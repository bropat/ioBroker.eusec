import { TypedEmitter } from "tiny-typed-emitter";
import { HTTPApi } from "./api";
import { GuardMode } from "./types";
import { HubResponse } from "./models";
import { ParameterValue, ParameterArray, StationEvents } from "./interfaces";
import { WatermarkSetting1, WatermarkSetting2, WatermarkSetting3 } from "../p2p/types";
import { Device } from "./device";
export declare class Station extends TypedEmitter<StationEvents> {
    private api;
    private hub;
    private log;
    private dsk_key;
    private dsk_expiration;
    private p2p_session;
    private parameters;
    private currentDelay;
    private reconnectTimeout?;
    static readonly CHANNEL: number;
    constructor(api: HTTPApi, hub: HubResponse);
    getStateID(state: string, level?: number): string;
    getStateChannel(): string;
    private _updateParameter;
    update(hub: HubResponse, force?: boolean): void;
    isStation(): boolean;
    isDeviceStation(): boolean;
    getDeviceType(): number;
    getHardwareVersion(): string;
    getMACAddress(): string;
    getModel(): string;
    getName(): string;
    getSerial(): string;
    getSoftwareVersion(): string;
    getIPAddress(): string;
    getParameter(param_type: number): ParameterValue;
    private getDSKKeys;
    isConnected(): boolean;
    close(): void;
    connect(): Promise<void>;
    private onFinishDownload;
    private onStartDownload;
    private onStopLivestream;
    private onStartLivestream;
    private onWifiRssiChanged;
    private onRTSPUrl;
    setGuardMode(mode: GuardMode): Promise<void>;
    getCameraInfo(): Promise<void>;
    getStorageInfo(): Promise<void>;
    private onAlarmMode;
    private _getDeviceSerial;
    private onCameraInfo;
    private onCommandResponse;
    private onConnect;
    private onDisconnect;
    getParameters(): ParameterArray;
    private getCurrentDelay;
    private resetCurrentDelay;
    private scheduleReconnect;
    rebootHUB(): Promise<void>;
    setStatusLed(device: Device, value: boolean): Promise<void>;
    setAutoNightVision(device: Device, value: boolean): Promise<void>;
    setMotionDetection(device: Device, value: boolean): Promise<void>;
    setRTSPStream(device: Device, value: boolean): Promise<void>;
    setAntiTheftDetection(device: Device, value: boolean): Promise<void>;
    setWatermark(device: Device, value: WatermarkSetting1 | WatermarkSetting2 | WatermarkSetting3): Promise<void>;
    enableDevice(device: Device, value: boolean): Promise<void>;
    startDownload(path: string, cipher_id: number): Promise<void>;
    cancelDownload(device: Device): Promise<void>;
    startLivestream(device: Device): Promise<void>;
    stopLivestream(device: Device): Promise<void>;
    isLiveStreaming(device: Device): boolean;
    quickResponse(device: Device, voice_id: number): Promise<void>;
}
