import { Camera, Device } from "./device";
import { FullDeviceResponse, HubResponse } from "./models";
import { Station } from "./station";

export interface IParameter {
    param_type: number;
    param_value: any;
}

export interface ParameterArray {
    [index: number]: string;
}

export interface Devices {
    [index: string]: Device;
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
    "devices": (devices: FullDevices) => void;
    "hubs": (hubs: Hubs) => void;
    "not_connected": () => void;
}

export declare interface ApiInterface {

    on<U extends keyof ApiInterfaceEvents>(
        event: U, listener: ApiInterfaceEvents[U]
    ): this;

    emit<U extends keyof ApiInterfaceEvents>(
        event: U, ...args: Parameters<ApiInterfaceEvents[U]>
    ): boolean;

}

interface StationInterfaceEvents {
    "parameter": (station: Station, type: number, value: string) => void;
}

export declare interface StationInterface {

    on<U extends keyof StationInterfaceEvents>(
        event: U, listener: StationInterfaceEvents[U]
    ): this;

    emit<U extends keyof StationInterfaceEvents>(
        event: U, ...args: Parameters<StationInterfaceEvents[U]>
    ): boolean;

}

interface DeviceInterfaceEvents {
    "parameter": (device: Device, type: number, value: string) => void;
}

export declare interface DeviceInterface {

    on<U extends keyof DeviceInterfaceEvents>(
        event: U, listener: DeviceInterfaceEvents[U]
    ): this;

    emit<U extends keyof DeviceInterfaceEvents>(
        event: U, ...args: Parameters<DeviceInterfaceEvents[U]>
    ): boolean;

}