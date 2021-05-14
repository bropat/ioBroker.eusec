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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EufySecurity = void 0;
const tiny_typed_emitter_1 = require("tiny-typed-emitter");
const eufy_security_client_1 = require("eufy-security-client");
const fs_extra_1 = __importDefault(require("fs-extra"));
const types_1 = require("./types");
const utils_1 = require("./utils");
const video_1 = require("./video");
const types_2 = require("./types");
class EufySecurity extends tiny_typed_emitter_1.TypedEmitter {
    constructor(adapter, log, country, language) {
        super();
        this.stations = {};
        this.devices = {};
        this.camera_max_livestream_seconds = 30;
        this.camera_livestream_timeout = new Map();
        this.rtmpFFmpegPromise = new Map();
        this.connected = false;
        this.adapter = adapter;
        this.username = this.adapter.config.username;
        this.password = this.adapter.config.password;
        this.camera_max_livestream_seconds = this.adapter.config.maxLivestreamDuration;
        this.log = log;
        this.api = new eufy_security_client_1.HTTPApi(this.username, this.password, this.log);
        try {
            if (country)
                this.api.setCountry(country);
        }
        catch (error) { }
        try {
            if (language)
                this.api.setLanguage(language);
        }
        catch (error) { }
        this.api.setPhoneModel("iobroker");
        this.api.on("hubs", (hubs) => this.handleHubs(hubs));
        this.api.on("devices", (devices) => this.handleDevices(devices));
        this.api.on("close", () => this.onAPIClose());
        this.api.on("connect", () => this.onAPIConnect());
        this.pushService = new eufy_security_client_1.PushNotificationService(this.log);
        this.pushService.on("connect", (token) => __awaiter(this, void 0, void 0, function* () {
            const registered = yield this.api.registerPushToken(token);
            const checked = yield this.api.checkPushToken();
            if (registered && checked) {
                this.log.info("Push notification connection successfully established.");
                this.emit("push connect");
            }
            else {
                this.emit("push close");
            }
        }));
        this.pushService.on("credential", (credentials) => {
            this.adapter.setPushCredentials(credentials);
        });
        this.pushService.on("message", (message) => {
            this.emit("push message", message);
        });
        this.pushService.on("close", () => {
            this.emit("push close");
        });
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
        return null;
    }
    getStationDevice(station_sn, channel) {
        for (const device of Object.values(this.devices)) {
            if ((device.getStationSerial() === station_sn && device.getChannel() === channel) || (device.getStationSerial() === station_sn && device.getSerial() === station_sn)) {
                return device;
            }
        }
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
    connectToStation(station_sn, p2pConnectionType = eufy_security_client_1.P2PConnectionType.PREFER_LOCAL) {
        return __awaiter(this, void 0, void 0, function* () {
            if (Object.keys(this.stations).includes(station_sn))
                this.stations[station_sn].connect(p2pConnectionType, true);
            else
                throw new Error(`No station with this serial number: ${station_sn}!`);
        });
    }
    handleHubs(hubs) {
        this.log.debug(`Hubs: ${Object.keys(hubs).length}`);
        const stations_sns = Object.keys(this.stations);
        for (const hub of Object.values(hubs)) {
            if (stations_sns.includes(hub.station_sn)) {
                this.updateStation(hub);
            }
            else {
                const station = new eufy_security_client_1.Station(this.api, hub);
                station.on("connect", (station) => this.onConnect(station));
                station.on("close", (station) => this.onClose(station));
                station.on("raw device property changed", (device_sn, params) => this.updateDeviceParameter(device_sn, params));
                station.on("raw property changed", (station, type, value, modified) => this.stationParameterChanged(station, type, value, modified));
                station.on("command result", (station, result) => this.stationP2PCommandResult(station, result));
                station.on("download start", (station, channel, metadata, videoStream, audioStream) => this.onStartDownload(station, channel, metadata, videoStream, audioStream));
                station.on("download finish", (station, channel) => this.onFinishDownload(station, channel));
                station.on("livestream start", (station, channel, metadata, videoStream, audioStream) => this.onStartLivestream(station, channel, metadata, videoStream, audioStream));
                station.on("livestream stop", (station, channel) => this.onStopLivestream(station, channel));
                station.on("rtsp url", (station, channel, rtsp_url, modified) => this.onRTSPUrl(station, channel, rtsp_url, modified));
                station.update(hub);
                this.addStation(station);
            }
        }
        const station_count = Object.keys(this.stations).length;
        this.log.debug(`Stations: ${station_count}`);
        if (station_count > 0) {
            this.emit("stations", this.stations);
        }
    }
    onConnect(station) {
        if (station.getDeviceType() !== eufy_security_client_1.DeviceType.DOORBELL)
            station.getCameraInfo();
    }
    onClose(station) {
        try {
            for (const device_sn of this.camera_livestream_timeout.keys()) {
                const device = this.getDevice(device_sn);
                if (device !== null && device.getStationSerial() === station.getSerial()) {
                    clearTimeout(this.camera_livestream_timeout.get(device_sn));
                    this.camera_livestream_timeout.delete(device_sn);
                }
            }
        }
        catch (error) {
            this.log.error(`Station: ${station.getSerial()} - Error: ${error}`);
        }
    }
    stationP2PCommandResult(station, result) {
        return __awaiter(this, void 0, void 0, function* () {
            if (result.return_code === 0) {
                const state_name = utils_1.getState(result.command_type);
                if (state_name) {
                    if (result.channel === eufy_security_client_1.Station.CHANNEL) {
                        // Station
                        if (state_name) {
                            const state_id = station.getStateID(state_name);
                            const state = yield this.adapter.getStateAsync(state_id);
                            this.adapter.setStateAsync(state_id, Object.assign(Object.assign({}, state), { ack: true }));
                            this.log.debug(`State ${state_id} aknowledged - station: ${station.getSerial()} result: ${JSON.stringify(result)}`);
                        }
                        else {
                            this.log.debug(`Loading current state not possible - station: ${station.getSerial()} result: ${JSON.stringify(result)}`);
                        }
                    }
                    else {
                        // Device
                        try {
                            const device = this.getStationDevice(station.getSerial(), result.channel);
                            const state_id = device.getStateID(state_name);
                            const state = yield this.adapter.getStateAsync(state_id);
                            this.adapter.setStateAsync(state_id, Object.assign(Object.assign({}, state), { ack: true }));
                            this.log.debug(`State ${state_id} aknowledged - station: ${station.getSerial()} device: ${device.getSerial()} result: ${JSON.stringify(result)}`);
                        }
                        catch (error) {
                            this.log.error(`Error: ${error} - station: ${station.getSerial()} result: ${JSON.stringify(result)}`);
                        }
                    }
                }
                else if (result.command_type === eufy_security_client_1.CommandType.CMD_DOORLOCK_DATA_PASS_THROUGH) {
                    // TODO: Implement third level of command verification for ESL?
                    const device = this.getStationDevice(station.getSerial(), result.channel);
                    const states = yield this.adapter.getStatesAsync(`${device.getStateID("", 1)}.*`);
                    for (const state in states) {
                        if (!states[state].ack)
                            this.adapter.setStateAsync(state, Object.assign(Object.assign({}, states[state]), { ack: true }));
                    }
                }
                else {
                    this.log.debug(`No mapping for state <> command_type - station: ${station.getSerial()} result: ${JSON.stringify(result)}`);
                }
            }
            else if (result.return_code !== 0 && result.command_type === eufy_security_client_1.CommandType.CMD_START_REALTIME_MEDIA) {
                this.log.debug(`Station: ${station.getSerial()} command ${eufy_security_client_1.CommandType[result.command_type]} failed with error: ${eufy_security_client_1.ErrorCode[result.return_code]} (${result.return_code}) fallback to RTMP livestream...`);
                try {
                    const device = this.getStationDevice(station.getSerial(), result.channel);
                    if (device.isCamera())
                        this._startRtmpLivestream(station, device);
                }
                catch (error) {
                    this.log.error(`Station: ${station.getSerial()} command ${eufy_security_client_1.CommandType[result.command_type]} RTMP fallback failed - Error ${error}`);
                }
            }
            else {
                this.log.error(`Station: ${station.getSerial()} command ${eufy_security_client_1.CommandType[result.command_type]} failed with error: ${eufy_security_client_1.ErrorCode[result.return_code]} (${result.return_code})`);
            }
        });
    }
    handleDevices(devices) {
        this.log.debug(`Devices: ${Object.keys(devices).length}`);
        const device_sns = Object.keys(this.devices);
        for (const device of Object.values(devices)) {
            if (device_sns.includes(device.device_sn)) {
                //if (!this.getStation(device.station_sn).isConnected())
                this.updateDevice(device);
            }
            else {
                let new_device;
                if (eufy_security_client_1.Device.isIndoorCamera(device.device_type)) {
                    new_device = new eufy_security_client_1.IndoorCamera(this.api, device);
                }
                else if (eufy_security_client_1.Device.isSoloCamera(device.device_type)) {
                    new_device = new eufy_security_client_1.SoloCamera(this.api, device);
                }
                else if (eufy_security_client_1.Device.isBatteryDoorbell(device.device_type) || eufy_security_client_1.Device.isBatteryDoorbell2(device.device_type)) {
                    new_device = new eufy_security_client_1.BatteryDoorbellCamera(this.api, device);
                }
                else if (eufy_security_client_1.Device.isWiredDoorbell(device.device_type)) {
                    new_device = new eufy_security_client_1.DoorbellCamera(this.api, device);
                }
                else if (eufy_security_client_1.Device.isFloodLight(device.device_type)) {
                    new_device = new eufy_security_client_1.FloodlightCamera(this.api, device);
                }
                else if (eufy_security_client_1.Device.isCamera(device.device_type)) {
                    new_device = new eufy_security_client_1.Camera(this.api, device);
                }
                else if (eufy_security_client_1.Device.isLock(device.device_type)) {
                    new_device = new eufy_security_client_1.Lock(this.api, device);
                }
                else if (eufy_security_client_1.Device.isMotionSensor(device.device_type)) {
                    new_device = new eufy_security_client_1.MotionSensor(this.api, device);
                }
                else if (eufy_security_client_1.Device.isEntrySensor(device.device_type)) {
                    new_device = new eufy_security_client_1.EntrySensor(this.api, device);
                }
                else if (eufy_security_client_1.Device.isKeyPad(device.device_type)) {
                    new_device = new eufy_security_client_1.Keypad(this.api, device);
                }
                else {
                    new_device = new eufy_security_client_1.UnknownDevice(this.api, device);
                }
                new_device.on("raw property changed", (device, type, value, modified) => this.deviceParameterChanged(device, type, value, modified));
                new_device.update(device);
                this.addDevice(new_device);
            }
        }
        const device_count = Object.keys(this.devices).length;
        this.log.debug(`Devices: ${device_count}`);
        if (device_count > 0) {
            this.emit("devices", this.devices);
        }
    }
    refreshData() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.api.updateDeviceInfo();
            Object.values(this.stations).forEach((station) => __awaiter(this, void 0, void 0, function* () {
                if (station.isConnected() && station.getDeviceType() !== eufy_security_client_1.DeviceType.DOORBELL)
                    yield station.getCameraInfo();
            }));
        });
    }
    close() {
        // if there is a camera with livestream running stop it (incl. timeout)
        for (const device_sn of this.camera_livestream_timeout.keys()) {
            this.stopLivestream(device_sn);
        }
        this.pushService.close();
        Object.values(this.stations).forEach(station => {
            station.close();
        });
        Object.values(this.devices).forEach(device => {
            device.destroy();
        });
        if (this.connected)
            this.emit("close");
        this.connected = false;
    }
    setCameraMaxLivestreamDuration(seconds) {
        this.camera_max_livestream_seconds = seconds;
    }
    getCameraMaxLivestreamDuration() {
        return this.camera_max_livestream_seconds;
    }
    registerPushNotifications(credentials, persistentIds) {
        return __awaiter(this, void 0, void 0, function* () {
            if (credentials)
                this.pushService.setCredentials(credentials);
            if (persistentIds)
                this.pushService.setPersistentIds(persistentIds);
            this.pushService.open();
        });
    }
    logon(verify_code) {
        return __awaiter(this, void 0, void 0, function* () {
            if (verify_code) {
                yield this.api.addTrustDevice(verify_code).then(result => {
                    if (result)
                        this.emit("connect");
                });
            }
            else {
                switch (yield this.api.authenticate()) {
                    case eufy_security_client_1.AuthResult.SEND_VERIFY_CODE:
                        break;
                    case eufy_security_client_1.AuthResult.RENEW:
                        this.log.debug("Renew token");
                        this.api.authenticate();
                        /*const result = await this.api.authenticate();
                        if (result == "ok") {
                            this.emit("connect");
                        }*/
                        break;
                    case eufy_security_client_1.AuthResult.ERROR:
                        this.log.error("Token error");
                        break;
                    case eufy_security_client_1.AuthResult.OK:
                        //this.emit("connect");
                        break;
                }
            }
        });
    }
    getPushPersistentIds() {
        return this.pushService.getPersistentIds();
    }
    stationParameterChanged(station, type, value, modified) {
        //this.log.debug(`EufySecurity.stationParameterChanged(): station: ${station.getSerial()} type: ${type} value: ${value} modified: ${modified}`);
        if (type == eufy_security_client_1.CommandType.CMD_SET_ARMING) {
            try {
                utils_1.setStateChangedWithTimestamp(this.adapter, station.getStateID(types_1.StationStateID.GUARD_MODE), Number.parseInt(value), modified);
            }
            catch (error) {
                this.log.error(`Station: ${station.getSerial()} GUARD_MODE Error: ${error}`);
            }
        }
        else if (type == eufy_security_client_1.CommandType.CMD_GET_ALARM_MODE) {
            try {
                utils_1.setStateChangedWithTimestamp(this.adapter, station.getStateID(types_1.StationStateID.CURRENT_MODE), Number.parseInt(value), modified);
            }
            catch (error) {
                this.log.error(`Station: ${station.getSerial()} CURRENT_MODE Error: ${error}`);
            }
        }
    }
    updateDeviceParameter(device_sn, params) {
        this.log.debug(`Device: ${device_sn} params: ${JSON.stringify(params)}`);
        const device = this.getDevice(device_sn);
        if (device)
            device.updateRawProperties(params);
    }
    deviceParameterChanged(device, type, value, modified) {
        this.log.debug(`Device: ${device.getSerial()} type: ${type} value: ${value} modified: ${modified}`);
        if (type == eufy_security_client_1.CommandType.CMD_GET_BATTERY) {
            try {
                utils_1.setStateChangedWithTimestamp(this.adapter, device.getStateID(types_1.CameraStateID.BATTERY), Number.parseInt(value), modified);
            }
            catch (error) {
                this.log.error(`Device: ${device.getSerial()} BATTERY Error:`, error);
            }
        }
        else if (type == eufy_security_client_1.CommandType.CMD_GET_BATTERY_TEMP) {
            try {
                utils_1.setStateChangedWithTimestamp(this.adapter, device.getStateID(types_1.CameraStateID.BATTERY_TEMPERATURE), Number.parseInt(value), modified);
            }
            catch (error) {
                this.log.error(`Device: ${device.getSerial()} BATTERY_TEMP Error:`, error);
            }
        }
        else if (type == eufy_security_client_1.CommandType.CMD_GET_WIFI_RSSI) {
            try {
                utils_1.setStateChangedWithTimestamp(this.adapter, device.getStateID(types_1.CameraStateID.WIFI_RSSI), Number.parseInt(value), modified);
            }
            catch (error) {
                this.log.error(`Device: ${device.getSerial()} WIFI_RSSI Error:`, error);
            }
        }
        else if (type == eufy_security_client_1.CommandType.CMD_DEVS_SWITCH || type == 99904 || type === eufy_security_client_1.ParamType.OPEN_DEVICE) {
            try {
                const enabled = device.isEnabled();
                utils_1.setStateChangedWithTimestamp(this.adapter, device.getStateID(types_1.CameraStateID.ENABLED), enabled.value, modified);
            }
            catch (error) {
                this.log.error(`Device: ${device.getSerial()} ENABLED Error:`, error);
            }
        }
        else if (type == eufy_security_client_1.CommandType.CMD_SET_DEVS_OSD) {
            try {
                utils_1.setStateChangedWithTimestamp(this.adapter, device.getStateID(types_1.CameraStateID.WATERMARK), Number.parseInt(value), modified);
            }
            catch (error) {
                this.log.error(`Device: ${device.getSerial()} WATERMARK Error:`, error);
            }
        }
        else if (type == eufy_security_client_1.CommandType.CMD_EAS_SWITCH) {
            try {
                utils_1.setStateChangedWithTimestamp(this.adapter, device.getStateID(types_1.CameraStateID.ANTITHEFT_DETECTION), value === "1" ? true : false, modified);
            }
            catch (error) {
                this.log.error(`Device: ${device.getSerial()} ANTITHEFT_DETECTION Error:`, error);
            }
        }
        else if (type == eufy_security_client_1.CommandType.CMD_IRCUT_SWITCH) {
            try {
                utils_1.setStateChangedWithTimestamp(this.adapter, device.getStateID(types_1.CameraStateID.AUTO_NIGHTVISION), value === "1" ? true : false, modified);
            }
            catch (error) {
                this.log.error(`Device: ${device.getSerial()} AUTO_NIGHTVISION Error:`, error);
            }
        }
        else if (type == eufy_security_client_1.CommandType.CMD_PIR_SWITCH) {
            try {
                utils_1.setStateChangedWithTimestamp(this.adapter, device.getStateID(types_1.CameraStateID.MOTION_DETECTION), value === "1" ? true : false, modified);
            }
            catch (error) {
                this.log.error(`Device: ${device.getSerial()} MOTION_DETECTION Error:`, error);
            }
        }
        else if (type == eufy_security_client_1.CommandType.CMD_NAS_SWITCH) {
            try {
                utils_1.setStateChangedWithTimestamp(this.adapter, device.getStateID(types_1.CameraStateID.RTSP_STREAM), value === "1" ? true : false, modified);
                if (value === "0") {
                    this.adapter.delStateAsync(device.getStateID(types_1.CameraStateID.RTSP_STREAM_URL));
                }
            }
            catch (error) {
                this.log.error(`Device: ${device.getSerial()} RTSP_STREAM Error:`, error);
            }
        }
        else if (type == eufy_security_client_1.CommandType.CMD_DEV_LED_SWITCH) {
            try {
                utils_1.setStateChangedWithTimestamp(this.adapter, device.getStateID(types_1.CameraStateID.LED_STATUS), value === "1" ? true : false, modified);
            }
            catch (error) {
                this.log.error(`Device: ${device.getSerial()} LED_STATUS Error:`, error);
            }
        }
        else if (type == eufy_security_client_1.CommandType.CMD_GET_DEV_STATUS) {
            try {
                utils_1.setStateChangedWithTimestamp(this.adapter, device.getStateID(types_1.CameraStateID.STATE), Number.parseInt(value), modified);
            }
            catch (error) {
                this.log.error(`Device: ${device.getSerial()} STATE Error:`, error);
            }
        }
        else if (type == eufy_security_client_1.CommandType.CMD_DOORLOCK_GET_STATE) {
            try {
                utils_1.setStateChangedWithTimestamp(this.adapter, device.getStateID(types_1.LockStateID.LOCK_STATUS), Number.parseInt(value), modified);
                utils_1.setStateChangedWithTimestamp(this.adapter, device.getStateID(types_1.LockStateID.LOCK), Number.parseInt(value) === 4 ? true : false, modified);
            }
            catch (error) {
                this.log.error(`Device: ${device.getSerial()} LOCK_STATUS Error:`, error);
            }
        }
    }
    onAPIClose() {
        this.connected = false;
        this.emit("close");
    }
    onAPIConnect() {
        this.connected = true;
        this.emit("connect");
    }
    onFinishDownload(station, channel) {
        return __awaiter(this, void 0, void 0, function* () {
            this.log.trace(`Station: ${station.getSerial()} channel: ${channel}`);
        });
    }
    onStartDownload(station, channel, metadata, videostream, audiostream) {
        return __awaiter(this, void 0, void 0, function* () {
            this.log.trace(`Station: ${station.getSerial()} channel: ${channel}`);
            try {
                const device = this.getStationDevice(station.getSerial(), channel);
                try {
                    yield utils_1.removeFiles(this.adapter, station.getSerial(), types_2.DataLocation.TEMP, device.getSerial()).catch();
                    const file_path = utils_1.getDataFilePath(this.adapter, station.getSerial(), types_2.DataLocation.TEMP, `${device.getSerial()}${types_2.STREAM_FILE_NAME_EXT}`);
                    video_1.ffmpegStreamToHls(this.adapter.config, this.adapter.namespace, metadata, videostream, audiostream, file_path, this.log)
                        .then(() => {
                        if (fs_extra_1.default.pathExistsSync(file_path)) {
                            utils_1.removeFiles(this.adapter, station.getSerial(), types_2.DataLocation.LAST_EVENT, device.getSerial());
                            return true;
                        }
                        return false;
                    })
                        .then((result) => {
                        if (result)
                            utils_1.moveFiles(this.adapter, station.getSerial(), device.getSerial(), types_2.DataLocation.TEMP, types_2.DataLocation.LAST_EVENT);
                        return result;
                    })
                        .then((result) => {
                        if (result) {
                            const filename_without_ext = utils_1.getDataFilePath(this.adapter, station.getSerial(), types_2.DataLocation.LAST_EVENT, device.getSerial());
                            utils_1.setStateWithTimestamp(this.adapter, device.getStateID(types_1.CameraStateID.LAST_EVENT_VIDEO_URL), "Last captured video URL", `/${this.adapter.namespace}/${station.getSerial()}/${types_2.DataLocation.LAST_EVENT}/${device.getSerial()}${types_2.STREAM_FILE_NAME_EXT}`, undefined, "url");
                            if (fs_extra_1.default.pathExistsSync(`${filename_without_ext}${types_2.STREAM_FILE_NAME_EXT}`))
                                video_1.ffmpegPreviewImage(this.adapter.config, `${filename_without_ext}${types_2.STREAM_FILE_NAME_EXT}`, `${filename_without_ext}${types_2.IMAGE_FILE_JPEG_EXT}`, this.log)
                                    .then(() => {
                                    utils_1.setStateWithTimestamp(this.adapter, device.getStateID(types_1.CameraStateID.LAST_EVENT_PICTURE_URL), "Last event picture URL", `/${this.adapter.namespace}/${station.getSerial()}/${types_2.DataLocation.LAST_EVENT}/${device.getSerial()}${types_2.IMAGE_FILE_JPEG_EXT}`, undefined, "url");
                                    try {
                                        if (fs_extra_1.default.existsSync(`${filename_without_ext}${types_2.IMAGE_FILE_JPEG_EXT}`)) {
                                            const image_data = utils_1.getImageAsHTML(fs_extra_1.default.readFileSync(`${filename_without_ext}${types_2.IMAGE_FILE_JPEG_EXT}`));
                                            utils_1.setStateWithTimestamp(this.adapter, device.getStateID(types_1.CameraStateID.LAST_EVENT_PICTURE_HTML), "Last event picture HTML image", image_data, undefined, "html");
                                        }
                                    }
                                    catch (error) {
                                        this.log.error(`Station: ${station.getSerial()} device: ${device.getSerial()} - Error:`, error);
                                    }
                                })
                                    .catch((error) => {
                                    this.log.error(`ffmpegPreviewImage - station: ${station.getSerial()} device: ${device.getSerial()} - Error:`, error);
                                });
                        }
                    })
                        .catch((error) => {
                        this.log.error(`Station: ${station.getSerial()} channel: ${channel} - Error: ${error} - Cancelling download...`);
                        station.cancelDownload(device);
                    });
                }
                catch (error) {
                    this.log.error(`Station: ${station.getSerial()} channel: ${channel} - Error: ${error} - Cancelling download...`);
                    station.cancelDownload(device);
                }
            }
            catch (error) {
                this.log.error(`Station: ${station.getSerial()} channel: ${channel} - Error: ${error} - ffmpeg conversion couldn't start. HLS Stream not available.`);
            }
        });
    }
    onStopLivestream(station, channel) {
        this.log.trace(`Station: ${station.getSerial()} channel: ${channel}`);
        try {
            const device = this.getStationDevice(station.getSerial(), channel);
            this.emit("livestream stop", station, device);
        }
        catch (error) {
            this.log.error(`Station: ${station.getSerial()} channel: ${channel} - Error: ${error}`);
        }
    }
    onStartLivestream(station, channel, metadata, videostream, audiostream) {
        return __awaiter(this, void 0, void 0, function* () {
            this.log.trace(`Station: ${station.getSerial()} channel: ${channel}`);
            try {
                const device = this.getStationDevice(station.getSerial(), channel);
                try {
                    const file_path = utils_1.getDataFilePath(this.adapter, station.getSerial(), types_2.DataLocation.LIVESTREAM, `${device.getSerial()}${types_2.STREAM_FILE_NAME_EXT}`);
                    yield utils_1.removeFiles(this.adapter, station.getSerial(), types_2.DataLocation.LIVESTREAM, device.getSerial()).catch();
                    video_1.ffmpegStreamToHls(this.adapter.config, this.adapter.namespace, metadata, videostream, audiostream, file_path, this.log)
                        .then(() => {
                        if (fs_extra_1.default.pathExistsSync(file_path)) {
                            utils_1.removeFiles(this.adapter, station.getSerial(), types_2.DataLocation.LAST_LIVESTREAM, device.getSerial());
                            return true;
                        }
                        return false;
                    })
                        .then((result) => {
                        if (result)
                            utils_1.moveFiles(this.adapter, station.getSerial(), device.getSerial(), types_2.DataLocation.LIVESTREAM, types_2.DataLocation.LAST_LIVESTREAM);
                        return result;
                    })
                        .then((result) => {
                        if (result) {
                            const filename_without_ext = utils_1.getDataFilePath(this.adapter, station.getSerial(), types_2.DataLocation.LAST_LIVESTREAM, device.getSerial());
                            this.adapter.setStateAsync(device.getStateID(types_1.CameraStateID.LAST_LIVESTREAM_VIDEO_URL), { val: `/${this.adapter.namespace}/${station.getSerial()}/${types_2.DataLocation.LAST_LIVESTREAM}/${device.getSerial()}${types_2.STREAM_FILE_NAME_EXT}`, ack: true });
                            if (fs_extra_1.default.pathExistsSync(`${filename_without_ext}${types_2.STREAM_FILE_NAME_EXT}`))
                                video_1.ffmpegPreviewImage(this.adapter.config, `${filename_without_ext}${types_2.STREAM_FILE_NAME_EXT}`, `${filename_without_ext}${types_2.IMAGE_FILE_JPEG_EXT}`, this.log)
                                    .then(() => {
                                    this.adapter.setStateAsync(device.getStateID(types_1.CameraStateID.LAST_LIVESTREAM_PIC_URL), { val: `/${this.adapter.namespace}/${station.getSerial()}/${types_2.DataLocation.LAST_LIVESTREAM}/${device.getSerial()}${types_2.IMAGE_FILE_JPEG_EXT}`, ack: true });
                                    try {
                                        if (fs_extra_1.default.existsSync(`${filename_without_ext}${types_2.IMAGE_FILE_JPEG_EXT}`)) {
                                            this.adapter.setStateAsync(device.getStateID(types_1.CameraStateID.LAST_LIVESTREAM_PIC_HTML), { val: utils_1.getImageAsHTML(fs_extra_1.default.readFileSync(`${filename_without_ext}${types_2.IMAGE_FILE_JPEG_EXT}`)), ack: true });
                                        }
                                    }
                                    catch (error) {
                                        this.log.error(`Station: ${station.getSerial()} device: ${device.getSerial()} - Error:`, error);
                                    }
                                })
                                    .catch((error) => {
                                    this.log.error(`ffmpegPreviewImage - station: ${station.getSerial()} device: ${device.getSerial()} - Error:`, error);
                                });
                        }
                    })
                        .catch((error) => {
                        this.log.error(`Station: ${station.getSerial()} channel: ${channel} - Error: ${error} - Stopping livestream...`);
                        station.stopLivestream(device);
                    });
                    this.emit("livestream start", station, device, `/${this.adapter.namespace}/${station.getSerial()}/${types_2.DataLocation.LIVESTREAM}/${device.getSerial()}${types_2.STREAM_FILE_NAME_EXT}`);
                }
                catch (error) {
                    this.log.error(`Station: ${station.getSerial()} channel: ${channel} - Error: ${error} - Stopping livestream...`);
                    station.stopLivestream(device);
                }
            }
            catch (error) {
                this.log.error(`Station: ${station.getSerial()} channel: ${channel} - Error: ${error} - ffmpeg conversion couldn't start. HLS Stream not available.`);
            }
        });
    }
    startLivestream(device_sn) {
        return __awaiter(this, void 0, void 0, function* () {
            if (Object.keys(this.devices).includes(device_sn) && this.devices[device_sn].isCamera()) {
                const camera = this.devices[device_sn];
                const station = this.stations[camera.getStationSerial()];
                if (station.isConnected()) {
                    if (!station.isLiveStreaming(camera)) {
                        station.startLivestream(camera);
                        this.camera_livestream_timeout.set(device_sn, setTimeout(() => {
                            this.stopLivestream(device_sn);
                        }, this.camera_max_livestream_seconds * 1000));
                    }
                    else {
                        this.log.warn(`The stream for the device ${device_sn} cannot be started, because it is already streaming!`);
                    }
                }
                else {
                    if (!camera.isStreaming()) {
                        this._startRtmpLivestream(station, camera);
                    }
                    else {
                        this.log.warn(`The stream for the device ${device_sn} cannot be started, because it is already streaming!`);
                    }
                }
            }
            else {
                throw new Error(`No camera device with this serial number: ${device_sn}!`);
            }
        });
    }
    _startRtmpLivestream(station, camera) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = yield camera.startStream();
            if (url !== "") {
                const file_path = utils_1.getDataFilePath(this.adapter, station.getSerial(), types_2.DataLocation.LIVESTREAM, `${camera.getSerial()}${types_2.STREAM_FILE_NAME_EXT}`);
                yield utils_1.sleep(2000);
                const rtmpPromise = video_1.ffmpegRTMPToHls(this.adapter.config, url, file_path, this.log);
                rtmpPromise.then(() => {
                    if (fs_extra_1.default.pathExistsSync(file_path)) {
                        utils_1.removeFiles(this.adapter, station.getSerial(), types_2.DataLocation.LAST_LIVESTREAM, camera.getSerial());
                        return true;
                    }
                    return false;
                })
                    .then((result) => {
                    if (result)
                        utils_1.moveFiles(this.adapter, station.getSerial(), camera.getSerial(), types_2.DataLocation.LIVESTREAM, types_2.DataLocation.LAST_LIVESTREAM);
                    return result;
                })
                    .then((result) => {
                    if (result) {
                        const filename_without_ext = utils_1.getDataFilePath(this.adapter, station.getSerial(), types_2.DataLocation.LAST_LIVESTREAM, camera.getSerial());
                        if (fs_extra_1.default.pathExistsSync(`${filename_without_ext}${types_2.STREAM_FILE_NAME_EXT}`))
                            video_1.ffmpegPreviewImage(this.adapter.config, `${filename_without_ext}${types_2.STREAM_FILE_NAME_EXT}`, `${filename_without_ext}${types_2.IMAGE_FILE_JPEG_EXT}`, this.log, 5.5)
                                .then(() => {
                                this.adapter.setStateAsync(camera.getStateID(types_1.CameraStateID.LAST_LIVESTREAM_PIC_URL), { val: `/${this.adapter.namespace}/${station.getSerial()}/${types_2.DataLocation.LAST_LIVESTREAM}/${camera.getSerial()}${types_2.IMAGE_FILE_JPEG_EXT}`, ack: true });
                                try {
                                    if (fs_extra_1.default.existsSync(`${filename_without_ext}${types_2.IMAGE_FILE_JPEG_EXT}`)) {
                                        this.adapter.setStateAsync(camera.getStateID(types_1.CameraStateID.LAST_LIVESTREAM_PIC_HTML), { val: utils_1.getImageAsHTML(fs_extra_1.default.readFileSync(`${filename_without_ext}${types_2.IMAGE_FILE_JPEG_EXT}`)), ack: true });
                                    }
                                }
                                catch (error) {
                                    this.log.error(`Station: ${station.getSerial()} device: ${camera.getSerial()} - Error:`, error);
                                }
                            })
                                .catch((error) => {
                                this.log.error(`ffmpegPreviewImage - station: ${station.getSerial()} device: ${camera.getSerial()} - Error:`, error);
                            });
                    }
                })
                    .catch((error) => {
                    this.log.error(`Station: ${station.getSerial()} device: ${camera.getSerial()} - Error: ${error} - Stopping livestream...`);
                    camera.stopStream();
                    this.emit("livestream stop", station, camera);
                });
                this.rtmpFFmpegPromise.set(camera.getSerial(), rtmpPromise);
                this.emit("livestream start", station, camera, `/${this.adapter.namespace}/${station.getSerial()}/${types_2.DataLocation.LIVESTREAM}/${camera.getSerial()}${types_2.STREAM_FILE_NAME_EXT}`);
                this.camera_livestream_timeout.set(camera.getSerial(), setTimeout(() => {
                    this.stopLivestream(camera.getSerial());
                }, this.camera_max_livestream_seconds * 1000));
            }
        });
    }
    stopLivestream(device_sn) {
        return __awaiter(this, void 0, void 0, function* () {
            if (Object.keys(this.devices).includes(device_sn) && this.devices[device_sn].isCamera()) {
                const camera = this.devices[device_sn];
                const station = this.stations[camera.getStationSerial()];
                if (station.isConnected() && station.isLiveStreaming(camera)) {
                    yield station.stopLivestream(camera);
                }
                else if (camera.isStreaming()) {
                    yield camera.stopStream();
                    const rtmpPromise = this.rtmpFFmpegPromise.get(camera.getSerial());
                    if (rtmpPromise) {
                        rtmpPromise.stop();
                        this.rtmpFFmpegPromise.delete(camera.getSerial());
                    }
                    this.emit("livestream stop", station, camera);
                }
                else {
                    this.log.warn(`The stream for the device ${device_sn} cannot be stopped, because it isn't streaming!`);
                }
                const timeout = this.camera_livestream_timeout.get(device_sn);
                if (timeout) {
                    clearTimeout(timeout);
                    this.camera_livestream_timeout.delete(device_sn);
                }
            }
            else {
                this.log.warn(`Stream couldn't be stopped as no camera device with serial number ${device_sn} was found!`);
            }
        });
    }
    onRTSPUrl(station, channel, rtsp_url, modified) {
        this.log.trace(`Station: ${station.getSerial()} channel: ${channel} rtsp_url: ${rtsp_url}`);
        try {
            const device = this.getStationDevice(station.getSerial(), channel);
            utils_1.setStateChangedWithTimestamp(this.adapter, device.getStateID(types_1.CameraStateID.RTSP_STREAM_URL), rtsp_url, modified);
        }
        catch (error) {
            this.log.error(`Station: ${station.getSerial()} channel: ${channel} - Error: ${error}`);
        }
    }
    isConnected() {
        return this.connected;
    }
}
exports.EufySecurity = EufySecurity;
//# sourceMappingURL=eufy-security.js.map