import { createSocket, Socket } from "dgram";
import { Address, CmdCameraInfoResponse } from "./models";
import { sendMessage, hasHeader, buildCheckCamPayload, buildIntCommandPayload, buildIntStringCommandPayload, buildStringTypeCommandPayload, buildCommandHeader, MAGIC_WORD } from "./utils";
import { RequestMessageType, ResponseMessageType, EufyP2PDataType, CommandType } from "./types";
import { AlarmMode } from "../http/types";
import { EventEmitter } from "events";
import { P2PInterface } from "./interfaces";

export class EufyP2PClientProtocol extends EventEmitter implements P2PInterface {

    private addressTimeoutInMs = 3 * 1000;
    private socket: Socket;
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
        this.socket = createSocket("udp4");
        this.socket.bind(0);
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

        if (this.socket) {
            this.socket.removeAllListeners();
        }

        //TODO: Implement reconnect strategy?
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
                        this.connected = true;
                        this.emit("connected");
                        resolve(true);
                    }
                });

                this.sendCamCheck();
                timer = setTimeout(() => {
                    reject(`Timeout on connect to ${JSON.stringify(this.address)}`);
                }, this.addressTimeoutInMs);
            });
        }
        return false;
    }

    private sendCamCheck(): void {
        const payload = buildCheckCamPayload(this.p2pDid);
        sendMessage(this.socket, this.address, RequestMessageType.CHECK_CAM, payload);
    }

    public sendPing(): void {
        sendMessage(this.socket, this.address, RequestMessageType.PING);
    }

    public sendCommandWithIntString(commandType: CommandType, value: number, channel = 0): void {
        // SET_COMMAND_WITH_INT_STRING_TYPE = msgTypeID == 10
        const payload = buildIntStringCommandPayload(value, this.actor, channel);
        this.sendCommand(commandType, payload);
    }

    public sendCommandWithInt(commandType: CommandType, value: number): void {
        // SET_COMMAND_WITH_INT_TYPE = msgTypeID == 4
        const payload = buildIntCommandPayload(value, this.actor);
        this.sendCommand(commandType, payload);
    }

    public sendCommandWithString(commandType: CommandType, value: string): void {
        // SET_COMMAND_WITH_STRING_TYPE = msgTypeID == 6
        const payload = buildStringTypeCommandPayload(value, this.actor);
        this.sendCommand(commandType, payload);
    }

    private sendCommand(commandType: CommandType, payload: Buffer): void {
        // Command header
        const msgSeqNumber = this.seqNumber++;
        const commandHeader = buildCommandHeader(msgSeqNumber, commandType);
        const data = Buffer.concat([commandHeader, payload]);

        this.log.debug(`EufyP2PClientProtocol.connect(): Sending commandType: ${commandType} with seqNum: ${msgSeqNumber}...`);
        sendMessage(this.socket, this.address, RequestMessageType.DATA, data);
        // -> NOTE:
        // -> We could wait for an ACK and then continue (sync)
        // -> Python impl creating an array an putting an "event" behind a seqNumber
        // -> ACK-Listener triggers the seq-number and therefore showing that the message
        // -> is done, until then the promise is waiting (await)
    }

    private handleMsg(msg: Buffer): void {
        if (hasHeader(msg, ResponseMessageType.PONG)) {
            // Response to a ping from our side
            this.log.debug("EufyP2PClientProtocol.handleMsg(): received PONG");
            return;
        } else if (hasHeader(msg, ResponseMessageType.PING)) {
            // Response with PONG to keep alive
            //this.log.debug("EufyP2PClientProtocol.handleMsg(): received PING, respond with PONG");
            sendMessage(this.socket, this.address, RequestMessageType.PONG);
            return;
        } else if (hasHeader(msg, ResponseMessageType.END)) {
            // Connection is closed by device
            this.log.debug("EufyP2PClientProtocol.handleMsg(): received END");
            this.connected = false;
            this.socket.close();
            this.emit("disconnected");
            return;
        } else if (hasHeader(msg, ResponseMessageType.CAM_ID)) {
            // Answer from the device to a CAM_CHECK message
            this.log.debug("EufyP2PClientProtocol.handleMsg(): received CAM_ID");
            return;
        } else if (hasHeader(msg, ResponseMessageType.ACK)) {
            // Device ACK a message from our side
            // Number of Acks sended in the message
            const numAcksBuffer = msg.slice(6, 8);
            const numAcks = numAcksBuffer.readUIntBE(0, numAcksBuffer.length);
            for (let i = 1; i <= numAcks; i++) {
                const idx = 6 + i * 2;
                const seqBuffer = msg.slice(idx, idx + 2);
                const ackedSeqNo = seqBuffer.readUIntBE(0, seqBuffer.length);
                // -> Message with seqNo was received at the station
                this.log.debug(`EufyP2PClientProtocol.handleMsg(): received ACK for squence ${ackedSeqNo}`);
            }
        } else if (hasHeader(msg, ResponseMessageType.DATA)) {
            const seqNo = msg[6] * 256 + msg[7];
            const dataTypeBuffer = msg.slice(4, 6);
            const dataType = this.toDataTypeName(dataTypeBuffer);

            if (this.seenSeqNo[dataType] !== undefined && this.seenSeqNo[dataType] >= seqNo) {
                // We have already seen this message, skip!
                // This can happen because the device is sending the message till it gets a ACK
                // which can take some time.
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
            const commandId = msg.slice(12, 14).readUIntLE(0, 2); // could also be the parameter type on DATA events (1224 = GUARD)
            const data = msg.slice(24, 26).readUIntLE(0, 2); // 0 = Away, 1 = Home, 63 = Deactivated
            // Note: data === 65420 when e.g. data mode is already set (guardMode=0, setting guardMode=0 => 65420)
            // Note: data === 65430 when there is an error (sending data to a channel which do not exist)
            const commandStr = CommandType[commandId];
            this.log.debug(`EufyP2PClientProtocol.handleData(): commandId: ${commandStr} (${commandId}) - data: ${data}`);
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
            Object.keys(messages)
                .sort() // assure the seqNumbers are in correct order
                .forEach((key: string) => {
                    completeMessage = Buffer.concat([completeMessage, messages[parseInt(key)]]);
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
        if (this.socket && this.connected)
            await sendMessage(this.socket, this.address, RequestMessageType.END);
    }
}