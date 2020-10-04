import { API } from "./api";
import { DeviceType, ParamType } from "./types";
import { FullDeviceResponse, ResultResponse, StreamResponse, DeviceResponse } from "./models"
import { Parameter } from "./parameter";
import { IParameter, ParameterArray } from "./interfaces";
import { getCameraStateID } from "../utils";

export abstract class Device {

    protected api: API;
    protected device: FullDeviceResponse;
    protected log: ioBroker.Logger;

    constructor(api: API, device: FullDeviceResponse) {
        this.api = api;
        this.device = device;
        this.log = api.getLog();
        this.update(device);
    }

    public update(device: FullDeviceResponse):void {
        this.device = device;
    }

    static isCamera(device: DeviceResponse): boolean {
        if (device.device_type == DeviceType.CAMERA ||
            device.device_type == DeviceType.CAMERA2 ||
            device.device_type == DeviceType.CAMERA_E ||
            device.device_type == DeviceType.CAMERA2C ||
            device.device_type == DeviceType.INDOOR_CAMERA ||
            device.device_type == DeviceType.INDOOR_PT_CAMERA ||
            device.device_type == DeviceType.FLOODLIGHT ||
            device.device_type == DeviceType.DOORBELL ||
            device.device_type == DeviceType.BATTERY_DOORBELL)
            return true;
        return false;
    }

    static isDoorbell(device: DeviceResponse): boolean {
        if (device.device_type == DeviceType.DOORBELL ||
            device.device_type == DeviceType.BATTERY_DOORBELL)
            return true;
        return false;
    }

    public abstract getStateID(state: string): string;

}

export class Camera extends Device {

    private is_streaming = false;

    public getStateID(state: string): string {
        return getCameraStateID(this, 2, state);
    }

    public getDeviceType(): number {
        return this.device.device_type;
    }

    public getHardwareVersion(): string {
        return this.device.main_hw_version;
    }

    public getLastCameraImageURL(): string {
        return this.device.cover_path;
    }

    public getMACAddress(): string {
        return this.device.wifi_mac;
    }

    public getModel(): string {
        return this.device.device_model;
    }

    public getName(): string {
        return this.device.device_name;
    }

    public getSerial(): string {
        return this.device.device_sn;
    }

    public getSoftwareVersion(): string {
        return this.device.main_sw_version;
    }

    public getStationSerial(): string {
        return this.device.station_sn;
    }

    public getParameters(): ParameterArray {
        const parameters: ParameterArray = {};

        this.device.params.forEach(param => {
            parameters[param.param_type] = Parameter.readValue(param.param_type, param.param_value);
        });

        return parameters;
    }

    public async setParameters(params: IParameter[]): Promise<void> {
        const tmp_params: any[] = []
        params.forEach(param => {
            tmp_params.push({ param_type: param.param_type, param_value: Parameter.writeValue(param.param_type, param.param_value) });
        });

        try {
            const response = await this.api.request("post", "app/upload_devs_params", {
                device_sn: this.device.device_sn,
                station_sn: this.device.station_sn,
                json: tmp_params
            });
            this.log.debug(`Camera.setParameters(): Response: ${JSON.stringify(response.data)}`);

            if (response.status == 200) {
                const result: ResultResponse = response.data;
                if (result.code == 0) {
                    const dataresult: StreamResponse = result.data;
                    this.log.debug("New Parameters successfully set.");
                    this.log.info(`Camera.setParameters(): New Parameters set. response: ${JSON.stringify(dataresult)}`);
                } else
                    this.log.error(`Camera.setParameters(): Response code not ok (code: ${result.code} msg: ${result.msg})`);
            } else {
                this.log.error(`Camera.setParameters(): Status return code not 200 (status: ${response.status} text: ${response.statusText}`);
            }
        } catch (error) {
            this.log.error(`Camera.setParameters(): error: ${error}`);
        }
    }

    public async startDetection(): Promise<void> {
        // Start camera detection.
        await this.setParameters([{ param_type: ParamType.DETECT_SWITCH, param_value: 1 }])
    }

    public async startStream(): Promise<string> {
        // Start the camera stream and return the RTSP URL.
        try {
            const response = await this.api.request("post", "web/equipment/start_stream", {
                device_sn: this.device.device_sn,
                station_sn: this.device.station_sn,
                proto: 2
            });
            this.log.debug(`Camera.startStream(): Response: ${JSON.stringify(response.data)}`);

            if (response.status == 200) {
                const result: ResultResponse = response.data;
                if (result.code == 0) {
                    const dataresult: StreamResponse = result.data;
                    this.is_streaming = true;
                    this.log.info(`Livestream of camera ${this.device.device_sn} started.`);
                    return dataresult.url;
                } else
                    this.log.error(`Camera.startStream(): Response code not ok (code: ${result.code} msg: ${result.msg})`);
            } else {
                this.log.error(`Camera.startStream(): Status return code not 200 (status: ${response.status} text: ${response.statusText}`);
            }
        } catch (error) {
            this.log.error(`Camera.startStream(): error: ${error}`);
        }
        return "";
    }

    public async stopDetection(): Promise<void> {
        // Stop camera detection.
        await this.setParameters([{ param_type: ParamType.DETECT_SWITCH, param_value: 0 }])
    }

    public async stopStream(): Promise<void> {
        // Stop the camera stream.
        try {
            const response = await this.api.request("post", "web/equipment/stop_stream", {
                device_sn: this.device.device_sn,
                station_sn: this.device.station_sn,
                proto: 2
            });
            this.log.debug(`Camera.stopStream(): Response: ${JSON.stringify(response.data)}`);

            if (response.status == 200) {
                const result: ResultResponse = response.data;
                if (result.code == 0) {
                    this.is_streaming = false;
                    this.log.info(`Livestream of camera ${this.device.device_sn} stopped.`);
                } else {
                    this.log.error(`Camera.stopStream(): Response code not ok (code: ${result.code} msg: ${result.msg})`);
                }
            } else {
                this.log.error(`Camera.stopStream(): Status return code not 200 (status: ${response.status} text: ${response.statusText}`);
            }
        } catch (error) {
            this.log.error(`Camera.stopStream(): error: ${error}`);
        }
    }

    public isStreaming(): boolean {
        return this.is_streaming;
    }

    public async close(): Promise<void> {
        //TODO: Stop other things if implemented such as detection feature
        if (this.is_streaming)
            await this.stopStream();
    }

}

export class DoorbellCamera extends Camera {

}

export class FloodlightCamera extends Camera {

}