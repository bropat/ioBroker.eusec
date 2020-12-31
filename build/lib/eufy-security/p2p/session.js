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
const types_2 = require("../http/types");
const events_1 = require("events");
class EufyP2PClientProtocol extends events_1.EventEmitter {
    constructor(p2p_did, dsk_key, log) {
        super();
        this.MAX_RETRIES = 5;
        this.MAX_COMMAND_RESULT_WAIT = 15 * 1000;
        this.MAX_AKNOWLEDGE_TIMEOUT = 3 * 1000;
        this.MAX_LOOKUP_TIMEOUT = 10 * 1000;
        this.HEARTBEAT_INTERVAL = 5 * 1000;
        this.binded = false;
        this.connected = false;
        this.seqNumber = 0;
        this.seenSeqNo = {};
        this.currentControlMessageBuilder = {
            bytesToRead: 0,
            bytesRead: 0,
            commandId: 0,
            messages: {},
        };
        this.cloud_addresses = [
            { host: "18.197.212.165", port: 32100 },
            { host: "34.235.4.153", port: 32100 },
            { host: "54.153.101.7", port: 32100 },
            { host: "18.223.127.200", port: 32100 },
            { host: "54.223.148.206", port: 32100 },
            { host: "13.251.222.7", port: 32100 },
        ];
        this.message_states = new Map();
        this.address_lookups = {};
        this.connectTime = null;
        this.lastPong = null;
        this.addresses = [];
        this.current_address = 0;
        this.p2p_did = p2p_did;
        this.dsk_key = dsk_key;
        this.log = log;
        this.socket = dgram_1.createSocket("udp4");
        this.socket.on("message", (msg, rinfo) => this.handleMsg(msg, rinfo));
        this.socket.on("error", (error) => this.onError(error));
        this.socket.on("close", () => this.onClose());
    }
    _clearHeartbeat() {
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = undefined;
        }
    }
    _disconnected() {
        this._clearHeartbeat();
        this.connected = false;
        this.lastPong = null;
        this.connectTime = null;
        this.emit("disconnected");
    }
    lookup() {
        this.cloud_addresses.map((address) => this.lookupByAddress(address, this.p2p_did, this.dsk_key));
        if (this.lookupTimeout)
            clearTimeout(this.lookupTimeout);
        this.lookupTimeout = setTimeout(() => {
            this.log.error(`EufyP2PClientProtocol.lookup(): All address lookup tentatives failed.`);
            this._disconnected();
        }, this.MAX_LOOKUP_TIMEOUT);
    }
    lookupByAddress(address, p2pDid, dskKey) {
        // Send lookup message
        const msgId = types_1.RequestMessageType.LOOKUP_WITH_KEY;
        const payload = utils_1.buildLookupWithKeyPayload(this.socket, p2pDid, dskKey);
        utils_1.sendMessage(this.socket, address, msgId, payload);
    }
    isConnected() {
        return this.connected;
    }
    _connect() {
        this.log.debug(`EufyP2PClientProtocol.connect(): Connecting to host ${this.addresses[this.current_address].host} on port ${this.addresses[this.current_address].port}...`);
        for (let i = 0; i < 4; i++)
            this.sendCamCheck();
        this.connectTimeout = setTimeout(() => {
            if (this.addresses.length - 1 > this.current_address) {
                this.log.warn(`EufyP2PClientProtocol.connect(): Could not connect to host ${this.addresses[this.current_address].host} on port ${this.addresses[this.current_address].port}! Try next one...`);
                this.current_address++;
                this._connect();
                return;
            }
            else {
                this.log.warn(`EufyP2PClientProtocol.connect(): Tried all hosts, no connection could be established.`);
                this._disconnected();
            }
        }, this.MAX_AKNOWLEDGE_TIMEOUT);
    }
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.connected) {
                if (this.addresses.length === 0) {
                    if (!this.binded)
                        this.socket.bind(0, () => {
                            this.binded = true;
                            this.lookup();
                        });
                    else
                        this.lookup();
                }
                else {
                    this._connect();
                }
            }
        });
    }
    sendCamCheck(port) {
        const payload = utils_1.buildCheckCamPayload(this.p2p_did);
        if (port) {
            utils_1.sendMessage(this.socket, { host: this.addresses[this.current_address].host, port: port }, types_1.RequestMessageType.CHECK_CAM, payload);
        }
        else
            utils_1.sendMessage(this.socket, this.addresses[this.current_address], types_1.RequestMessageType.CHECK_CAM, payload);
    }
    sendPing() {
        if ((this.lastPong && ((new Date().getTime() - this.lastPong) / this.getHeartbeatInterval() >= this.MAX_RETRIES)) ||
            (this.connectTime && !this.lastPong && ((new Date().getTime() - this.connectTime) / this.getHeartbeatInterval() >= this.MAX_RETRIES))) {
            this.log.warn(`EufyP2PClientProtocol.sendPing(): Heartbeat check failed. Connection seems lost. Try to reconnect...`);
            this._disconnected();
        }
        utils_1.sendMessage(this.socket, this.addresses[this.current_address], types_1.RequestMessageType.PING);
    }
    sendCommandWithIntString(commandType, value, admin_user_id, channel = 0) {
        // SET_COMMAND_WITH_INT_STRING_TYPE = msgTypeID == 10
        const payload = utils_1.buildIntStringCommandPayload(value, admin_user_id, channel);
        this.sendCommand(commandType, payload, channel);
    }
    sendCommandWithInt(commandType, value, admin_user_id, channel = 255) {
        // SET_COMMAND_WITH_INT_TYPE = msgTypeID == 4
        const payload = utils_1.buildIntCommandPayload(value, admin_user_id, channel);
        this.sendCommand(commandType, payload, channel);
    }
    sendCommandWithString(commandType, value, channel = 0) {
        // SET_COMMAND_WITH_STRING_TYPE = msgTypeID == 6
        const payload = utils_1.buildCommandWithStringTypePayload(value, channel);
        let nested_commandType = undefined;
        if (commandType == types_1.CommandType.CMD_SET_PAYLOAD) {
            try {
                const json = JSON.parse(value);
                nested_commandType = json.cmd;
            }
            catch (error) {
                this.log.error(`EufyP2PClientProtocol.sendCommandWithString(): Error: ${error}`);
            }
        }
        this.sendCommand(commandType, payload, channel, nested_commandType);
    }
    sendCommand(commandType, payload, channel, nested_commandType) {
        // Command header
        const msgSeqNumber = this.seqNumber++;
        const commandHeader = utils_1.buildCommandHeader(msgSeqNumber, commandType);
        const data = Buffer.concat([commandHeader, payload]);
        const message = {
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
    _sendCommand(message) {
        var _a;
        this.log.debug(`EufyP2PClientProtocol._sendCommand(): sequence: ${message.sequence} command_type: ${message.command_type} channel: ${message.channel} retries: ${message.retries} message_states.size: ${this.message_states.size}`);
        utils_1.sendMessage(this.socket, this.addresses[this.current_address], types_1.RequestMessageType.DATA, message.data);
        if (message.retries < this.MAX_RETRIES) {
            const msg = this.message_states.get(message.sequence);
            if (msg) {
                msg.retries++;
                msg.timeout = setTimeout(() => {
                    this._sendCommand(msg);
                }, this.MAX_AKNOWLEDGE_TIMEOUT);
            }
        }
        else {
            this.log.error(`EufyP2PClientProtocol._sendCommand(): Max retries ${(_a = this.message_states.get(message.sequence)) === null || _a === void 0 ? void 0 : _a.retries} - stop with error for sequence: ${message.sequence} command_type: ${message.command_type} channel: ${message.channel} retries: ${message.retries}`);
            this.emit("command", {
                command_type: message.nested_command_type !== undefined ? message.nested_command_type : message.command_type,
                channel: message.channel,
                return_code: -1
            });
            this.message_states.delete(message.sequence);
            this.log.warn(`EufyP2PClientProtocol._sendCommand(): Connection seems lost. Try to reconnect...`);
            this._disconnected();
        }
    }
    handleMsg(msg, rinfo) {
        if (utils_1.hasHeader(msg, types_1.ResponseMessageType.LOOKUP_ADDR)) {
            const port = msg[7] * 256 + msg[6];
            const ip = `${msg[11]}.${msg[10]}.${msg[9]}.${msg[8]}`;
            this.log.debug(`EufyP2PClientProtocol.handleMsg(): LOOKUP_ADDR - Got response from host ${rinfo.address}:${rinfo.port}: ip: ${ip} port: ${port}`);
            if (this.addresses.length === 2 && this.connected) {
                this.log.debug(`EufyP2PClientProtocol.handleMsg(): LOOKUP_ADDR - Addresses already got, ignoring response from host ${rinfo.address}:${rinfo.port}: ip: ${ip} port: ${port}`);
            }
            else {
                if (ip === "0.0.0.0") {
                    this.log.debug(`EufyP2PClientProtocol.handleMsg(): LOOKUP_ADDR - Got invalid ip address 0.0.0.0, ignoring response!`);
                    return;
                }
                const tmp = this.address_lookups[`${rinfo.address}:${rinfo.port}`];
                if (tmp) {
                    if (!tmp.includes({ host: ip, port: port }))
                        if (utils_1.isPrivateIp(ip)) {
                            tmp.unshift({ host: ip, port: port });
                        }
                        else {
                            tmp.push({ host: ip, port: port });
                        }
                    this.address_lookups[`${rinfo.address}:${rinfo.port}`] = tmp;
                }
                else {
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
        }
        else if (utils_1.hasHeader(msg, types_1.ResponseMessageType.CAM_ID)) {
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
            }
            else {
                this.log.debug("EufyP2PClientProtocol.handleMsg(): CAM_ID - Already connected, ignoring...");
            }
        }
        else if (utils_1.hasHeader(msg, types_1.ResponseMessageType.PONG)) {
            // Response to a ping from our side
            this.lastPong = new Date().getTime();
            return;
        }
        else if (utils_1.hasHeader(msg, types_1.ResponseMessageType.PING)) {
            // Response with PONG to keep alive
            utils_1.sendMessage(this.socket, this.addresses[this.current_address], types_1.RequestMessageType.PONG);
            return;
        }
        else if (utils_1.hasHeader(msg, types_1.ResponseMessageType.END)) {
            // Connection is closed by device
            this.log.debug(`EufyP2PClientProtocol.handleMsg(): END - received from host ${rinfo.address}:${rinfo.port}`);
            this.socket.close();
            return;
        }
        else if (utils_1.hasHeader(msg, types_1.ResponseMessageType.ACK)) {
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
                        });
                    }, this.MAX_COMMAND_RESULT_WAIT);
                }
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
                this.sendAck(dataTypeBuffer, seqNo);
                return;
            }
            this.seenSeqNo[dataType] = seqNo;
            this.log.debug(`EufyP2PClientProtocol.handleMsg(): DATA - received from host ${rinfo.address}:${rinfo.port} - Processing ${dataType} with sequence ${seqNo}...`);
            this.sendAck(dataTypeBuffer, seqNo);
            this.handleData(seqNo, dataType, msg);
        }
        else {
            this.log.debug(`EufyP2PClientProtocol.handleMsg(): received unknown message from host ${rinfo.address}:${rinfo.port} - msg.length: ${msg.length} msg: ${msg.toString("hex")}`);
        }
    }
    handleData(seqNo, dataType, msg) {
        if (dataType === "CONTROL") {
            this.parseDataControlMessage(seqNo, msg);
        }
        else if (dataType === "DATA") {
            const commandId = msg.slice(12, 14).readUIntLE(0, 2);
            const return_code = msg.slice(24, 28).readUInt32LE() | 0;
            const commandStr = types_1.CommandType[commandId];
            const error_codeStr = types_1.ErrorCode[return_code];
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
                    });
                    this.log.debug(`EufyP2PClientProtocol.handleData(): Result data for command received - message: ${JSON.stringify(msg_state)} result: ${error_codeStr} (${return_code})`);
                    this.message_states.delete(seqNo);
                }
                else {
                    this.log.warn(`EufyP2PClientProtocol.handleData(): data_type: ${dataType} commandtype and sequencenumber different!!!`);
                }
            }
            else {
                this.log.warn(`EufyP2PClientProtocol.handleData(): data_type: ${dataType} sequence: ${seqNo} not present!!!`);
            }
            this.log.debug(`EufyP2PClientProtocol.handleData(): commandId: ${commandStr} (${commandId}) - result: ${error_codeStr} (${return_code}) - msg: ${msg.toString("hex")}`);
        }
        else if (dataType === "BINARY") {
            this.log.debug(`EufyP2PClientProtocol.handleData(): Binary data: seqNo: ${seqNo} - dataType: ${dataType} - msg: ${msg.toString("hex")}`);
        }
        else {
            this.log.debug(`EufyP2PClientProtocol.handleData(): Data to handle: seqNo: ${seqNo} - dataType: ${dataType} - msg: ${msg.toString("hex")}`);
        }
    }
    parseDataControlMessage(seqNo, msg) {
        // is this the first message?
        const firstPartMessage = msg.slice(8, 12).toString() === utils_1.MAGIC_WORD;
        if (firstPartMessage) {
            const commandId = msg.slice(12, 14).readUIntLE(0, 2);
            this.currentControlMessageBuilder.commandId = commandId;
            const bytesToRead = msg.slice(14, 16).readUIntLE(0, 2);
            this.currentControlMessageBuilder.bytesToRead = bytesToRead;
            const payload = msg.slice(24);
            this.currentControlMessageBuilder.messages[seqNo] = payload;
            this.currentControlMessageBuilder.bytesRead += payload.byteLength;
        }
        else {
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
                .forEach((key) => {
                completeMessage = Buffer.concat([completeMessage, messages[key]]);
            });
            this.currentControlMessageBuilder = { bytesRead: 0, bytesToRead: 0, commandId: 0, messages: {} };
            this.handleDataControl(commandId, completeMessage);
        }
    }
    handleDataControl(commandId, message) {
        this.log.debug(`EufyP2PClientProtocol.handleDataControl(): DATA - CONTROL message with commandId: ${types_1.CommandType[commandId]} (${commandId}) - message: ${message.toString("hex")}`);
        switch (commandId) {
            case types_1.CommandType.CMD_GET_ALARM_MODE:
                this.log.debug(`EufyP2PClientProtocol.handleDataControl(): Alarm mode changed to: ${types_2.AlarmMode[message.readUIntBE(0, 1)]}`);
                this.emit("alarm_mode", message.readUIntBE(0, 1));
                break;
            case types_1.CommandType.CMD_CAMERA_INFO:
                this.log.debug(`EufyP2PClientProtocol.handleDataControl(): Camera info: ${message.toString()}`);
                this.emit("camera_info", JSON.parse(message.toString()));
                break;
        }
    }
    sendAck(dataType, seqNo) {
        const num_pending_acks = 1;
        const pendingAcksBuffer = Buffer.from([Math.floor(num_pending_acks / 256), num_pending_acks % 256]);
        const seqBuffer = Buffer.from([Math.floor(seqNo / 256), seqNo % 256]);
        const payload = Buffer.concat([dataType, pendingAcksBuffer, seqBuffer]);
        utils_1.sendMessage(this.socket, this.addresses[this.current_address], types_1.RequestMessageType.ACK, payload);
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
        else if (input.compare(types_1.EufyP2PDataType.BINARY) === 0) {
            return "BINARY";
        }
        return "unknown";
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.socket) {
                if (this.connected)
                    yield utils_1.sendMessage(this.socket, this.addresses[this.current_address], types_1.RequestMessageType.END);
                else
                    this.socket.close();
            }
        });
    }
    getHeartbeatInterval() {
        return this.HEARTBEAT_INTERVAL;
    }
    onClose() {
        this.log.debug("EufyP2PClientProtocol.onClose(): ");
        this._disconnected();
    }
    onError(error) {
        this.log.debug(`EufyP2PClientProtocol.onError(): Error: ${error}`);
    }
    scheduleHeartbeat() {
        if (this.isConnected()) {
            this.sendPing();
            this.heartbeatTimeout = setTimeout(() => {
                this.scheduleHeartbeat();
            }, this.getHeartbeatInterval());
        }
        else {
            this.log.debug("EufyP2PClientProtocol.scheduleHeartbeat(): disabled!");
        }
    }
}
exports.EufyP2PClientProtocol = EufyP2PClientProtocol;
