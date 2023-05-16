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
exports.convertCamelCaseToSnakeCase = exports.handleUpdate = exports.deleteStates = exports.changeRole = exports.removeLastChar = exports.getVideoClipLength = exports.sleep = exports.lowestUnusedNumber = exports.moveFiles = exports.removeFiles = exports.setStateAsync = exports.getDataFilePath = exports.getImageAsHTML = exports.isEmpty = exports.setStateChangedAsync = void 0;
const eufy_security_client_1 = require("eufy-security-client");
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const utils = __importStar(require("@iobroker/adapter-core"));
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
const getImageAsHTML = function (data, mime = "image/jpg") {
    if (data && data.length > 0)
        return `<img src="data:${mime};base64,${data.toString("base64")}" style="width: auto ;height: 100%;" />`;
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
const changeRole = async function (adapter, log, state, role) {
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
exports.changeRole = changeRole;
const deleteStates = async function (adapter, property) {
    const states = await adapter.getStatesAsync(`*.${property}`);
    if (states)
        Object.keys(states).forEach(async (id) => {
            await adapter.delObjectAsync(id).catch();
        });
};
exports.deleteStates = deleteStates;
const handleUpdate = async function (adapter, log, old_version) {
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
    if (old_version <= 1) {
        for (const state of ["last_event_pic_url", "last_event_pic_html", "last_event_video_url"]) {
            try {
                await (0, exports.deleteStates)(adapter, state);
            }
            catch (error) {
                log.error(`Version 1.0.0 - ${state}: Error:`, error);
            }
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