"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EufyP2PClientProtocol = void 0;
const dgram_1 = require("dgram");
const utils_1 = require("./utils");
const types_1 = require("./types");
class EufyP2PClientProtocol {
    constructor(address, p2pDid, actor, log) {
        this.addressTimeoutInMs = 3 * 1000;
        this.connected = false;
        this.seqNumber = 0;
        this.seenSeqNo = {};
        this.address = address;
        this.p2pDid = p2pDid;
        this.actor = actor;
        this.log = log;
        this.socket = dgram_1.createSocket("udp4");
        this.socket.bind(0);
    }
    isConnected() {
        return this.connected;
    }
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.connected) {
                return new Promise((resolve, reject) => {
                    let timer = null;
                    this.socket.once("message", (msg) => {
                        if (utils_1.hasHeader(msg, types_1.ResponseMessageType.CAM_ID)) {
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
        });
    }
    sendCamCheck() {
        const payload = utils_1.buildCheckCamPayload(this.p2pDid);
        utils_1.sendMessage(this.socket, this.address, types_1.RequestMessageType.CHECK_CAM, payload);
    }
    sendPing() {
        utils_1.sendMessage(this.socket, this.address, types_1.RequestMessageType.PING);
    }
    sendCommandWithIntString(commandType, value, channel) {
        const payload = utils_1.buildIntStringCommandPayload(value, this.actor, channel);
        this.sendCommand(commandType, payload);
    }
    sendCommandWithInt(commandType, value) {
        const payload = utils_1.buildIntCommandPayload(value, this.actor);
        this.sendCommand(commandType, payload);
    }
    sendCommand(commandType, payload) {
        // Command header
        const msgSeqNumber = this.seqNumber++;
        const dataTypeBuffer = Buffer.from([0xd1, 0x00]);
        const seqAsBuffer = utils_1.intToBufferBE(msgSeqNumber, 2);
        const magicString = Buffer.from("XZYH");
        const commandTypeBuffer = utils_1.intToBufferLE(commandType, 2);
        const commandHeader = Buffer.concat([dataTypeBuffer, seqAsBuffer, magicString, commandTypeBuffer]);
        const data = Buffer.concat([commandHeader, payload]);
        this.log.debug(`EufyP2PClientProtocol.connect(): Sending commandType: ${commandType} with seqNum: ${msgSeqNumber}...`);
        utils_1.sendMessage(this.socket, this.address, types_1.RequestMessageType.DATA, data);
        // -> NOTE:
        // -> We could wait for an ACK and then continue (sync)
        // -> Python impl creating an array an putting an "event" behind a seqNumber
        // -> ACK-Listener triggers the seq-number and therefore showing that the message
        // -> is done, until then the promise is waiting (await)
    }
    handleMsg(msg) {
        if (utils_1.hasHeader(msg, types_1.ResponseMessageType.PONG)) {
            // Response to a ping from our side
            this.log.debug("EufyP2PClientProtocol.handleMsg(): received PONG");
            return;
        }
        else if (utils_1.hasHeader(msg, types_1.ResponseMessageType.PING)) {
            // Response with PONG to keep alive
            this.log.debug("EufyP2PClientProtocol.handleMsg(): received PING, respond with PONG");
            utils_1.sendMessage(this.socket, this.address, types_1.RequestMessageType.PONG);
            return;
        }
        else if (utils_1.hasHeader(msg, types_1.ResponseMessageType.END)) {
            // Connection is closed by device
            this.log.debug("EufyP2PClientProtocol.handleMsg(): received END");
            this.connected = false;
            this.socket.close();
            return;
        }
        else if (utils_1.hasHeader(msg, types_1.ResponseMessageType.CAM_ID)) {
            // Answer from the device to a CAM_CHECK message
            this.log.debug("EufyP2PClientProtocol.handleMsg(): received CAM_ID");
            return;
        }
        else if (utils_1.hasHeader(msg, types_1.ResponseMessageType.ACK)) {
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
        }
        else if (utils_1.hasHeader(msg, types_1.ResponseMessageType.DATA)) {
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
        }
        else {
            this.log.debug(`EufyP2PClientProtocol.handleMsg(): received unknown message - msg.length: ${msg.length} msg: ${msg}`);
        }
    }
    handleData(seqNo, dataType, msg) {
        this.log.debug(`EufyP2PClientProtocol.handleData(): Data to handle: seqNo: ${seqNo} - dataType: ${dataType} - msg: ${msg.toString("hex")}`);
        const commandId = msg.slice(12, 14).readUIntLE(0, 2); // could also be the parameter type on DATA events (1224 = GUARD)
        const data = msg.slice(24, 26).readUIntLE(0, 2); // 0 = Away, 1 = Home, 63 = Deactivated
        // Note: data === 65420 when e.g. data mode is already set (guardMode=0, setting guardMode=0 => 65420)
        this.log.debug(`EufyP2PClientProtocol.handleData(): commandId: ${commandId} - data: ${data}`);
        //TODO: Implement responses - for example Eufy protocol keepalive
    }
    sendAck(dataType, seqNo) {
        const num_pending_acks = 1;
        const pendingAcksBuffer = Buffer.from([Math.floor(num_pending_acks / 256), num_pending_acks % 256]);
        const seqBuffer = Buffer.from([Math.floor(seqNo / 256), seqNo % 256]);
        const payload = Buffer.concat([dataType, pendingAcksBuffer, seqBuffer]);
        utils_1.sendMessage(this.socket, this.address, types_1.RequestMessageType.ACK, payload);
    }
    toDataTypeName(input) {
        if (input.compare(types_1.EufyP2PDataType.DATA) === 0) {
            return "DATA";
        }
        else if (input.compare(types_1.EufyP2PDataType.VIDEO) === 0) {
            return "VIDEO";
        }
        else if (input.compare(types_1.EufyP2PDataType.CONTROL) === 0) {
            return "CONTROL";
        }
        return "unknown";
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.socket && this.connected)
                yield utils_1.sendMessage(this.socket, this.address, types_1.RequestMessageType.END);
        });
    }
}
exports.EufyP2PClientProtocol = EufyP2PClientProtocol;
