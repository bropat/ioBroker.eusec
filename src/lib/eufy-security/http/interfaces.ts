import { EufySecurity } from "../eufy-security";
import { Camera } from "./device";
import { FullDeviceResponse, HubResponse } from "./models";
import { Station } from "./station";

export interface IParameter {
    param_type: number;
    param_value: any;
}

export interface ParameterArray {
    [index: number]: string;
}

export interface Cameras {
    [index: string]: Camera;
}

export interface Stations {
    [index: string]: Station;
}

export interface Hubs {
    [index: string]: HubResponse;
}

export interface FullDevices {
    [index: string]: FullDeviceResponse;
}

interface ApiInterfaceEvents {
    "devices": (devices: FullDevices, eufy: EufySecurity) => void;
    "hubs": (hubs: Hubs, eufy: EufySecurity) => void;
}

export declare interface ApiInterface {

    on<U extends keyof ApiInterfaceEvents>(
        event: U, listener: ApiInterfaceEvents[U], eufy: EufySecurity
    ): this;

    emit<U extends keyof ApiInterfaceEvents>(
        event: U, ...args: Parameters<ApiInterfaceEvents[U]>
    ): boolean;

}