import { createSocket, Socket } from "dgram";
import { Address, CmdCameraInfoResponse, CommandResult } from "./models";
import { sendMessage, hasHeader, buildCheckCamPayload, buildIntCommandPayload, buildIntStringCommandPayload, buildCommandHeader, MAGIC_WORD, buildCommandWithStringTypePayload } from "./utils";
import { RequestMessageType, ResponseMessageType, EufyP2PDataType, CommandType, ErrorCode } from "./types";
import { AlarmMode } from "../http/types";
import { EventEmitter } from "events";
import { P2PInterface, P2PMessageState } from "./interfaces";

export class EufyP2PClientProtocol extends EventEmitter implements P2PInterface {

    private readonly MAX_RETRIES = 5;
    private readonly MAX_COMMAND_RESULT_WAIT = 15 * 1000;
    private readonly MAX_AKNOWLEDGE_TIMEOUT = 3 * 1000;
    private readonly HEARTBEAT_INTERVAL = 15 * 1000;

    private socket!: Socket;
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

    private message_states: Map<number, P2PMessageState> = new Map<number, P2PMessageState>();

    private heartbeatTimeout?: NodeJS.Timeout;
    private connectTime: number | null = null;
    private lastPong: number | null = null;

    private address: Address;
    private p2pDid: string;
    private actor: string;
    private log: ioBroker.Logger;

    constructor(address: Address, p2pDid: string, actor: string, log: ioBroker.Logger) {
        super();
        this.address = address;
        this.p2pDid = p2pDid;
        this.actor = actor;
        this.log = log;
        this.initialize();
    }

    private initialize(): void {
        this.currentControlMessageBuilder = {
            bytesToRead: 0,
            bytesRead: 0,
            commandId: 0,
            messages: {},
        };
        this.connected = false;
        this.seqNumber = 0;
        this.seenSeqNo = {};
        this.message_states.clear();
        this.connectTime = null;
        this.lastPong = null;

        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = undefined;
        }

        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.close();
        }
        this.socket = createSocket("udp4");
        this.socket.bind(0);
    }

    public isConnected(): boolean {
        return this.connected;
    }

    public async connect(): Promise<boolean> {
        if (!this.connected) {
            return new Promise((resolve, reject) => {
                let timer: NodeJS.Timeout | null = null;

                this.socket.once("message", (msg) => {
                    if (hasHeader(msg, ResponseMessageType.CAM_ID)) {
                        this.log.debug("EufyP2PClientProtocol.connect(): connected!");
                        if (!!timer) {
                            clearTimeout(timer);
                        }
                        this.socket.on("message", (msg) => this.handleMsg(msg));
                        this.socket.on("error", (error) => this.onError(error));
                        this.socket.on("close", () => this.onClose());
                        this.connected = true;
                        this.connectTime = new Date().getTime();
                        this.heartbeatTimeout = setTimeout(() => {
                            this.scheduleHeartbeat();
                        }, this.getHeartbeatInterval());
                        this.emit("connected");
                        resolve(true);
                    }
                });

                this.sendCamCheck();
                timer = setTimeout(() => {
                    reject(`Timeout on connect to ${JSON.stringify(this.address)}`);
                }, this.MAX_AKNOWLEDGE_TIMEOUT);
            });
        }
        return false;
    }

    private sendCamCheck(): void {
        const payload = buildCheckCamPayload(this.p2pDid);
        sendMessage(this.socket, this.address, RequestMessageType.CHECK_CAM, payload);
    }

    public sendPing(): void {
        if ((this.lastPong && ((new Date().getTime() - this.lastPong) / this.getHeartbeatInterval() >= 5)) ||
            (this.connectTime && !this.lastPong && ((new Date().getTime() - this.connectTime) / this.getHeartbeatInterval() >= 5))) {
            this.log.warn(`EufyP2PClientProtocol.sendPing(): Heartbeat check failed. Connection seems lost. Try to reconnect...`);
            this.initialize();
            this.emit("disconnected");
        }
        sendMessage(this.socket, this.address, RequestMessageType.PING);
    }

    public sendCommandWithIntString(commandType: CommandType, value: number, channel = 0): void {
        // SET_COMMAND_WITH_INT_STRING_TYPE = msgTypeID == 10
        const payload = buildIntStringCommandPayload(value, this.actor, channel);
        this.sendCommand(commandType, payload, channel);
    }

    public sendCommandWithInt(commandType: CommandType, value: number, channel = 255): void {
        // SET_COMMAND_WITH_INT_TYPE = msgTypeID == 4
        const payload = buildIntCommandPayload(value, this.actor, channel);
        this.sendCommand(commandType, payload, channel);
    }

    public sendCommandWithString(commandType: CommandType, value: string, channel = 0): void {
        // SET_COMMAND_WITH_STRING_TYPE = msgTypeID == 6
        //const payload = buildStringTypeCommandPayload(value, this.actor);
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
        sendMessage(this.socket, this.address, RequestMessageType.DATA, message.data);
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
            this.initialize();
            this.emit("disconnected");
        }
    }

    private handleMsg(msg: Buffer): void {
        if (hasHeader(msg, ResponseMessageType.PONG)) {
            // Response to a ping from our side
            this.lastPong = new Date().getTime();
            return;
        } else if (hasHeader(msg, ResponseMessageType.PING)) {
            // Response with PONG to keep alive
            sendMessage(this.socket, this.address, RequestMessageType.PONG);
            return;
        } else if (hasHeader(msg, ResponseMessageType.END)) {
            // Connection is closed by device
            this.log.debug("EufyP2PClientProtocol.handleMsg(): received END");
            this.initialize();
            this.emit("disconnected");
            return;
        } else if (hasHeader(msg, ResponseMessageType.CAM_ID)) {
            // Answer from the device to a CAM_CHECK message
            this.log.debug("EufyP2PClientProtocol.handleMsg(): received CAM_ID");
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
                this.log.debug(`EufyP2PClientProtocol.handleMsg(): received ACK for datatype ${dataType} sequence ${ackedSeqNo}`);
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

            this.log.debug(`EufyP2PClientProtocol.handleMsg(): received DATA - Processing ${dataType} with sequence ${seqNo}...`);
            this.sendAck(dataTypeBuffer, seqNo);
            this.handleData(seqNo, dataType, msg);
        } else {
            this.log.debug(`EufyP2PClientProtocol.handleMsg(): received unknown message - msg.length: ${msg.length} msg: ${msg.toString("hex")}`);
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
            //this.parseBinaryMessage(seqNo, msg);
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
                //this.emit("data", commandId, message.readUIntBE(0, 1) as AlarmMode);
                break;
            case CommandType.CMD_CAMERA_INFO:
                this.log.debug(`EufyP2PClientProtocol.handleDataControl(): Camera info: ${message.toString()}`);
                this.emit("camera_info", JSON.parse(message.toString()) as CmdCameraInfoResponse);
                //this.emit("data", commandId, JSON.parse(message.toString()) as CmdCameraInfoResponse);
                break;
        }
    }

    private sendAck(dataType: Buffer, seqNo: number): void {
        const num_pending_acks = 1;
        const pendingAcksBuffer = Buffer.from([Math.floor(num_pending_acks / 256), num_pending_acks % 256]);
        const seqBuffer = Buffer.from([Math.floor(seqNo / 256), seqNo % 256]);
        const payload = Buffer.concat([dataType, pendingAcksBuffer, seqBuffer]);
        sendMessage(this.socket, this.address, RequestMessageType.ACK, payload);
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
        if (this.socket && this.connected) {
            await sendMessage(this.socket, this.address, RequestMessageType.END);
        } else {
            this.initialize();
        }
    }

    private getHeartbeatInterval(): number {
        return this.HEARTBEAT_INTERVAL;
    }

    private onClose(): void {
        /*if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = undefined;
        }*/
        this.log.debug("EufyP2PClientProtocol.onClose(): ");
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