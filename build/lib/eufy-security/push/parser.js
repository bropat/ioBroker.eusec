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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PushClientParser = void 0;
/* eslint-disable @typescript-eslint/no-non-null-assertion */
const events_1 = require("events");
const path_1 = __importDefault(require("path"));
const protobuf_typescript_1 = require("protobuf-typescript");
const models_1 = require("./models");
class PushClientParser extends events_1.EventEmitter {
    constructor(log) {
        super();
        this.state = models_1.ProcessingState.MCS_VERSION_TAG_AND_SIZE;
        this.data = Buffer.alloc(0);
        this.isWaitingForData = true;
        this.sizePacketSoFar = 0;
        this.messageSize = 0;
        this.messageTag = 0;
        this.handshakeComplete = false;
        this.log = log;
    }
    resetState() {
        this.state = models_1.ProcessingState.MCS_VERSION_TAG_AND_SIZE;
        this.data = Buffer.alloc(0);
        this.isWaitingForData = true;
        this.sizePacketSoFar = 0;
        this.messageSize = 0;
        this.messageTag = 0;
        this.handshakeComplete = false;
        this.removeAllListeners();
    }
    static init(log) {
        return __awaiter(this, void 0, void 0, function* () {
            this.proto = yield protobuf_typescript_1.load(path_1.default.join(__dirname, "./proto/mcs.proto"));
            return new PushClientParser(log);
        });
    }
    handleData(newData) {
        this.data = Buffer.concat([this.data, newData]);
        if (this.isWaitingForData) {
            this.isWaitingForData = false;
            this.waitForData();
        }
    }
    waitForData() {
        const minBytesNeeded = this.getMinBytesNeeded();
        // If we don't have all bytes yet, wait some more
        if (this.data.length < minBytesNeeded) {
            this.isWaitingForData = true;
            return;
        }
        else {
            this.handleFullMessage();
        }
    }
    handleFullMessage() {
        switch (this.state) {
            case models_1.ProcessingState.MCS_VERSION_TAG_AND_SIZE:
                this.onGotVersion();
                break;
            case models_1.ProcessingState.MCS_TAG_AND_SIZE:
                this.onGotMessageTag();
                break;
            case models_1.ProcessingState.MCS_SIZE:
                this.onGotMessageSize();
                break;
            case models_1.ProcessingState.MCS_PROTO_BYTES:
                this.onGotMessageBytes();
                break;
            default:
                this.log.warn(`PushClientParser.handleFullMessage(): Unknown state: ${this.state}`);
                break;
        }
    }
    onGotVersion() {
        const version = this.data.readInt8(0);
        this.data = this.data.slice(1);
        if (version < 41 && version !== 38) {
            throw new Error(`Got wrong version: ${version}`);
        }
        // Process the LoginResponse message tag.
        this.onGotMessageTag();
    }
    onGotMessageTag() {
        this.messageTag = this.data.readInt8(0);
        this.data = this.data.slice(1);
        this.onGotMessageSize();
    }
    onGotMessageSize() {
        let incompleteSizePacket = false;
        const reader = new protobuf_typescript_1.BufferReader(this.data);
        try {
            this.messageSize = reader.int32();
        }
        catch (error) {
            if (error.message.startsWith("index out of range:")) {
                incompleteSizePacket = true;
            }
            else {
                throw new Error(error);
            }
        }
        if (incompleteSizePacket) {
            this.sizePacketSoFar = reader.pos;
            this.state = models_1.ProcessingState.MCS_SIZE;
            this.waitForData();
            return;
        }
        this.data = this.data.slice(reader.pos);
        this.sizePacketSoFar = 0;
        if (this.messageSize > 0) {
            this.state = models_1.ProcessingState.MCS_PROTO_BYTES;
            this.waitForData();
        }
        else {
            this.onGotMessageBytes();
        }
    }
    onGotMessageBytes() {
        const protobuf = this.buildProtobufFromTag(this.messageTag);
        if (this.messageSize === 0) {
            this.emit("message", { tag: this.messageTag, object: {} });
            this.getNextMessage();
            return;
        }
        if (this.data.length < this.messageSize) {
            this.state = models_1.ProcessingState.MCS_PROTO_BYTES;
            this.waitForData();
            return;
        }
        const buffer = this.data.slice(0, this.messageSize);
        this.data = this.data.slice(this.messageSize);
        const message = protobuf.decode(buffer);
        const object = protobuf.toObject(message, {
            longs: String,
            enums: String,
            bytes: Buffer,
        });
        this.emit("message", { tag: this.messageTag, object: object });
        if (this.messageTag === models_1.MessageTag.LoginResponse) {
            if (this.handshakeComplete) {
                this.log.error("PushClientParser.onGotMessageBytes(): Unexpected login response!");
            }
            else {
                this.handshakeComplete = true;
            }
        }
        this.getNextMessage();
    }
    getNextMessage() {
        this.messageTag = 0;
        this.messageSize = 0;
        this.state = models_1.ProcessingState.MCS_TAG_AND_SIZE;
        this.waitForData();
    }
    getMinBytesNeeded() {
        switch (this.state) {
            case models_1.ProcessingState.MCS_VERSION_TAG_AND_SIZE:
                return 1 + 1 + 1;
            case models_1.ProcessingState.MCS_TAG_AND_SIZE:
                return 1 + 1;
            case models_1.ProcessingState.MCS_SIZE:
                return this.sizePacketSoFar + 1;
            case models_1.ProcessingState.MCS_PROTO_BYTES:
                return this.messageSize;
            default:
                throw new Error(`Unknown state: ${this.state}`);
        }
    }
    buildProtobufFromTag(messageTag) {
        switch (messageTag) {
            case models_1.MessageTag.HeartbeatPing:
                return PushClientParser.proto.lookupType("mcs_proto.HeartbeatPing");
            case models_1.MessageTag.HeartbeatAck:
                return PushClientParser.proto.lookupType("mcs_proto.HeartbeatAck");
            case models_1.MessageTag.LoginRequest:
                return PushClientParser.proto.lookupType("mcs_proto.LoginRequest");
            case models_1.MessageTag.LoginResponse:
                return PushClientParser.proto.lookupType("mcs_proto.LoginResponse");
            case models_1.MessageTag.Close:
                return PushClientParser.proto.lookupType("mcs_proto.Close");
            case models_1.MessageTag.IqStanza:
                return PushClientParser.proto.lookupType("mcs_proto.IqStanza");
            case models_1.MessageTag.DataMessageStanza:
                return PushClientParser.proto.lookupType("mcs_proto.DataMessageStanza");
            case models_1.MessageTag.StreamErrorStanza:
                return PushClientParser.proto.lookupType("mcs_proto.StreamErrorStanza");
            default:
                throw new Error(`Unknown tag: ${this.messageTag}`);
        }
    }
}
exports.PushClientParser = PushClientParser;
PushClientParser.proto = null;
