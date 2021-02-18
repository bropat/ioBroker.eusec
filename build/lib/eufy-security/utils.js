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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.lowestUnusedNumber = exports.moveFiles = exports.removeFiles = exports.saveImageStates = exports.setStateWithTimestamp = exports.setStateChangedWithTimestamp = exports.saveImage = exports.getDataFilePath = exports.getImageAsHTML = exports.getImage = exports.getState = exports.isEmpty = exports.setStateChangedAsync = exports.md5 = exports.generateSerialnumber = exports.generateUDID = exports.decrypt = void 0;
const crypto = __importStar(require("crypto"));
const read_bigint_1 = require("read-bigint");
const axios_1 = __importDefault(require("axios"));
const eufy_security_client_1 = require("eufy-security-client");
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const utils = __importStar(require("@iobroker/adapter-core"));
const types_1 = require("./types");
const decrypt = (key, value) => {
    let result = "";
    for (let i = 0; i < value.length; ++i) {
        result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
    }
    return result;
};
exports.decrypt = decrypt;
const generateUDID = function () {
    //return crypto.randomBytes(8).readBigUInt64BE().toString(16);
    return read_bigint_1.readBigUInt64BE(crypto.randomBytes(8)).toString(16);
};
exports.generateUDID = generateUDID;
const generateSerialnumber = function (length) {
    return crypto.randomBytes(length / 2).toString("hex");
};
exports.generateSerialnumber = generateSerialnumber;
const md5 = (contents) => crypto.createHash("md5").update(contents).digest("hex");
exports.md5 = md5;
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const setStateChangedAsync = function (adapter, id, value) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield adapter.setStateChangedAsync(id, value === undefined || value === null ? null : { val: value, ack: true }).catch();
    });
};
exports.setStateChangedAsync = setStateChangedAsync;
const isEmpty = function (str) {
    if (str) {
        if (str.length > 0)
            return false;
        return true;
    }
    return true;
};
exports.isEmpty = isEmpty;
const getState = function (type) {
    //TODO: Extend the implementation as soon as new p2p commands are implemented!
    switch (type) {
        case eufy_security_client_1.CommandType.CMD_SET_ARMING:
            return types_1.StationStateID.GUARD_MODE;
        case eufy_security_client_1.CommandType.CMD_DEVS_SWITCH:
            return types_1.CameraStateID.ENABLED;
        case eufy_security_client_1.CommandType.CMD_SET_DEVS_OSD:
            return types_1.CameraStateID.WATERMARK;
        case eufy_security_client_1.CommandType.CMD_EAS_SWITCH:
            return types_1.CameraStateID.ANTITHEFT_DETECTION;
        case eufy_security_client_1.CommandType.CMD_IRCUT_SWITCH:
            return types_1.CameraStateID.AUTO_NIGHTVISION;
        case eufy_security_client_1.CommandType.CMD_DEV_LED_SWITCH:
            return types_1.CameraStateID.LED_STATUS;
    }
    return null;
};
exports.getState = getState;
const getImage = function (url) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield axios_1.default({
            method: "GET",
            url: url,
            responseType: "arraybuffer",
            validateStatus: function (_status) {
                return true;
            }
        });
        return response;
    });
};
exports.getImage = getImage;
const getImageAsHTML = function (data) {
    if (data && data.length > 0)
        return `<img src="data:image/jpg;base64,${data.toString("base64")}" style="width: auto ;height: 100%;" />`;
    return "";
};
exports.getImageAsHTML = getImageAsHTML;
const getDataFilePath = function (namespace, stationSerial, folderName, fileName) {
    const root_path = `${utils.getAbsoluteDefaultDataDir()}files${path_1.default.sep}${namespace}`;
    const dir_path = `${root_path}${path_1.default.sep}${stationSerial}${path_1.default.sep}${folderName}`;
    if (!fs_extra_1.default.existsSync(dir_path)) {
        fs_extra_1.default.mkdirSync(dir_path, { mode: 0o775, recursive: true });
    }
    return `${dir_path}${path_1.default.sep}${fileName}`;
};
exports.getDataFilePath = getDataFilePath;
const saveImage = function (adapter, url, station_sn, device_sn, location) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = {
            status: 0,
            statusText: "",
            imageUrl: "",
            imageHtml: ""
        };
        try {
            if (url) {
                const response = yield exports.getImage(url);
                result.status = response.status;
                result.statusText = response.statusText;
                if (response.status === 200) {
                    const data = Buffer.from(response.data);
                    yield adapter.writeFileAsync(adapter.namespace, `${station_sn}/${location}/${device_sn}${types_1.IMAGE_FILE_JPEG_EXT}`, data).then(() => {
                        result.imageUrl = `/${adapter.namespace}/${station_sn}/${location}/${device_sn}${types_1.IMAGE_FILE_JPEG_EXT}`;
                        result.imageHtml = exports.getImageAsHTML(data);
                    }).catch(error => {
                        adapter.log.error(`saveImage(): writeFile Error: ${error} - url: ${url}`);
                    });
                }
            }
        }
        catch (error) {
            adapter.log.error(`saveImage(): Error: ${error} - url: ${url}`);
        }
        return result;
    });
};
exports.saveImage = saveImage;
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const setStateChangedWithTimestamp = function (adapter, id, value, timestamp) {
    return __awaiter(this, void 0, void 0, function* () {
        const obj = yield adapter.getObjectAsync(id);
        if (obj) {
            if ((obj.native.timestamp !== undefined && obj.native.timestamp < timestamp) || obj.native.timestamp === undefined) {
                obj.native.timestamp = timestamp;
                yield exports.setStateChangedAsync(adapter, id, value);
                yield adapter.setObject(id, obj);
            }
        }
    });
};
exports.setStateChangedWithTimestamp = setStateChangedWithTimestamp;
const setStateWithTimestamp = function (adapter, state_id, common_name, value, timestamp = new Date().getTime() - 15 * 60 * 1000, role = "text", type = "string") {
    return __awaiter(this, void 0, void 0, function* () {
        const obj = yield adapter.getObjectAsync(state_id);
        if (obj) {
            if ((obj.native.timestamp !== undefined && obj.native.timestamp < timestamp) || obj.native.timestamp === undefined) {
                obj.native.timestamp = timestamp;
                yield adapter.setStateAsync(state_id, { val: value, ack: true });
                yield adapter.setObject(state_id, obj);
            }
        }
        else {
            yield adapter.setObjectNotExistsAsync(state_id, {
                type: "state",
                common: {
                    name: common_name,
                    type: type,
                    role: role,
                    read: true,
                    write: false,
                },
                native: {
                    timestamp: timestamp
                },
            });
            yield adapter.setStateAsync(state_id, { val: value, ack: true });
        }
    });
};
exports.setStateWithTimestamp = setStateWithTimestamp;
const saveImageStates = function (adapter, url, timestamp, station_sn, device_sn, location, url_state_id, html_state_id, prefix_common_name, retry = 1) {
    return __awaiter(this, void 0, void 0, function* () {
        const image_data = yield exports.saveImage(adapter, url, station_sn, device_sn, location);
        if (image_data.status === 404) {
            if (retry < 6) {
                adapter.log.info(`Retry get image in ${5 * retry} seconds from url: ${url} (retry_count: ${retry} error: ${image_data.statusText} message: ${image_data.statusText})...`);
                setTimeout(() => {
                    exports.saveImageStates(adapter, url, timestamp, station_sn, device_sn, location, url_state_id, html_state_id, prefix_common_name, ++retry);
                }, 5 * 1000 * retry);
            }
            else {
                adapter.log.warn(`Could not download the image within 5 attempts from url: ${url} (error: ${image_data.statusText} message: ${image_data.statusText})`);
            }
            return;
        }
        exports.setStateWithTimestamp(adapter, url_state_id, `${prefix_common_name} URL`, image_data.imageUrl, timestamp);
        exports.setStateWithTimestamp(adapter, html_state_id, `${prefix_common_name} HTML image`, image_data.imageHtml, timestamp);
    });
};
exports.saveImageStates = saveImageStates;
const removeFiles = function (namespace, stationSerial, folderName, device_sn) {
    return new Promise((resolve, reject) => {
        try {
            const root_path = `${utils.getAbsoluteDefaultDataDir()}files${path_1.default.sep}${namespace}`;
            const dir_path = `${root_path}${path_1.default.sep}${stationSerial}${path_1.default.sep}${folderName}`;
            if (fs_extra_1.default.existsSync(dir_path)) {
                const files = fs_extra_1.default.readdirSync(dir_path).filter(fn => fn.startsWith(device_sn));
                try {
                    files.map(filename => fs_extra_1.default.removeSync(`${dir_path}${path_1.default.sep}${filename}`));
                }
                catch (error) {
                }
            }
            resolve();
        }
        catch (error) {
            reject(error);
        }
    });
};
exports.removeFiles = removeFiles;
const moveFiles = function (namespace, stationSerial, device_sn, srcFolderName, dstFolderName) {
    return new Promise((resolve, reject) => {
        try {
            const rootPath = `${utils.getAbsoluteDefaultDataDir()}files${path_1.default.sep}${namespace}`;
            const dirSrcPath = `${rootPath}${path_1.default.sep}${stationSerial}${path_1.default.sep}${srcFolderName}`;
            const dirDstPath = `${rootPath}${path_1.default.sep}${stationSerial}${path_1.default.sep}${dstFolderName}`;
            if (!fs_extra_1.default.existsSync(dirDstPath)) {
                fs_extra_1.default.mkdirSync(dirDstPath, { mode: 0o775, recursive: true });
            }
            if (fs_extra_1.default.existsSync(dirSrcPath)) {
                const files = fs_extra_1.default.readdirSync(dirSrcPath).filter(fn => fn.startsWith(device_sn));
                try {
                    files.map(filename => fs_extra_1.default.moveSync(`${dirSrcPath}${path_1.default.sep}${filename}`, `${dirDstPath}${path_1.default.sep}${filename}`));
                }
                catch (error) {
                }
            }
            resolve();
        }
        catch (error) {
            reject(error);
        }
    });
};
exports.moveFiles = moveFiles;
const lowestUnusedNumber = function (sequence, startingFrom) {
    const arr = sequence.slice(0);
    arr.sort((a, b) => a - b);
    return arr.reduce((lowest, num, i) => {
        const seqIndex = i + startingFrom;
        return num !== seqIndex && seqIndex < lowest ? seqIndex : lowest;
    }, arr.length + startingFrom);
};
exports.lowestUnusedNumber = lowestUnusedNumber;
