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
Object.defineProperty(exports, "__esModule", { value: true });
exports.setStateChangedAsync = exports.getPushNotificationStateID = exports.md5 = exports.generateSerialnumber = exports.generateUDID = exports.decrypt = void 0;
const crypto = __importStar(require("crypto"));
const decrypt = (key, value) => {
    let result = "";
    for (let i = 0; i < value.length; ++i) {
        result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
    }
    return result;
};
exports.decrypt = decrypt;
const generateUDID = function () {
    return crypto.randomBytes(8).readBigUInt64BE().toString(16);
};
exports.generateUDID = generateUDID;
const generateSerialnumber = function (length) {
    return crypto.randomBytes(length / 2).toString("hex");
};
exports.generateSerialnumber = generateSerialnumber;
const md5 = (contents) => crypto.createHash("md5").update(contents).digest("hex");
exports.md5 = md5;
const getPushNotificationStateID = (state) => {
    return `push_notification.${state}`;
};
exports.getPushNotificationStateID = getPushNotificationStateID;
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const setStateChangedAsync = function (adapter, id, value) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield adapter.setStateChangedAsync(id, value === undefined || value === null ? null : { val: value, ack: true }).catch();
    });
};
exports.setStateChangedAsync = setStateChangedAsync;
