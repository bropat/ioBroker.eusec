import { TypedEmitter } from "tiny-typed-emitter";
import { HTTPApi, Device, Camera, Lock, MotionSensor, EntrySensor, Keypad, UnknownDevice, Devices, FullDevices, Hubs, Station, Stations, ParamType, FullDeviceResponse, HubResponse, Credentials, PushMessage, CommandResult, CommandType, ErrorCode, StreamMetadata, PushNotificationService, ParameterArray } from "eufy-security-client";
import { Readable } from "stream";
import fse from "fs-extra";

import { CameraStateID, StationStateID } from "./types";
import { EufySecurityEvents } from "./interfaces";
import { EufySecurity as EufySecurityAdapter } from "./../../main";
import { getDataFilePath, getImageAsHTML, getState, moveFiles, removeFiles, setStateChangedWithTimestamp, setStateWithTimestamp } from "./utils";
import { ffmpegPreviewImage, ffmpegRTMPToHls, ffmpegStreamToHls } from "./video";
import { DataLocation, IMAGE_FILE_JPEG_EXT, STREAM_FILE_NAME_EXT } from "./types";
import { ioBrokerLogger } from "./log";

export class EufySecurity extends TypedEmitter<EufySecurityEvents> {

    private adapter: EufySecurityAdapter;

    private username: string;
    private password: string;

    private log: ioBrokerLogger;

    private api: HTTPApi;

    private stations: Stations = {};
    private devices: Devices = {};

    private camera_max_livestream_seconds = 30;
    private camera_livestream_timeout: Map<string, NodeJS.Timeout> = new Map<string, NodeJS.Timeout>();

    private pushService: PushNotificationService;

    constructor(adapter: EufySecurityAdapter) {
        super();

        this.adapter = adapter;
        this.username = this.adapter.config.username;
        this.password = this.adapter.config.password;
        this.camera_max_livestream_seconds = this.adapter.config.maxLivestreamDuration;
        this.log = new ioBrokerLogger(this.adapter.log);
        this.api = new HTTPApi(this.username, this.password, this.log);
        this.api.on("hubs", (hubs) => this.handleHubs(hubs));
        this.api.on("devices", (devices) => this.handleDevices(devices));
        this.api.on("not_connected", () => this.handleNotConnected());
        this.pushService = new PushNotificationService(this.log);
        this.pushService.on("connect", async (token: string) => {
            const registered = await this.api.registerPushToken(token);
            const checked = await this.api.checkPushToken();

            if (registered && checked) {
                this.log.info("Push notification connection successfully established.");
                await this.adapter.setStateAsync("info.push_connection", { val: true, ack: true });
            } else {
                await this.adapter.setStateAsync("info.push_connection", { val: false, ack: true });
            }
        });
        this.pushService.on("credential", (credentials: Credentials) => {
            this.adapter.setPushCredentials(credentials);
        });
        /*this.pushService.on("raw_message", (message: PushMessage) => {
            this.emit("push_notification", message);
        });*/
        this.pushService.on("message", (message: PushMessage) => {
            this.emit("push_notification", message);
        })
    }

    public addStation(station: Station): void {
        const serial = station.getSerial();
        if (serial && !Object.keys(this.stations).includes(serial))
            this.stations[serial] = station;
        else
            throw new Error(`Station with this serial ${station.getSerial()} exists already and couldn't be added again!`);
    }

    public updateStation(hub: HubResponse): void {
        if (Object.keys(this.stations).includes(hub.station_sn))
            this.stations[hub.station_sn].update(hub);
        else
            throw new Error(`Station with this serial ${hub.station_sn} doesn't exists and couldn't be updated!`);
    }

    public addDevice(device: Device): void {
        const serial = device.getSerial()
        if (serial && !Object.keys(this.devices).includes(serial))
            this.devices[serial] = device;
        else
            throw new Error(`Device with this serial ${device.getSerial()} exists already and couldn't be added again!`);
    }

    public updateDevice(device: FullDeviceResponse): void {
        if (Object.keys(this.devices).includes(device.device_sn))
            this.devices[device.device_sn].update(device)
        else
            throw new Error(`Device with this serial ${device.device_sn} doesn't exists and couldn't be updated!`);
    }

    public getDevices(): Devices {
        return this.devices;
    }

    public getDevice(device_sn: string): Device | null {
        if (Object.keys(this.devices).includes(device_sn))
            return this.devices[device_sn];
        return null;
    }

    public getStationDevice(station_sn: string, channel: number): Device {
        for (const device of Object.values(this.devices)) {
            if (device.getStationSerial() === station_sn && device.getChannel() === channel) {
                return device;
            }
        }
        throw new Error(`No device with channel ${channel} found on station with serial number: ${station_sn}!`);
    }

    public getStations(): Stations {
        return this.stations;
    }

    public getStation(station_sn: string): Station {
        if (Object.keys(this.stations).includes(station_sn))
            return this.stations[station_sn];
        throw new Error(`No station with this serial number: ${station_sn}!`);
    }

    public getApi(): HTTPApi {
        return this.api;
    }

    public async connectToStation(station_sn: string): Promise<void> {
        if (Object.keys(this.stations).includes(station_sn))
            this.stations[station_sn].connect();
        else
            throw new Error(`No station with this serial number: ${station_sn}!`);
    }

    private handleHubs(hubs: Hubs): void {
        this.log.debug(`EufySecurity.handleHubs(): hubs: ${Object.keys(hubs).length}`);
        const stations_sns: string[] = Object.keys(this.stations);
        for (const hub of Object.values(hubs)) {
            if (stations_sns.includes(hub.station_sn)) {
                this.updateStation(hub);
            } else {
                const station = new Station(this.api, hub);
                station.on("connect", (station: Station) => this.onConnect(station));
                station.on("close", (station: Station) => this.onClose(station));
                station.on("device_parameter", (device_sn: string, params: ParameterArray) => this.updateDeviceParameter(device_sn, params));
                station.on("parameter", (station: Station, type: number, value: string, modified: number) => this.stationParameterChanged(station, type, value, modified));
                station.on("p2p_command", (station: Station, result: CommandResult) => this.stationP2PCommandResult(station, result));
                station.on("start_download", (station: Station, channel: number, metadata: StreamMetadata, videoStream: Readable, audioStream: Readable) => this.onStartDownload(station, channel, metadata, videoStream, audioStream));
                station.on("finish_download", (station: Station, channel: number) => this.onFinishDownload(station, channel));
                station.on("start_livestream", (station: Station, channel: number, metadata: StreamMetadata, videoStream: Readable, audioStream: Readable) => this.onStartLivestream(station, channel, metadata, videoStream, audioStream));
                station.on("stop_livestream", (station: Station, channel: number) => this.onStopLivestream(station, channel));
                station.update(hub, true);
                this.addStation(station);
            }
        }

        const station_count = Object.keys(this.stations).length;
        this.log.debug(`EufySecurity.handleHubs(): stations: ${station_count}`);
        if (station_count > 0) {
            this.emit("stations", this.stations);
        }
    }

    private onConnect(station: Station): void {
        station.getCameraInfo();
    }

    private onClose(_station: Station): void {
        //TODO: Do something?
    }

    private async stationP2PCommandResult(station: Station, result: CommandResult): Promise<void> {
        if (result.return_code === 0) {
            const state_name = getState(result.command_type);
            if (state_name) {
                if (result.channel === Station.CHANNEL) {
                    // Station
                    if (state_name) {
                        const state_id = station.getStateID(state_name);
                        const state = await this.adapter.getStateAsync(state_id);
                        this.adapter.setStateAsync(state_id, {...state as ioBroker.State, ack: true });
                        this.log.debug(`EufySecurity.stationP2PCommandResult(): State ${state_id} aknowledged - station: ${station.getSerial()} result: ${JSON.stringify(result)}`);
                    } else {
                        this.log.debug(`EufySecurity.stationP2PCommandResult(): Loading current state not possible - station: ${station.getSerial()} result: ${JSON.stringify(result)}`);
                    }
                } else {
                    // Device
                    try {
                        const device = this.getStationDevice(station.getSerial(), result.channel);
                        const state_id = device.getStateID(state_name);
                        const state = await this.adapter.getStateAsync(state_id);
                        this.adapter.setStateAsync(state_id, {...state as ioBroker.State, ack: true });
                        this.log.debug(`EufySecurity.stationP2PCommandResult(): State ${state_id} aknowledged - station: ${station.getSerial()} device: ${device.getSerial()} result: ${JSON.stringify(result)}`);
                    } catch(error) {
                        this.log.error(`EufySecurity.stationP2PCommandResult(): Error: ${error} - station: ${station.getSerial()} result: ${JSON.stringify(result)}`);
                    }
                }
            } else {
                this.log.debug(`EufySecurity.stationP2PCommandResult(): No mapping for state <> command_type - station: ${station.getSerial()} result: ${JSON.stringify(result)}`);
            }
        } else if (result.return_code !== 0 && result.command_type === CommandType.CMD_START_REALTIME_MEDIA) {
            this.log.debug(`EufySecurity.stationP2PCommandResult(): Station: ${station.getSerial()} command ${CommandType[result.command_type]} failed with error: ${ErrorCode[result.return_code]} (${result.return_code}) fallback to RTMP livestream...`);
            try {
                const device = this.getStationDevice(station.getSerial(), result.channel);
                if (device.isCamera())
                    this._startRtmpLivestream(station, device as Camera);
            } catch (error) {
                this.log.error(`EufySecurity.stationP2PCommandResult(): Station: ${station.getSerial()} command ${CommandType[result.command_type]} RTMP fallback failed - Error ${error}`);
            }
        } else {
            this.log.error(`EufySecurity.stationP2PCommandResult(): Station: ${station.getSerial()} command ${CommandType[result.command_type]} failed with error: ${ErrorCode[result.return_code]} (${result.return_code})`);
        }
    }

    private handleDevices(devices: FullDevices): void {
        this.log.debug(`EufySecurity.handleDevices(): devices: ${Object.keys(devices).length}`);
        const device_sns: string[] = Object.keys(this.devices);
        for (const device of Object.values(devices)) {

            if (device_sns.includes(device.device_sn)) {
                //if (!this.getStation(device.station_sn).isConnected())
                this.updateDevice(device);
            } else {
                let new_device: Device;

                if (Device.isCamera(device.device_type)) {
                    new_device = new Camera(this.api, device);
                } else if (Device.isLock(device.device_type)) {
                    new_device = new Lock(this.api, device);
                } else if (Device.isMotionSensor(device.device_type)) {
                    new_device = new MotionSensor(this.api, device);
                } else if (Device.isEntrySensor(device.device_type)) {
                    new_device = new EntrySensor(this.api, device);
                } else if (Device.isKeyPad(device.device_type)) {
                    new_device = new Keypad(this.api, device);
                } else {
                    new_device = new UnknownDevice(this.api, device);
                }

                new_device.on("parameter", (device: Device, type: number, value: string, modified: number) => this.deviceParameterChanged(device, type, value, modified))
                new_device.update(device, true);
                this.addDevice(new_device);
            }
        }
        const device_count = Object.keys(this.devices).length;
        this.log.debug(`EufySecurity.handleDevices(): devices: ${device_count}`);
        if (device_count > 0) {
            this.emit("devices", this.devices);
        }
    }

    public async refreshData(): Promise<void> {
        await this.api.updateDeviceInfo();
        Object.values(this.stations).forEach(async (station: Station) => {
            if (station.isConnected())
                await station.getCameraInfo();
        });
    }

    public close(): void {

        // if there is a camera with livestream running stop it (incl. timeout)
        for (const device_sn of this.camera_livestream_timeout.keys()) {
            this.stopLivestream(device_sn);
        }

        Object.values(this.stations).forEach(station => {
            station.close();
        });
    }

    public setCameraMaxLivestreamDuration(seconds: number): void {
        this.camera_max_livestream_seconds = seconds;
    }

    public getCameraMaxLivestreamDuration(): number {
        return this.camera_max_livestream_seconds;
    }

    public async registerPushNotifications(credentials?: Credentials, persistentIds?: string[]): Promise<void> {
        if (credentials)
            this.pushService.setCredentials(credentials);
        if (persistentIds)
            this.pushService.setPersistentIds(persistentIds);

        this.pushService.open();
    }

    public async logon(verify_code?:number|null): Promise<void> {
        if (verify_code) {
            await this.api.addTrustDevice(verify_code).then(result => {
                if (result)
                    this.emit("connect");
            });
        } else {
            switch (await this.api.authenticate()) {
                case "send_verify_code":
                    break;
                case "renew":
                    this.log.debug("EufySecurity.logon(): renew token");
                    const result = await this.api.authenticate();
                    if (result == "ok") {
                        this.emit("connect");
                    }
                    break;
                case "error":
                    this.log.error("EufySecurity.logon(): token error");
                    break;
                case "ok":
                    this.emit("connect");
                    break;
            }
        }
    }

    public getPushPersistentIds(): string[] {
        return this.pushService.getPersistentIds();
    }

    private stationParameterChanged(station: Station, type: number, value: string, modified: number): void {
        //this.log.debug(`EufySecurity.stationParameterChanged(): station: ${station.getSerial()} type: ${type} value: ${value} modified: ${modified}`);
        if (type == ParamType.GUARD_MODE) {
            try {
                setStateChangedWithTimestamp(this.adapter, station.getStateID(StationStateID.GUARD_MODE), Number.parseInt(value), modified);
            } catch (error) {
                this.log.error(`EufySecurity.stationParameterChanged(): station: ${station.getSerial()} GUARD_MODE Error: ${error}`);
            }
        } else if (type == ParamType.SCHEDULE_MODE) {
            try {
                setStateChangedWithTimestamp(this.adapter, station.getStateID(StationStateID.CURRENT_MODE), Number.parseInt(value), modified);
            } catch (error) {
                this.log.error(`EufySecurity.stationParameterChanged(): station: ${station.getSerial()} CURRENT_MODE Error: ${error}`);
            }
        }
    }

    private updateDeviceParameter(device_sn: string, params: ParameterArray): void {
        this.log.debug(`EufySecurity.updateDeviceParameter(): device: ${device_sn} params: ${JSON.stringify(params)}`);
        const device = this.getDevice(device_sn);
        if (device)
            device.updateParameters(params);
    }

    private deviceParameterChanged(device: Device, type: number, value: string, modified: number): void {
        //this.log.debug(`EufySecurity.deviceParameterChanged(): device: ${device.getSerial()} type: ${type} value: ${value} modified: ${modified}`);
        if (type == CommandType.CMD_GET_BATTERY) {
            try {
                setStateChangedWithTimestamp(this.adapter, device.getStateID(CameraStateID.BATTERY), Number.parseInt(value), modified);
            } catch (error) {
                this.log.error(`EufySecurity.deviceParameterChanged(): device: ${device.getSerial()} BATTERY Error: ${error}`);
            }
        } else if (type == CommandType.CMD_GET_BATTERY_TEMP) {
            try {
                setStateChangedWithTimestamp(this.adapter, device.getStateID(CameraStateID.BATTERY_TEMPERATURE), Number.parseInt(value), modified);
            } catch (error) {
                this.log.error(`EufySecurity.deviceParameterChanged(): device: ${device.getSerial()} BATTERY_TEMP Error: ${error}`);
            }
        } else if (type == CommandType.CMD_GET_WIFI_RSSI) {
            try {
                setStateChangedWithTimestamp(this.adapter, device.getStateID(CameraStateID.WIFI_RSSI), Number.parseInt(value), modified);
            } catch (error) {
                this.log.error(`EufySecurity.deviceParameterChanged(): device: ${device.getSerial()} WIFI_RSSI Error: ${error}`);
            }
        } else if (type == CommandType.CMD_DEVS_SWITCH || type == 99904) {
            try {
                setStateChangedWithTimestamp(this.adapter, device.getStateID(CameraStateID.ENABLED), value === "1" ? true : false, modified);
            } catch (error) {
                this.log.error(`EufySecurity.deviceParameterChanged(): device: ${device.getSerial()} ENABLED Error: ${error}`);
            }
        } else if (type == CommandType.CMD_SET_DEVS_OSD) {
            try {
                setStateChangedWithTimestamp(this.adapter, device.getStateID(CameraStateID.WATERMARK), Number.parseInt(value), modified);
            } catch (error) {
                this.log.error(`EufySecurity.deviceParameterChanged(): device: ${device.getSerial()} WATERMARK Error: ${error}`);
            }
        } else if (type == CommandType.CMD_EAS_SWITCH) {
            try {
                setStateChangedWithTimestamp(this.adapter, device.getStateID(CameraStateID.ANTITHEFT_DETECTION), value === "1" ? true : false, modified);
            } catch (error) {
                this.log.error(`EufySecurity.deviceParameterChanged(): device: ${device.getSerial()} ANTITHEFT_DETECTION Error: ${error}`);
            }
        } else if (type == CommandType.CMD_IRCUT_SWITCH) {
            try {
                setStateChangedWithTimestamp(this.adapter, device.getStateID(CameraStateID.AUTO_NIGHTVISION), value === "1" ? true : false, modified);
            } catch (error) {
                this.log.error(`EufySecurity.deviceParameterChanged(): device: ${device.getSerial()} AUTO_NIGHTVISION Error: ${error}`);
            }
        } else if (type == CommandType.CMD_DEV_LED_SWITCH) {
            try {
                setStateChangedWithTimestamp(this.adapter, device.getStateID(CameraStateID.LED_STATUS), value === "1" ? true : false, modified);
            } catch (error) {
                this.log.error(`EufySecurity.deviceParameterChanged(): device: ${device.getSerial()} LED_STATUS Error: ${error}`);
            }
        } else if (type == CommandType.CMD_GET_DEV_STATUS) {
            try {
                setStateChangedWithTimestamp(this.adapter, device.getStateID(CameraStateID.STATE), Number.parseInt(value), modified);
            } catch (error) {
                this.log.error(`EufySecurity.deviceParameterChanged(): device: ${device.getSerial()} STATE Error: ${error}`);
            }
        }
    }

    private handleNotConnected(): void {
        this.emit("disconnect");
    }

    private async onFinishDownload(station: Station, channel: number): Promise<void> {
        this.log.trace(`EufySecurity.onFinishDownload(): station: ${station.getSerial()} channel: ${channel}`);
    }

    private async onStartDownload(station: Station, channel: number, metadata: StreamMetadata, videostream: Readable, audiostream: Readable): Promise<void> {
        this.log.trace(`EufySecurity.onStartDownload(): station: ${station.getSerial()} channel: ${channel}`);
        try {
            const device = this.getStationDevice(station.getSerial(), channel);
            try {
                await removeFiles(this.adapter.namespace, station.getSerial(), DataLocation.TEMP, device.getSerial());
                const file_path = getDataFilePath(this.adapter.namespace, station.getSerial(), DataLocation.TEMP, `${device.getSerial()}${STREAM_FILE_NAME_EXT}`);

                ffmpegStreamToHls(this.adapter.namespace, metadata, videostream, audiostream, file_path, this.log)
                    .then(() => {
                        return removeFiles(this.adapter.namespace, station.getSerial(), DataLocation.LAST_EVENT, device.getSerial());
                    })
                    .then(() => {
                        return moveFiles(this.adapter.namespace, station.getSerial(), device.getSerial(), DataLocation.TEMP, DataLocation.LAST_EVENT);
                    })
                    .then(() => {
                        const filename_without_ext = getDataFilePath(this.adapter.namespace, station.getSerial(), DataLocation.LAST_EVENT, device.getSerial());
                        setStateWithTimestamp(this.adapter, device.getStateID(CameraStateID.LAST_EVENT_VIDEO_URL), "Last captured video URL", `/${this.adapter.namespace}/${station.getSerial()}/${DataLocation.LAST_EVENT}/${device.getSerial()}${STREAM_FILE_NAME_EXT}`);
                        ffmpegPreviewImage(`${filename_without_ext}${STREAM_FILE_NAME_EXT}`, `${filename_without_ext}${IMAGE_FILE_JPEG_EXT}`, this.log)
                            .then(() => {
                                setStateWithTimestamp(this.adapter, device.getStateID(CameraStateID.LAST_EVENT_PICTURE_URL), "Last event picture URL", `/${this.adapter.namespace}/${station.getSerial()}/${DataLocation.LAST_EVENT}/${device.getSerial()}${IMAGE_FILE_JPEG_EXT}`);
                                try {
                                    const image_data = getImageAsHTML(fse.readFileSync(`${filename_without_ext}${IMAGE_FILE_JPEG_EXT}`));
                                    setStateWithTimestamp(this.adapter, device.getStateID(CameraStateID.LAST_EVENT_PICTURE_HTML), "Last event picture HTML image", image_data);
                                } catch (error) {
                                    this.log.error(`EufySecurity.onStartDownload(): station: ${station.getSerial()} device: ${device.getSerial()} - Error: ${error}`);
                                }
                            });
                    });
                /*.catch(() => {

                });*/
            } catch(error) {
                this.log.error(`EufySecurity.onStartDownload(): station: ${station.getSerial()} channel: ${channel} - Error: ${error} - Cancelling download...`);
                station.cancelDownload(device);
            }
        } catch(error) {
            this.log.error(`EufySecurity.onStartDownload(): station: ${station.getSerial()} channel: ${channel} - Error: ${error} - ffmpeg conversion couldn't start. HLS Stream not available.`);
        }
    }

    private onStopLivestream(station: Station, channel: number): void {
        this.log.trace(`EufySecurity.onStopLivestream(): station: ${station.getSerial()} channel: ${channel}`);
        try {
            const device = this.getStationDevice(station.getSerial(), channel);
            this.emit("stop_livestream", station, device);
        } catch(error) {
            this.log.error(`EufySecurity.onStopLivestream(): station: ${station.getSerial()} channel: ${channel} - Error: ${error}`);
        }
    }

    private async onStartLivestream(station: Station, channel: number, metadata: StreamMetadata, videostream: Readable, audiostream: Readable): Promise<void> {
        this.log.trace(`EufySecurity.onStartLivestream(): station: ${station.getSerial()} channel: ${channel}`);
        try {
            const device = this.getStationDevice(station.getSerial(), channel);
            try {
                const device = this.getStationDevice(station.getSerial(), channel);
                const file_path = getDataFilePath(this.adapter.namespace, station.getSerial(), DataLocation.LIVESTREAM, `${device.getSerial()}${STREAM_FILE_NAME_EXT}`);
                await removeFiles(this.adapter.namespace, station.getSerial(), DataLocation.LIVESTREAM, device.getSerial());
                ffmpegStreamToHls(this.adapter.namespace, metadata, videostream, audiostream, file_path, this.log)
                    .then(() => {
                        return removeFiles(this.adapter.namespace, station.getSerial(), DataLocation.LAST_LIVESTREAM, device.getSerial());
                    })
                    .then(() => {
                        return moveFiles(this.adapter.namespace, station.getSerial(), device.getSerial(), DataLocation.LIVESTREAM, DataLocation.LAST_LIVESTREAM);
                    })
                    .then(() => {
                        const filename_without_ext = getDataFilePath(this.adapter.namespace, station.getSerial(), DataLocation.LAST_LIVESTREAM, device.getSerial());
                        this.adapter.setStateAsync(device.getStateID(CameraStateID.LAST_LIVESTREAM_VIDEO_URL), { val: `/${this.adapter.namespace}/${station.getSerial()}/${DataLocation.LAST_LIVESTREAM}/${device.getSerial()}${STREAM_FILE_NAME_EXT}`, ack: true });
                        ffmpegPreviewImage(`${filename_without_ext}${STREAM_FILE_NAME_EXT}`, `${filename_without_ext}${IMAGE_FILE_JPEG_EXT}`, this.log)
                            .then(() => {
                                this.adapter.setStateAsync(device.getStateID(CameraStateID.LAST_LIVESTREAM_PIC_URL), { val: `/${this.adapter.namespace}/${station.getSerial()}/${DataLocation.LAST_LIVESTREAM}/${device.getSerial()}${IMAGE_FILE_JPEG_EXT}`, ack: true });
                                try {
                                    this.adapter.setStateAsync(device.getStateID(CameraStateID.LAST_LIVESTREAM_PIC_HTML), { val: getImageAsHTML(fse.readFileSync(`${filename_without_ext}${IMAGE_FILE_JPEG_EXT}`)), ack: true });
                                } catch (error) {
                                    this.log.error(`EufySecurity.onStartLivestream(): station: ${station.getSerial()} device: ${device.getSerial()} - Error: ${error}`);
                                }
                            });
                    });
                this.emit("start_livestream", station, device, `/${this.adapter.namespace}/${station.getSerial()}/${DataLocation.LIVESTREAM}/${device.getSerial()}${STREAM_FILE_NAME_EXT}`);
            } catch(error) {
                this.log.error(`EufySecurity.onStartLivestream(): station: ${station.getSerial()} channel: ${channel} - Error: ${error} - Stopping livestream...`);
                station.stopLivestream(device);
            }
        } catch(error) {
            this.log.error(`EufySecurity.onStartLivestream(): station: ${station.getSerial()} channel: ${channel} - Error: ${error} - ffmpeg conversion couldn't start. HLS Stream not available.`);
        }
    }

    public async startLivestream(device_sn: string): Promise<void> {
        if (!this.camera_livestream_timeout.get(device_sn)) {
            if (Object.keys(this.devices).includes(device_sn) && this.devices[device_sn].isCamera()) {
                const camera = this.devices[device_sn] as Camera;
                const station = this.stations[camera.getStationSerial()];

                if (station.isConnected()) {
                    if (!station.isLiveStreaming(camera)) {
                        station.startLivestream(camera);

                        this.camera_livestream_timeout.set(device_sn, setTimeout(() => {
                            this.stopLivestream(device_sn);
                        }, this.camera_max_livestream_seconds * 1000));
                    }
                } else if (!camera.isStreaming()) {
                    this._startRtmpLivestream(station, camera);
                }
            } else {
                throw new Error(`No camera device with this serial number: ${device_sn}!`);
            }
        } else {
            this.log.warn(`The stream for the device ${device_sn} cannot be started, because it is already streaming!`);
        }
    }

    private async _startRtmpLivestream(station: Station, camera: Camera): Promise<void> {
        const url = await camera.startStream();
        const file_path = getDataFilePath(this.adapter.namespace, station.getSerial(), DataLocation.LIVESTREAM, `${camera.getSerial()}${STREAM_FILE_NAME_EXT}`);
        ffmpegRTMPToHls(url, file_path, this.log)
            .then(() => {
                return removeFiles(this.adapter.namespace, station.getSerial(), DataLocation.LAST_LIVESTREAM, camera.getSerial());
            })
            .then(() => {
                return moveFiles(this.adapter.namespace, station.getSerial(), camera.getSerial(), DataLocation.LIVESTREAM, DataLocation.LAST_LIVESTREAM);
            })
            .then(() => {
                const filename_without_ext = getDataFilePath(this.adapter.namespace, station.getSerial(), DataLocation.LAST_LIVESTREAM, camera.getSerial());
                ffmpegPreviewImage(`${filename_without_ext}${STREAM_FILE_NAME_EXT}`, `${filename_without_ext}${IMAGE_FILE_JPEG_EXT}`, this.log)
                    .then(() => {
                        this.adapter.setStateAsync(camera.getStateID(CameraStateID.LAST_LIVESTREAM_PIC_URL), { val: `/${this.adapter.namespace}/${station.getSerial()}/${DataLocation.LAST_LIVESTREAM}/${camera.getSerial()}${IMAGE_FILE_JPEG_EXT}`, ack: true });
                        try {
                            this.adapter.setStateAsync(camera.getStateID(CameraStateID.LAST_LIVESTREAM_PIC_HTML), { val: getImageAsHTML(fse.readFileSync(`${filename_without_ext}${IMAGE_FILE_JPEG_EXT}`)), ack: true });
                        } catch (error) {
                            this.log.error(`EufySecurity.startLivestream(): station: ${station.getSerial()} device: ${camera.getSerial()} - Error: ${error}`);
                        }
                    });
            });
        this.emit("start_livestream", station, camera, `/${this.adapter.namespace}/${station.getSerial()}/${DataLocation.LIVESTREAM}/${camera.getSerial()}${STREAM_FILE_NAME_EXT}`);
        this.camera_livestream_timeout.set(camera.getSerial(), setTimeout(() => {
            this.stopLivestream(camera.getSerial());
        }, this.camera_max_livestream_seconds * 1000));
    }

    public async stopLivestream(device_sn: string): Promise<void> {
        if (this.camera_livestream_timeout.get(device_sn)) {
            if (Object.keys(this.devices).includes(device_sn) && this.devices[device_sn].isCamera()) {
                const camera = this.devices[device_sn] as Camera;
                const station = this.stations[camera.getStationSerial()];

                if (station.isConnected() && station.isLiveStreaming(camera)) {
                    await station.stopLivestream(camera);
                } else if (camera.isStreaming()) {
                    await camera.stopStream();
                    this.emit("stop_livestream", station, camera);
                }

                const timeout = this.camera_livestream_timeout.get(device_sn);
                if (timeout) {
                    clearTimeout(timeout);
                    this.camera_livestream_timeout.delete(device_sn);
                }
            } else {
                throw new Error(`No camera device with this serial number: ${device_sn}!`);
            }
        } else {
            this.log.warn(`The stream for the device ${device_sn} cannot be stopped, because it isn't streaming!`);
        }
    }

}