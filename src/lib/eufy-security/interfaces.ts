import { Device, Devices, Station, Stations, Credentials, PushMessage } from "eufy-security-client";

export interface EufySecurityEvents {
    "devices": (devices: Devices) => void;
    "stations": (stations: Stations) => void;
    "push_notification": (push_msg: PushMessage) => void;
    "connect": () => void;
    "disconnect": () => void;
    "device_parameter": (device: Device, param_type: number, param_value: string) => void;
    "station_parameter": (station: Station, param_type: number, param_value: string) => void;
    "start_livestream": (station: Station, device: Device, url: string) => void;
    "stop_livestream": (station: Station, device: Device) => void;
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


export interface ImageResponse {
    status: number;
    statusText: string;
    imageUrl: string;
    imageHtml: string;
}