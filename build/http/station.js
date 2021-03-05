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
exports.Station = void 0;
const tiny_typed_emitter_1 = require("tiny-typed-emitter");
const types_1 = require("./types");
const parameter_1 = require("./parameter");
const utils_1 = require("./utils");
const session_1 = require("../p2p/session");
const types_2 = require("../p2p/types");
const device_1 = require("./device");
const utils_2 = require("../push/utils");
class Station extends tiny_typed_emitter_1.TypedEmitter {
    constructor(api, hub) {
        super();
        this.dsk_key = "";
        this.dsk_expiration = null;
        this.p2p_session = null;
        this.parameters = {};
        this.currentDelay = 0;
        this.api = api;
        this.hub = hub;
        this.log = api.getLog();
        this.update(this.hub);
    }
    getStateID(state, level = 2) {
        switch (level) {
            case 0:
                return `${this.getSerial()}`;
            case 1:
                return `${this.getSerial()}.${this.getStateChannel()}`;
            default:
                if (state)
                    return `${this.getSerial()}.${this.getStateChannel()}.${state}`;
                throw new Error("No state value passed.");
        }
    }
    getStateChannel() {
        return "station";
    }
    _updateParameter(param_type, param_value) {
        const tmp_param_value = parameter_1.ParameterHelper.readValue(param_type, param_value.value);
        if (((this.parameters[param_type] !== undefined && (this.parameters[param_type].value != tmp_param_value || this.parameters[param_type].modified < param_value.modified)) || this.parameters[param_type] === undefined) && param_type != 1147) {
            this.parameters[param_type] = {
                value: tmp_param_value,
                modified: param_value.modified
            };
            this.emit("parameter", this, param_type, this.parameters[param_type].value, this.parameters[param_type].modified);
        }
    }
    update(hub, force = false) {
        this.hub = hub;
        if (force)
            this.parameters = {};
        this.hub.params.forEach(param => {
            this._updateParameter(param.param_type, { value: param.param_value, modified: utils_2.convertTimestampMs(param.update_time) });
        });
    }
    isStation() {
        return this.hub.device_type == types_1.DeviceType.STATION;
    }
    isDeviceStation() {
        return this.hub.device_type != types_1.DeviceType.STATION;
    }
    getDeviceType() {
        return this.hub.device_type;
    }
    getHardwareVersion() {
        return this.hub.main_hw_version;
    }
    getMACAddress() {
        return this.hub.wifi_mac;
    }
    getModel() {
        return this.hub.station_model;
    }
    getName() {
        return this.hub.station_name;
    }
    getSerial() {
        return this.hub.station_sn;
    }
    getSoftwareVersion() {
        return this.hub.main_sw_version;
    }
    getIPAddress() {
        return this.hub.ip_addr;
    }
    getParameter(param_type) {
        return this.parameters[param_type];
    }
    getDSKKeys() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.api.request("post", "app/equipment/get_dsk_keys", {
                    station_sns: [this.getSerial()]
                }).catch(error => {
                    this.log.error(`${this.constructor.name}.getDSKKeys(): error: ${JSON.stringify(error)}`);
                    return error;
                });
                this.log.debug(`${this.constructor.name}.getDSKKeys(): station: ${this.getSerial()} Response: ${JSON.stringify(response.data)}`);
                if (response.status == 200) {
                    const result = response.data;
                    if (result.code == 0) {
                        const dataresult = result.data;
                        dataresult.dsk_keys.forEach(key => {
                            if (key.station_sn == this.getSerial()) {
                                this.dsk_key = key.dsk_key;
                                this.dsk_expiration = new Date(key.expiration * 1000);
                                this.log.debug(`${this.constructor.name}.getDSKKeys(): dsk_key: ${this.dsk_key} dsk_expiration: ${this.dsk_expiration}`);
                            }
                        });
                    }
                    else
                        this.log.error(`${this.constructor.name}.getDSKKeys(): station: ${this.getSerial()} Response code not ok (code: ${result.code} msg: ${result.msg})`);
                }
                else {
                    this.log.error(`${this.constructor.name}.getDSKKeys(): station: ${this.getSerial()} Status return code not 200 (status: ${response.status} text: ${response.statusText}`);
                }
            }
            catch (error) {
                this.log.error(`${this.constructor.name}.getDSKKeys(): station: ${this.getSerial()} error: ${error}`);
            }
        });
    }
    isConnected() {
        if (this.p2p_session)
            return this.p2p_session.isConnected();
        return false;
    }
    close() {
        this.log.info(`Disconnect from station ${this.getSerial()}.`);
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = undefined;
        }
        if (this.p2p_session) {
            this.p2p_session.close();
            this.p2p_session = null;
        }
    }
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.dsk_key == "" || (this.dsk_expiration && (new Date()).getTime() >= this.dsk_expiration.getTime())) {
                this.log.debug(`${this.constructor.name}.connect(): station: ${this.getSerial()} DSK keys not present or expired, get/renew it. (dsk_expiration: ${this.dsk_expiration})`);
                yield this.getDSKKeys();
            }
            this.log.debug(`${this.constructor.name}.connect(): station: ${this.getSerial()} p2p_did: ${this.hub.p2p_did} dsk_key: ${this.dsk_key}`);
            if (this.p2p_session) {
                this.p2p_session.removeAllListeners();
                this.p2p_session.close();
                this.p2p_session = null;
            }
            this.p2p_session = new session_1.P2PClientProtocol(this.hub.p2p_did, this.dsk_key, this.log);
            this.p2p_session.on("connect", (address) => this.onConnect(address));
            this.p2p_session.on("close", () => this.onDisconnect());
            this.p2p_session.on("command", (cmd_result) => this.onCommandResponse(cmd_result));
            this.p2p_session.on("alarm_mode", (mode) => this.onAlarmMode(mode));
            this.p2p_session.on("camera_info", (camera_info) => this.onCameraInfo(camera_info));
            this.p2p_session.on("start_download", (channel, metadata, videoStream, audioStream) => this.onStartDownload(channel, metadata, videoStream, audioStream));
            this.p2p_session.on("finish_download", (channel) => this.onFinishDownload(channel));
            this.p2p_session.on("start_livestream", (channel, metadata, videoStream, audioStream) => this.onStartLivestream(channel, metadata, videoStream, audioStream));
            this.p2p_session.on("stop_livestream", (channel) => this.onStopLivestream(channel));
            this.p2p_session.on("wifi_rssi", (channel, rssi) => this.onWifiRssiChanged(channel, rssi));
            this.p2p_session.on("rtsp_url", (channel, rtsp_url) => this.onRTSPUrl(channel, rtsp_url));
            this.p2p_session.connect();
        });
    }
    onFinishDownload(channel) {
        this.log.trace(`${this.constructor.name}.onFinishDownload(): station: ${this.getSerial()} channel: ${channel}`);
        this.emit("finish_download", this, channel);
    }
    onStartDownload(channel, metadata, videoStream, audioStream) {
        this.log.trace(`${this.constructor.name}.onStartDownload(): station: ${this.getSerial()} channel: ${channel}`);
        this.emit("start_download", this, channel, metadata, videoStream, audioStream);
    }
    onStopLivestream(channel) {
        this.log.trace(`${this.constructor.name}.onStopLivestream(): station: ${this.getSerial()} channel: ${channel}`);
        this.emit("stop_livestream", this, channel);
    }
    onStartLivestream(channel, metadata, videoStream, audioStream) {
        this.log.trace(`${this.constructor.name}.onStartLivestream(): station: ${this.getSerial()} channel: ${channel}`);
        this.emit("start_livestream", this, channel, metadata, videoStream, audioStream);
    }
    onWifiRssiChanged(channel, rssi) {
        this.log.trace(`${this.constructor.name}.onWifiRssiChanged(): station: ${this.getSerial()} channel: ${channel} rssi: ${rssi}`);
        this.emit("parameter", this, types_2.CommandType.CMD_WIFI_CONFIG, rssi.toString(), +new Date);
    }
    onRTSPUrl(channel, rtsp_url) {
        this.log.trace(`${this.constructor.name}.onRTSPUrl(): station: ${this.getSerial()} channel: ${channel} rtsp_url: ${rtsp_url}`);
        this.emit("rtsp_url", this, channel, rtsp_url, +new Date);
    }
    setGuardMode(mode) {
        return __awaiter(this, void 0, void 0, function* () {
            if (mode in types_1.GuardMode) {
                if (!this.p2p_session || !this.p2p_session.isConnected()) {
                    this.log.debug(`${this.constructor.name}.setGuardMode(): P2P connection to station ${this.getSerial()} not present, establish it.`);
                    yield this.connect();
                }
                if (this.p2p_session) {
                    if (this.p2p_session.isConnected()) {
                        this.log.debug(`${this.constructor.name}.setGuardMode(): P2P connection to station ${this.getSerial()} present, send command mode: ${mode}.`);
                        if ((utils_1.isGreaterMinVersion("2.0.7.9", this.getSoftwareVersion()) && !device_1.Device.isIntegratedDeviceBySn(this.getSerial())) || device_1.Device.isSoloCameraBySn(this.getSerial())) {
                            this.log.debug(`${this.constructor.name}.setGuardMode(): Using CMD_SET_PAYLOAD for station ${this.getSerial()} (main_sw_version: ${this.getSoftwareVersion()})`);
                            yield this.p2p_session.sendCommandWithStringPayload(types_2.CommandType.CMD_SET_PAYLOAD, JSON.stringify({
                                "account_id": this.hub.member.admin_user_id,
                                "cmd": types_2.CommandType.CMD_SET_ARMING,
                                "mValue3": 0,
                                "payload": {
                                    "mode_type": mode,
                                    "user_name": this.hub.member.nick_name
                                }
                            }), Station.CHANNEL);
                        }
                        else {
                            this.log.debug(`${this.constructor.name}.setGuardMode(): Using CMD_SET_ARMING for station ${this.getSerial()}`);
                            yield this.p2p_session.sendCommandWithInt(types_2.CommandType.CMD_SET_ARMING, mode, this.hub.member.admin_user_id, Station.CHANNEL);
                        }
                    }
                }
            }
            else {
                this.log.error(`${this.constructor.name}.setGuardMode(): Trying to set unsupported guard mode "${mode}" for station ${this.getSerial()}`);
            }
        });
    }
    getCameraInfo() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.p2p_session || !this.p2p_session.isConnected()) {
                this.log.debug(`${this.constructor.name}.getCameraInfo(): P2P connection to station ${this.getSerial()} not present, establish it.`);
                yield this.connect();
            }
            if (this.p2p_session) {
                if (this.p2p_session.isConnected()) {
                    this.log.debug(`${this.constructor.name}.getCameraInfo(): P2P connection to station ${this.getSerial()} present, get device infos.`);
                    yield this.p2p_session.sendCommandWithInt(types_2.CommandType.CMD_CAMERA_INFO, 255, "", Station.CHANNEL);
                }
            }
        });
    }
    getStorageInfo() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.p2p_session || !this.p2p_session.isConnected()) {
                this.log.debug(`${this.constructor.name}.getStorageInfo(): P2P connection to station ${this.getSerial()} not present, establish it.`);
                yield this.connect();
            }
            if (this.p2p_session) {
                if (this.p2p_session.isConnected()) {
                    this.log.debug(`${this.constructor.name}.getStorageInfo(): P2P connection to station ${this.getSerial()} present, get camera info.`);
                    //TODO: Verify channel! Should be 255...
                    yield this.p2p_session.sendCommandWithIntString(types_2.CommandType.CMD_SDINFO_EX, 0, 0, this.hub.member.admin_user_id);
                }
            }
        });
    }
    onAlarmMode(mode) {
        this.log.info(`Alarm mode for station ${this.getSerial()} changed to: ${types_1.AlarmMode[mode]}`);
        this.parameters[types_1.ParamType.SCHEDULE_MODE] = {
            value: mode.toString(),
            modified: +new Date
        };
        this.emit("parameter", this, types_1.ParamType.SCHEDULE_MODE, this.parameters[types_1.ParamType.SCHEDULE_MODE].value, this.parameters[types_1.ParamType.SCHEDULE_MODE].modified);
        // Trigger refresh Guard Mode
        this.getCameraInfo();
    }
    _getDeviceSerial(channel) {
        if (this.hub.devices)
            for (const device of this.hub.devices) {
                if (device.device_channel === channel)
                    return device.device_sn;
            }
        return "";
    }
    onCameraInfo(camera_info) {
        this.log.debug(`${this.constructor.name}.onCameraInfo(): station: ${this.getSerial()} camera_info: ${JSON.stringify(camera_info)}`);
        const devices = {};
        const timestamp = +new Date;
        camera_info.params.forEach(param => {
            if (param.dev_type === Station.CHANNEL) {
                this._updateParameter(param.param_type, { value: param.param_value, modified: timestamp });
            }
            else {
                const device_sn = this._getDeviceSerial(param.dev_type);
                if (device_sn !== "") {
                    if (!devices[device_sn]) {
                        devices[device_sn] = {};
                    }
                    devices[device_sn][param.param_type] = {
                        value: parameter_1.ParameterHelper.readValue(param.param_type, param.param_value),
                        modified: timestamp
                    };
                }
            }
        });
        Object.keys(devices).forEach(device => {
            this.emit("device_parameter", device, devices[device]);
        });
    }
    onCommandResponse(cmd_result) {
        this.log.debug(`${this.constructor.name}.onCommandResponse(): station: ${this.getSerial()} command_type: ${cmd_result.command_type} channel: ${cmd_result.channel} return_code: ${types_2.ErrorCode[cmd_result.return_code]} (${cmd_result.return_code})`);
        this.emit("p2p_command", this, cmd_result);
    }
    onConnect(address) {
        this.resetCurrentDelay();
        this.log.info(`Connected to station ${this.getSerial()} on host ${address.host} and port ${address.port}.`);
        this.emit("connect", this);
    }
    onDisconnect() {
        this.log.info(`Disconnected from station ${this.getSerial()}.`);
        this.emit("close", this);
        if (this.p2p_session)
            this.scheduleReconnect();
    }
    getParameters() {
        return this.parameters;
    }
    getCurrentDelay() {
        const delay = this.currentDelay == 0 ? 5000 : this.currentDelay;
        if (this.currentDelay < 60000)
            this.currentDelay += 10000;
        if (this.currentDelay >= 60000 && this.currentDelay < 600000)
            this.currentDelay += 60000;
        return delay;
    }
    resetCurrentDelay() {
        this.currentDelay = 0;
    }
    scheduleReconnect() {
        const delay = this.getCurrentDelay();
        this.log.debug(`${this.constructor.name}.scheduleReconnect(): delay: ${delay}`);
        if (!this.reconnectTimeout)
            this.reconnectTimeout = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                this.reconnectTimeout = undefined;
                this.connect();
            }), delay);
    }
    rebootHUB() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.p2p_session || !this.p2p_session.isConnected()) {
                this.log.warn(`${this.constructor.name}.rebootHUB(): P2P connection to station ${this.getSerial()} not present, command aborted.`);
                return;
            }
            this.log.debug(`${this.constructor.name}.rebootHUB(): P2P connection to station ${this.getSerial()} present, reboot requested.`);
            yield this.p2p_session.sendCommandWithInt(types_2.CommandType.CMD_HUB_REBOOT, 0, this.hub.member.admin_user_id, Station.CHANNEL);
        });
    }
    setStatusLed(device, value) {
        return __awaiter(this, void 0, void 0, function* () {
            //TODO: I'm not sure if other devices support this feature
            if (device.getStationSerial() === this.getSerial()) {
                if (device.isCamera2Product() || device.isIndoorCamera() || device.isSoloCameras() || device.isFloodLight()) {
                    if (!this.p2p_session || !this.p2p_session.isConnected()) {
                        this.log.warn(`${this.constructor.name}.setStatusLed(): P2P connection to station ${this.getSerial()} not present, command aborted.`);
                        return;
                    }
                    this.log.debug(`${this.constructor.name}.setStatusLed(): P2P connection to station ${this.getSerial()} present, set value: ${value}.`);
                    yield this.p2p_session.sendCommandWithIntString(types_2.CommandType.CMD_DEV_LED_SWITCH, value === true ? 1 : 0, device.getChannel(), this.hub.member.admin_user_id, "", device.getChannel());
                    if (!device.isFloodLight())
                        yield this.p2p_session.sendCommandWithIntString(types_2.CommandType.CMD_LIVEVIEW_LED_SWITCH, value === true ? 1 : 0, device.getChannel(), this.hub.member.admin_user_id, "", device.getChannel());
                }
                else {
                    this.log.warn(`${this.constructor.name}.setStatusLed(): This functionality is not implemented or support by this device.`);
                }
            }
            else {
                this.log.warn(`${this.constructor.name}.setStatusLed(): The device ${device.getSerial()} is not managed by this station ${this.getSerial()}, no action is performed.`);
            }
        });
    }
    setAutoNightVision(device, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (device.getStationSerial() === this.getSerial()) {
                if (device.isCamera()) {
                    if (!this.p2p_session || !this.p2p_session.isConnected()) {
                        this.log.warn(`${this.constructor.name}.setAutoNightVision(): P2P connection to station ${this.getSerial()} not present, command aborted.`);
                        return;
                    }
                    this.log.debug(`${this.constructor.name}.setAutoNightVision(): P2P connection to station ${this.getSerial()} present, set value: ${value}.`);
                    yield this.p2p_session.sendCommandWithIntString(types_2.CommandType.CMD_IRCUT_SWITCH, value === true ? 1 : 0, device.getChannel(), "", "", device.getChannel());
                }
                else {
                    this.log.warn(`${this.constructor.name}.setAutoNightVision(): This functionality is not implemented or support by this device.`);
                }
            }
            else {
                this.log.warn(`${this.constructor.name}.setAutoNightVision(): The device ${device.getSerial()} is not managed by this station ${this.getSerial()}, no action is performed.`);
            }
        });
    }
    setMotionDetection(device, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (device.getStationSerial() === this.getSerial()) {
                if (device.isCamera()) {
                    if (!this.p2p_session || !this.p2p_session.isConnected()) {
                        this.log.warn(`${this.constructor.name}.setMotionDetection(): P2P connection to station ${this.getSerial()} not present, command aborted.`);
                        return;
                    }
                    this.log.debug(`${this.constructor.name}.setMotionDetection(): P2P connection to station ${this.getSerial()} present, set value: ${value}.`);
                    yield this.p2p_session.sendCommandWithIntString(types_2.CommandType.CMD_PIR_SWITCH, value === true ? 1 : 0, device.getChannel(), this.hub.member.admin_user_id, "", device.getChannel());
                }
                else {
                    this.log.warn(`${this.constructor.name}.setMotionDetection(): This functionality is not implemented or support by this device.`);
                }
            }
            else {
                this.log.warn(`${this.constructor.name}.setMotionDetection(): The device ${device.getSerial()} is not managed by this station ${this.getSerial()}, no action is performed.`);
            }
        });
    }
    setRTSPStream(device, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (device.getStationSerial() === this.getSerial()) {
                //TODO: Check better supported devices?
                if (device.isCamera2Product() || device.isIndoorCamera() || device.isSoloCameras() || device.isFloodLight()) {
                    if (!this.p2p_session || !this.p2p_session.isConnected()) {
                        this.log.warn(`${this.constructor.name}.setRTSPStream(): P2P connection to station ${this.getSerial()} not present, command aborted.`);
                        return;
                    }
                    this.log.debug(`${this.constructor.name}.setRTSPStream(): P2P connection to station ${this.getSerial()} present, set value: ${value}.`);
                    yield this.p2p_session.sendCommandWithIntString(types_2.CommandType.CMD_NAS_SWITCH, value === true ? 1 : 0, device.getChannel(), this.hub.member.admin_user_id, "", device.getChannel());
                }
                else {
                    this.log.warn(`${this.constructor.name}.setRTSPStream(): This functionality is not implemented or support by this device.`);
                }
            }
            else {
                this.log.warn(`${this.constructor.name}.setRTSPStream(): The device ${device.getSerial()} is not managed by this station ${this.getSerial()}, no action is performed.`);
            }
        });
    }
    setAntiTheftDetection(device, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (device.getStationSerial() === this.getSerial()) {
                if (device.isCamera2Product()) {
                    if (!this.p2p_session || !this.p2p_session.isConnected()) {
                        this.log.warn(`${this.constructor.name}.setAntiTheftDetection(): P2P connection to station ${this.getSerial()} not present, command aborted.`);
                        return;
                    }
                    this.log.debug(`${this.constructor.name}.setAntiTheftDetection(): P2P connection to station ${this.getSerial()} present, set value: ${value}.`);
                    yield this.p2p_session.sendCommandWithIntString(types_2.CommandType.CMD_EAS_SWITCH, value === true ? 1 : 0, device.getChannel(), this.hub.member.admin_user_id, "", device.getChannel());
                }
                else {
                    this.log.warn(`${this.constructor.name}.setAntiTheftDetection(): This functionality is only enabled for Eufy Camera 2 products.`);
                }
            }
            else {
                this.log.warn(`${this.constructor.name}.setAntiTheftDetection(): The device ${device.getSerial()} is not managed by this station ${this.getSerial()}, no action is performed.`);
            }
        });
    }
    setWatermark(device, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (device.getStationSerial() === this.getSerial()) {
                if (!this.p2p_session || !this.p2p_session.isConnected()) {
                    this.log.warn(`${this.constructor.name}.setWatermark(): P2P connection to station ${this.getSerial()} not present, command aborted.`);
                    return;
                }
                if (device.isCamera2Product() || device.isIndoorCamera() || device.isFloodLight()) {
                    if (!Object.values(types_2.WatermarkSetting3).includes(value)) {
                        this.log.error(`${this.constructor.name}.setWatermark(): The device ${device.getSerial()} accepts only this type of values: `, types_2.WatermarkSetting3);
                        return;
                    }
                    this.log.debug(`${this.constructor.name}.setWatermark(): P2P connection to station ${this.getSerial()} present, set value: ${types_2.WatermarkSetting3[value]}.`);
                    yield this.p2p_session.sendCommandWithIntString(types_2.CommandType.CMD_SET_DEVS_OSD, value, device.getChannel(), this.hub.member.admin_user_id, "", device.getChannel());
                }
                else if (device.isSoloCameras() || device.getDeviceType() === types_1.DeviceType.DOORBELL) {
                    if (!Object.values(types_2.WatermarkSetting1).includes(value)) {
                        this.log.error(`${this.constructor.name}.setWatermark(): The device ${device.getSerial()} accepts only this type of values: `, types_2.WatermarkSetting1);
                        return;
                    }
                    this.log.debug(`${this.constructor.name}.setWatermark(): P2P connection to station ${this.getSerial()} present, set value: ${types_2.WatermarkSetting1[value]}.`);
                    yield this.p2p_session.sendCommandWithIntString(types_2.CommandType.CMD_SET_DEVS_OSD, value, 0, this.hub.member.admin_user_id, "", 0);
                }
                else if (device.isBatteryDoorbell() || device.isBatteryDoorbell2() || device.getDeviceType() === types_1.DeviceType.CAMERA || device.getDeviceType() === types_1.DeviceType.CAMERA_E) {
                    if (!Object.values(types_2.WatermarkSetting2).includes(value)) {
                        this.log.error(`${this.constructor.name}.setWatermark(): The device ${device.getSerial()} accepts only this type of values: `, types_2.WatermarkSetting2);
                        return;
                    }
                    this.log.debug(`${this.constructor.name}.setWatermark(): P2P connection to station ${this.getSerial()} present, set value: ${types_2.WatermarkSetting2[value]}.`);
                    yield this.p2p_session.sendCommandWithIntString(types_2.CommandType.CMD_SET_DEVS_OSD, value, device.getChannel(), this.hub.member.admin_user_id, "", device.getChannel());
                }
                else {
                    this.log.warn(`${this.constructor.name}.setWatermark(): This functionality is only enabled for Eufy Camera 2 or Indoor Camera products.`);
                }
            }
            else {
                this.log.warn(`${this.constructor.name}.setWatermark(): The device ${device.getSerial()} is not managed by this station ${this.getSerial()}, no action is performed.`);
            }
        });
    }
    enableDevice(device, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (device.getStationSerial() === this.getSerial()) {
                if (device.isCamera()) {
                    if (!this.p2p_session || !this.p2p_session.isConnected()) {
                        this.log.warn(`${this.constructor.name}.enableDevice(): P2P connection to station ${this.getSerial()} not present, command aborted.`);
                        return;
                    }
                    let param_value = value === true ? 0 : 1;
                    if (device.isIndoorCamera() || device.isSoloCameras() || device.getDeviceType() === types_1.DeviceType.DOORBELL)
                        param_value = value === true ? 1 : 0;
                    this.log.debug(`${this.constructor.name}.enableDevice(): P2P connection to station ${this.getSerial()} present, set value: ${value}.`);
                    yield this.p2p_session.sendCommandWithIntString(types_2.CommandType.CMD_DEVS_SWITCH, param_value, device.getChannel(), this.hub.member.admin_user_id, "", device.getChannel());
                }
                else {
                    this.log.warn(`${this.constructor.name}.enableDevice(): This functionality is only enabled for Eufy Camera products.`);
                }
            }
            else {
                this.log.warn(`${this.constructor.name}.enableDevice(): The device ${device.getSerial()} is not managed by this station ${this.getSerial()}, no action is performed.`);
            }
        });
    }
    startDownload(path, cipher_id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.p2p_session || !this.p2p_session.isConnected()) {
                this.log.warn(`${this.constructor.name}.startDownload(): P2P connection to station ${this.getSerial()} not present, command aborted.`);
                return;
            }
            const cipher = yield this.api.getCipher(cipher_id, this.hub.member.admin_user_id);
            if (cipher) {
                this.log.debug(`${this.constructor.name}.startDownload(): P2P connection to station ${this.getSerial()} present, download video path: ${path}.`);
                this.p2p_session.setDownloadRSAPrivateKeyPem(cipher.private_key);
                yield this.p2p_session.sendCommandWithString(types_2.CommandType.CMD_DOWNLOAD_VIDEO, path, this.hub.member.admin_user_id, Station.CHANNEL);
            }
            else {
                this.log.warn(`Cancelled download of video "${path}" from Station ${this.getSerial()}, because RSA certificate couldn't be loaded.`);
            }
        });
    }
    cancelDownload(device) {
        return __awaiter(this, void 0, void 0, function* () {
            if (device.getStationSerial() === this.getSerial()) {
                if (!this.p2p_session || !this.p2p_session.isConnected()) {
                    this.log.warn(`${this.constructor.name}.cancelDownload(): P2P connection to station ${this.getSerial()} not present, command aborted.`);
                    return;
                }
                this.log.debug(`${this.constructor.name}.cancelDownload(): P2P connection to station ${this.getSerial()} present, cancel download for channel: ${device.getChannel()}.`);
                yield this.p2p_session.sendCommandWithInt(types_2.CommandType.CMD_DOWNLOAD_CANCEL, device.getChannel(), this.hub.member.admin_user_id, device.getChannel());
            }
            else {
                this.log.warn(`${this.constructor.name}.cancelDownload(): The device ${device.getSerial()} is not managed by this station ${this.getSerial()}, no action is performed.`);
            }
        });
    }
    startLivestream(device) {
        return __awaiter(this, void 0, void 0, function* () {
            if (device.getStationSerial() === this.getSerial()) {
                if (!this.p2p_session || !this.p2p_session.isConnected()) {
                    this.log.warn(`${this.constructor.name}.startLivestream(): P2P connection to station ${this.getSerial()} not present, command aborted.`);
                    return;
                }
                this.log.debug(`${this.constructor.name}.startLivestream(): P2P connection to station ${this.getSerial()} present, start livestream for channel: ${device.getChannel()}.`);
                const rsa_key = this.p2p_session.getRSAPrivateKey();
                if (device.getDeviceType() === types_1.DeviceType.DOORBELL || device.isFloodLight() || device.isSoloCameras() || device.isIndoorCamera()) {
                    this.log.debug(`${this.constructor.name}.startLivestream(): Using CMD_DOORBELL_SET_PAYLOAD for station ${this.getSerial()} (main_sw_version: ${this.getSoftwareVersion()})`);
                    yield this.p2p_session.sendCommandWithStringPayload(types_2.CommandType.CMD_DOORBELL_SET_PAYLOAD, JSON.stringify({
                        "commandType": 1000,
                        "data": {
                            "account_id": this.hub.member.admin_user_id,
                            "encryptkey": rsa_key === null || rsa_key === void 0 ? void 0 : rsa_key.exportKey("components-public").n.slice(1).toString("hex"),
                            "streamtype": 0
                        }
                        //}), Station.CHANNEL);
                    }), device.getChannel());
                }
                else {
                    if ((device_1.Device.isIntegratedDeviceBySn(this.getSerial()) || !utils_1.isGreaterMinVersion("2.0.9.7", this.getSoftwareVersion())) && (!this.getSerial().startsWith("T8420") || !utils_1.isGreaterMinVersion("1.0.0.25", this.getSoftwareVersion()))) {
                        this.log.debug(`${this.constructor.name}.startLivestream(): Using CMD_START_REALTIME_MEDIA for station ${this.getSerial()} (main_sw_version: ${this.getSoftwareVersion()})`);
                        yield this.p2p_session.sendCommandWithInt(types_2.CommandType.CMD_START_REALTIME_MEDIA, device.getChannel(), rsa_key === null || rsa_key === void 0 ? void 0 : rsa_key.exportKey("components-public").n.slice(1).toString("hex"), device.getChannel());
                    }
                    else {
                        this.log.debug(`${this.constructor.name}.startLivestream(): Using CMD_SET_PAYLOAD for station ${this.getSerial()} (main_sw_version: ${this.getSoftwareVersion()})`);
                        yield this.p2p_session.sendCommandWithStringPayload(types_2.CommandType.CMD_SET_PAYLOAD, JSON.stringify({
                            "account_id": this.hub.member.admin_user_id,
                            "cmd": types_2.CommandType.CMD_START_REALTIME_MEDIA,
                            "mValue3": types_2.CommandType.CMD_START_REALTIME_MEDIA,
                            "payload": {
                                "ClientOS": "Android",
                                "key": rsa_key === null || rsa_key === void 0 ? void 0 : rsa_key.exportKey("components-public").n.slice(1).toString("hex"),
                                "streamtype": types_2.VideoCodec.H264
                            }
                        }), device.getChannel());
                    }
                }
            }
            else {
                this.log.warn(`${this.constructor.name}.startLivestream(): The device ${device.getSerial()} is not managed by this station ${this.getSerial()}, no action is performed.`);
            }
        });
    }
    stopLivestream(device) {
        return __awaiter(this, void 0, void 0, function* () {
            if (device.getStationSerial() === this.getSerial()) {
                if (!this.p2p_session || !this.p2p_session.isConnected()) {
                    this.log.warn(`${this.constructor.name}.stopLivestream(): P2P connection to station ${this.getSerial()} not present, command aborted.`);
                    return;
                }
                this.log.debug(`${this.constructor.name}.stopLivestream(): P2P connection to station ${this.getSerial()} present, start livestream for channel: ${device.getChannel()}.`);
                yield this.p2p_session.sendCommandWithInt(types_2.CommandType.CMD_STOP_REALTIME_MEDIA, device.getChannel(), undefined, device.getChannel());
            }
            else {
                this.log.warn(`${this.constructor.name}.stopLivestream(): The device ${device.getSerial()} is not managed by this station ${this.getSerial()}, no action is performed.`);
            }
        });
    }
    isLiveStreaming(device) {
        if (!this.p2p_session || !this.p2p_session.isConnected()) {
            return false;
        }
        if (device.getStationSerial() !== this.getSerial())
            return false;
        return this.p2p_session.isLiveStreaming(device.getChannel());
    }
    quickResponse(device, voice_id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (device.getStationSerial() === this.getSerial()) {
                if (device.isDoorbell()) {
                    if (!this.p2p_session || !this.p2p_session.isConnected()) {
                        this.log.warn(`${this.constructor.name}.quickResponse(): P2P connection to station ${this.getSerial()} not present, command aborted.`);
                        return;
                    }
                    this.log.debug(`${this.constructor.name}.quickResponse(): P2P connection to station ${this.getSerial()} present, set voice_id: ${voice_id}.`);
                    if (device.isBatteryDoorbell() || device.isBatteryDoorbell2()) {
                        this.log.debug(`${this.constructor.name}.startLivestream(): Using CMD_BAT_DOORBELL_QUICK_RESPONSE for station ${this.getSerial()}`);
                        yield this.p2p_session.sendCommandWithIntString(types_2.CommandType.CMD_BAT_DOORBELL_QUICK_RESPONSE, voice_id, device.getChannel(), this.hub.member.admin_user_id, "", device.getChannel());
                    }
                    else if (device.getDeviceType() === types_1.DeviceType.DOORBELL) {
                        this.log.debug(`${this.constructor.name}.startLivestream(): Using CMD_DOORBELL_SET_PAYLOAD for station ${this.getSerial()}`);
                        yield this.p2p_session.sendCommandWithStringPayload(types_2.CommandType.CMD_DOORBELL_SET_PAYLOAD, JSON.stringify({
                            "commandType": 1004,
                            "data": {
                                "voiceID": voice_id
                            }
                            //}), Station.CHANNEL);
                        }), device.getChannel());
                    }
                }
                else {
                    this.log.warn(`${this.constructor.name}.quickResponse(): This functionality is only enabled for doorbell products.`);
                }
            }
            else {
                this.log.warn(`${this.constructor.name}.quickResponse(): The device ${device.getSerial()} is not managed by this station ${this.getSerial()}, no action is performed.`);
            }
        });
    }
}
exports.Station = Station;
Station.CHANNEL = 255;
