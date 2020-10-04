import { createSocket, Socket } from "dgram";
import { Address } from "./models";
import { sendMessage, hasHeader, buildCheckCamPayload, intToBufferLE, intToBufferBE, buildIntCommandPayload, buildIntStringCommandPayload } from "./utils";
import { RequestMessageType, ResponseMessageType, EufyP2PDataType } from "./types";

export class EufyP2PClientProtocol {

    private addressTimeoutInMs = 3 * 1000;
    private socket: Socket;
    private connected = false;
    private seqNumber = 0;
    private seenSeqNo: {
        [dataType: string]: number;
    } = {};
    private address: Address;
    private p2pDid: string;
    private actor: string;
    private log: ioBroker.Logger;

    constructor(address: Address, p2pDid: string, actor: string, log: ioBroker.Logger) {
        this.address = address;
        this.p2pDid = p2pDid;
        this.actor = actor;
        this.log = log;
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
                        this.connected = true;
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

    public sendCommandWithIntString(commandType: number, value: number, channel: number): void {
        const payload = buildIntStringCommandPayload(value, this.actor, channel);
        this.sendCommand(commandType, payload);
    }

    public sendCommandWithInt(commandType: number, value: number): void {
        const payload = buildIntCommandPayload(value, this.actor);
        this.sendCommand(commandType, payload);
    }

    private sendCommand(commandType: number, payload: Buffer): void {
        // Command header
        const msgSeqNumber = this.seqNumber++;
        const dataTypeBuffer = Buffer.from([0xd1, 0x00]);
        const seqAsBuffer = intToBufferBE(msgSeqNumber, 2);
        const magicString = Buffer.from("XZYH");
        const commandTypeBuffer = intToBufferLE(commandType, 2);
        const commandHeader = Buffer.concat([dataTypeBuffer, seqAsBuffer, magicString, commandTypeBuffer]);
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
            this.log.debug("EufyP2PClientProtocol.handleMsg(): received PING, respond with PONG");
            sendMessage(this.socket, this.address, RequestMessageType.PONG);
            return;
        } else if (hasHeader(msg, ResponseMessageType.END)) {
            // Connection is closed by device
            this.log.debug("EufyP2PClientProtocol.handleMsg(): received END");
            this.connected = false;
            this.socket.close();
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
            this.log.debug(`EufyP2PClientProtocol.handleMsg(): received unknown message - msg.length: ${msg.length} msg: ${msg}`);
        }
    }

    public handleData(seqNo: number, dataType: string, msg: Buffer): void {
        this.log.debug(`EufyP2PClientProtocol.handleData(): Data to handle: seqNo: ${seqNo} - dataType: ${dataType} - msg: ${msg.toString("hex")}`);

        const commandId = msg.slice(12, 14).readUIntLE(0, 2); // could also be the parameter type on DATA events (1224 = GUARD)
        const data = msg.slice(24, 26).readUIntLE(0, 2); // 0 = Away, 1 = Home, 63 = Deactivated
        // Note: data === 65420 when e.g. data mode is already set (guardMode=0, setting guardMode=0 => 65420)
        this.log.debug(`EufyP2PClientProtocol.handleData(): commandId: ${commandId} - data: ${data}`);
        //TODO: Implement responses - for example Eufy protocol keepalive
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
        }
        return "unknown";
    }

    public async close(): Promise<void> {
        if (this.socket && this.connected)
            await sendMessage(this.socket, this.address, RequestMessageType.END);
    }
}