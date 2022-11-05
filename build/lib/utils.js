"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertCamelCaseToSnakeCase = exports.handleUpdate = exports.removeLastChar = exports.getVideoClipLength = exports.sleep = exports.lowestUnusedNumber = exports.moveFiles = exports.removeFiles = exports.saveImageStates = exports.setStateAsync = exports.saveImage = exports.getDataFilePath = exports.getImageAsHTML = exports.getImage = exports.isEmpty = exports.setStateChangedAsync = void 0;
const got_1 = __importDefault(require("got"));
const eufy_security_client_1 = require("eufy-security-client");
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const utils = __importStar(require("@iobroker/adapter-core"));
const types_1 = require("./types");
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const setStateChangedAsync = async function (adapter, id, value) {
    return await adapter.setStateChangedAsync(id, value === undefined || value === null ? null : { val: value, ack: true }).catch();
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
const getImage = async function (url) {
    const response = await (0, got_1.default)(url, {
        method: "GET",
        responseType: "buffer",
        http2: true,
        throwHttpErrors: false,
        retry: {
            limit: 3,
            methods: ["GET"]
        }
    });
    return response;
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
const saveImage = async function (adapter, url, station_sn, device_sn, location) {
    const result = {
        status: 0,
        statusText: "",
        imageUrl: "",
        imageHtml: ""
    };
    try {
        if (url) {
            const response = await (0, exports.getImage)(url);
            result.status = response.statusCode;
            result.statusText = response.statusMessage ? response.statusMessage : "";
            if (result.status === 200) {
                const data = response.body;
                const fileName = `${device_sn}${types_1.IMAGE_FILE_JPEG_EXT}`;
                const filePath = path_1.default.join(utils.getAbsoluteInstanceDataDir(adapter), station_sn, location);
                if (!fs_extra_1.default.existsSync(filePath)) {
                    fs_extra_1.default.mkdirSync(filePath, { mode: 0o775, recursive: true });
                }
                await fs_extra_1.default.writeFile(path_1.default.join(filePath, fileName), data).then(() => {
                    result.imageUrl = `/${adapter.namespace}/${station_sn}/${location}/${device_sn}${types_1.IMAGE_FILE_JPEG_EXT}`;
                    result.imageHtml = (0, exports.getImageAsHTML)(data);
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
};
exports.saveImage = saveImage;
const setStateAsync = async function (adapter, state_id, common_name, value, role = "text", type = "string") {
    await adapter.setObjectNotExistsAsync(state_id, {
        type: "state",
        common: {
            name: common_name,
            type: type,
            role: role,
            read: true,
            write: false,
        },
        native: {},
    });
    await adapter.setStateAsync(state_id, { val: value, ack: true });
};
exports.setStateAsync = setStateAsync;
const saveImageStates = async function (adapter, url, station_sn, device_sn, location, url_state_id, html_state_id, prefix_common_name, retry = 1) {
    if (adapter.config.autoDownloadPicture) {
        const image_data = await (0, exports.saveImage)(adapter, url, station_sn, device_sn, location);
        if (image_data.status === 404) {
            if (retry < 6) {
                adapter.log.info(`Retry get image in ${5 * retry} seconds from url: ${url} (retry_count: ${retry} error: ${image_data.statusText} message: ${image_data.statusText})...`);
                setTimeout(() => {
                    (0, exports.saveImageStates)(adapter, url, station_sn, device_sn, location, url_state_id, html_state_id, prefix_common_name, ++retry);
                }, 5 * 1000 * retry);
            }
            else {
                adapter.log.warn(`Could not download the image within 5 attempts from url: ${url} (error: ${image_data.statusText} message: ${image_data.statusText})`);
            }
            return;
        }
        else if (image_data.status === 200) {
            (0, exports.setStateAsync)(adapter, url_state_id, `${prefix_common_name} URL`, image_data.imageUrl, "url");
            (0, exports.setStateAsync)(adapter, html_state_id, `${prefix_common_name} HTML image`, image_data.imageHtml, "html");
        }
    }
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
const sleep = async (ms) => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};
exports.sleep = sleep;
const getVideoClipLength = (device) => {
    let length = 60;
    const workingMode = device.getRawProperty(eufy_security_client_1.CommandType.CMD_SET_PIR_POWERMODE);
    if (workingMode !== undefined) {
        switch (workingMode) {
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
                        length = Number.parseInt(customValue);
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
const handleUpdate = async function (adapter, log, old_version) {
    if (old_version <= 0.31) {
        try {
            const watermark = await adapter.getStatesAsync("*.watermark");
            if (watermark)
                Object.keys(watermark).forEach(async (id) => {
                    await adapter.delObjectAsync(id).catch();
                });
        }
        catch (error) {
            log.error("Version 0.3.1 - watermark: Error:", error);
        }
        try {
            const state = await adapter.getStatesAsync("*.state");
            if (state)
                Object.keys(state).forEach(async (id) => {
                    await adapter.delObjectAsync(id).catch();
                });
        }
        catch (error) {
            log.error("Version 0.3.1 - state: Error:", error);
        }
        try {
            const wifi_rssi = await adapter.getStatesAsync("*.wifi_rssi");
            if (wifi_rssi)
                Object.keys(wifi_rssi).forEach(async (id) => {
                    await adapter.delObjectAsync(id).catch();
                });
        }
        catch (error) {
            log.error("Version 0.3.1 - wifi_rssi: Error:", error);
        }
    }
    if (old_version <= 0.41) {
        try {
            const changeRole = async function (adapter, state, role) {
                try {
                    const states = await adapter.getStatesAsync(`*.${state}`);
                    if (states)
                        Object.keys(states).forEach(async (id) => {
                            await adapter.extendObjectAsync(id, {
                                type: "state",
                                common: {
                                    role: role
                                }
                            }, {}).catch();
                        });
                }
                catch (error) {
                    log.error(`state: ${state} role: ${role} - Error:`, error);
                }
            };
            await changeRole(adapter, types_1.CameraStateID.STATE, "value");
            await changeRole(adapter, types_1.CameraStateID.LIVESTREAM, "url");
            await changeRole(adapter, types_1.CameraStateID.LAST_LIVESTREAM_PIC_URL, "url");
            await changeRole(adapter, types_1.CameraStateID.LAST_LIVESTREAM_PIC_HTML, "html");
            await changeRole(adapter, types_1.CameraStateID.LAST_LIVESTREAM_VIDEO_URL, "url");
            await changeRole(adapter, types_1.CameraStateID.ENABLED, "switch.enable");
            await changeRole(adapter, types_1.CameraStateID.ANTITHEFT_DETECTION, "switch.enable");
            await changeRole(adapter, types_1.CameraStateID.AUTO_NIGHTVISION, "switch.enable");
            await changeRole(adapter, types_1.CameraStateID.MOTION_DETECTION, "switch.enable");
            await changeRole(adapter, types_1.CameraStateID.RTSP_STREAM, "switch.enable");
            await changeRole(adapter, types_1.CameraStateID.RTSP_STREAM_URL, "url");
            await changeRole(adapter, types_1.CameraStateID.LED_STATUS, "switch.enable");
            await changeRole(adapter, types_1.CameraStateID.MOTION_DETECTED, "sensor.motion");
            await changeRole(adapter, types_1.CameraStateID.PERSON_DETECTED, "sensor.motion");
            await changeRole(adapter, types_1.CameraStateID.LAST_PERSON_IDENTIFIED, "text");
            await changeRole(adapter, types_1.CameraStateID.LAST_EVENT_PIC_URL, "url");
            await changeRole(adapter, types_1.CameraStateID.LAST_EVENT_PIC_HTML, "html");
            await changeRole(adapter, types_1.CameraStateID.LAST_EVENT_VIDEO_URL, "url");
            await changeRole(adapter, types_1.DoorbellStateID.RINGING, "sensor");
            await changeRole(adapter, types_1.IndoorCameraStateID.SOUND_DETECTION, "switch.enable");
            await changeRole(adapter, types_1.IndoorCameraStateID.PET_DETECTION, "switch.enable");
            await changeRole(adapter, types_1.IndoorCameraStateID.SOUND_DETECTED, "sensor.noise");
            await changeRole(adapter, types_1.IndoorCameraStateID.CRYING_DETECTED, "sensor.noise");
            await changeRole(adapter, types_1.IndoorCameraStateID.PET_DETECTED, "sensor");
            await changeRole(adapter, types_1.EntrySensorStateID.STATE, "value");
            await changeRole(adapter, types_1.EntrySensorStateID.SENSOR_OPEN, "sensor");
            await changeRole(adapter, types_1.EntrySensorStateID.LOW_BATTERY, "sensor");
            await changeRole(adapter, types_1.EntrySensorStateID.SENSOR_CHANGE_TIME, "value");
            await changeRole(adapter, types_1.MotionSensorStateID.STATE, "value");
            await changeRole(adapter, types_1.MotionSensorStateID.LOW_BATTERY, "sensor");
            await changeRole(adapter, types_1.MotionSensorStateID.MOTION_DETECTED, "sensor.motion");
            await changeRole(adapter, types_1.KeyPadStateID.STATE, "value");
            await changeRole(adapter, types_1.KeyPadStateID.LOW_BATTERY, "sensor");
            await changeRole(adapter, types_1.StationStateID.CURRENT_MODE, "value");
        }
        catch (error) {
            log.error("Version 0.4.1 - Error:", error);
        }
    }
    if (old_version <= 0.42) {
        try {
            const changeRole = async function (adapter, state, role) {
                try {
                    const states = await adapter.getStatesAsync(`*.${state}`);
                    if (states)
                        Object.keys(states).forEach(async (id) => {
                            await adapter.extendObjectAsync(id, {
                                type: "state",
                                common: {
                                    role: role
                                }
                            }, {}).catch();
                        });
                }
                catch (error) {
                    log.error(`state: ${state} role: ${role} - Error:`, error);
                }
            };
            await changeRole(adapter, types_1.CameraStateID.STATE, "info.status");
            await changeRole(adapter, types_1.CameraStateID.NAME, "info.name");
            await changeRole(adapter, types_1.CameraStateID.MAC_ADDRESS, "info.mac");
            await changeRole(adapter, types_1.CameraStateID.BATTERY, "value.battery");
            await changeRole(adapter, types_1.CameraStateID.BATTERY_TEMPERATURE, "value.temperature");
            await changeRole(adapter, types_1.EntrySensorStateID.LOW_BATTERY, "indicator.lowbat");
            await changeRole(adapter, types_1.StationStateID.LAN_IP_ADDRESS, "info.ip");
        }
        catch (error) {
            log.error("Version 0.4.2 - States - Error:", error);
        }
        try {
            if (fs_extra_1.default.existsSync(path_1.default.join(utils.getAbsoluteDefaultDataDir(), "files", adapter.namespace))) {
                if (!fs_extra_1.default.existsSync(utils.getAbsoluteInstanceDataDir(adapter)))
                    fs_extra_1.default.mkdirpSync(utils.getAbsoluteInstanceDataDir(adapter));
                const files = fs_extra_1.default.readdirSync(path_1.default.join(utils.getAbsoluteDefaultDataDir(), "files", adapter.namespace)).filter(fn => fn.startsWith("T"));
                files.map(filename => fs_extra_1.default.moveSync(path_1.default.join(utils.getAbsoluteDefaultDataDir(), "files", adapter.namespace, filename), path_1.default.join(utils.getAbsoluteInstanceDataDir(adapter), filename)));
            }
        }
        catch (error) {
            log.error("Version 0.4.2 - Files - Error:", error);
        }
    }
    if (old_version <= 0.61) {
        try {
            const all = await adapter.getStatesAsync("T*");
            if (all) {
                Object.keys(all).forEach(async (id) => {
                    await adapter.delObjectAsync(id, { recursive: false }).catch();
                });
            }
            const channels = await adapter.getChannelsOfAsync();
            if (channels) {
                Object.values(channels).forEach(async (channel) => {
                    if (channel.common.name !== "info") {
                        await adapter.delObjectAsync(channel._id, { recursive: false }).catch();
                    }
                });
            }
            const devices = await adapter.getDevicesAsync();
            if (devices) {
                Object.values(devices).forEach(async (device) => {
                    await adapter.delObjectAsync(device._id, { recursive: false }).catch();
                });
            }
        }
        catch (error) {
            log.error("Version 0.6.1: Error:", error);
        }
    }
    if (old_version <= 0.74) {
        try {
            await adapter.setObjectAsync("verify_code", {
                type: "state",
                common: {
                    name: "2FA verification code",
                    type: "string",
                    role: "state",
                    read: true,
                    write: true,
                },
                native: {},
            });
        }
        catch (error) {
            log.error("Version 0.7.4: Error:", error);
        }
    }
};
exports.handleUpdate = handleUpdate;
const convertCamelCaseToSnakeCase = function (value) {
    return value.replace(/[A-Z]/g, (letter, index) => {
        return index == 0 ? letter.toLowerCase() : "_" + letter.toLowerCase();
    });
};
exports.convertCamelCaseToSnakeCase = convertCamelCaseToSnakeCase;
//# sourceMappingURL=utils.js.map