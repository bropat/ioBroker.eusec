import * as crypto from "crypto";
import axios, { AxiosResponse } from "axios";
import { CommandType, Device, ParamType } from "eufy-security-client";
import path from "path";
import fse from "fs-extra";
import * as utils from "@iobroker/adapter-core";

import { CameraStateID, DoorbellStateID, EntrySensorStateID, IMAGE_FILE_JPEG_EXT, IndoorCameraStateID, KeyPadStateID, MotionSensorStateID, StationStateID } from "./types";
import { ImageResponse } from "./interfaces";
import { ioBrokerLogger } from "./log";

export const decrypt = (key: string, value: string): string => {
    let result = "";
    for (let i = 0; i < value.length; ++i) {
        result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
    }
    return result;
}

export const generateUDID = function(): string {
    return crypto.randomBytes(8).readBigUInt64BE().toString(16);
};

export const generateSerialnumber = function(length: number): string {
    return crypto.randomBytes(length/2).toString("hex");
};

export const md5 = (contents: string): string => crypto.createHash("md5").update(contents).digest("hex");

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const setStateChangedAsync = async function(adapter: ioBroker.Adapter, id: string, value: any): ioBroker.SetStateChangedPromise {
    return await adapter.setStateChangedAsync(id, value === undefined || value === null ? null : { val: value, ack: true }).catch();
};

export const isEmpty = function(str: string | null | undefined): boolean {
    if (str) {
        if (str.length > 0)
            return false;
        return true;
    }
    return true;
};

export const getState = function(type: CommandType | ParamType): string | null {
    //TODO: Extend the implementation as soon as new p2p commands are implemented!
    switch(type) {
        case CommandType.CMD_SET_ARMING:
            return StationStateID.GUARD_MODE;
        case CommandType.CMD_DEVS_SWITCH:
            return CameraStateID.ENABLED;
        case CommandType.CMD_SET_DEVS_OSD:
            return CameraStateID.WATERMARK;
        case CommandType.CMD_EAS_SWITCH:
            return CameraStateID.ANTITHEFT_DETECTION;
        case CommandType.CMD_IRCUT_SWITCH:
            return CameraStateID.AUTO_NIGHTVISION;
        case CommandType.CMD_PIR_SWITCH:
        case CommandType.CMD_INDOOR_DET_SET_MOTION_DETECT_ENABLE:
            return CameraStateID.MOTION_DETECTION;
        case CommandType.CMD_NAS_SWITCH:
            return CameraStateID.RTSP_STREAM;
        case CommandType.CMD_DEV_LED_SWITCH:
        case CommandType.CMD_INDOOR_LED_SWITCH:
        case CommandType.CMD_BAT_DOORBELL_SET_LED_ENABLE:
            return CameraStateID.LED_STATUS;
        case CommandType.CMD_INDOOR_DET_SET_SOUND_DETECT_ENABLE:
            return IndoorCameraStateID.SOUND_DETECTION;
        case CommandType.CMD_INDOOR_DET_SET_PET_ENABLE:
            return IndoorCameraStateID.PET_DETECTION;
    }
    switch(type) {
        case ParamType.COMMAND_MOTION_DETECTION_PACKAGE:
            return CameraStateID.MOTION_DETECTION;
        case ParamType.COMMAND_LED_NIGHT_OPEN:
            return CameraStateID.LED_STATUS;
    }
    return null;
}

export const getImage = async function(url: string): Promise<AxiosResponse> {
    const response = await axios({
        method: "GET",
        url: url,
        responseType: "arraybuffer",
        validateStatus: function (_status) {
            return true;
        }
    });

    return response;
}

export const getImageAsHTML = function(data: Buffer): string {
    if (data && data.length > 0)
        return `<img src="data:image/jpg;base64,${data.toString("base64")}" style="width: auto ;height: 100%;" />`;
    return "";
}

export const getDataFilePath = function(adapter: ioBroker.Adapter, stationSerial: string, folderName: string, fileName: string): string {
    const dir_path = path.join(utils.getAbsoluteInstanceDataDir(adapter), stationSerial, folderName);
    if (!fse.existsSync(dir_path)) {
        fse.mkdirSync(dir_path, {mode: 0o775, recursive: true});
    }
    return path.join(dir_path, fileName);
}

export const saveImage = async function(adapter: ioBroker.Adapter, url: string, station_sn: string, device_sn: string, location: string): Promise<ImageResponse> {
    const result: ImageResponse = {
        status: 0,
        statusText: "",
        imageUrl: "",
        imageHtml: ""
    };
    try {
        if (url) {
            const response = await getImage(url);
            result.status = response.status;
            result.statusText = response.statusText;
            if (response.status === 200) {
                const data = Buffer.from(response.data);
                const fileName = `${device_sn}${IMAGE_FILE_JPEG_EXT}`;
                const filePath = path.join(utils.getAbsoluteInstanceDataDir(adapter), station_sn, location);

                if (!fse.existsSync(filePath)) {
                    fse.mkdirSync(filePath, {mode: 0o775, recursive: true});
                }

                await fse.writeFile(path.join(filePath, fileName), data).then(() => {
                //await adapter.writeFileAsync(adapter.namespace, `${station_sn}/${location}/${device_sn}${IMAGE_FILE_JPEG_EXT}`, data).then(() => {
                    result.imageUrl = `/${adapter.namespace}/${station_sn}/${location}/${device_sn}${IMAGE_FILE_JPEG_EXT}`;
                    result.imageHtml = getImageAsHTML(data);
                }).catch(error => {
                    adapter.log.error(`saveImage(): writeFile Error: ${error} - url: ${url}`);
                });
            }
        }
    } catch (error) {
        adapter.log.error(`saveImage(): Error: ${error} - url: ${url}`);
    }
    return result;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const setStateChangedWithTimestamp = async function(adapter: ioBroker.Adapter, id: string, value: any, timestamp: number): Promise<void> {
    const obj = await adapter.getObjectAsync(id);
    if (obj) {
        if ((obj.native.timestamp !== undefined && obj.native.timestamp < timestamp) || obj.native.timestamp === undefined) {
            obj.native.timestamp = timestamp;

            await setStateChangedAsync(adapter, id, value);
            await adapter.setObject(id, obj);
        }
    }
};

export const setStateWithTimestamp = async function(adapter: ioBroker.Adapter, state_id: string, common_name: string, value: string, timestamp:number = new Date().getTime() - 15 * 60 * 1000, role = "text", type: "string" | "number" | "boolean" | "object" | "array" | "mixed" | "file" | undefined = "string"): Promise<void> {
    const obj = await adapter.getObjectAsync(state_id);
    if (obj) {
        if ((obj.native.timestamp !== undefined && obj.native.timestamp < timestamp) || obj.native.timestamp === undefined) {
            obj.native.timestamp = timestamp;

            await adapter.setStateAsync(state_id, { val: value, ack: true });
            await adapter.setObject(state_id, obj);
        }
    } else {
        await adapter.setObjectNotExistsAsync(state_id, {
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
        await adapter.setStateAsync(state_id, { val: value, ack: true });
    }
}

export const saveImageStates = async function(adapter: ioBroker.Adapter, url: string, timestamp:number, station_sn: string, device_sn: string, location: string, url_state_id: string, html_state_id: string, prefix_common_name: string, retry = 1): Promise<void> {
    const image_data = await saveImage(adapter, url, station_sn, device_sn, location);
    if (image_data.status === 404) {
        if (retry < 6) {
            adapter.log.info(`Retry get image in ${5 * retry} seconds from url: ${url} (retry_count: ${retry} error: ${image_data.statusText} message: ${image_data.statusText})...`);
            setTimeout(() => {
                saveImageStates(adapter, url, timestamp, station_sn, device_sn, location, url_state_id, html_state_id, prefix_common_name, ++retry);
            }, 5 * 1000 * retry);
        } else {
            adapter.log.warn(`Could not download the image within 5 attempts from url: ${url} (error: ${image_data.statusText} message: ${image_data.statusText})`);
        }
        return;
    }
    setStateWithTimestamp(adapter, url_state_id, `${prefix_common_name} URL`, image_data.imageUrl, timestamp, "url");
    setStateWithTimestamp(adapter, html_state_id, `${prefix_common_name} HTML image`, image_data.imageHtml, timestamp, "html");
}

export const removeFiles = function(adapter: ioBroker.Adapter, stationSerial: string, folderName: string, device_sn: string): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            const dir_path = path.join(utils.getAbsoluteInstanceDataDir(adapter), stationSerial, folderName);
            if (fse.existsSync(dir_path)) {
                const files = fse.readdirSync(dir_path).filter(fn => fn.startsWith(device_sn));
                try {
                    files.map(filename => fse.removeSync(path.join(dir_path, filename)));
                } catch (error) {
                }
            }
            resolve();
        } catch (error) {
            reject(error);
        }
    });
}

export const moveFiles = function(adapter: ioBroker.Adapter, stationSerial: string, device_sn: string, srcFolderName: string, dstFolderName: string): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            const dirSrcPath = path.join(utils.getAbsoluteInstanceDataDir(adapter), stationSerial, srcFolderName);
            const dirDstPath = path.join(utils.getAbsoluteInstanceDataDir(adapter), stationSerial, dstFolderName);
            if (!fse.existsSync(dirDstPath)) {
                fse.mkdirSync(dirDstPath, {mode: 0o775, recursive: true});
            }
            if (fse.existsSync(dirSrcPath)) {
                const files = fse.readdirSync(dirSrcPath).filter(fn => fn.startsWith(device_sn));
                try {
                    files.map(filename => fse.moveSync(path.join(dirSrcPath, filename), path.join(dirDstPath, filename)));
                } catch (error) {
                }
            }
            resolve();
        } catch (error) {
            reject(error);
        }
    });
}

export const lowestUnusedNumber = function (sequence: number[], startingFrom: number): number {
    const arr = sequence.slice(0);
    arr.sort((a, b) => a - b);
    return arr.reduce((lowest, num, i) => {
        const seqIndex = i + startingFrom;
        return num !== seqIndex && seqIndex < lowest ? seqIndex : lowest
    }, arr.length + startingFrom);
}

export const sleep = async (ms: number): Promise<void> => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};

export const getVideoClipLength = (device: Device): number => {
    let length = 60;
    const workingMode = device.getRawProperty(CommandType.CMD_SET_PIR_POWERMODE);
    if (workingMode !== undefined) {
        switch(workingMode.value) {
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
                const customValue = device.getRawProperty(CommandType.CMD_DEV_RECORD_TIMEOUT);
                if (customValue !== undefined) {
                    try {
                        length = Number.parseInt(customValue.value);
                    } catch(error) {
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

export const removeLastChar = function(text: string, char: string): string {
    const strArr = [...text];
    strArr.splice(text.lastIndexOf(char), 1);
    return strArr.join("");
}

export const handleUpdate = async function(adapter: ioBroker.Adapter, log: ioBrokerLogger, old_version: number): Promise<void> {
    if (old_version <= 0.31) {
        try {
            const watermark = await adapter.getStatesAsync("*.watermark");
            Object.keys(watermark).forEach(async id => {
                await adapter.delObjectAsync(id);
            });
        } catch (error) {
            log.error("Version 0.3.1 - watermark: Error:", error);
        }
        try {
            const state = await adapter.getStatesAsync("*.state");
            Object.keys(state).forEach(async id => {
                await adapter.delObjectAsync(id);
            });
        } catch (error) {
            log.error("Version 0.3.1 - state: Error:", error);
        }
        try {
            const wifi_rssi = await adapter.getStatesAsync("*.wifi_rssi");
            Object.keys(wifi_rssi).forEach(async id => {
                await adapter.delObjectAsync(id);
            });
        } catch (error) {
            log.error("Version 0.3.1 - wifi_rssi: Error:", error);
        }
    } else if (old_version <= 0.41) {
        try {
            const changeRole = async function(adapter: ioBroker.Adapter, state: string, role: string): Promise<void> {
                try {
                    const states = await adapter.getStatesAsync(`*.${state}`);
                    Object.keys(states).forEach(async id => {
                        await adapter.extendObjectAsync(id, {
                            type: "state",
                            common: {
                                role: role
                            }
                        }, {});
                    });
                } catch (error) {
                    log.error(`state: ${state} role: ${role} - Error:`, error);
                }
            };

            await changeRole(adapter, CameraStateID.STATE, "value");
            await changeRole(adapter, CameraStateID.LIVESTREAM, "url");
            await changeRole(adapter, CameraStateID.LAST_LIVESTREAM_PIC_URL, "url");
            await changeRole(adapter, CameraStateID.LAST_LIVESTREAM_PIC_HTML, "html");
            await changeRole(adapter, CameraStateID.LAST_LIVESTREAM_VIDEO_URL, "url");
            await changeRole(adapter, CameraStateID.ENABLED, "switch.enable");
            await changeRole(adapter, CameraStateID.ANTITHEFT_DETECTION, "switch.enable");
            await changeRole(adapter, CameraStateID.AUTO_NIGHTVISION, "switch.enable");
            await changeRole(adapter, CameraStateID.MOTION_DETECTION, "switch.enable");
            await changeRole(adapter, CameraStateID.RTSP_STREAM, "switch.enable");
            await changeRole(adapter, CameraStateID.RTSP_STREAM_URL, "url");
            await changeRole(adapter, CameraStateID.LED_STATUS, "switch.enable");
            await changeRole(adapter, CameraStateID.MOTION_DETECTED, "sensor.motion");
            await changeRole(adapter, CameraStateID.PERSON_DETECTED, "sensor.motion");
            await changeRole(adapter, CameraStateID.LAST_PERSON_IDENTIFIED, "text");
            await changeRole(adapter, CameraStateID.LAST_EVENT_PICTURE_URL, "url");
            await changeRole(adapter, CameraStateID.LAST_EVENT_PICTURE_HTML, "html");
            await changeRole(adapter, CameraStateID.LAST_EVENT_VIDEO_URL, "url");
            await changeRole(adapter, DoorbellStateID.RINGING, "sensor");
            await changeRole(adapter, IndoorCameraStateID.SOUND_DETECTION, "switch.enable");
            await changeRole(adapter, IndoorCameraStateID.PET_DETECTION, "switch.enable");
            await changeRole(adapter, IndoorCameraStateID.SOUND_DETECTED, "sensor.noise");
            await changeRole(adapter, IndoorCameraStateID.CRYING_DETECTED, "sensor.noise");
            await changeRole(adapter, IndoorCameraStateID.PET_DETECTED, "sensor");
            await changeRole(adapter, EntrySensorStateID.STATE, "value");
            await changeRole(adapter, EntrySensorStateID.SENSOR_OPEN, "sensor");
            await changeRole(adapter, EntrySensorStateID.LOW_BATTERY, "sensor");
            await changeRole(adapter, EntrySensorStateID.SENSOR_CHANGE_TIME, "value");
            await changeRole(adapter, MotionSensorStateID.STATE, "value");
            await changeRole(adapter, MotionSensorStateID.LOW_BATTERY, "sensor");
            await changeRole(adapter, MotionSensorStateID.MOTION_DETECTED, "sensor.motion");
            await changeRole(adapter, KeyPadStateID.STATE, "value");
            await changeRole(adapter, KeyPadStateID.LOW_BATTERY, "sensor");
            await changeRole(adapter, StationStateID.CURRENT_MODE, "value");
        } catch (error) {
            log.error("Version 0.4.1 - Error:", error);
        }
    } else if (old_version <= 0.42) {
        try {
            const changeRole = async function(adapter: ioBroker.Adapter, state: string, role: string): Promise<void> {
                try {
                    const states = await adapter.getStatesAsync(`*.${state}`);
                    Object.keys(states).forEach(async id => {
                        await adapter.extendObjectAsync(id, {
                            type: "state",
                            common: {
                                role: role
                            }
                        }, {});
                    });
                } catch (error) {
                    log.error(`state: ${state} role: ${role} - Error:`, error);
                }
            };

            await changeRole(adapter, CameraStateID.STATE, "info.status");
            await changeRole(adapter, CameraStateID.NAME, "info.name");
            await changeRole(adapter, CameraStateID.MAC_ADDRESS, "info.mac");
            await changeRole(adapter, CameraStateID.BATTERY, "value.battery");
            await changeRole(adapter, CameraStateID.BATTERY_TEMPERATURE, "value.temperature");
            await changeRole(adapter, EntrySensorStateID.LOW_BATTERY, "indicator.lowbat");
            await changeRole(adapter, StationStateID.LAN_IP_ADDRESS, "info.ip");
        } catch (error) {
            log.error("Version 0.4.2 - States - Error:", error);
        }
        try {
            const files = fse.readdirSync(path.join(utils.getAbsoluteDefaultDataDir(), "files", adapter.namespace)).filter(fn => fn.startsWith("T"));
            files.map(filename => fse.moveSync(path.join(utils.getAbsoluteDefaultDataDir(), "files", adapter.namespace, filename), path.join(utils.getAbsoluteInstanceDataDir(adapter), filename)));
        } catch (error) {
            log.error("Version 0.4.2 - Files - Error:", error);
        }
    }
};
