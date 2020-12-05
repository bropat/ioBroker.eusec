import { Device } from "./http/device";
import { Devices, Stations } from "./http/interfaces";
import { Station } from "./http/station";
import { Credentials, PushMessage } from "./push/models";

interface EufySecurityInterfaceEvents {
    "devices": (devices: Devices) => void;
    "stations": (stations: Stations) => void;
    "push_notifications": (push_msg: PushMessage) => void;
    "connected": () => void;
    "not_connected": () => void;
    "device_parameter": (device: Device, param_type: number, param_value: string) => void;
    "station_parameter": (station: Station, param_type: number, param_value: string) => void;
}

export declare interface EufySecurityInterface {

    on<U extends keyof EufySecurityInterfaceEvents>(
        event: U, listener: EufySecurityInterfaceEvents[U]
    ): this;

    emit<U extends keyof EufySecurityInterfaceEvents>(
        event: U, ...args: Parameters<EufySecurityInterfaceEvents[U]>
    ): boolean;

}

export interface AdapterConfig {
    username: string;
    password: string;
    pollingInterval: number;
    maxLivestreamDuration: number;
    eventDuration: number;
    verificationMethod: number;
}

export interface PersistentData {
    login_hash: string;
    openudid: string;
    serial_number: string;
    api_base: string;
    cloud_token: string;
    cloud_token_expiration: number;
    push_credentials: Credentials | undefined;
    push_persistentIds: string[];
}