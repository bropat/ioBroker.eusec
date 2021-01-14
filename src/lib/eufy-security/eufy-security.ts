import { EventEmitter} from "events";
import { API } from "./http/api";
import { Device, Camera, Lock, MotionSensor, EntrySensor, Keypad, UnknownDevice } from "./http/device";
import { ApiInterface, Devices, FullDevices, Hubs, Stations } from "./http/interfaces";
import { CameraStateID, ParamType, StationStateID } from "./http/types";

import { Station } from "./http/station";
import { FullDeviceResponse, HubResponse } from "./http/models";

import { PushRegisterService } from "./push/register"
import { PushClient } from "./push/client"
import { Credentials, PushMessage } from "./push/models";
import { EufySecurity as EufySecurityAdapter } from "./../../main";
import { getState, setStateChangedAsync } from "./utils";
import { CommandResult } from "./p2p/models";
import { CommandType, ErrorCode } from "./p2p/types";

export class EufySecurity extends EventEmitter implements ApiInterface {

    private adapter: EufySecurityAdapter;

    private username: string;
    private password: string;

    private log: ioBroker.Logger;

    private api: API;

    private stations: Stations = {};
    private devices: Devices = {};

    private camera_max_livestream_seconds = 30;
    private camera_livestream_timeout: {
        [index: string]: NodeJS.Timeout;
    } = {};

    private pushService;
    private pushClient?: PushClient;
    private pushCredentialsTimeout?: NodeJS.Timeout;
    private pushRetryTimeout?: NodeJS.Timeout;
    private pushRetryDelay = 0;

    constructor(adapter: EufySecurityAdapter) {
        super();

        this.adapter = adapter;
        this.username = this.adapter.config.username;
        this.password = this.adapter.config.password;
        this.camera_max_livestream_seconds = this.adapter.config.maxLivestreamDuration;
        this.log = this.adapter.log;
        this.api = new API(this.username, this.password, this.log);
        this.api.on("hubs", (hubs) => this.handleHubs(hubs));
        this.api.on("devices", (devices) => this.handleDevices(devices));
        this.api.on("not_connected", () => this.handleNotConnected());
        this.pushService = new PushRegisterService(this.log);
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

    public getDevice(device_sn: string): Device {
        if (Object.keys(this.devices).includes(device_sn))
            return this.devices[device_sn];
        throw new Error(`No device with this serial number: ${device_sn}!`);
    }

    public getStationDevice(station_sn: string, channel: number): Device {
        Object.values(this.devices).forEach((device: Device) => {
            if (device.getStationSerial() === station_sn && device.getChannel() === channel) {
                return device;
            }
        });
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

    public getApi(): API {
        return this.api;
    }

    public async startCameraStream(device_sn: string): Promise<string> {
        if (Object.keys(this.devices).includes(device_sn) && this.devices[device_sn].isCamera()) {
            const camera = this.devices[device_sn] as Camera;
            const url = camera.startStream();
            this.camera_livestream_timeout[device_sn] = setTimeout(() => { this.stopCameraStreamCallback(camera, this.adapter); }, this.camera_max_livestream_seconds * 1000);
            return url;
        }
        throw new Error(`No camera device with this serial number: ${device_sn}!`);
    }

    private async stopCameraStreamCallback(camera: Camera, adapter: EufySecurityAdapter): Promise<void> {
        camera.stopStream();
        await adapter.delStateAsync(camera.getStateID(CameraStateID.LIVESTREAM));
    }

    public async stopCameraStream(device_sn: string): Promise<void> {
        if (Object.keys(this.devices).includes(device_sn) && this.devices[device_sn].isCamera()) {
            const camera = this.devices[device_sn] as Camera;
            if (this.camera_livestream_timeout[device_sn]) {
                clearTimeout(this.camera_livestream_timeout[device_sn]);
                delete this.camera_livestream_timeout[device_sn];
            }
            await this.stopCameraStreamCallback(camera, this.adapter);
        } else {
            throw new Error(`No camera device with this serial number: ${device_sn}!`);
        }
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
                if (!this.getStation(hub.station_sn).isConnected())
                    //TODO: Verify better!!! SCHEDULE_MODE get from HTTP Api has sometimes a wrong value (outdated? delay in refresh in cloud vs local?)
                    this.updateStation(hub);
            } else {
                const station = new Station(this.api, hub);
                station.on("parameter", (station, type, value) => this.stationParameterChanged(station, type, value))
                station.on("p2p_command", (station, result) => this.stationP2PCommandResult(station, result))
                this.addStation(station);
            }
        }

        const station_count = Object.keys(this.stations).length;
        this.log.debug(`EufySecurity.handleHubs(): stations: ${station_count}`);
        if (station_count > 0) {
            this.emit("stations", this.stations);
        }
    }
    private async stationP2PCommandResult(station: Station, result: CommandResult): Promise<void> {
        //TODO: Finish implementation!!!!
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
        } else {
            this.log.error(`EufySecurity.stationP2PCommandResult(): Station: ${station.getSerial()} command ${CommandType[result.command_type]} failed with error: ${ErrorCode[result.return_code]} (${result.return_code})`);
        }
    }

    private handleDevices(devices: FullDevices): void {
        this.log.debug(`EufySecurity.handleDevices(): devices: ${Object.keys(devices).length}`);
        const device_sns: string[] = Object.keys(this.devices);
        for (const device of Object.values(devices)) {

            if (device_sns.includes(device.device_sn)) {
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

                new_device.on("parameter", (device, type, value) => this.deviceParameterChanged(device, type, value))
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
    }

    public close(): void {

        // if there is a camera with livestream running stop it (incl. timeout)
        for (const device of Object.values(this.getDevices())) {
            if (device && device.isCamera()) {
                if ((device as Camera).isStreaming()) {
                    const serial = device.getSerial();
                    if (serial)
                        this.stopCameraStream(serial);
                }
            }
        }

        Object.values(this.stations).forEach(station => {
            station.close();
        });

        if (this.pushCredentialsTimeout) {
            clearTimeout(this.pushCredentialsTimeout);
            this.pushCredentialsTimeout = undefined;
        }

        if (this.pushRetryTimeout) {
            clearTimeout(this.pushRetryTimeout);
            this.pushRetryTimeout = undefined;
            this.pushRetryDelay = 0;
        }
    }

    public setCameraMaxLivestreamDuration(seconds: number): void {
        this.camera_max_livestream_seconds = seconds;
    }

    public getCameraMaxLivestreamDuration(): number {
        return this.camera_max_livestream_seconds;
    }

    // eslint-disable-next-line @typescript-eslint/no-inferrable-types
    private async _registerPushNotifications(credentials: Credentials | undefined, persistentIds?: string[], renew: boolean = false): Promise<Credentials | undefined> {
        if (renew && credentials) {
            credentials = await this.pushService.renewPushCredentials(credentials).catch(error => {
                this.log.error(`EufySecurity._registerPushNotifications(): renewPushCredentials() - error: ${JSON.stringify(error)}`);
                return undefined;
            });
            this.adapter.setPushCredentials(credentials);
        }

        if (credentials) {
            if (this.pushCredentialsTimeout)
                clearTimeout(this.pushCredentialsTimeout);

            this.pushCredentialsTimeout = setTimeout(async () => {
                this.log.info("Push notification token is expiring, renew it.");
                await this._registerPushNotifications(credentials, persistentIds, true);
            }, credentials.fidResponse.authToken.expiresAt - new Date().getTime());

            if (this.pushClient) {
                this.pushClient.removeAllListeners();
            }

            this.pushClient = await PushClient.init(this.log, {
                androidId: credentials.checkinResponse.androidId,
                securityToken: credentials.checkinResponse.securityToken,
            });
            if (persistentIds)
                this.pushClient.setPersistentIds(persistentIds);

            this.pushClient.connect((msg: PushMessage) => {
                this.emit("push_notifications", msg, this);
            });

            // Register generated token
            const fcmToken = credentials.gcmResponse.token;
            const registered = await this.api.registerPushToken(fcmToken);
            const checked = await this.api.checkPushToken();

            if (registered && checked) {
                this.log.info("Push notification connection successfully established.");
                await this.adapter.setStateAsync("info.push_connection", { val: true, ack: true });
            } else {
                await this.adapter.setStateAsync("info.push_connection", { val: false, ack: true });
            }
        } else {
            await this.adapter.setStateAsync("info.push_connection", { val: false, ack: true });
            this.log.error("Push notifications are disabled, because the registration failed!");
        }

        return credentials;
    }

    public async registerPushNotifications(persistentIds?: string[]): Promise<Credentials | undefined> {
        let credentials: Credentials | undefined = this.adapter.getPersistentData().push_credentials;

        if (!credentials || Object.keys(credentials).length === 0) {
            this.log.debug("EufySecurity.registerPushNotifications(): create new push credentials...");
            credentials = await this.pushService.createPushCredentials().catch(error => {
                this.log.error(`EufySecurity.registerPushNotifications(): createPushCredentials() - error: ${JSON.stringify(error)}`);
                return undefined;
            });
            this.adapter.setPushCredentials(credentials);
        } else if (new Date().getTime() >= credentials.fidResponse.authToken.expiresAt) {
            this.log.debug("EufySecurity.registerPushNotifications(): Renew push credentials...");
            credentials = await this.pushService.renewPushCredentials(credentials).catch(error => {
                this.log.error(`EufySecurity.registerPushNotifications(): renewPushCredentials() - error: ${JSON.stringify(error)}`);
                return undefined;
            });
            this.adapter.setPushCredentials(credentials);
        } else {
            this.log.debug(`EufySecurity.registerPushNotifications(): Login with previous push credentials... (${JSON.stringify(credentials)})`);
            credentials = await this.pushService.loginPushCredentials(credentials).catch(error => {
                this.log.error(`EufySecurity.registerPushNotifications(): loginPushCredentials() - error: ${JSON.stringify(error)}`);
                return undefined;
            });
            this.adapter.setPushCredentials(credentials);
        }

        credentials = await this._registerPushNotifications(credentials, persistentIds);

        if (!credentials) {
            if (this.pushRetryTimeout)
                clearTimeout(this.pushRetryTimeout);

            const delay = this.getCurrentPushRetryDelay();
            this.log.info(`Retry to register/login for push notification in ${delay / 1000} seconds...`);
            this.pushRetryTimeout = setTimeout(async () => {
                this.log.info(`Retry to register/login for push notification`);
                await this.registerPushNotifications(persistentIds);
            }, delay);
        } else {
            this.pushRetryDelay = 0;
            if (this.pushRetryTimeout) {
                clearTimeout(this.pushRetryTimeout);
                this.pushRetryTimeout = undefined;
            }
        }

        return credentials;
    }

    public async logon(verify_code?:number|null): Promise<void> {
        if (verify_code) {
            await this.api.addTrustDevice(verify_code).then(result => {
                if (result)
                    this.emit("connected");
            });
        } else {
            switch (await this.api.authenticate()) {
                case "send_verify_code":
                    break;
                case "renew":
                    this.log.debug("EufySecurity.logon(): renew token");
                    const result = await this.api.authenticate();
                    if (result == "ok") {
                        this.emit("connected");
                    }
                    break;
                case "error":
                    this.log.error("EufySecurity.logon(): token error");
                    break;
                case "ok":
                    this.emit("connected");
                    break;
            }
        }
    }

    public getPushPersistentIds(): string[] {
        if (this.pushClient)
            return this.pushClient.getPersistentIds();
        return [];
    }

    private stationParameterChanged(station: Station, type: number, value: string): void {
        this.log.debug(`EufySecurity.stationParameterChanged(): station: ${station.getSerial()} type: ${type} value: ${value}`);
        if (type == ParamType.GUARD_MODE)
        //TODO: if configured guard mode was changed to SCHEDULE (2) we get the correct current mode, but we change the effective guard mode on next http data refresh... Get it asap!
            try {
                setStateChangedAsync(this.adapter, station.getStateID(StationStateID.GUARD_MODE), Number.parseInt(value));
            } catch (error) {
                this.log.error(`EufySecurity.stationParameterChanged(): station: ${station.getSerial()} GUARD_MODE Error: ${error}`);
            }
        else if (type == ParamType.SCHEDULE_MODE)
            try {
                setStateChangedAsync(this.adapter, station.getStateID(StationStateID.CURRENT_MODE), Number.parseInt(value));
            } catch (error) {
                this.log.error(`EufySecurity.stationParameterChanged(): station: ${station.getSerial()} CURRENT_MODE Error: ${error}`);
            }
    }

    private deviceParameterChanged(device: Device, type: number, value: string): void {
        this.log.debug(`EufySecurity.deviceParameterChanged(): device: ${device.getSerial()} type: ${type} value: ${value}`);
    }

    private handleNotConnected(): void {
        this.emit("disconnected");
    }

    private getCurrentPushRetryDelay(): number {
        const delay = this.pushRetryDelay == 0 ? 5000 : this.pushRetryDelay;

        if (this.pushRetryDelay < 60000)
            this.pushRetryDelay += 10000;

        if (this.pushRetryDelay >= 60000 && this.pushRetryDelay < 600000)
            this.pushRetryDelay += 60000;

        return delay;
    }

}