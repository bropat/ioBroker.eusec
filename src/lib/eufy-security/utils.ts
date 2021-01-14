import * as crypto from "crypto";
import { readBigUInt64BE } from "read-bigint";
import axios from "axios";
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
    //TODO: Extend the implementation as soon as new p2p commands are implemented!
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

export const saveImage = async function(adapter: ioBroker.Adapter, url: string, filename_without_extension: string): Promise<ImageResponse> {
    const result: ImageResponse = {
        image_url: "",
        image_html: ""
    };
    if (url) {
        const data = await getImage(url).catch(error => {
            adapter.log.error(`saveImage(): getImage Error: ${error} - url: ${url}`);
            return Buffer.from([]);
        });
        const filename = `${filename_without_extension}.jpg`;
        await adapter.writeFileAsync(`${adapter.name}.${adapter.instance}`, filename, data).then(() => {
            result.image_url = `/${adapter.name}.${adapter.instance}/${filename}`;
            result.image_html = `<img src="data:image/jpg;base64,${data.toString("base64")}" style="width: auto ;height: 100%;" />`;
        }).catch(error => {
            adapter.log.error(`saveImage(): writeFile Error: ${error} - url: ${url}`);
        });
    }
    return result;
}

export const saveImageStates = async function(adapter: ioBroker.Adapter, url: string, serial_number: string, url_state_id: string, html_state_id: string, prefix_common_name: string, filename_prefix = ""): Promise<void> {
    const obj = await adapter.getObjectAsync(url_state_id);
    if (obj) {
        if ((obj.native.url && obj.native.url.split("?")[0] !== url.split("?")[0]) || (!obj.native.url && url && url !== "")) {
            obj.native.url = url;
            const image_data = await saveImage(adapter, url, `${filename_prefix}${serial_number}`);

            await adapter.setStateAsync(url_state_id, { val: image_data.image_url, ack: true });
            await adapter.setStateAsync(html_state_id, { val: image_data.image_html, ack: true });
            await adapter.setObject(url_state_id, obj);
        }
    } else {
        const image_data = await saveImage(adapter, url, `${filename_prefix}${serial_number}`);

        await adapter.setObjectNotExistsAsync(url_state_id, {
            type: "state",
            common: {
                name: `${prefix_common_name} URL`,
                type: "string",
                role: "text",
                read: true,
                write: false,
            },
            native: {
                url: url
            },
        });
        await adapter.setStateAsync(url_state_id, { val: image_data.image_url, ack: true });

        await adapter.setObjectNotExistsAsync(html_state_id, {
            type: "state",
            common: {
                name: `${prefix_common_name} HTML image`,
                type: "string",
                role: "text",
                read: true,
                write: false,
            },
            native: {
            },
        });
        await adapter.setStateAsync(html_state_id, { val: image_data.image_html, ack: true });
    }
}