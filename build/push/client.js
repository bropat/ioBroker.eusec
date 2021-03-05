"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PushClient = void 0;
const long_1 = __importDefault(require("long"));
const path_1 = __importDefault(require("path"));
const protobuf_typescript_1 = require("protobuf-typescript");
const tls = __importStar(require("tls"));
const tiny_typed_emitter_1 = require("tiny-typed-emitter");
const ts_log_1 = require("ts-log");
const models_1 = require("./models");
const parser_1 = require("./parser");
class PushClient extends tiny_typed_emitter_1.TypedEmitter {
    constructor(pushClientParser, auth, log = ts_log_1.dummyLogger) {
        super();
        this.HOST = "mtalk.google.com";
        this.PORT = 5228;
        this.MCS_VERSION = 41;
        this.HEARTBEAT_INTERVAL = 5 * 60 * 1000;
        this.loggedIn = false;
        this.streamId = 0;
        this.lastStreamIdReported = -1;
        this.currentDelay = 0;
        this.persistentIds = [];
        this.log = log;
        this.pushClientParser = pushClientParser;
        this.auth = auth;
    }
    static init(auth, log = ts_log_1.dummyLogger) {
        return __awaiter(this, void 0, void 0, function* () {
            this.proto = yield protobuf_typescript_1.load(path_1.default.join(__dirname, "./proto/mcs.proto"));
            const pushClientParser = yield parser_1.PushClientParser.init(log);
            return new PushClient(pushClientParser, auth, log);
        });
    }
    initialize() {
        this.loggedIn = false;
        this.streamId = 0;
        this.lastStreamIdReported = -1;
        if (this.client) {
            this.client.removeAllListeners();
            this.client.destroy();
            this.client = undefined;
        }
        this.pushClientParser.resetState();
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = undefined;
        }
    }
    getPersistentIds() {
        return this.persistentIds;
    }
    setPersistentIds(ids) {
        this.persistentIds = ids;
    }
    connect() {
        this.initialize();
        this.pushClientParser.on("message", (message) => this.handleParsedMessage(message));
        this.client = tls.connect(this.PORT, this.HOST, {
            rejectUnauthorized: false,
        });
        this.client.setKeepAlive(true);
        // For debugging purposes
        //this.client.enableTrace();
        this.client.on("connect", () => this.onSocketConnect());
        this.client.on("close", () => this.onSocketClose());
        this.client.on("error", (error) => this.onSocketError(error));
        this.client.on("data", (newData) => this.onSocketData(newData));
        this.client.write(this.buildLoginRequest());
    }
    buildLoginRequest() {
        const androidId = this.auth.androidId;
        const securityToken = this.auth.securityToken;
        const LoginRequestType = PushClient.proto.lookupType("mcs_proto.LoginRequest");
        const hexAndroidId = long_1.default.fromString(androidId).toString(16);
        const loginRequest = {
            adaptiveHeartbeat: false,
            authService: 2,
            authToken: securityToken,
            id: "chrome-63.0.3234.0",
            domain: "mcs.android.com",
            deviceId: `android-${hexAndroidId}`,
            networkType: 1,
            resource: androidId,
            user: androidId,
            useRmq2: true,
            setting: [{ name: "new_vc", value: "1" }],
            clientEvent: [],
            receivedPersistentId: this.persistentIds,
        };
        const errorMessage = LoginRequestType.verify(loginRequest);
        if (errorMessage) {
            throw new Error(errorMessage);
        }
        const buffer = LoginRequestType.encodeDelimited(loginRequest).finish();
        return Buffer.concat([Buffer.from([this.MCS_VERSION, models_1.MessageTag.LoginRequest]), buffer]);
    }
    buildHeartbeatPingRequest(stream_id) {
        const heartbeatPingRequest = {};
        if (stream_id) {
            heartbeatPingRequest.last_stream_id_received = stream_id;
        }
        this.log.debug(`${this.constructor.name}.buildHeartbeatPingRequest(): heartbeatPingRequest: ${JSON.stringify(heartbeatPingRequest)}`);
        const HeartbeatPingRequestType = PushClient.proto.lookupType("mcs_proto.HeartbeatPing");
        const errorMessage = HeartbeatPingRequestType.verify(heartbeatPingRequest);
        if (errorMessage) {
            throw new Error(errorMessage);
        }
        const buffer = HeartbeatPingRequestType.encodeDelimited(heartbeatPingRequest).finish();
        return Buffer.concat([Buffer.from([models_1.MessageTag.HeartbeatPing]), buffer]);
    }
    buildHeartbeatAckRequest(stream_id, status) {
        const heartbeatAckRequest = {};
        if (stream_id && !status) {
            heartbeatAckRequest.last_stream_id_received = stream_id;
        }
        else if (!stream_id && status) {
            heartbeatAckRequest.status = status;
        }
        else {
            heartbeatAckRequest.last_stream_id_received = stream_id;
            heartbeatAckRequest.status = status;
        }
        this.log.debug(`${this.constructor.name}.buildHeartbeatAckRequest(): heartbeatAckRequest: ${JSON.stringify(heartbeatAckRequest)}`);
        const HeartbeatAckRequestType = PushClient.proto.lookupType("mcs_proto.HeartbeatAck");
        const errorMessage = HeartbeatAckRequestType.verify(heartbeatAckRequest);
        if (errorMessage) {
            throw new Error(errorMessage);
        }
        const buffer = HeartbeatAckRequestType.encodeDelimited(heartbeatAckRequest).finish();
        return Buffer.concat([Buffer.from([models_1.MessageTag.HeartbeatAck]), buffer]);
    }
    onSocketData(newData) {
        this.pushClientParser.handleData(newData);
    }
    onSocketConnect() {
        //
    }
    onSocketClose() {
        this.loggedIn = false;
        if (this.heartbeatTimeout)
            clearTimeout(this.heartbeatTimeout);
        this.scheduleReconnect();
        this.emit("close");
    }
    onSocketError(error) {
        this.log.error(`${this.constructor.name}.onSocketError(): ${error}`);
    }
    handleParsedMessage(message) {
        this.resetCurrentDelay();
        switch (message.tag) {
            case models_1.MessageTag.DataMessageStanza:
                this.log.debug(`${this.constructor.name}.handleParsedMessage(): DataMessageStanza: message: ${JSON.stringify(message)}`);
                if (message.object && message.object.persistentId)
                    this.persistentIds.push(message.object.persistentId);
                this.emit("message", this.convertPayloadMessage(message));
                break;
            case models_1.MessageTag.HeartbeatPing:
                this.handleHeartbeatPing(message);
                break;
            case models_1.MessageTag.HeartbeatAck:
                this.handleHeartbeatAck(message);
                break;
            case models_1.MessageTag.Close:
                this.log.debug(`${this.constructor.name}.handleParsedMessage(): Close: Server requested close! message: ${JSON.stringify(message)}`);
                break;
            case models_1.MessageTag.LoginResponse:
                this.log.debug(`${this.constructor.name}.handleParsedMessage(): Login response: GCM -> logged in -> waiting for push messages!`);
                this.loggedIn = true;
                this.persistentIds = [];
                this.emit("connect");
                this.heartbeatTimeout = setTimeout(() => {
                    this.scheduleHeartbeat(this);
                }, this.getHeartbeatInterval());
                break;
            case models_1.MessageTag.LoginRequest:
                this.log.debug(`${this.constructor.name}.handleParsedMessage(): Login request: message: ${JSON.stringify(message)}`);
                break;
            case models_1.MessageTag.IqStanza:
                this.log.debug(`${this.constructor.name}.handleParsedMessage(): IqStanza: Not implemented! - message: ${JSON.stringify(message)}`);
                break;
            default:
                this.log.debug(`${this.constructor.name}.handleParsedMessage(): Unknown message: ${JSON.stringify(message)}`);
                return;
        }
        this.streamId++;
    }
    handleHeartbeatPing(message) {
        this.log.debug(`${this.constructor.name}.handleHeartbeatPing(): message: ${JSON.stringify(message)}`);
        let streamId = undefined;
        let status = undefined;
        if (this.newStreamIdAvailable()) {
            streamId = this.getStreamId();
        }
        if (message.object && message.object.status) {
            status = message.object.status;
        }
        if (this.client)
            this.client.write(this.buildHeartbeatAckRequest(streamId, status));
    }
    handleHeartbeatAck(message) {
        this.log.debug(`${this.constructor.name}.handleHeartbeatAck(): message: ${JSON.stringify(message)}`);
    }
    convertPayloadMessage(message) {
        const _a = message.object, { appData } = _a, otherData = __rest(_a, ["appData"]);
        const messageData = {};
        appData.forEach((kv) => {
            if (kv.key === "payload") {
                const payload = JSON.parse(Buffer.from(kv.value, "base64").toString("utf-8"));
                messageData[kv.key] = payload;
            }
            else {
                messageData[kv.key] = kv.value;
            }
        });
        return Object.assign(Object.assign({}, otherData), { payload: messageData });
    }
    getStreamId() {
        this.lastStreamIdReported = this.streamId;
        return this.streamId;
    }
    newStreamIdAvailable() {
        return this.lastStreamIdReported != this.streamId;
    }
    scheduleHeartbeat(client) {
        if (client.sendHeartbeat()) {
            this.heartbeatTimeout = setTimeout(() => {
                this.scheduleHeartbeat(client);
            }, client.getHeartbeatInterval());
        }
        else {
            this.log.debug(`${this.constructor.name}.scheduleHeartbeat(): disabled!`);
        }
    }
    sendHeartbeat() {
        let streamId = undefined;
        if (this.newStreamIdAvailable()) {
            streamId = this.getStreamId();
        }
        if (this.client && this.isConnected()) {
            this.log.debug(`${this.constructor.name}.sendHeartbeat(): streamId: ${streamId}`);
            this.client.write(this.buildHeartbeatPingRequest(streamId));
            return true;
        }
        else {
            this.log.debug(`${this.constructor.name}.sendHeartbeat(): No more connected, reconnect`);
            this.scheduleReconnect();
        }
        return false;
    }
    isConnected() {
        return this.loggedIn;
    }
    getHeartbeatInterval() {
        return this.HEARTBEAT_INTERVAL;
    }
    getCurrentDelay() {
        const delay = this.currentDelay == 0 ? 5000 : this.currentDelay;
        if (this.currentDelay < 60000)
            this.currentDelay += 10000;
        if (this.currentDelay >= 60000 && this.currentDelay < 600000)
            this.currentDelay += 60000;
        return delay;
    }
    resetCurrentDelay() {
        this.currentDelay = 0;
    }
    scheduleReconnect() {
        const delay = this.getCurrentDelay();
        this.log.debug(`${this.constructor.name}.scheduleReconnect(): delay: ${delay}`);
        if (!this.reconnectTimeout)
            this.reconnectTimeout = setTimeout(() => {
                this.connect();
            }, delay);
    }
    close() {
        this.initialize();
    }
}
exports.PushClient = PushClient;
PushClient.proto = null;
