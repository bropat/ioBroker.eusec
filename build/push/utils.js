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
exports.convertTimestampMs = exports.sleep = exports.parseCheckinResponse = exports.buildCheckinRequest = exports.generateFid = exports.VALID_FID_PATTERN = void 0;
const crypto_1 = require("crypto");
const path_1 = __importDefault(require("path"));
const protobuf_typescript_1 = require("protobuf-typescript");
exports.VALID_FID_PATTERN = /^[cdef][\w-]{21}$/;
function generateFid() {
    const fidByteArray = new Uint8Array(17);
    fidByteArray.set(crypto_1.randomBytes(fidByteArray.length));
    // Replace the first 4 random bits with the constant FID header of 0b0111.
    fidByteArray[0] = 0b01110000 + (fidByteArray[0] % 0b00010000);
    const b64 = Buffer.from(fidByteArray).toString("base64");
    const b64_safe = b64.replace(/\+/g, "-").replace(/\//g, "_");
    const fid = b64_safe.substr(0, 22);
    if (exports.VALID_FID_PATTERN.test(fid)) {
        return fid;
    }
    throw new Error(`Generated FID is invalid?!`);
}
exports.generateFid = generateFid;
const buildCheckinRequest = () => __awaiter(void 0, void 0, void 0, function* () {
    const root = yield protobuf_typescript_1.load(path_1.default.join(__dirname, "./proto/checkin.proto"));
    const CheckinRequestModel = root.lookupType("CheckinRequest");
    const payload = {
        imei: "109269993813709",
        androidId: 0,
        checkin: {
            build: {
                fingerprint: "google/razor/flo:5.0.1/LRX22C/1602158:user/release-keys",
                hardware: "flo",
                brand: "google",
                radio: "FLO-04.04",
                clientId: "android-google",
            },
            lastCheckinMs: 0,
        },
        locale: "en",
        loggingId: 1234567890,
        macAddress: ["A1B2C3D4E5F6"],
        meid: "109269993813709",
        accountCookie: [],
        timeZone: "GMT",
        version: 3,
        otaCert: ["71Q6Rn2DDZl1zPDVaaeEHItd+Yg="],
        esn: "ABCDEF01",
        macAddressType: ["wifi"],
        fragment: 0,
        userSerialNumber: 0,
    };
    const message = CheckinRequestModel.create(payload);
    return CheckinRequestModel.encode(message).finish();
});
exports.buildCheckinRequest = buildCheckinRequest;
const parseCheckinResponse = (data) => __awaiter(void 0, void 0, void 0, function* () {
    const root = yield protobuf_typescript_1.load(path_1.default.join(__dirname, "./proto/checkin.proto"));
    const CheckinResponseModel = root.lookupType("CheckinResponse");
    const message = CheckinResponseModel.decode(data);
    const object = CheckinResponseModel.toObject(message, {
        longs: String,
        enums: String,
        bytes: String,
    });
    return object;
});
exports.parseCheckinResponse = parseCheckinResponse;
const sleep = (ms) => __awaiter(void 0, void 0, void 0, function* () {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
});
exports.sleep = sleep;
function convertTimestampMs(timestamp) {
    if (timestamp.toString().length === 10) {
        return timestamp * 1000;
    }
    return timestamp;
}
exports.convertTimestampMs = convertTimestampMs;
