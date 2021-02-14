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
exports.decryptAESData = exports.getNewRSAPrivateKey = exports.getRSAPrivateKey = exports.sortP2PMessageParts = exports.buildCommandWithStringTypePayload = exports.buildCommandHeader = exports.hasHeader = exports.sendMessage = exports.buildIntStringCommandPayload = exports.buildStringTypeCommandPayload = exports.buildIntCommandPayload = exports.buildCheckCamPayload = exports.buildLookupWithKeyPayload = exports.isPrivateIp = exports.MAGIC_WORD = void 0;
const node_rsa_1 = __importDefault(require("node-rsa"));
const crypto_js_1 = __importDefault(require("crypto-js"));
const types_1 = require("./types");
exports.MAGIC_WORD = "XZYH";
const isPrivateIp = (ip) => /^(::f{4}:)?10\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})$/i.test(ip) ||
    /^(::f{4}:)?192\.168\.([0-9]{1,3})\.([0-9]{1,3})$/i.test(ip) ||
    /^(::f{4}:)?172\.(1[6-9]|2\d|30|31)\.([0-9]{1,3})\.([0-9]{1,3})$/i.test(ip) ||
    /^(::f{4}:)?127\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})$/i.test(ip) ||
    /^(::f{4}:)?169\.254\.([0-9]{1,3})\.([0-9]{1,3})$/i.test(ip) ||
    /^f[cd][0-9a-f]{2}:/i.test(ip) ||
    /^fe80:/i.test(ip) ||
    /^::1$/.test(ip) ||
    /^::$/.test(ip);
exports.isPrivateIp = isPrivateIp;
const stringWithLength = (input, targetByteLength = 128) => {
    const stringAsBuffer = Buffer.from(input);
    const postZeros = Buffer.alloc(targetByteLength - stringAsBuffer.byteLength);
    return Buffer.concat([stringAsBuffer, postZeros]);
};
const p2pDidToBuffer = (p2pDid) => {
    const p2pArray = p2pDid.split("-");
    const buf1 = stringWithLength(p2pArray[0], 8);
    const buf2 = Buffer.allocUnsafe(4);
    buf2.writeUInt32BE(Number.parseInt(p2pArray[1]), 0);
    const buf3 = stringWithLength(p2pArray[2], 8);
    return Buffer.concat([buf1, buf2, buf3], 20);
};
const buildLookupWithKeyPayload = (socket, p2pDid, dskKey) => {
    const p2pDidBuffer = p2pDidToBuffer(p2pDid);
    const port = socket.address().port;
    const portAsBuffer = Buffer.allocUnsafe(2);
    portAsBuffer.writeUInt16LE(port, 0);
    const ip = socket.address().address;
    const temp_buff = [];
    ip.split(".").reverse().forEach(element => {
        temp_buff.push(Number.parseInt(element));
    });
    const ipAsBuffer = Buffer.from(temp_buff);
    const splitter = Buffer.from([0x00, 0x00]);
    const magic = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0x04, 0x00, 0x00]);
    const dskKeyAsBuffer = Buffer.from(dskKey);
    const fourEmpty = Buffer.from([0x00, 0x00, 0x00, 0x00]);
    return Buffer.concat([p2pDidBuffer, splitter, portAsBuffer, ipAsBuffer, magic, dskKeyAsBuffer, fourEmpty]);
};
exports.buildLookupWithKeyPayload = buildLookupWithKeyPayload;
const buildCheckCamPayload = (p2pDid) => {
    const p2pDidBuffer = p2pDidToBuffer(p2pDid);
    const magic = Buffer.from([0x00, 0x00, 0x00]);
    return Buffer.concat([p2pDidBuffer, magic]);
};
exports.buildCheckCamPayload = buildCheckCamPayload;
const buildIntCommandPayload = (value, strValue = "", channel = 255) => {
    const emptyBuffer = Buffer.from([0x00, 0x00]);
    const magicBuffer = Buffer.from([0x01, 0x00]);
    const channelBuffer = Buffer.from([channel, 0x00]);
    const valueBuffer = Buffer.allocUnsafe(4);
    valueBuffer.writeUInt32LE(value, 0);
    const headerBuffer = Buffer.allocUnsafe(2);
    const strValueBuffer = strValue.length === 0 ? Buffer.from([]) : stringWithLength(strValue);
    headerBuffer.writeUInt16LE(valueBuffer.length + strValueBuffer.length, 0);
    return Buffer.concat([
        headerBuffer,
        emptyBuffer,
        magicBuffer,
        channelBuffer,
        emptyBuffer,
        valueBuffer,
        strValueBuffer
    ]);
};
exports.buildIntCommandPayload = buildIntCommandPayload;
const buildStringTypeCommandPayload = (strValue, strValueSub, channel = 255) => {
    const emptyBuffer = Buffer.from([0x00, 0x00]);
    const magicBuffer = Buffer.from([0x01, 0x00]);
    const channelBuffer = Buffer.from([channel, 0x00]);
    const someBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00]);
    const strValueBuffer = stringWithLength(strValue);
    const strValueSubBuffer = stringWithLength(strValueSub);
    const headerBuffer = Buffer.allocUnsafe(2);
    headerBuffer.writeUInt16LE(someBuffer.length + strValueBuffer.length + strValueSubBuffer.length, 0);
    return Buffer.concat([
        headerBuffer,
        emptyBuffer,
        magicBuffer,
        channelBuffer,
        emptyBuffer,
        someBuffer,
        strValueBuffer,
        strValueSubBuffer
    ]);
};
exports.buildStringTypeCommandPayload = buildStringTypeCommandPayload;
const buildIntStringCommandPayload = (value, valueSub = 0, strValue = "", strValueSub = "", channel = 0) => {
    const emptyBuffer = Buffer.from([0x00, 0x00]);
    const magicBuffer = Buffer.from([0x01, 0x00]);
    const channelBuffer = Buffer.from([channel, 0x00]);
    const someintBuffer = Buffer.allocUnsafe(4);
    someintBuffer.writeUInt32LE(valueSub, 0);
    const valueBuffer = Buffer.allocUnsafe(4);
    valueBuffer.writeUInt32LE(value, 0);
    const strValueBuffer = strValue.length === 0 ? Buffer.from([]) : stringWithLength(strValue);
    const strValueSubBuffer = strValueSub.length === 0 ? Buffer.from([]) : stringWithLength(strValueSub);
    const headerBuffer = Buffer.allocUnsafe(2);
    headerBuffer.writeUInt16LE(someintBuffer.length + valueBuffer.length + strValueBuffer.length + strValueSubBuffer.length, 0);
    return Buffer.concat([
        headerBuffer,
        emptyBuffer,
        magicBuffer,
        channelBuffer,
        emptyBuffer,
        someintBuffer,
        valueBuffer,
        strValueBuffer,
        strValueSubBuffer
    ]);
};
exports.buildIntStringCommandPayload = buildIntStringCommandPayload;
const sendMessage = (socket, address, msgID, payload) => __awaiter(void 0, void 0, void 0, function* () {
    if (!payload)
        payload = Buffer.from([]);
    const payloadLen = Buffer.allocUnsafe(2);
    payloadLen.writeUInt16BE(payload.length, 0);
    const message = Buffer.concat([msgID, payloadLen, payload], 4 + payload.length);
    return new Promise((resolve, reject) => {
        socket.send(message, address.port, address.host, (err, bytes) => {
            return err ? reject(err) : resolve(bytes);
        });
    });
});
exports.sendMessage = sendMessage;
const hasHeader = (msg, searchedType) => {
    const header = Buffer.allocUnsafe(2);
    msg.copy(header, 0, 0, 2);
    return Buffer.compare(header, searchedType) === 0;
};
exports.hasHeader = hasHeader;
const buildCommandHeader = (seqNumber, commandType) => {
    const dataTypeBuffer = types_1.EufyP2PDataTypeHeader.DATA;
    const seqAsBuffer = Buffer.allocUnsafe(2);
    seqAsBuffer.writeUInt16BE(seqNumber, 0);
    const magicString = Buffer.from(exports.MAGIC_WORD);
    const commandTypeBuffer = Buffer.allocUnsafe(2);
    commandTypeBuffer.writeUInt16LE(commandType, 0);
    return Buffer.concat([dataTypeBuffer, seqAsBuffer, magicString, commandTypeBuffer]);
};
exports.buildCommandHeader = buildCommandHeader;
const buildCommandWithStringTypePayload = (value, channel = 0) => {
    // type = 6
    //setCommandWithString()
    const headerBuffer = Buffer.allocUnsafe(2);
    headerBuffer.writeUInt16LE(value.length, 0);
    const emptyBuffer = Buffer.from([0x00, 0x00]);
    const magicBuffer = Buffer.from([0x01, 0x00]);
    const channelBuffer = Buffer.from([channel, 0x00]);
    const jsonBuffer = Buffer.from(value);
    return Buffer.concat([
        headerBuffer,
        emptyBuffer,
        magicBuffer,
        channelBuffer,
        emptyBuffer,
        jsonBuffer,
    ]);
};
exports.buildCommandWithStringTypePayload = buildCommandWithStringTypePayload;
const sortP2PMessageParts = (messages) => {
    let completeMessage = Buffer.from([]);
    Object.keys(messages).map(Number)
        .sort((a, b) => a - b) // assure the seqNumbers are in correct order
        .forEach((key) => {
        completeMessage = Buffer.concat([completeMessage, messages[key]]);
    });
    return completeMessage;
};
exports.sortP2PMessageParts = sortP2PMessageParts;
const getRSAPrivateKey = (pem) => {
    const key = new node_rsa_1.default();
    if (pem.startsWith("-----BEGIN RSA PRIVATE KEY-----")) {
        pem = pem.replace("-----BEGIN RSA PRIVATE KEY-----", "").replace("-----END RSA PRIVATE KEY-----", "");
    }
    key.importKey(pem, "pkcs8");
    key.setOptions({
        encryptionScheme: "pkcs1"
    });
    return key;
};
exports.getRSAPrivateKey = getRSAPrivateKey;
const getNewRSAPrivateKey = () => {
    const key = new node_rsa_1.default({ b: 1024 });
    key.setOptions({
        encryptionScheme: "pkcs1"
    });
    return key;
};
exports.getNewRSAPrivateKey = getNewRSAPrivateKey;
const decryptAESData = (hexkey, data) => {
    const key = crypto_js_1.default.enc.Hex.parse(hexkey);
    const cipherParams = crypto_js_1.default.lib.CipherParams.create({
        ciphertext: crypto_js_1.default.enc.Hex.parse(data.toString("hex"))
    });
    const decrypted = crypto_js_1.default.AES.decrypt(cipherParams, key, {
        mode: crypto_js_1.default.mode.ECB,
        padding: crypto_js_1.default.pad.NoPadding
    });
    return Buffer.from(crypto_js_1.default.enc.Hex.stringify(decrypted), "hex");
};
exports.decryptAESData = decryptAESData;
