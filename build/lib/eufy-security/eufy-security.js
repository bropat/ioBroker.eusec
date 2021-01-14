"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EufySecurity = void 0;
const events_1 = require("events");
const api_1 = require("./http/api");
const device_1 = require("./http/device");
const types_1 = require("./http/types");
const station_1 = require("./http/station");
const register_1 = require("./push/register");
const client_1 = require("./push/client");
const utils_1 = require("./utils");
const types_2 = require("./p2p/types");
class EufySecurity extends events_1.EventEmitter {
    constructor(adapter) {
        super();
        this.stations = {};
        this.devices = {};
        this.camera_max_livestream_seconds = 30;
        this.camera_livestream_timeout = {};
        this.pushRetryDelay = 0;
        this.adapter = adapter;
        this.username = this.adapter.config.username;
        this.password = this.adapter.config.password;
        this.camera_max_livestream_seconds = this.adapter.config.maxLivestreamDuration;
        this.log = this.adapter.log;
        this.api = new api_1.API(this.username, this.password, this.log);
        this.api.on("hubs", (hubs) => this.handleHubs(hubs));
        this.api.on("devices", (devices) => this.handleDevices(devices));
        this.api.on("not_connected", () => this.handleNotConnected());
        this.pushService = new register_1.PushRegisterService(this.log);
    }
    addStation(station) {
        const serial = station.getSerial();
        if (serial && !Object.keys(this.stations).includes(serial))
            this.stations[serial] = station;
        else
            throw new Error(`Station with this serial ${station.getSerial()} exists already and couldn't be added again!`);
    }
    updateStation(hub) {
        if (Object.keys(this.stations).includes(hub.station_sn))
            this.stations[hub.station_sn].update(hub);
        else
            throw new Error(`Station with this serial ${hub.station_sn} doesn't exists and couldn't be updated!`);
    }
    addDevice(device) {
        const serial = device.getSerial();
        if (serial && !Object.keys(this.devices).includes(serial))
            this.devices[serial] = device;
        else
            throw new Error(`Device with this serial ${device.getSerial()} exists already and couldn't be added again!`);
    }
    updateDevice(device) {
        if (Object.keys(this.devices).includes(device.device_sn))
            this.devices[device.device_sn].update(device);
        else
            throw new Error(`Device with this serial ${device.device_sn} doesn't exists and couldn't be updated!`);
    }
    getDevices() {
        return this.devices;
    }
    getDevice(device_sn) {
        if (Object.keys(this.devices).includes(device_sn))
            return this.devices[device_sn];
        throw new Error(`No device with this serial number: ${device_sn}!`);
    }
    getStationDevice(station_sn, channel) {
        Object.values(this.devices).forEach((device) => {
            if (device.getStationSerial() === station_sn && device.getChannel() === channel) {
                return device;
            }
        });
        throw new Error(`No device with channel ${channel} found on station with serial number: ${station_sn}!`);
    }
    getStations() {
        return this.stations;
    }
    getStation(station_sn) {
        if (Object.keys(this.stations).includes(station_sn))
            return this.stations[station_sn];
        throw new Error(`No station with this serial number: ${station_sn}!`);
    }
    getApi() {
        return this.api;
    }
    startCameraStream(device_sn) {
        return __awaiter(this, void 0, void 0, function* () {
            if (Object.keys(this.devices).includes(device_sn) && this.devices[device_sn].isCamera()) {
                const camera = this.devices[device_sn];
                const url = camera.startStream();
                this.camera_livestream_timeout[device_sn] = setTimeout(() => { this.stopCameraStreamCallback(camera, this.adapter); }, this.camera_max_livestream_seconds * 1000);
                return url;
            }
            throw new Error(`No camera device with this serial number: ${device_sn}!`);
        });
    }
    stopCameraStreamCallback(camera, adapter) {
        return __awaiter(this, void 0, void 0, function* () {
            camera.stopStream();
            yield adapter.delStateAsync(camera.getStateID(types_1.CameraStateID.LIVESTREAM));
        });
    }
    stopCameraStream(device_sn) {
        return __awaiter(this, void 0, void 0, function* () {
            if (Object.keys(this.devices).includes(device_sn) && this.devices[device_sn].isCamera()) {
                const camera = this.devices[device_sn];
                if (this.camera_livestream_timeout[device_sn]) {
                    clearTimeout(this.camera_livestream_timeout[device_sn]);
                    delete this.camera_livestream_timeout[device_sn];
                }
                yield this.stopCameraStreamCallback(camera, this.adapter);
            }
            else {
                throw new Error(`No camera device with this serial number: ${device_sn}!`);
            }
        });
    }
    connectToStation(station_sn) {
        return __awaiter(this, void 0, void 0, function* () {
            if (Object.keys(this.stations).includes(station_sn))
                this.stations[station_sn].connect();
            else
                throw new Error(`No station with this serial number: ${station_sn}!`);
        });
    }
    handleHubs(hubs) {
        this.log.debug(`EufySecurity.handleHubs(): hubs: ${Object.keys(hubs).length}`);
        const stations_sns = Object.keys(this.stations);
        for (const hub of Object.values(hubs)) {
            if (stations_sns.includes(hub.station_sn)) {
                if (!this.getStation(hub.station_sn).isConnected())
                    //TODO: Verify better!!! SCHEDULE_MODE get from HTTP Api has sometimes a wrong value (outdated? delay in refresh in cloud vs local?)
                    this.updateStation(hub);
            }
            else {
                const station = new station_1.Station(this.api, hub);
                station.on("parameter", (station, type, value) => this.stationParameterChanged(station, type, value));
                station.on("p2p_command", (station, result) => this.stationP2PCommandResult(station, result));
                this.addStation(station);
            }
        }
        const station_count = Object.keys(this.stations).length;
        this.log.debug(`EufySecurity.handleHubs(): stations: ${station_count}`);
        if (station_count > 0) {
            this.emit("stations", this.stations);
        }
    }
    stationP2PCommandResult(station, result) {
        return __awaiter(this, void 0, void 0, function* () {
            //TODO: Finish implementation!!!!
            if (result.return_code === 0) {
                const state_name = utils_1.getState(result.command_type);
                if (state_name) {
                    if (result.channel === station_1.Station.CHANNEL) {
                        // Station
                        if (state_name) {
                            const state_id = station.getStateID(state_name);
                            const state = yield this.adapter.getStateAsync(state_id);
                            this.adapter.setStateAsync(state_id, Object.assign(Object.assign({}, state), { ack: true }));
                            this.log.debug(`EufySecurity.stationP2PCommandResult(): State ${state_id} aknowledged - station: ${station.getSerial()} result: ${JSON.stringify(result)}`);
                        }
                        else {
                            this.log.debug(`EufySecurity.stationP2PCommandResult(): Loading current state not possible - station: ${station.getSerial()} result: ${JSON.stringify(result)}`);
                        }
                    }
                    else {
                        // Device
                        try {
                            const device = this.getStationDevice(station.getSerial(), result.channel);
                            const state_id = device.getStateID(state_name);
                            const state = yield this.adapter.getStateAsync(state_id);
                            this.adapter.setStateAsync(state_id, Object.assign(Object.assign({}, state), { ack: true }));
                            this.log.debug(`EufySecurity.stationP2PCommandResult(): State ${state_id} aknowledged - station: ${station.getSerial()} device: ${device.getSerial()} result: ${JSON.stringify(result)}`);
                        }
                        catch (error) {
                            this.log.error(`EufySecurity.stationP2PCommandResult(): Error: ${error} - station: ${station.getSerial()} result: ${JSON.stringify(result)}`);
                        }
                    }
                }
                else {
                    this.log.debug(`EufySecurity.stationP2PCommandResult(): No mapping for state <> command_type - station: ${station.getSerial()} result: ${JSON.stringify(result)}`);
                }
            }
            else {
                this.log.error(`EufySecurity.stationP2PCommandResult(): Station: ${station.getSerial()} command ${types_2.CommandType[result.command_type]} failed with error: ${types_2.ErrorCode[result.return_code]} (${result.return_code})`);
            }
        });
    }
    handleDevices(devices) {
        this.log.debug(`EufySecurity.handleDevices(): devices: ${Object.keys(devices).length}`);
        const device_sns = Object.keys(this.devices);
        for (const device of Object.values(devices)) {
            if (device_sns.includes(device.device_sn)) {
                this.updateDevice(device);
            }
            else {
                let new_device;
                if (device_1.Device.isCamera(device.device_type)) {
                    new_device = new device_1.Camera(this.api, device);
                }
                else if (device_1.Device.isLock(device.device_type)) {
                    new_device = new device_1.Lock(this.api, device);
                }
                else if (device_1.Device.isMotionSensor(device.device_type)) {
                    new_device = new device_1.MotionSensor(this.api, device);
                }
                else if (device_1.Device.isEntrySensor(device.device_type)) {
                    new_device = new device_1.EntrySensor(this.api, device);
                }
                else if (device_1.Device.isKeyPad(device.device_type)) {
                    new_device = new device_1.Keypad(this.api, device);
                }
                else {
                    new_device = new device_1.UnknownDevice(this.api, device);
                }
                new_device.on("parameter", (device, type, value) => this.deviceParameterChanged(device, type, value));
                this.addDevice(new_device);
            }
        }
        const device_count = Object.keys(this.devices).length;
        this.log.debug(`EufySecurity.handleDevices(): devices: ${device_count}`);
        if (device_count > 0) {
            this.emit("devices", this.devices);
        }
    }
    refreshData() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.api.updateDeviceInfo();
        });
    }
    close() {
        // if there is a camera with livestream running stop it (incl. timeout)
        for (const device of Object.values(this.getDevices())) {
            if (device && device.isCamera()) {
                if (device.isStreaming()) {
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
    setCameraMaxLivestreamDuration(seconds) {
        this.camera_max_livestream_seconds = seconds;
    }
    getCameraMaxLivestreamDuration() {
        return this.camera_max_livestream_seconds;
    }
    // eslint-disable-next-line @typescript-eslint/no-inferrable-types
    _registerPushNotifications(credentials, persistentIds, renew = false) {
        return __awaiter(this, void 0, void 0, function* () {
            if (renew && credentials) {
                credentials = yield this.pushService.renewPushCredentials(credentials).catch(error => {
                    this.log.error(`EufySecurity._registerPushNotifications(): renewPushCredentials() - error: ${JSON.stringify(error)}`);
                    return undefined;
                });
                this.adapter.setPushCredentials(credentials);
            }
            if (credentials) {
                if (this.pushCredentialsTimeout)
                    clearTimeout(this.pushCredentialsTimeout);
                this.pushCredentialsTimeout = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                    this.log.info("Push notification token is expiring, renew it.");
                    yield this._registerPushNotifications(credentials, persistentIds, true);
                }), credentials.fidResponse.authToken.expiresAt - new Date().getTime());
                if (this.pushClient) {
                    this.pushClient.removeAllListeners();
                }
                this.pushClient = yield client_1.PushClient.init(this.log, {
                    androidId: credentials.checkinResponse.androidId,
                    securityToken: credentials.checkinResponse.securityToken,
                });
                if (persistentIds)
                    this.pushClient.setPersistentIds(persistentIds);
                this.pushClient.connect((msg) => {
                    this.emit("push_notifications", msg, this);
                });
                // Register generated token
                const fcmToken = credentials.gcmResponse.token;
                const registered = yield this.api.registerPushToken(fcmToken);
                const checked = yield this.api.checkPushToken();
                if (registered && checked) {
                    this.log.info("Push notification connection successfully established.");
                    yield this.adapter.setStateAsync("info.push_connection", { val: true, ack: true });
                }
                else {
                    yield this.adapter.setStateAsync("info.push_connection", { val: false, ack: true });
                }
            }
            else {
                yield this.adapter.setStateAsync("info.push_connection", { val: false, ack: true });
                this.log.error("Push notifications are disabled, because the registration failed!");
            }
            return credentials;
        });
    }
    registerPushNotifications(persistentIds) {
        return __awaiter(this, void 0, void 0, function* () {
            let credentials = this.adapter.getPersistentData().push_credentials;
            if (!credentials || Object.keys(credentials).length === 0) {
                this.log.debug("EufySecurity.registerPushNotifications(): create new push credentials...");
                credentials = yield this.pushService.createPushCredentials().catch(error => {
                    this.log.error(`EufySecurity.registerPushNotifications(): createPushCredentials() - error: ${JSON.stringify(error)}`);
                    return undefined;
                });
                this.adapter.setPushCredentials(credentials);
            }
            else if (new Date().getTime() >= credentials.fidResponse.authToken.expiresAt) {
                this.log.debug("EufySecurity.registerPushNotifications(): Renew push credentials...");
                credentials = yield this.pushService.renewPushCredentials(credentials).catch(error => {
                    this.log.error(`EufySecurity.registerPushNotifications(): renewPushCredentials() - error: ${JSON.stringify(error)}`);
                    return undefined;
                });
                this.adapter.setPushCredentials(credentials);
            }
            else {
                this.log.debug(`EufySecurity.registerPushNotifications(): Login with previous push credentials... (${JSON.stringify(credentials)})`);
                credentials = yield this.pushService.loginPushCredentials(credentials).catch(error => {
                    this.log.error(`EufySecurity.registerPushNotifications(): loginPushCredentials() - error: ${JSON.stringify(error)}`);
                    return undefined;
                });
                this.adapter.setPushCredentials(credentials);
            }
            credentials = yield this._registerPushNotifications(credentials, persistentIds);
            if (!credentials) {
                if (this.pushRetryTimeout)
                    clearTimeout(this.pushRetryTimeout);
                const delay = this.getCurrentPushRetryDelay();
                this.log.info(`Retry to register/login for push notification in ${delay / 1000} seconds...`);
                this.pushRetryTimeout = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                    this.log.info(`Retry to register/login for push notification`);
                    yield this.registerPushNotifications(persistentIds);
                }), delay);
            }
            else {
                this.pushRetryDelay = 0;
                if (this.pushRetryTimeout) {
                    clearTimeout(this.pushRetryTimeout);
                    this.pushRetryTimeout = undefined;
                }
            }
            return credentials;
        });
    }
    logon(verify_code) {
        return __awaiter(this, void 0, void 0, function* () {
            if (verify_code) {
                yield this.api.addTrustDevice(verify_code).then(result => {
                    if (result)
                        this.emit("connected");
                });
            }
            else {
                switch (yield this.api.authenticate()) {
                    case "send_verify_code":
                        break;
                    case "renew":
                        this.log.debug("EufySecurity.logon(): renew token");
                        const result = yield this.api.authenticate();
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
        });
    }
    getPushPersistentIds() {
        if (this.pushClient)
            return this.pushClient.getPersistentIds();
        return [];
    }
    stationParameterChanged(station, type, value) {
        this.log.debug(`EufySecurity.stationParameterChanged(): station: ${station.getSerial()} type: ${type} value: ${value}`);
        if (type == types_1.ParamType.GUARD_MODE)
            //TODO: if configured guard mode was changed to SCHEDULE (2) we get the correct current mode, but we change the effective guard mode on next http data refresh... Get it asap!
            try {
                utils_1.setStateChangedAsync(this.adapter, station.getStateID(types_1.StationStateID.GUARD_MODE), Number.parseInt(value));
            }
            catch (error) {
                this.log.error(`EufySecurity.stationParameterChanged(): station: ${station.getSerial()} GUARD_MODE Error: ${error}`);
            }
        else if (type == types_1.ParamType.SCHEDULE_MODE)
            try {
                utils_1.setStateChangedAsync(this.adapter, station.getStateID(types_1.StationStateID.CURRENT_MODE), Number.parseInt(value));
            }
            catch (error) {
                this.log.error(`EufySecurity.stationParameterChanged(): station: ${station.getSerial()} CURRENT_MODE Error: ${error}`);
            }
    }
    deviceParameterChanged(device, type, value) {
        this.log.debug(`EufySecurity.deviceParameterChanged(): device: ${device.getSerial()} type: ${type} value: ${value}`);
    }
    handleNotConnected() {
        this.emit("disconnected");
    }
    getCurrentPushRetryDelay() {
        const delay = this.pushRetryDelay == 0 ? 5000 : this.pushRetryDelay;
        if (this.pushRetryDelay < 60000)
            this.pushRetryDelay += 10000;
        if (this.pushRetryDelay >= 60000 && this.pushRetryDelay < 600000)
            this.pushRetryDelay += 60000;
        return delay;
    }
}
exports.EufySecurity = EufySecurity;
