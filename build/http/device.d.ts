import { TypedEmitter } from "tiny-typed-emitter";
import { Logger } from "ts-log";
import { HTTPApi } from "./api";
import { FullDeviceResponse } from "./models";
import { DeviceEvents, ParameterValue, ParameterArray } from "./interfaces";
export declare abstract class Device extends TypedEmitter<DeviceEvents> {
    protected api: HTTPApi;
    protected device: FullDeviceResponse;
    protected log: Logger;
    private parameters;
    constructor(api: HTTPApi, device: FullDeviceResponse);
    getParameter(param_type: number): ParameterValue;
    getParameters(): ParameterArray;
    private _updateParameter;
    updateParameters(params: ParameterArray): void;
    update(device: FullDeviceResponse, force?: boolean): void;
    static isCamera(type: number): boolean;
    static hasBattery(type: number): boolean;
    static isStation(type: number): boolean;
    static isSensor(type: number): boolean;
    static isKeyPad(type: number): boolean;
    static isDoorbell(type: number): boolean;
    static isIndoorCamera(type: number): boolean;
    static isFloodLight(type: number): boolean;
    static isLock(type: number): boolean;
    static isLockBasic(type: number): boolean;
    static isLockBasicNoFinger(type: number): boolean;
    static isLockAdvanced(type: number): boolean;
    static isLockAdvancedNoFinger(type: number): boolean;
    static isBatteryDoorbell(type: number): boolean;
    static isBatteryDoorbell2(type: number): boolean;
    static isSoloCamera(type: number): boolean;
    static isSoloCameraPro(type: number): boolean;
    static isSoloCameras(type: number): boolean;
    static isCamera2(type: number): boolean;
    static isCamera2C(type: number): boolean;
    static isCamera2Pro(type: number): boolean;
    static isCamera2CPro(type: number): boolean;
    static isCamera2Product(type: number): boolean;
    static isEntrySensor(type: number): boolean;
    static isMotionSensor(type: number): boolean;
    static isIntegratedDeviceBySn(sn: string): boolean;
    static isSoloCameraBySn(sn: string): boolean;
    isCamera(): boolean;
    isFloodLight(): boolean;
    isDoorbell(): boolean;
    isLock(): boolean;
    isLockBasic(): boolean;
    isLockBasicNoFinger(): boolean;
    isLockAdvanced(): boolean;
    isLockAdvancedNoFinger(): boolean;
    isBatteryDoorbell(): boolean;
    isBatteryDoorbell2(): boolean;
    isSoloCamera(): boolean;
    isSoloCameraPro(): boolean;
    isSoloCameras(): boolean;
    isCamera2(): boolean;
    isCamera2C(): boolean;
    isCamera2Pro(): boolean;
    isCamera2CPro(): boolean;
    isCamera2Product(): boolean;
    isEntrySensor(): boolean;
    isKeyPad(): boolean;
    isMotionSensor(): boolean;
    isIndoorCamera(): boolean;
    hasBattery(): boolean;
    getDeviceKey(): string;
    getDeviceType(): number;
    getHardwareVersion(): string;
    getSoftwareVersion(): string;
    getModel(): string;
    getName(): string;
    getSerial(): string;
    getStationSerial(): string;
    setParameters(params: {
        param_type: number;
        param_value: any;
    }[]): Promise<boolean>;
    getChannel(): number;
    getStateID(state: string, level?: number): string;
    abstract getStateChannel(): string;
    getWifiRssi(): number;
    getStoragePath(filename: string): string;
    isEnabled(): boolean;
}
export declare class Camera extends Device {
    private is_streaming;
    getStateChannel(): string;
    getLastCameraImageURL(): string;
    getLastCameraImageTimestamp(): number;
    getMACAddress(): string;
    startDetection(): Promise<void>;
    startStream(): Promise<string>;
    stopDetection(): Promise<void>;
    stopStream(): Promise<void>;
    getState(): number;
    isStreaming(): boolean;
    close(): Promise<void>;
    getLastChargingDays(): number;
    getLastChargingFalseEvents(): number;
    getLastChargingRecordedEvents(): number;
    getLastChargingTotalEvents(): number;
    getBatteryValue(): number;
    getBatteryTemperature(): number;
}
export declare class DoorbellCamera extends Camera {
}
export declare class FloodlightCamera extends Camera {
}
export declare class Sensor extends Device {
    getStateChannel(): string;
    getState(): number;
}
export declare class EntrySensor extends Sensor {
    isSensorOpen(): boolean;
    getSensorChangeTime(): string;
    isBatteryLow(): boolean;
}
export declare class MotionSensor extends Sensor {
    static readonly MOTION_COOLDOWN_MS = 120000;
    static isMotionDetected(millis: number): {
        motion: boolean;
        cooldown_ms: number;
    };
    isMotionDetected(): {
        motion: boolean;
        cooldown_ms: number;
    };
    getMotionSensorPIREvent(): number;
    isBatteryLow(): boolean;
}
export declare class Lock extends Device {
    getStateChannel(): string;
}
export declare class Keypad extends Device {
    getStateChannel(): string;
    getState(): number;
    isBatteryLow(): boolean;
}
export declare class UnknownDevice extends Device {
    getStateChannel(): string;
}
