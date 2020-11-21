import * as crypto from "crypto";

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

export const getPushNotificationStateID = (state: string): string => {
    return `push_notification.${state}`;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const setStateChangedAsync = async function(adapter: ioBroker.Adapter, id: string, value: any): ioBroker.SetStateChangedPromise {
    return await adapter.setStateChangedAsync(id, value === undefined || value === null ? null : { val: value, ack: true }).catch();
    //return await adapter.setStateChangedAsync(id, { val: value, ack: true });
};
