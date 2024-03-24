import { CommandType, Device } from "eufy-security-client";
import path from "path";
import fse from "fs-extra";
import * as utils from "@iobroker/adapter-core";

import { ioBrokerLogger } from "./log";
import { euSec } from "../main";

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

export const getImageAsHTML = function(data: Buffer, mime = "image/jpg"): string {
    if (data && data.length > 0)
        return `<img src="data:${mime};base64,${data.toString("base64")}" style="width: auto ;height: 100%;" />`;
    return "";
}

/*export const getDataFilePath = function(adapter: ioBroker.Adapter, stationSerial: string, folderName: string, fileName: string): string {
    const dir_path = path.join(utils.getAbsoluteInstanceDataDir(adapter), stationSerial, folderName);
    if (!fse.existsSync(dir_path)) {
        fse.mkdirSync(dir_path, {mode: 0o775, recursive: true});
    }
    return path.join(dir_path, fileName);
}*/

export const setStateAsync = async function(adapter: ioBroker.Adapter, state_id: string, common_name: string, value: string, role = "text", type: "string" | "number" | "boolean" | "object" | "array" | "mixed" | "file" | undefined = "string"): Promise<void> {
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
        },
    });
    await adapter.setStateAsync(state_id, { val: value, ack: true });
}

export const removeFiles = function(adapter: ioBroker.Adapter, stationSerial: string, folderName: string, device_sn: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
        try {
            const dir_path = path.join(stationSerial, folderName);
            if (await adapter.fileExistsAsync(adapter.namespace, dir_path)) {
                const files = (await adapter.readDirAsync(adapter.namespace, dir_path)).filter(fn => fn.file.startsWith(device_sn));
                try {
                    files.map(filename => adapter.delFileAsync(adapter.namespace, path.join(dir_path, filename.file)));
                } catch (error) {
                }
            }
            resolve();
        } catch (error) {
            reject(error);
        }
    });
}

/*export const moveFiles = function(adapter: ioBroker.Adapter, stationSerial: string, device_sn: string, srcFolderName: string, dstFolderName: string): Promise<void> {
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
}*/

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
        switch(workingMode) {
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
                        length = Number.parseInt(customValue);
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

export const changeRole = async function(adapter: ioBroker.Adapter, log: ioBrokerLogger, state: string, role: string): Promise<void> {
    try {
        const states = await adapter.getStatesAsync(`*.${state}`);
        if (states)
            Object.keys(states).forEach(async id => {
                await adapter.extendObjectAsync(id, {
                    type: "state",
                    common: {
                        role: role
                    }
                }, {}).catch();
            });
    } catch (error) {
        log.error(`state: ${state} role: ${role} - Error:`, error);
    }
};

export const deleteStates = async function(adapter: ioBroker.Adapter, property: string): Promise<void> {
    const states = await adapter.getStatesAsync(`*.${property}`);
    if (states)
        Object.keys(states).forEach(async id => {
            await adapter.delObjectAsync(id).catch();
        });
};

export const handleUpdate = async function(adapter: euSec, log: ioBrokerLogger, oldVersion: number, newVersion: number): Promise<void> {
    if (oldVersion != 0 && oldVersion <= 0.61) {
        try {
            const all = await adapter.getStatesAsync("T*");
            if (all) {
                Object.keys(all).forEach(async id => {
                    await adapter.delObjectAsync(id, { recursive: false }).catch();
                });
            }
            const channels = await adapter.getChannelsOfAsync();
            if (channels) {
                Object.values(channels).forEach(async channel => {
                    if (channel.common.name !== "info") {
                        await adapter.delObjectAsync(channel._id, {recursive: false}).catch();
                    }
                });
            }
            const devices = await adapter.getDevicesAsync();
            if (devices) {
                Object.values(devices).forEach(async device => {
                    await adapter.delObjectAsync(device._id, {recursive: false}).catch();
                });
            }
        } catch (error) {
            log.error("Version 0.6.1: Error:", error);
        }
    }
    if (oldVersion != 0 && oldVersion <= 0.74) {
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
        } catch (error) {
            log.error("Version 0.7.4: Error:", error);
        }
    }
    if (oldVersion != 0 && oldVersion <= 1) {
        for (const state of ["last_event_pic_url", "last_event_pic_html", "last_event_video_url"]) {
            try {
                await deleteStates(adapter, state);
            } catch (error) {
                log.error(`Version 1.0.0 - ${state}: Error:`, error);
            }
        }
    }
    if (oldVersion == 0 && newVersion == 1.3) {
        const data_dir = utils.getAbsoluteInstanceDataDir(adapter);
        try {
            const file = path.join(data_dir, "adapter.json");
            if (fse.statSync(file).isFile()) {
                const fileContent = fse.readFileSync(file, "utf8");
                await adapter.writeFileAsync(adapter.namespace, "adapter.json", fileContent);
            }
        } catch (error) {
            //log.error(`Version 3.0.0: Error:`, error);
        }
        try {
            const file = path.join(data_dir, "persistent.json");
            if (fse.statSync(file).isFile()) {
                const fileContent = fse.readFileSync(file, "utf8");
                await adapter.writeFileAsync(adapter.namespace, "driver.json", fileContent);
            }
        } catch (error) {
            //log.error(`Version 3.0.0: Error:`, error);
        }
        try {
            fse.removeSync(data_dir);
        } catch (error) {
            //log.error(`Version 3.0.0: Error:`, error);
        }
        adapter.log.warn("Migrated configuration files to new location (needs restart). Restart of the adapter initiated.")
        adapter.restartAdapter();
    }
};

export const convertCamelCaseToSnakeCase = function (value: string): string {
    return value.replace(/[A-Z]/g, (letter, index) => {
        return index == 0 ? letter.toLowerCase() : "_" + letter.toLowerCase();
    });
};

export function getShortUrl(url: URL, prefixUrl?: string): string {
    if (url.password) {
        url = new URL(url.toString()); // prevent original url mutation
        url.password = "[redacted]";
    }
    let shortUrl = url.toString();
    if (prefixUrl && shortUrl.startsWith(prefixUrl)) {
        shortUrl = shortUrl.slice(prefixUrl.length);
    }

    return shortUrl;
}