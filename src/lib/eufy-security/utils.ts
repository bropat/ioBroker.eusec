import * as crypto from "crypto";
import { readBigUInt64BE } from "read-bigint";
import axios, { AxiosResponse } from "axios";
import { CommandType, Device, ParamType } from "eufy-security-client";
import path from "path";
import fse from "fs-extra";
import * as utils from "@iobroker/adapter-core";

import { CameraStateID, IMAGE_FILE_JPEG_EXT, IndoorCameraStateID, StationStateID } from "./types";
import { ImageResponse } from "./interfaces";

export const decrypt = (key: string, value: string): string => {
    let result = "";
    for (let i = 0; i < value.length; ++i) {
        result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
    }
    return result;
}

export const generateUDID = function(): string {
    //return crypto.randomBytes(8).readBigUInt64BE().toString(16);
    return readBigUInt64BE(crypto.randomBytes(8)).toString(16);
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

export const getDataFilePath = function(namespace: string, stationSerial: string, folderName: string, fileName: string): string {
    const root_path = `${utils.getAbsoluteDefaultDataDir()}files${path.sep}${namespace}`
    const dir_path = `${root_path}${path.sep}${stationSerial}${path.sep}${folderName}`;
    if (!fse.existsSync(dir_path)) {
        fse.mkdirSync(dir_path, {mode: 0o775, recursive: true});
    }
    return `${dir_path}${path.sep}${fileName}`;
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
                await adapter.writeFileAsync(adapter.namespace, `${station_sn}/${location}/${device_sn}${IMAGE_FILE_JPEG_EXT}`, data).then(() => {
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
    setStateWithTimestamp(adapter, url_state_id, `${prefix_common_name} URL`, image_data.imageUrl, timestamp);
    setStateWithTimestamp(adapter, html_state_id, `${prefix_common_name} HTML image`, image_data.imageHtml, timestamp);
}

export const removeFiles = function(namespace: string, stationSerial: string, folderName: string, device_sn: string): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            const root_path = `${utils.getAbsoluteDefaultDataDir()}files${path.sep}${namespace}`
            const dir_path = `${root_path}${path.sep}${stationSerial}${path.sep}${folderName}`;
            if (fse.existsSync(dir_path)) {
                const files = fse.readdirSync(dir_path).filter(fn => fn.startsWith(device_sn));
                try {
                    files.map(filename => fse.removeSync(`${dir_path}${path.sep}${filename}`));
                } catch (error) {
                }
            }
            resolve();
        } catch (error) {
            reject(error);
        }
    });
}

export const moveFiles = function(namespace: string, stationSerial: string, device_sn: string, srcFolderName: string, dstFolderName: string): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            const rootPath = `${utils.getAbsoluteDefaultDataDir()}files${path.sep}${namespace}`
            const dirSrcPath = `${rootPath}${path.sep}${stationSerial}${path.sep}${srcFolderName}`;
            const dirDstPath = `${rootPath}${path.sep}${stationSerial}${path.sep}${dstFolderName}`;
            if (!fse.existsSync(dirDstPath)) {
                fse.mkdirSync(dirDstPath, {mode: 0o775, recursive: true});
            }
            if (fse.existsSync(dirSrcPath)) {
                const files = fse.readdirSync(dirSrcPath).filter(fn => fn.startsWith(device_sn));
                try {
                    files.map(filename => fse.moveSync(`${dirSrcPath}${path.sep}${filename}`, `${dirDstPath}${path.sep}${filename}`));
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
    const workingMode = device.getParameter(CommandType.CMD_SET_PIR_POWERMODE);
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
                const customValue = device.getParameter(CommandType.CMD_DEV_RECORD_TIMEOUT);
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

export const handleUpdate = async function(adapter: ioBroker.Adapter, old_version: number): Promise<void> {
    if (old_version <= 31) {
        try {
            const watermark = await adapter.getStatesAsync("*.watermark");
            Object.keys(watermark).forEach(async id => {
                await adapter.delObjectAsync(id);
            });
        } catch (error) {
        }
        try {
            const state = await adapter.getStatesAsync("*.state");
            Object.keys(state).forEach(async id => {
                await adapter.delObjectAsync(id);
            });
        } catch (error) {
        }
        try {
            const wifi_rssi = await adapter.getStatesAsync("*.wifi_rssi");
            Object.keys(wifi_rssi).forEach(async id => {
                await adapter.delObjectAsync(id);
            });
        } catch (error) {
        }
    }
};
