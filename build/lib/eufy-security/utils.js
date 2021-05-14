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
exports.handleUpdate = exports.removeLastChar = exports.getVideoClipLength = exports.sleep = exports.lowestUnusedNumber = exports.moveFiles = exports.removeFiles = exports.saveImageStates = exports.setStateWithTimestamp = exports.setStateChangedWithTimestamp = exports.saveImage = exports.getDataFilePath = exports.getImageAsHTML = exports.getImage = exports.getState = exports.isEmpty = exports.setStateChangedAsync = exports.md5 = exports.generateSerialnumber = exports.generateUDID = exports.decrypt = void 0;
const crypto = __importStar(require("crypto"));
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
    return crypto.randomBytes(8).readBigUInt64BE().toString(16);
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
        case eufy_security_client_1.CommandType.CMD_PIR_SWITCH:
        case eufy_security_client_1.CommandType.CMD_INDOOR_DET_SET_MOTION_DETECT_ENABLE:
            return types_1.CameraStateID.MOTION_DETECTION;
        case eufy_security_client_1.CommandType.CMD_NAS_SWITCH:
            return types_1.CameraStateID.RTSP_STREAM;
        case eufy_security_client_1.CommandType.CMD_DEV_LED_SWITCH:
        case eufy_security_client_1.CommandType.CMD_INDOOR_LED_SWITCH:
        case eufy_security_client_1.CommandType.CMD_BAT_DOORBELL_SET_LED_ENABLE:
            return types_1.CameraStateID.LED_STATUS;
        case eufy_security_client_1.CommandType.CMD_INDOOR_DET_SET_SOUND_DETECT_ENABLE:
            return types_1.IndoorCameraStateID.SOUND_DETECTION;
        case eufy_security_client_1.CommandType.CMD_INDOOR_DET_SET_PET_ENABLE:
            return types_1.IndoorCameraStateID.PET_DETECTION;
    }
    switch (type) {
        case eufy_security_client_1.ParamType.COMMAND_MOTION_DETECTION_PACKAGE:
            return types_1.CameraStateID.MOTION_DETECTION;
        case eufy_security_client_1.ParamType.COMMAND_LED_NIGHT_OPEN:
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
const getDataFilePath = function (adapter, stationSerial, folderName, fileName) {
    const dir_path = path_1.default.join(utils.getAbsoluteInstanceDataDir(adapter), stationSerial, folderName);
    if (!fs_extra_1.default.existsSync(dir_path)) {
        fs_extra_1.default.mkdirSync(dir_path, { mode: 0o775, recursive: true });
    }
    return path_1.default.join(dir_path, fileName);
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
                    const fileName = `${device_sn}${types_1.IMAGE_FILE_JPEG_EXT}`;
                    const filePath = path_1.default.join(utils.getAbsoluteInstanceDataDir(adapter), station_sn, location);
                    if (!fs_extra_1.default.existsSync(filePath)) {
                        fs_extra_1.default.mkdirSync(filePath, { mode: 0o775, recursive: true });
                    }
                    yield fs_extra_1.default.writeFile(path_1.default.join(filePath, fileName), data).then(() => {
                        //await adapter.writeFileAsync(adapter.namespace, `${station_sn}/${location}/${device_sn}${IMAGE_FILE_JPEG_EXT}`, data).then(() => {
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
        exports.setStateWithTimestamp(adapter, url_state_id, `${prefix_common_name} URL`, image_data.imageUrl, timestamp, "url");
        exports.setStateWithTimestamp(adapter, html_state_id, `${prefix_common_name} HTML image`, image_data.imageHtml, timestamp, "html");
    });
};
exports.saveImageStates = saveImageStates;
const removeFiles = function (adapter, stationSerial, folderName, device_sn) {
    return new Promise((resolve, reject) => {
        try {
            const dir_path = path_1.default.join(utils.getAbsoluteInstanceDataDir(adapter), stationSerial, folderName);
            if (fs_extra_1.default.existsSync(dir_path)) {
                const files = fs_extra_1.default.readdirSync(dir_path).filter(fn => fn.startsWith(device_sn));
                try {
                    files.map(filename => fs_extra_1.default.removeSync(path_1.default.join(dir_path, filename)));
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
const moveFiles = function (adapter, stationSerial, device_sn, srcFolderName, dstFolderName) {
    return new Promise((resolve, reject) => {
        try {
            const dirSrcPath = path_1.default.join(utils.getAbsoluteInstanceDataDir(adapter), stationSerial, srcFolderName);
            const dirDstPath = path_1.default.join(utils.getAbsoluteInstanceDataDir(adapter), stationSerial, dstFolderName);
            if (!fs_extra_1.default.existsSync(dirDstPath)) {
                fs_extra_1.default.mkdirSync(dirDstPath, { mode: 0o775, recursive: true });
            }
            if (fs_extra_1.default.existsSync(dirSrcPath)) {
                const files = fs_extra_1.default.readdirSync(dirSrcPath).filter(fn => fn.startsWith(device_sn));
                try {
                    files.map(filename => fs_extra_1.default.moveSync(path_1.default.join(dirSrcPath, filename), path_1.default.join(dirDstPath, filename)));
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
const sleep = (ms) => __awaiter(void 0, void 0, void 0, function* () {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
});
exports.sleep = sleep;
const getVideoClipLength = (device) => {
    let length = 60;
    const workingMode = device.getRawProperty(eufy_security_client_1.CommandType.CMD_SET_PIR_POWERMODE);
    if (workingMode !== undefined) {
        switch (workingMode.value) {
            case "0":
                if (device.isCamera2Product() || device.isIndoorCamera() || device.isSoloCameras())
                    length = 20;
                else if (device.isBatteryDoorbell() || device.isBatteryDoorbell2())
                    length = 30;
                break;
            case "1":
                // Corrisponds to 60 seconds
                break;
            case "2":
                const customValue = device.getRawProperty(eufy_security_client_1.CommandType.CMD_DEV_RECORD_TIMEOUT);
                if (customValue !== undefined) {
                    try {
                        length = Number.parseInt(customValue.value);
                    }
                    catch (error) {
                    }
                }
                break;
            case "3":
                // Corrisponds to 60 seconds?? (this mode exists only for battery doorbells; mode: Optimal Battery Life)
                break;
        }
    }
    return length;
};
exports.getVideoClipLength = getVideoClipLength;
const removeLastChar = function (text, char) {
    const strArr = [...text];
    strArr.splice(text.lastIndexOf(char), 1);
    return strArr.join("");
};
exports.removeLastChar = removeLastChar;
const handleUpdate = function (adapter, log, old_version) {
    return __awaiter(this, void 0, void 0, function* () {
        if (old_version <= 0.31) {
            try {
                const watermark = yield adapter.getStatesAsync("*.watermark");
                Object.keys(watermark).forEach((id) => __awaiter(this, void 0, void 0, function* () {
                    yield adapter.delObjectAsync(id);
                }));
            }
            catch (error) {
                log.error("Version 0.3.1 - watermark: Error:", error);
            }
            try {
                const state = yield adapter.getStatesAsync("*.state");
                Object.keys(state).forEach((id) => __awaiter(this, void 0, void 0, function* () {
                    yield adapter.delObjectAsync(id);
                }));
            }
            catch (error) {
                log.error("Version 0.3.1 - state: Error:", error);
            }
            try {
                const wifi_rssi = yield adapter.getStatesAsync("*.wifi_rssi");
                Object.keys(wifi_rssi).forEach((id) => __awaiter(this, void 0, void 0, function* () {
                    yield adapter.delObjectAsync(id);
                }));
            }
            catch (error) {
                log.error("Version 0.3.1 - wifi_rssi: Error:", error);
            }
        }
        else if (old_version <= 0.41) {
            try {
                const changeRole = function (adapter, state, role) {
                    return __awaiter(this, void 0, void 0, function* () {
                        try {
                            const states = yield adapter.getStatesAsync(`*.${state}`);
                            Object.keys(states).forEach((id) => __awaiter(this, void 0, void 0, function* () {
                                yield adapter.extendObjectAsync(id, {
                                    type: "state",
                                    common: {
                                        role: role
                                    }
                                }, {});
                            }));
                        }
                        catch (error) {
                            log.error(`state: ${state} role: ${role} - Error:`, error);
                        }
                    });
                };
                yield changeRole(adapter, types_1.CameraStateID.STATE, "value");
                yield changeRole(adapter, types_1.CameraStateID.LIVESTREAM, "url");
                yield changeRole(adapter, types_1.CameraStateID.LAST_LIVESTREAM_PIC_URL, "url");
                yield changeRole(adapter, types_1.CameraStateID.LAST_LIVESTREAM_PIC_HTML, "html");
                yield changeRole(adapter, types_1.CameraStateID.LAST_LIVESTREAM_VIDEO_URL, "url");
                yield changeRole(adapter, types_1.CameraStateID.ENABLED, "switch.enable");
                yield changeRole(adapter, types_1.CameraStateID.ANTITHEFT_DETECTION, "switch.enable");
                yield changeRole(adapter, types_1.CameraStateID.AUTO_NIGHTVISION, "switch.enable");
                yield changeRole(adapter, types_1.CameraStateID.MOTION_DETECTION, "switch.enable");
                yield changeRole(adapter, types_1.CameraStateID.RTSP_STREAM, "switch.enable");
                yield changeRole(adapter, types_1.CameraStateID.RTSP_STREAM_URL, "url");
                yield changeRole(adapter, types_1.CameraStateID.LED_STATUS, "switch.enable");
                yield changeRole(adapter, types_1.CameraStateID.MOTION_DETECTED, "sensor.motion");
                yield changeRole(adapter, types_1.CameraStateID.PERSON_DETECTED, "sensor.motion");
                yield changeRole(adapter, types_1.CameraStateID.LAST_PERSON_IDENTIFIED, "text");
                yield changeRole(adapter, types_1.CameraStateID.LAST_EVENT_PICTURE_URL, "url");
                yield changeRole(adapter, types_1.CameraStateID.LAST_EVENT_PICTURE_HTML, "html");
                yield changeRole(adapter, types_1.CameraStateID.LAST_EVENT_VIDEO_URL, "url");
                yield changeRole(adapter, types_1.DoorbellStateID.RINGING, "sensor");
                yield changeRole(adapter, types_1.IndoorCameraStateID.SOUND_DETECTION, "switch.enable");
                yield changeRole(adapter, types_1.IndoorCameraStateID.PET_DETECTION, "switch.enable");
                yield changeRole(adapter, types_1.IndoorCameraStateID.SOUND_DETECTED, "sensor.noise");
                yield changeRole(adapter, types_1.IndoorCameraStateID.CRYING_DETECTED, "sensor.noise");
                yield changeRole(adapter, types_1.IndoorCameraStateID.PET_DETECTED, "sensor");
                yield changeRole(adapter, types_1.EntrySensorStateID.STATE, "value");
                yield changeRole(adapter, types_1.EntrySensorStateID.SENSOR_OPEN, "sensor");
                yield changeRole(adapter, types_1.EntrySensorStateID.LOW_BATTERY, "sensor");
                yield changeRole(adapter, types_1.EntrySensorStateID.SENSOR_CHANGE_TIME, "value");
                yield changeRole(adapter, types_1.MotionSensorStateID.STATE, "value");
                yield changeRole(adapter, types_1.MotionSensorStateID.LOW_BATTERY, "sensor");
                yield changeRole(adapter, types_1.MotionSensorStateID.MOTION_DETECTED, "sensor.motion");
                yield changeRole(adapter, types_1.KeyPadStateID.STATE, "value");
                yield changeRole(adapter, types_1.KeyPadStateID.LOW_BATTERY, "sensor");
                yield changeRole(adapter, types_1.StationStateID.CURRENT_MODE, "value");
            }
            catch (error) {
                log.error("Version 0.4.1 - Error:", error);
            }
        }
        else if (old_version <= 0.42) {
            try {
                const changeRole = function (adapter, state, role) {
                    return __awaiter(this, void 0, void 0, function* () {
                        try {
                            const states = yield adapter.getStatesAsync(`*.${state}`);
                            Object.keys(states).forEach((id) => __awaiter(this, void 0, void 0, function* () {
                                yield adapter.extendObjectAsync(id, {
                                    type: "state",
                                    common: {
                                        role: role
                                    }
                                }, {});
                            }));
                        }
                        catch (error) {
                            log.error(`state: ${state} role: ${role} - Error:`, error);
                        }
                    });
                };
                yield changeRole(adapter, types_1.CameraStateID.STATE, "info.status");
                yield changeRole(adapter, types_1.CameraStateID.NAME, "info.name");
                yield changeRole(adapter, types_1.CameraStateID.MAC_ADDRESS, "info.mac");
                yield changeRole(adapter, types_1.CameraStateID.BATTERY, "value.battery");
                yield changeRole(adapter, types_1.CameraStateID.BATTERY_TEMPERATURE, "value.temperature");
                yield changeRole(adapter, types_1.EntrySensorStateID.LOW_BATTERY, "indicator.lowbat");
                yield changeRole(adapter, types_1.StationStateID.LAN_IP_ADDRESS, "info.ip");
            }
            catch (error) {
                log.error("Version 0.4.2 - States - Error:", error);
            }
            try {
                const files = fs_extra_1.default.readdirSync(path_1.default.join(utils.getAbsoluteDefaultDataDir(), "files", adapter.namespace)).filter(fn => fn.startsWith("T"));
                files.map(filename => fs_extra_1.default.moveSync(path_1.default.join(utils.getAbsoluteDefaultDataDir(), "files", adapter.namespace, filename), path_1.default.join(utils.getAbsoluteInstanceDataDir(adapter), filename)));
            }
            catch (error) {
                log.error("Version 0.4.2 - Files - Error:", error);
            }
        }
    });
};
exports.handleUpdate = handleUpdate;
//# sourceMappingURL=utils.js.map