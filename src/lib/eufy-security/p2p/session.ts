import { createSocket, Socket, RemoteInfo } from "dgram";
import { Address, CmdCameraInfoResponse, CommandResult } from "./models";
import { sendMessage, hasHeader, buildCheckCamPayload, buildIntCommandPayload, buildIntStringCommandPayload, buildCommandHeader, MAGIC_WORD, buildCommandWithStringTypePayload, isPrivateIp, buildLookupWithKeyPayload } from "./utils";
import { RequestMessageType, ResponseMessageType, EufyP2PDataType, CommandType, ErrorCode } from "./types";
import { AlarmMode } from "../http/types";
import { EventEmitter } from "events";
import { LookupAdresses, P2PInterface, P2PMessageState } from "./interfaces";

export class EufyP2PClientProtocol extends EventEmitter implements P2PInterface {

    private readonly MAX_RETRIES = 5;
    private readonly MAX_COMMAND_RESULT_WAIT = 15 * 1000;
    private readonly MAX_AKNOWLEDGE_TIMEOUT = 3 * 1000;
    private readonly MAX_LOOKUP_TIMEOUT = 10 * 1000;
    private readonly HEARTBEAT_INTERVAL = 5 * 1000;

    private socket!: Socket;
    private binded = false;
    private connected = false;

    private seqNumber = 0;
    private seenSeqNo: {
        [dataType: string]: number;
    } = {};

    private currentControlMessageBuilder: {
        bytesToRead: number;
        bytesRead: number;
        commandId: number;
        messages: { [seqNo: number]: Buffer };
    } = {
        bytesToRead: 0,
        bytesRead: 0,
        commandId: 0,
        messages: {},
    };

    private cloud_addresses: Array<Address> = [
        { host: "18.197.212.165", port: 32100 },    // Germany Frankfurt
        { host: "34.235.4.153", port: 32100 },      // USA Ashburn
        { host: "54.153.101.7", port: 32100 },      // USA San Francisco
        { host: "18.223.127.200", port: 32100 },    // USA Columbus
        { host: "54.223.148.206", port: 32100 },    // China Beijing
        { host: "13.251.222.7", port: 32100 },      // Singapore
    ];

    private message_states: Map<number, P2PMessageState> = new Map<number, P2PMessageState>();
    private address_lookups: LookupAdresses = {};

    private connectTimeout?: NodeJS.Timeout;
    private lookupTimeout?: NodeJS.Timeout;
    private heartbeatTimeout?: NodeJS.Timeout;
    private connectTime: number | null = null;
    private lastPong: number | null = null;

    private addresses: Array<Address> = [];
    private current_address = 0;
    private p2p_did: string;
    private dsk_key: string;
    private log: ioBroker.Logger;

    constructor(p2p_did: string, dsk_key: string, log: ioBroker.Logger) {
        super();
        this.p2p_did = p2p_did;
        this.dsk_key = dsk_key;
        this.log = log;

        this.socket = createSocket("udp4");
        this.socket.on("message", (msg, rinfo) => this.handleMsg(msg, rinfo));
        this.socket.on("error", (error) => this.onError(error));
        this.socket.on("close", () => this.onClose());
    }

    private _clearHeartbeat(): void {
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = undefined;
        }
    }

    private _disconnected(): void {
        this._clearHeartbeat();
        this.connected = false;
        this.lastPong = null;
        this.connectTime = null;
        this.emit("disconnected");
    }

    public lookup(): void {
        this.cloud_addresses.map((address) => this.lookupByAddress(address, this.p2p_did, this.dsk_key));

        if (this.lookupTimeout)
            clearTimeout(this.lookupTimeout);

        this.lookupTimeout = setTimeout(() => {
            this.log.error(`EufyP2PClientProtocol.lookup(): All address lookup tentatives failed.`);
            this._disconnected();
        }, this.MAX_LOOKUP_TIMEOUT);
    }

    private lookupByAddress(address: Address, p2pDid: string, dskKey: string): void {
        // Send lookup message
        const msgId = RequestMessageType.LOOKUP_WITH_KEY;
        const payload = buildLookupWithKeyPayload(this.socket, p2pDid, dskKey);
        sendMessage(this.socket, address, msgId, payload);
    }

    public isConnected(): boolean {
        return this.connected;
    }

    private _connect(): void {
        this.log.debug(`EufyP2PClientProtocol.connect(): Connecting to host ${this.addresses[this.current_address].host} on port ${this.addresses[this.current_address].port}...`);
        for (let i = 0; i < 4; i++)
            this.sendCamCheck();

        this.connectTimeout = setTimeout(() => {
            if (this.addresses.length - 1 > this.current_address) {
                this.log.warn(`EufyP2PClientProtocol.connect(): Could not connect to host ${this.addresses[this.current_address].host} on port ${this.addresses[this.current_address].port}! Try next one...`);
                this.current_address++;
                this._connect();
                return;
            } else {
                this.log.warn(`EufyP2PClientProtocol.connect(): Tried all hosts, no connection could be established.`);
                this._disconnected();
            }
        }, this.MAX_AKNOWLEDGE_TIMEOUT);
    }

    public async connect(): Promise<void> {
        if (!this.connected) {
            if (this.addresses.length === 0) {
                if (!this.binded)
                    this.socket.bind(0, () => {
                        this.binded = true;
                        this.lookup();
                    });
                else
                    this.lookup();
            } else {
                this._connect();
            }
        }
    }

    private sendCamCheck(port?: number): void {
        const payload = buildCheckCamPayload(this.p2p_did);
        if (port) {
            sendMessage(this.socket, { host: this.addresses[this.current_address].host, port: port}, RequestMessageType.CHECK_CAM, payload);
        } else
            sendMessage(this.socket, this.addresses[this.current_address], RequestMessageType.CHECK_CAM, payload);
    }

    public sendPing(): void {
        if ((this.lastPong && ((new Date().getTime() - this.lastPong) / this.getHeartbeatInterval() >= this.MAX_RETRIES)) ||
            (this.connectTime && !this.lastPong && ((new Date().getTime() - this.connectTime) / this.getHeartbeatInterval() >= this.MAX_RETRIES))) {
            this.log.warn(`EufyP2PClientProtocol.sendPing(): Heartbeat check failed. Connection seems lost. Try to reconnect...`);
            this._disconnected();
        }
        sendMessage(this.socket, this.addresses[this.current_address], RequestMessageType.PING);
    }

    public sendCommandWithIntString(commandType: CommandType, value: number, admin_user_id: string, channel = 0): void {
        // SET_COMMAND_WITH_INT_STRING_TYPE = msgTypeID == 10
        const payload = buildIntStringCommandPayload(value, admin_user_id, channel);
        this.sendCommand(commandType, payload, channel);
    }

    public sendCommandWithInt(commandType: CommandType, value: number, admin_user_id: string, channel = 255): void {
        // SET_COMMAND_WITH_INT_TYPE = msgTypeID == 4
        const payload = buildIntCommandPayload(value, admin_user_id, channel);
        this.sendCommand(commandType, payload, channel);
    }

    public sendCommandWithString(commandType: CommandType, value: string, channel = 0): void {
        // SET_COMMAND_WITH_STRING_TYPE = msgTypeID == 6
        const payload = buildCommandWithStringTypePayload(value, channel);
        let nested_commandType = undefined;

        if (commandType == CommandType.CMD_SET_PAYLOAD) {
            try {
                const json = JSON.parse(value);
                nested_commandType = json.cmd;
            } catch (error) {
                this.log.error(`EufyP2PClientProtocol.sendCommandWithString(): Error: ${error}`);
            }
        }

        this.sendCommand(commandType, payload, channel, nested_commandType);
    }

    private sendCommand(commandType: CommandType, payload: Buffer, channel: number, nested_commandType?: CommandType): void {
        // Command header
        const msgSeqNumber = this.seqNumber++;
        const commandHeader = buildCommandHeader(msgSeqNumber, commandType);
        const data = Buffer.concat([commandHeader, payload]);

        const message: P2PMessageState = {
            sequence: msgSeqNumber,
            command_type: commandType,
            nested_command_type: nested_commandType,
            channel: channel,
            data: data,
            retries: 0,
            acknowledged: false,
            return_code: -1
        };
        this.message_states.set(msgSeqNumber, message);

        this._sendCommand(message);
    }

    private _sendCommand(message: P2PMessageState): void {
        this.log.debug(`EufyP2PClientProtocol._sendCommand(): sequence: ${message.sequence} command_type: ${message.command_type} channel: ${message.channel} retries: ${message.retries} message_states.size: ${this.message_states.size}`);
        sendMessage(this.socket, this.addresses[this.current_address], RequestMessageType.DATA, message.data);
        if (message.retries < this.MAX_RETRIES) {
            const msg = this.message_states.get(message.sequence);
            if (msg) {
                msg.retries++;
                msg.timeout = setTimeout(() => {
                    this._sendCommand(msg);
                }, this.MAX_AKNOWLEDGE_TIMEOUT);
            }
        } else {
            this.log.error(`EufyP2PClientProtocol._sendCommand(): Max retries ${this.message_states.get(message.sequence)?.retries} - stop with error for sequence: ${message.sequence} command_type: ${message.command_type} channel: ${message.channel} retries: ${message.retries}`);
            this.emit("command", {
                command_type: message.nested_command_type !== undefined ? message.nested_command_type : message.command_type,
                channel: message.channel,
                return_code: -1
            } as CommandResult);
            this.message_states.delete(message.sequence);
            this.log.warn(`EufyP2PClientProtocol._sendCommand(): Connection seems lost. Try to reconnect...`);
            this._disconnected();
        }
    }

    private handleMsg(msg: Buffer, rinfo: RemoteInfo): void {
        if (hasHeader(msg, ResponseMessageType.LOOKUP_ADDR)) {
            const port = msg[7] * 256 + msg[6];
            const ip = `${msg[11]}.${msg[10]}.${msg[9]}.${msg[8]}`;

            this.log.debug(`EufyP2PClientProtocol.handleMsg(): LOOKUP_ADDR - Got response from host ${rinfo.address}:${rinfo.port}: ip: ${ip} port: ${port}`);

            if (this.addresses.length === 2 && this.connected) {
                this.log.debug(`EufyP2PClientProtocol.handleMsg(): LOOKUP_ADDR - Addresses already got, ignoring response from host ${rinfo.address}:${rinfo.port}: ip: ${ip} port: ${port}`);
            } else {
                if (ip === "0.0.0.0") {
                    this.log.debug(`EufyP2PClientProtocol.handleMsg(): LOOKUP_ADDR - Got invalid ip address 0.0.0.0, ignoring response!`);
                    return;
                }
                const tmp = this.address_lookups[`${rinfo.address}:${rinfo.port}`];
                if (tmp) {
                    if (!tmp.includes({ host: ip, port: port }))
                        if (isPrivateIp(ip)) {
                            tmp.unshift({ host: ip, port: port });
                        } else {
                            tmp.push({ host: ip, port: port });
                        }
                    this.address_lookups[`${rinfo.address}:${rinfo.port}`] = tmp;
                } else {
                    this.address_lookups[`${rinfo.address}:${rinfo.port}`] = [{ host: ip, port: port }];
                }
                if (this.address_lookups[`${rinfo.address}:${rinfo.port}`].length === 2 && !!this.lookupTimeout) {
                    this.addresses = this.address_lookups[`${rinfo.address}:${rinfo.port}`];
                    this.address_lookups = {};
                    clearTimeout(this.lookupTimeout);
                    this.lookupTimeout = undefined;
                    this.log.debug(`EufyP2PClientProtocol.handleMsg(): Got addresses (${JSON.stringify(this.addresses)})! Try to connect...`);
                    this._connect();
                }
            }
        } else if (hasHeader(msg, ResponseMessageType.CAM_ID)) {
            // Answer from the device to a CAM_CHECK message
            this.log.debug(`EufyP2PClientProtocol.handleMsg(): CAM_ID - received from host ${rinfo.address}:${rinfo.port}`);
            if (!this.connected) {
                this.log.debug("EufyP2PClientProtocol.handleMsg(): CAM_ID - Connected!");
                if (!!this.connectTimeout) {
                    clearTimeout(this.connectTimeout);
                }
                this.connected = true;
                this.connectTime = new Date().getTime();
                this.lastPong = null;
                this.heartbeatTimeout = setTimeout(() => {
                    this.scheduleHeartbeat();
                }, this.getHeartbeatInterval());
                this.emit("connected", this.addresses[this.current_address]);
            } else {
                this.log.debug("EufyP2PClientProtocol.handleMsg(): CAM_ID - Already connected, ignoring...");
            }
        } else if (hasHeader(msg, ResponseMessageType.PONG)) {
            // Response to a ping from our side
            this.lastPong = new Date().getTime();
            return;
        } else if (hasHeader(msg, ResponseMessageType.PING)) {
            // Response with PONG to keep alive
            sendMessage(this.socket, this.addresses[this.current_address], RequestMessageType.PONG);
            return;
        } else if (hasHeader(msg, ResponseMessageType.END)) {
            // Connection is closed by device
            this.log.debug(`EufyP2PClientProtocol.handleMsg(): END - received from host ${rinfo.address}:${rinfo.port}`);
            this.socket.close();
            return;
        } else if (hasHeader(msg, ResponseMessageType.ACK)) {
            // Device ACK a message from our side
            // Number of Acks sended in the message
            const dataTypeBuffer = msg.slice(4, 6);
            const dataType = this.toDataTypeName(dataTypeBuffer);
            const numAcksBuffer = msg.slice(6, 8);
            const numAcks = numAcksBuffer.readUIntBE(0, numAcksBuffer.length);
            for (let i = 1; i <= numAcks; i++) {
                const idx = 6 + i * 2;
                const seqBuffer = msg.slice(idx, idx + 2);
                const ackedSeqNo = seqBuffer.readUIntBE(0, seqBuffer.length);
                // -> Message with seqNo was received at the station
                this.log.debug(`EufyP2PClientProtocol.handleMsg(): ACK - received from host ${rinfo.address}:${rinfo.port} for datatype ${dataType} sequence ${ackedSeqNo}`);
                const msg_state = this.message_states.get(ackedSeqNo);
                if (msg_state && !msg_state.acknowledged) {
                    msg_state.acknowledged = true;
                    if (msg_state.timeout) {
                        clearTimeout(msg_state.timeout);
                    }
                    msg_state.timeout = setTimeout(() => {
                        this.log.warn(`EufyP2PClientProtocol.handleMsg(): Result data for command not received - message: ${JSON.stringify(msg_state)}`);
                        this.message_states.delete(ackedSeqNo);
                        this.emit("command", {
                            command_type: msg_state.nested_command_type !== undefined ? msg_state.nested_command_type : msg_state.command_type,
                            channel: msg_state.channel,
                            return_code: -1
                        } as CommandResult);
                    }, this.MAX_COMMAND_RESULT_WAIT);
                }
            }
        } else if (hasHeader(msg, ResponseMessageType.DATA)) {
            const seqNo = msg[6] * 256 + msg[7];
            const dataTypeBuffer = msg.slice(4, 6);
            const dataType = this.toDataTypeName(dataTypeBuffer);

            if (this.seenSeqNo[dataType] !== undefined && this.seenSeqNo[dataType] >= seqNo) {
                // We have already seen this message, skip!
                // This can happen because the device is sending the message till it gets a ACK
                // which can take some time.
                this.sendAck(dataTypeBuffer, seqNo);
                return;
            }
            this.seenSeqNo[dataType] = seqNo;

            this.log.debug(`EufyP2PClientProtocol.handleMsg(): DATA - received from host ${rinfo.address}:${rinfo.port} - Processing ${dataType} with sequence ${seqNo}...`);
            this.sendAck(dataTypeBuffer, seqNo);
            this.handleData(seqNo, dataType, msg);
        } else {
            this.log.debug(`EufyP2PClientProtocol.handleMsg(): received unknown message from host ${rinfo.address}:${rinfo.port} - msg.length: ${msg.length} msg: ${msg.toString("hex")}`);
        }
    }

    private handleData(seqNo: number, dataType: string, msg: Buffer): void {
        if (dataType === "CONTROL") {
            this.parseDataControlMessage(seqNo, msg);
        } else if (dataType === "DATA") {
            const commandId = msg.slice(12, 14).readUIntLE(0, 2);
            const return_code = msg.slice(24, 28).readUInt32LE()|0;

            const commandStr = CommandType[commandId];
            const error_codeStr = ErrorCode[return_code];

            const msg_state = this.message_states.get(seqNo);

            if (msg_state) {
                if (msg_state.command_type === commandId) {
                    if (msg_state.timeout) {
                        clearTimeout(msg_state.timeout);
                    }
                    this.emit("command", {
                        command_type: msg_state.nested_command_type !== undefined ? msg_state.nested_command_type : msg_state.command_type,
                        channel: msg_state.channel,
                        return_code: return_code
                    } as CommandResult);
                    this.log.debug(`EufyP2PClientProtocol.handleData(): Result data for command received - message: ${JSON.stringify(msg_state)} result: ${error_codeStr} (${return_code})`);
                    this.message_states.delete(seqNo);
                } else {
                    this.log.warn(`EufyP2PClientProtocol.handleData(): data_type: ${dataType} commandtype and sequencenumber different!!!`);
                }
            } else {
                this.log.warn(`EufyP2PClientProtocol.handleData(): data_type: ${dataType} sequence: ${seqNo} not present!!!`);
            }
            this.log.debug(`EufyP2PClientProtocol.handleData(): commandId: ${commandStr} (${commandId}) - result: ${error_codeStr} (${return_code}) - msg: ${msg.toString("hex")}`);
        } else if (dataType === "BINARY") {
            this.log.debug(`EufyP2PClientProtocol.handleData(): Binary data: seqNo: ${seqNo} - dataType: ${dataType} - msg: ${msg.toString("hex")}`);
        } else {
            this.log.debug(`EufyP2PClientProtocol.handleData(): Data to handle: seqNo: ${seqNo} - dataType: ${dataType} - msg: ${msg.toString("hex")}`);
        }
    }

    private parseDataControlMessage(seqNo: number, msg: Buffer): void {
        // is this the first message?
        const firstPartMessage = msg.slice(8, 12).toString() === MAGIC_WORD;

        if (firstPartMessage) {
            const commandId = msg.slice(12, 14).readUIntLE(0, 2);
            this.currentControlMessageBuilder.commandId = commandId;

            const bytesToRead = msg.slice(14, 16).readUIntLE(0, 2);
            this.currentControlMessageBuilder.bytesToRead = bytesToRead;

            const payload = msg.slice(24);
            this.currentControlMessageBuilder.messages[seqNo] = payload;
            this.currentControlMessageBuilder.bytesRead += payload.byteLength;
        } else {
            // finish message and print
            const payload = msg.slice(8);
            this.currentControlMessageBuilder.messages[seqNo] = payload;
            this.currentControlMessageBuilder.bytesRead += payload.byteLength;
        }

        if (this.currentControlMessageBuilder.bytesRead >= this.currentControlMessageBuilder.bytesToRead) {
            const commandId = this.currentControlMessageBuilder.commandId;
            const messages = this.currentControlMessageBuilder.messages;
            // sort by keys
            let completeMessage = Buffer.from([]);
            Object.keys(messages).map(Number)
                .sort((a, b) => a - b) // assure the seqNumbers are in correct order
                .forEach((key: number) => {
                    completeMessage = Buffer.concat([completeMessage, messages[key]]);
                });
            this.currentControlMessageBuilder = { bytesRead: 0, bytesToRead: 0, commandId: 0, messages: {} };
            this.handleDataControl(commandId, completeMessage);
        }
    }

    private handleDataControl(commandId: number, message: Buffer): void {
        this.log.debug(`EufyP2PClientProtocol.handleDataControl(): DATA - CONTROL message with commandId: ${CommandType[commandId]} (${commandId}) - message: ${message.toString("hex")}`);
        switch(commandId) {
            case CommandType.CMD_GET_ALARM_MODE:
                this.log.debug(`EufyP2PClientProtocol.handleDataControl(): Alarm mode changed to: ${AlarmMode[message.readUIntBE(0, 1)]}`);
                this.emit("alarm_mode", message.readUIntBE(0, 1) as AlarmMode);
                break;
            case CommandType.CMD_CAMERA_INFO:
                this.log.debug(`EufyP2PClientProtocol.handleDataControl(): Camera info: ${message.toString()}`);
                this.emit("camera_info", JSON.parse(message.toString()) as CmdCameraInfoResponse);
                break;
        }
    }

    private sendAck(dataType: Buffer, seqNo: number): void {
        const num_pending_acks = 1;
        const pendingAcksBuffer = Buffer.from([Math.floor(num_pending_acks / 256), num_pending_acks % 256]);
        const seqBuffer = Buffer.from([Math.floor(seqNo / 256), seqNo % 256]);
        const payload = Buffer.concat([dataType, pendingAcksBuffer, seqBuffer]);
        sendMessage(this.socket, this.addresses[this.current_address], RequestMessageType.ACK, payload);
    }

    private toDataTypeName(input: Buffer): string {
        if (input.compare(EufyP2PDataType.DATA) === 0) {
            return "DATA";
        } else if (input.compare(EufyP2PDataType.VIDEO) === 0) {
            return "VIDEO";
        } else if (input.compare(EufyP2PDataType.CONTROL) === 0) {
            return "CONTROL";
        } else if (input.compare(EufyP2PDataType.BINARY) === 0) {
            return "BINARY";
        }
        return "unknown";
    }

    public async close(): Promise<void> {
        if (this.socket) {
            if (this.connected)
                await sendMessage(this.socket, this.addresses[this.current_address], RequestMessageType.END);
            else
                this.socket.close();
        }
    }

    private getHeartbeatInterval(): number {
        return this.HEARTBEAT_INTERVAL;
    }

    private onClose(): void {
        this.log.debug("EufyP2PClientProtocol.onClose(): ");
        this._disconnected();
    }

    private onError(error: any): void {
        this.log.debug(`EufyP2PClientProtocol.onError(): Error: ${error}`);
    }

    private scheduleHeartbeat(): void {
        if (this.isConnected()) {
            this.sendPing();
            this.heartbeatTimeout = setTimeout(() => {
                this.scheduleHeartbeat();
            }, this.getHeartbeatInterval());
        } else {
            this.log.debug("EufyP2PClientProtocol.scheduleHeartbeat(): disabled!");
        }
    }
}