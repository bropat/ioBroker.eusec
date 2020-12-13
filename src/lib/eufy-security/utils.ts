import * as crypto from "crypto";
import { readBigUInt64BE } from "read-bigint";
import axios from "axios";
import { Device } from "./http/device";
import { StationStateID } from "./http/types";
import { CommandType } from "./p2p/types";
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

export const getState = function(type: CommandType): string | null {
    //TODO: Finish implementation!
    switch(type) {
        case CommandType.CMD_SET_ARMING:
            return StationStateID.GUARD_MODE;
    }
    return null;
}

export const getImage = async function(url: string): Promise<Buffer> {
    const response = await axios({
        method: "GET",
        url: url,
        responseType: "arraybuffer"
    });

    return Buffer.from(response.data);
}

export const saveImage = async function(adapter: ioBroker.Adapter, url: string, device: Device): Promise<ImageResponse> {
    const result: ImageResponse = {
        image_url: "",
        image_html: ""
    };
    if (url) {
        const data = await getImage(url);
        const filename = `${device.getSerial()}.jpg`;
        await adapter.writeFileAsync(`${adapter.name}.${adapter.instance}`, filename, data).then(() => {
            result.image_url = `/${adapter.name}.${adapter.instance}/${filename}`;
            result.image_html = `<img src="data:image/jpg;base64,${data.toString("base64")}" style="width: auto ;height: 100%;" />`;
        }).catch(error => {
            adapter.log.error(`saveImage(): Error: ${JSON.stringify(error)}`);
        });
    }
    return result;
}