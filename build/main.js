"use strict";
/*
 * Created with @iobroker/create-adapter v1.28.0
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.euSec = void 0;
const utils = __importStar(require("@iobroker/adapter-core"));
const path = __importStar(require("path"));
const eufy_security_client_1 = require("eufy-security-client");
const i18n_iso_countries_1 = require("i18n-iso-countries");
const i18n_iso_languages_1 = require("@cospired/i18n-iso-languages");
const fs_extra_1 = __importDefault(require("fs-extra"));
const util_1 = __importDefault(require("util"));
const types_1 = require("./lib/types");
const utils_1 = require("./lib/utils");
const log_1 = require("./lib/log");
const video_1 = require("./lib/video");
class euSec extends utils.Adapter {
    constructor(options = {}) {
        super({
            ...options,
            name: "eusec",
        });
        this.downloadEvent = {};
        this.persistentData = {
            version: ""
        };
        this.rtmpFFmpegPromise = new Map();
        this.captchaId = null;
        this.verify_code = false;
        const data_dir = utils.getAbsoluteInstanceDataDir(this);
        this.persistentFile = path.join(data_dir, "adapter.json");
        if (!fs_extra_1.default.existsSync(data_dir))
            fs_extra_1.default.mkdirSync(data_dir);
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        // this.on("objectChange", this.onObjectChange.bind(this));
        // this.on("message", this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));
    }
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        this.logger = new log_1.ioBrokerLogger(this.log);
        await this.setObjectNotExistsAsync("verify_code", {
            type: "state",
            common: {
                name: "2FA verification code",
                type: "string",
                role: "state",
                read: true,
                write: true,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync("received_captcha_html", {
            type: "state",
            common: {
                name: "Received captcha image HTML",
                type: "string",
                role: "state",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync("captcha", {
            type: "state",
            common: {
                name: "Enter captcha",
                type: "string",
                role: "state",
                read: true,
                write: true,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync("info", {
            type: "channel",
            common: {
                name: "info"
            },
            native: {},
        });
        await this.setObjectNotExistsAsync("info.connection", {
            type: "state",
            common: {
                name: "Global connection",
                type: "boolean",
                role: "indicator.connection",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setStateAsync("info.connection", { val: false, ack: true });
        await this.setObjectNotExistsAsync("info.push_connection", {
            type: "state",
            common: {
                name: "Push notification connection",
                type: "boolean",
                role: "indicator.connection",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setStateAsync("info.push_connection", { val: false, ack: true });
        await this.setObjectNotExistsAsync("info.mqtt_connection", {
            type: "state",
            common: {
                name: "MQTT connection",
                type: "boolean",
                role: "indicator.connection",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setStateAsync("info.mqtt_connection", { val: false, ack: true });
        try {
            const connection = await this.getStatesAsync("*.connection");
            if (connection)
                Object.keys(connection).forEach(async (id) => {
                    await this.setStateAsync(id, { val: false, ack: true });
                });
        }
        catch (error) {
            this.logger.error("Reset connection states - Error", error);
        }
        try {
            const sensorList = [
                eufy_security_client_1.PropertyName.DeviceMotionDetected,
                eufy_security_client_1.PropertyName.DevicePersonDetected,
                eufy_security_client_1.PropertyName.DeviceSoundDetected,
                eufy_security_client_1.PropertyName.DeviceCryingDetected,
                eufy_security_client_1.PropertyName.DevicePetDetected,
                eufy_security_client_1.PropertyName.DeviceRinging
            ];
            for (const sensorName of sensorList) {
                const sensors = await this.getStatesAsync(`*.${(0, utils_1.convertCamelCaseToSnakeCase)(sensorName)}`);
                if (sensors)
                    Object.keys(sensors).forEach(async (id) => {
                        await this.setStateAsync(id, { val: false, ack: true });
                    });
            }
        }
        catch (error) {
            this.logger.error("Reset sensor states - Error", error);
        }
        try {
            if (fs_extra_1.default.statSync(this.persistentFile).isFile()) {
                const fileContent = fs_extra_1.default.readFileSync(this.persistentFile, "utf8");
                this.persistentData = JSON.parse(fileContent);
            }
        }
        catch (error) {
            this.logger.debug("No stored data from last exit found.", error);
        }
        this.subscribeStates("verify_code");
        this.subscribeStates("captcha");
        const systemConfig = await this.getForeignObjectAsync("system.config");
        let countryCode = undefined;
        let languageCode = undefined;
        if (systemConfig) {
            countryCode = (0, i18n_iso_countries_1.getAlpha2Code)(systemConfig.common.country, "en");
            if ((0, i18n_iso_languages_1.isValid)(systemConfig.common.language))
                languageCode = systemConfig.common.language;
        }
        // Handling adapter version update
        try {
            if (this.persistentData.version !== this.version) {
                const currentVersion = Number.parseFloat((0, utils_1.removeLastChar)(this.version, "."));
                const previousVersion = this.persistentData.version !== "" && this.persistentData.version !== undefined ? Number.parseFloat((0, utils_1.removeLastChar)(this.persistentData.version, ".")) : 0;
                this.logger.debug(`Handling of adapter update - currentVersion: ${currentVersion} previousVersion: ${previousVersion}`);
                if (previousVersion < currentVersion) {
                    await (0, utils_1.handleUpdate)(this, this.logger, previousVersion);
                    this.persistentData.version = this.version;
                    this.writePersistentData();
                }
            }
        }
        catch (error) {
            this.logger.error(`Handling of adapter update - Error:`, error);
        }
        let connectionType = eufy_security_client_1.P2PConnectionType.QUICKEST;
        if (this.config.p2pConnectionType === "only_local") {
            connectionType = eufy_security_client_1.P2PConnectionType.ONLY_LOCAL;
        }
        const config = {
            username: this.config.username,
            password: this.config.password,
            country: countryCode,
            language: languageCode,
            persistentDir: utils.getAbsoluteInstanceDataDir(this),
            eventDurationSeconds: this.config.eventDuration,
            p2pConnectionSetup: connectionType,
            pollingIntervalMinutes: this.config.pollingInterval,
            acceptInvitations: this.config.acceptInvitations,
            trustedDeviceName: "IOBROKER",
        };
        this.eufy = await eufy_security_client_1.EufySecurity.initialize(config, this.logger);
        this.eufy.on("station added", (station) => this.onStationAdded(station));
        this.eufy.on("device added", (device) => this.onDeviceAdded(device));
        this.eufy.on("station removed", (station) => this.onStationRemoved(station));
        this.eufy.on("device removed", (device) => this.onDeviceRemoved(device));
        this.eufy.on("push message", (messages) => this.handlePushNotification(messages));
        this.eufy.on("push connect", () => this.onPushConnect());
        this.eufy.on("push close", () => this.onPushClose());
        this.eufy.on("mqtt connect", () => this.onMQTTConnect());
        this.eufy.on("mqtt close", () => this.onMQTTClose());
        this.eufy.on("connect", () => this.onConnect());
        this.eufy.on("close", () => this.onClose());
        this.eufy.on("cloud livestream start", (station, device, url) => this.onCloudLivestreamStart(station, device, url));
        this.eufy.on("cloud livestream stop", (station, device) => this.onCloudLivestreamStop(station, device));
        this.eufy.on("device property changed", (device, name, value) => this.onDevicePropertyChanged(device, name, value));
        this.eufy.on("station command result", (station, result) => this.onStationCommandResult(station, result));
        this.eufy.on("station download start", (station, device, metadata, videostream, audiostream) => this.onStationDownloadStart(station, device, metadata, videostream, audiostream));
        this.eufy.on("station download finish", (station, device) => this.onStationDownloadFinish(station, device));
        this.eufy.on("station livestream start", (station, device, metadata, videostream, audiostream) => this.onStationLivestreamStart(station, device, metadata, videostream, audiostream));
        this.eufy.on("station livestream stop", (station, device) => this.onStationLivestreamStop(station, device));
        this.eufy.on("station rtsp url", (station, device, value) => this.onStationRTSPUrl(station, device, value));
        this.eufy.on("station property changed", (station, name, value) => this.onStationPropertyChanged(station, name, value));
        this.eufy.on("station connect", (station) => this.onStationConnect(station));
        this.eufy.on("station close", (station) => this.onStationClose(station));
        this.eufy.on("tfa request", () => this.onTFARequest());
        this.eufy.on("captcha request", (captchaId, captcha) => this.onCaptchaRequest(captchaId, captcha));
        this.eufy.setCameraMaxLivestreamDuration(this.config.maxLivestreamDuration);
        //TODO: Implement station alarm event
        //this.eufy.on("station alarm event", );
        await this.eufy.connect();
    }
    writePersistentData() {
        try {
            fs_extra_1.default.writeFileSync(this.persistentFile, JSON.stringify(this.persistentData));
        }
        catch (error) {
            this.logger.error(`writePersistentData() - Error: ${error}`);
        }
    }
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    async onUnload(callback) {
        try {
            this.writePersistentData();
            if (this.eufy) {
                this.eufy.removeAllListeners();
                this.eufy.close();
            }
            callback();
        }
        catch (e) {
            callback();
        }
    }
    // If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
    // You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
    // /**
    //  * Is called if a subscribed object changes
    //  */
    // private onObjectChange(id: string, obj: ioBroker.Object | null | undefined): void {
    //     if (obj) {
    //         // The object was changed
    //         this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
    //     } else {
    //         // The object was deleted
    //         this.log.info(`object ${id} deleted`);
    //     }
    // }
    /**
     * Is called if a subscribed state changes
     */
    async onStateChange(id, state) {
        if (state) {
            // don't do anything if the state is acked
            if (!id || state.ack) {
                this.logger.debug(`state ${id} changed: ${state.val} (ack = ${state.ack}) was already acknowledged, ignore it...`);
                return;
            }
            this.logger.debug(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
            const values = id.split(".");
            const station_sn = values[2];
            const device_type = values[3];
            if (station_sn == "verify_code") {
                if (this.eufy && this.verify_code) {
                    this.logger.info(`Verification code received, send it. (verify_code: ${state.val})`);
                    await this.eufy.connect({ verifyCode: state.val });
                    this.verify_code = false;
                    await this.delStateAsync(id);
                }
            }
            else if (station_sn == "captcha") {
                if (this.eufy && this.captchaId) {
                    this.logger.info(`Captcha received, send it. (captcha: ${state.val})`);
                    await this.eufy.connect({
                        captcha: {
                            captchaCode: state.val,
                            captchaId: this.captchaId
                        }
                    });
                    this.captchaId = null;
                    await this.delStateAsync(id);
                    await this.delStateAsync("received_captcha_html");
                }
            }
            else if (device_type == "station") {
                try {
                    const station_state_name = values[4];
                    if (this.eufy) {
                        const obj = await this.getObjectAsync(id);
                        if (obj) {
                            if (obj.native.name !== undefined) {
                                await this.eufy.setStationProperty(station_sn, obj.native.name, state.val);
                                return;
                            }
                        }
                        const station = await this.eufy.getStation(station_sn);
                        switch (station_state_name) {
                            case types_1.StationStateID.REBOOT:
                                await station.rebootHUB();
                                break;
                            case types_1.StationStateID.TRIGGER_ALARM_SOUND:
                                await station.triggerStationAlarmSound(this.config.alarmSoundDuration);
                                break;
                            case types_1.StationStateID.RESET_ALARM_SOUND:
                                await station.resetStationAlarmSound();
                                break;
                        }
                    }
                }
                catch (error) {
                    this.logger.error(`station - Error:`, error);
                }
            }
            else {
                try {
                    const device_sn = values[4];
                    const obj = await this.getObjectAsync(id);
                    if (obj) {
                        if (obj.native.name !== undefined) {
                            try {
                                await this.eufy.setDeviceProperty(device_sn, obj.native.name, state.val);
                            }
                            catch (error) {
                                this.logger.error(`Error in setting property value (property: ${obj.native.name} value: ${state.val})`, error);
                            }
                            return;
                        }
                    }
                    const device_state_name = values[5];
                    const station = await this.eufy.getStation(station_sn);
                    const device = await this.eufy.getDevice(device_sn);
                    switch (device_state_name) {
                        case types_1.CameraStateID.START_STREAM:
                            await this.startLivestream(device_sn);
                            break;
                        case types_1.CameraStateID.STOP_STREAM:
                            await this.stopLivestream(device_sn);
                            break;
                        case types_1.CameraStateID.TRIGGER_ALARM_SOUND:
                            await station.triggerDeviceAlarmSound(device, this.config.alarmSoundDuration);
                            break;
                        case types_1.CameraStateID.RESET_ALARM_SOUND:
                            await station.resetDeviceAlarmSound(device);
                            break;
                        case types_1.IndoorCameraStateID.ROTATE_360:
                            await station.panAndTilt(device, eufy_security_client_1.PanTiltDirection.ROTATE360);
                            break;
                        case types_1.IndoorCameraStateID.PAN_LEFT:
                            await station.panAndTilt(device, eufy_security_client_1.PanTiltDirection.LEFT);
                            break;
                        case types_1.IndoorCameraStateID.PAN_RIGHT:
                            await station.panAndTilt(device, eufy_security_client_1.PanTiltDirection.RIGHT);
                            break;
                        case types_1.IndoorCameraStateID.TILT_UP:
                            await station.panAndTilt(device, eufy_security_client_1.PanTiltDirection.UP);
                            break;
                        case types_1.IndoorCameraStateID.TILT_DOWN:
                            await station.panAndTilt(device, eufy_security_client_1.PanTiltDirection.DOWN);
                            break;
                        case types_1.LockStateID.CALIBRATE:
                            if (device.isLock()) {
                                await station.calibrateLock(device);
                            }
                            else {
                                await station.calibrate(device);
                            }
                            break;
                        case types_1.SmartSafeStateID.UNLOCK:
                            await station.unlock(device);
                            break;
                        case types_1.IndoorCameraStateID.SET_DEFAULT_ANGLE:
                            await station.setDefaultAngle(device);
                            break;
                        case types_1.IndoorCameraStateID.SET_PRIVACY_ANGLE:
                            await station.setPrivacyAngle(device);
                            break;
                    }
                }
                catch (error) {
                    this.logger.error(`cameras - Error:`, error);
                }
            }
        }
        else {
            // The state was deleted
            this.logger.debug(`state ${id} deleted`);
        }
    }
    // If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
    // /**
    //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
    //  * Using this method requires "common.message" property to be set to true in io-package.json
    //  */
    // private onMessage(obj: ioBroker.Message): void {
    //     if (typeof obj === "object" && obj.message) {
    //         if (obj.command === "send") {
    //             // e.g. send email or pushover or whatever
    //             this.log.info("send command");
    //             // Send response in callback if required
    //             if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
    //         }
    //     }
    // }
    getStateCommon(property) {
        const state = {
            name: property.label,
            type: property.type,
            role: "state",
            read: property.readable,
            write: property.writeable,
            def: property.default
        };
        switch (property.type) {
            case "number": {
                const numberProperty = property;
                state.min = numberProperty.min;
                state.max = numberProperty.max;
                state.states = numberProperty.states;
                state.unit = numberProperty.unit;
                state.step = numberProperty.steps;
                state.role = types_1.RoleMapping[property.name] !== undefined ? types_1.RoleMapping[property.name] : "value";
                break;
            }
            case "string": {
                state.role = types_1.RoleMapping[property.name] !== undefined ? types_1.RoleMapping[property.name] : "text";
                break;
            }
            case "boolean": {
                state.role = types_1.RoleMapping[property.name] !== undefined ? types_1.RoleMapping[property.name] : (property.writeable ? "switch.enable" : "state");
                break;
            }
        }
        return state;
    }
    async createAndSetState(device, property) {
        if (property.name !== eufy_security_client_1.PropertyName.Type && property.name !== eufy_security_client_1.PropertyName.DeviceStationSN) {
            const state = this.getStateCommon(property);
            const id = device.getStateID((0, utils_1.convertCamelCaseToSnakeCase)(property.name));
            const obj = await this.getObjectAsync(id);
            if (obj) {
                let changed = false;
                if (obj.native.name !== undefined && obj.native.name !== property.name) {
                    obj.native.name = property.name;
                    changed = true;
                }
                if (obj.native.key !== undefined && obj.native.key !== property.key) {
                    obj.native.key = property.key;
                    changed = true;
                }
                if (obj.native.commandId !== undefined && obj.native.commandId !== property.commandId) {
                    obj.native.commandId = property.commandId;
                    changed = true;
                }
                if (obj.common !== undefined && !util_1.default.isDeepStrictEqual(obj.common, state)) {
                    changed = true;
                }
                if (changed) {
                    const propertyMetadata = device.getPropertiesMetadata()[property.name];
                    if (propertyMetadata !== undefined) {
                        const newState = this.getStateCommon(propertyMetadata);
                        obj.common = newState;
                    }
                    await this.setObjectAsync(id, obj);
                }
            }
            else {
                await this.setObjectNotExistsAsync(id, {
                    type: "state",
                    common: state,
                    native: {
                        key: property.key,
                        commandId: property.commandId,
                        name: property.name,
                    },
                });
            }
            const value = device.getPropertyValue(property.name);
            if (value !== undefined)
                await (0, utils_1.setStateChangedAsync)(this, id, value);
        }
    }
    async onDeviceAdded(device) {
        //this.logger.debug(`count: ${Object.keys(devices).length}`);
        await this.setObjectNotExistsAsync(device.getStateID("", 0), {
            type: "channel",
            common: {
                name: device.getStateChannel()
            },
            native: {},
        });
        await this.setObjectNotExistsAsync(device.getStateID("", 1), {
            type: "device",
            common: {
                name: device.getName()
            },
            native: {},
        });
        const metadata = device.getPropertiesMetadata();
        for (const property of Object.values(metadata)) {
            this.createAndSetState(device, property);
        }
        if (device.hasCommand(eufy_security_client_1.CommandName.DeviceTriggerAlarmSound)) {
            await this.setObjectNotExistsAsync(device.getStateID(types_1.CameraStateID.TRIGGER_ALARM_SOUND), {
                type: "state",
                common: {
                    name: "Trigger Alarm Sound",
                    type: "boolean",
                    role: "button.start",
                    read: false,
                    write: true,
                },
                native: {},
            });
            await this.setObjectNotExistsAsync(device.getStateID(types_1.CameraStateID.RESET_ALARM_SOUND), {
                type: "state",
                common: {
                    name: "Reset Alarm Sound",
                    type: "boolean",
                    role: "button.start",
                    read: false,
                    write: true,
                },
                native: {},
            });
        }
        if (device.hasCommand(eufy_security_client_1.CommandName.DevicePanAndTilt)) {
            await this.setObjectNotExistsAsync(device.getStateID(types_1.IndoorCameraStateID.PAN_LEFT), {
                type: "state",
                common: {
                    name: "Pan Left",
                    type: "boolean",
                    role: "button.start",
                    read: false,
                    write: true,
                },
                native: {},
            });
            await this.setObjectNotExistsAsync(device.getStateID(types_1.IndoorCameraStateID.PAN_RIGHT), {
                type: "state",
                common: {
                    name: "Pan Right",
                    type: "boolean",
                    role: "button.start",
                    read: false,
                    write: true,
                },
                native: {},
            });
            await this.setObjectNotExistsAsync(device.getStateID(types_1.IndoorCameraStateID.ROTATE_360), {
                type: "state",
                common: {
                    name: "Rotate 360°",
                    type: "boolean",
                    role: "button.start",
                    read: false,
                    write: true,
                },
                native: {},
            });
            await this.setObjectNotExistsAsync(device.getStateID(types_1.IndoorCameraStateID.TILT_UP), {
                type: "state",
                common: {
                    name: "Tilt Up",
                    type: "boolean",
                    role: "button.start",
                    read: false,
                    write: true,
                },
                native: {},
            });
            await this.setObjectNotExistsAsync(device.getStateID(types_1.IndoorCameraStateID.TILT_DOWN), {
                type: "state",
                common: {
                    name: "Tilt Down",
                    type: "boolean",
                    role: "button.start",
                    read: false,
                    write: true,
                },
                native: {},
            });
        }
        if (device.hasCommand(eufy_security_client_1.CommandName.DeviceLockCalibration)) {
            await this.setObjectNotExistsAsync(device.getStateID(types_1.LockStateID.CALIBRATE), {
                type: "state",
                common: {
                    name: "Calibrate Lock",
                    type: "boolean",
                    role: "button.start",
                    read: false,
                    write: true,
                },
                native: {},
            });
        }
        if (device.hasCommand(eufy_security_client_1.CommandName.DeviceUnlock)) {
            await this.setObjectNotExistsAsync(device.getStateID(types_1.SmartSafeStateID.UNLOCK), {
                type: "state",
                common: {
                    name: "Unlock",
                    type: "boolean",
                    role: "button.start",
                    read: false,
                    write: true,
                },
                native: {},
            });
        }
        if (device.hasCommand(eufy_security_client_1.CommandName.DeviceSetDefaultAngle)) {
            await this.setObjectNotExistsAsync(device.getStateID(types_1.IndoorCameraStateID.SET_DEFAULT_ANGLE), {
                type: "state",
                common: {
                    name: "Set Default Angle",
                    type: "boolean",
                    role: "button.start",
                    read: false,
                    write: true,
                },
                native: {},
            });
        }
        if (device.hasCommand(eufy_security_client_1.CommandName.DeviceSetPrivacyAngle)) {
            await this.setObjectNotExistsAsync(device.getStateID(types_1.IndoorCameraStateID.SET_PRIVACY_ANGLE), {
                type: "state",
                common: {
                    name: "Set Default Angle",
                    type: "boolean",
                    role: "button.start",
                    read: false,
                    write: true,
                },
                native: {},
            });
        }
        if (device.hasCommand(eufy_security_client_1.CommandName.DeviceCalibrate)) {
            await this.setObjectNotExistsAsync(device.getStateID(types_1.LockStateID.CALIBRATE), {
                type: "state",
                common: {
                    name: "Calibrate",
                    type: "boolean",
                    role: "button.start",
                    read: false,
                    write: true,
                },
                native: {},
            });
        }
        if (device.hasProperty(eufy_security_client_1.PropertyName.DevicePictureUrl)) {
            // Last event picture
            const last_camera_url = device.getPropertyValue(eufy_security_client_1.PropertyName.DevicePictureUrl);
            if (last_camera_url !== undefined)
                (0, utils_1.saveImageStates)(this, last_camera_url, device.getStationSerial(), device.getSerial(), types_1.DataLocation.LAST_EVENT, device.getStateID(types_1.CameraStateID.LAST_EVENT_PIC_URL), device.getStateID(types_1.CameraStateID.LAST_EVENT_PIC_HTML), "Last event picture").catch(() => {
                    this.logger.error(`State LAST_EVENT_PICTURE_URL of device ${device.getSerial()} - saveImageStates(): url ${last_camera_url}`);
                });
        }
        if (device.hasCommand(eufy_security_client_1.CommandName.DeviceStartLivestream)) {
            // Start Stream
            await this.setObjectNotExistsAsync(device.getStateID(types_1.CameraStateID.START_STREAM), {
                type: "state",
                common: {
                    name: "Start stream",
                    type: "boolean",
                    role: "button.start",
                    read: false,
                    write: true,
                },
                native: {},
            });
            // Stop Stream
            await this.setObjectNotExistsAsync(device.getStateID(types_1.CameraStateID.STOP_STREAM), {
                type: "state",
                common: {
                    name: "Stop stream",
                    type: "boolean",
                    role: "button.stop",
                    read: false,
                    write: true,
                },
                native: {},
            });
            // Livestream URL
            await this.setObjectNotExistsAsync(device.getStateID(types_1.CameraStateID.LIVESTREAM), {
                type: "state",
                common: {
                    name: "Livestream URL",
                    type: "string",
                    role: "url",
                    read: true,
                    write: false,
                },
                native: {},
            });
            // Last livestream video URL
            await this.setObjectNotExistsAsync(device.getStateID(types_1.CameraStateID.LAST_LIVESTREAM_VIDEO_URL), {
                type: "state",
                common: {
                    name: "Last livestream video URL",
                    type: "string",
                    role: "url",
                    read: true,
                    write: false,
                },
                native: {},
            });
            // Last livestream picture URL
            await this.setObjectNotExistsAsync(device.getStateID(types_1.CameraStateID.LAST_LIVESTREAM_PIC_URL), {
                type: "state",
                common: {
                    name: "Last livestream picture URL",
                    type: "string",
                    role: "url",
                    read: true,
                    write: false,
                },
                native: {},
            });
            // Last livestream picture HTML
            await this.setObjectNotExistsAsync(device.getStateID(types_1.CameraStateID.LAST_LIVESTREAM_PIC_HTML), {
                type: "state",
                common: {
                    name: "Last livestream picture HTML image",
                    type: "string",
                    role: "html",
                    read: true,
                    write: false,
                },
                native: {},
            });
        }
        if (device.hasProperty(eufy_security_client_1.PropertyName.DeviceRTSPStream)) {
            // RTSP Stream URL
            await this.setObjectNotExistsAsync(device.getStateID(types_1.CameraStateID.RTSP_STREAM_URL), {
                type: "state",
                common: {
                    name: "RTSP stream URL",
                    type: "string",
                    role: "url",
                    read: true,
                    write: false
                },
                native: {},
            });
        }
        if (device.hasCommand(eufy_security_client_1.CommandName.DeviceStartDownload)) {
            // Last event video URL
            await this.setObjectNotExistsAsync(device.getStateID(types_1.CameraStateID.LAST_EVENT_VIDEO_URL), {
                type: "state",
                common: {
                    name: "Last event video URL",
                    type: "string",
                    role: "url",
                    read: true,
                    write: false,
                    def: ""
                },
                native: {},
            });
            // Last event picture URL
            await this.setObjectNotExistsAsync(device.getStateID(types_1.CameraStateID.LAST_EVENT_PIC_URL), {
                type: "state",
                common: {
                    name: "Last event picture URL",
                    type: "string",
                    role: "url",
                    read: true,
                    write: false,
                    def: ""
                },
                native: {},
            });
            // Last event picture HTML image
            await this.setObjectNotExistsAsync(device.getStateID(types_1.CameraStateID.LAST_EVENT_PIC_HTML), {
                type: "state",
                common: {
                    name: "Last event picture HTML image",
                    type: "string",
                    role: "html",
                    read: true,
                    write: false,
                    def: ""
                },
                native: {},
            });
        }
    }
    async onDeviceRemoved(device) {
        this.delObjectAsync(device.getStateID("", 0), { recursive: true }).catch((error) => {
            this.logger.error(`Error deleting removed device`, error);
        });
    }
    async onStationAdded(station) {
        this.subscribeStates(`${station.getStateID("", 0)}.*`);
        await this.setObjectNotExistsAsync(station.getStateID("", 0), {
            type: "device",
            common: {
                name: station.getName()
            },
            native: {},
        });
        await this.setObjectNotExistsAsync(station.getStateID("", 1), {
            type: "channel",
            common: {
                name: station.getStateChannel()
            },
            native: {},
        });
        await this.setObjectNotExistsAsync(station.getStateID(types_1.StationStateID.CONNECTION), {
            type: "state",
            common: {
                name: "Connection",
                type: "boolean",
                role: "indicator.connection",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setStateAsync(station.getStateID(types_1.StationStateID.CONNECTION), { val: false, ack: true });
        const metadata = station.getPropertiesMetadata();
        for (const property of Object.values(metadata)) {
            this.createAndSetState(station, property);
        }
        // Reboot station
        if (station.hasCommand(eufy_security_client_1.CommandName.StationReboot)) {
            await this.setObjectNotExistsAsync(station.getStateID(types_1.StationStateID.REBOOT), {
                type: "state",
                common: {
                    name: "Reboot station",
                    type: "boolean",
                    role: "button.start",
                    read: false,
                    write: true,
                },
                native: {},
            });
        }
        // Alarm Sound
        if (station.hasCommand(eufy_security_client_1.CommandName.StationTriggerAlarmSound)) {
            await this.setObjectNotExistsAsync(station.getStateID(types_1.StationStateID.TRIGGER_ALARM_SOUND), {
                type: "state",
                common: {
                    name: "Trigger Alarm Sound",
                    type: "boolean",
                    role: "button.start",
                    read: false,
                    write: true,
                },
                native: {},
            });
            await this.setObjectNotExistsAsync(station.getStateID(types_1.StationStateID.RESET_ALARM_SOUND), {
                type: "state",
                common: {
                    name: "Reset Alarm Sound",
                    type: "boolean",
                    role: "button.start",
                    read: false,
                    write: true,
                },
                native: {},
            });
        }
    }
    async onStationRemoved(station) {
        this.delObjectAsync(station.getStateID("", 0), { recursive: true }).catch((error) => {
            this.logger.error(`Error deleting removed station`, error);
        });
    }
    async downloadEventVideo(device, event_time, full_path, cipher_id) {
        this.logger.debug(`Device: ${device.getSerial()} full_path: ${full_path} cipher_id: ${cipher_id}`);
        try {
            if (!(0, utils_1.isEmpty)(full_path) && cipher_id !== undefined) {
                const station = await this.eufy.getStation(device.getStationSerial());
                if (station !== undefined) {
                    if (this.downloadEvent[device.getSerial()])
                        clearTimeout(this.downloadEvent[device.getSerial()]);
                    let videoLength = (0, utils_1.getVideoClipLength)(device);
                    const time_passed = (new Date().getTime() - new Date(event_time).getTime()) / 1000;
                    if (time_passed >= videoLength)
                        videoLength = 1;
                    else
                        videoLength = videoLength - time_passed;
                    this.logger.info(`Downloading video event for device ${device.getSerial()} in ${videoLength} seconds...`);
                    this.downloadEvent[device.getSerial()] = setTimeout(async () => {
                        station.startDownload(device, full_path, cipher_id);
                    }, videoLength * 1000);
                }
            }
        }
        catch (error) {
            this.logger.error(`Device: ${device.getSerial()} - Error`, error);
        }
    }
    async handlePushNotification(message) {
        try {
            if (message.device_sn !== undefined) {
                const device = await this.eufy.getDevice(message.device_sn);
                if (!(0, utils_1.isEmpty)(message.pic_url)) {
                    await (0, utils_1.saveImageStates)(this, message.pic_url, device.getStationSerial(), device.getSerial(), types_1.DataLocation.LAST_EVENT, device.getStateID(types_1.CameraStateID.LAST_EVENT_PIC_URL), device.getStateID(types_1.CameraStateID.LAST_EVENT_PIC_HTML), "Last captured picture").catch(() => {
                        this.logger.error(`Device ${device.getSerial()} - saveImageStates(): url ${message.pic_url}`);
                    });
                }
                if ((message.push_count === 1 || message.push_count === undefined) && (message.file_path !== undefined && message.file_path !== "" && message.cipher !== undefined))
                    if (this.config.autoDownloadVideo)
                        await this.downloadEventVideo(device, message.event_time, message.file_path, message.cipher);
            }
        }
        catch (error) {
            if (error instanceof eufy_security_client_1.DeviceNotFoundError) {
                //Do nothing
            }
            else {
                this.logger.error("Handling push notification - Error", error);
            }
        }
    }
    async onConnect() {
        await this.setObjectNotExistsAsync("info", {
            type: "channel",
            common: {
                name: "info"
            },
            native: {},
        });
        await this.setObjectNotExistsAsync("info.connection", {
            type: "state",
            common: {
                name: "Global connection",
                type: "boolean",
                role: "indicator.connection",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setStateAsync("info.connection", { val: true, ack: true });
    }
    async onClose() {
        this.log.warn("ON CLOSE!!!");
        await this.setObjectNotExistsAsync("info", {
            type: "channel",
            common: {
                name: "info"
            },
            native: {},
        });
        await this.setObjectNotExistsAsync("info.connection", {
            type: "state",
            common: {
                name: "Global connection",
                type: "boolean",
                role: "indicator.connection",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setStateAsync("info.connection", { val: false, ack: true });
    }
    getPersistentData() {
        return this.persistentData;
    }
    async onPushConnect() {
        await this.setObjectNotExistsAsync("info", {
            type: "channel",
            common: {
                name: "info"
            },
            native: {},
        });
        await this.setObjectNotExistsAsync("info.push_connection", {
            type: "state",
            common: {
                name: "Push notification connection",
                type: "boolean",
                role: "indicator.connection",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setStateAsync("info.push_connection", { val: true, ack: true });
    }
    async onPushClose() {
        await this.setObjectNotExistsAsync("info", {
            type: "channel",
            common: {
                name: "info"
            },
            native: {},
        });
        await this.setObjectNotExistsAsync("info.push_connection", {
            type: "state",
            common: {
                name: "Push notification connection",
                type: "boolean",
                role: "indicator.connection",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setStateAsync("info.push_connection", { val: false, ack: true });
    }
    async onMQTTConnect() {
        await this.setObjectNotExistsAsync("info", {
            type: "channel",
            common: {
                name: "info"
            },
            native: {},
        });
        await this.setObjectNotExistsAsync("info.mqtt_connection", {
            type: "state",
            common: {
                name: "MQTT connection",
                type: "boolean",
                role: "indicator.connection",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setStateAsync("info.mqtt_connection", { val: true, ack: true });
    }
    async onMQTTClose() {
        await this.setObjectNotExistsAsync("info", {
            type: "channel",
            common: {
                name: "info"
            },
            native: {},
        });
        await this.setObjectNotExistsAsync("info.mqtt_connection", {
            type: "state",
            common: {
                name: "MQTT connection",
                type: "boolean",
                role: "indicator.connection",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setStateAsync("info.mqtt_connection", { val: false, ack: true });
    }
    async onStationCommandResult(station, result) {
        if (result.return_code !== 0 && result.command_type === eufy_security_client_1.CommandType.CMD_START_REALTIME_MEDIA) {
            this.logger.debug(`Station: ${station.getSerial()} command ${eufy_security_client_1.CommandType[result.command_type]} failed with error: ${eufy_security_client_1.ErrorCode[result.return_code]} (${result.return_code}) fallback to RTMP livestream...`);
            try {
                const device = await this.eufy.getStationDevice(station.getSerial(), result.channel);
                if (device.isCamera())
                    this.eufy.startCloudLivestream(device.getSerial());
            }
            catch (error) {
                this.logger.error(`Station: ${station.getSerial()} command ${eufy_security_client_1.CommandType[result.command_type]} RTMP fallback failed - Error ${error}`);
            }
        }
        else if (result.return_code !== 0 && result.command_type !== eufy_security_client_1.CommandType.P2P_QUERY_STATUS_IN_LOCK) {
            this.logger.error(`Station: ${station.getSerial()} command ${eufy_security_client_1.CommandType[result.command_type]} failed with error: ${eufy_security_client_1.ErrorCode[result.return_code]} (${result.return_code})`);
        }
    }
    async onStationPropertyChanged(station, name, value) {
        const states = await this.getStatesAsync(`${station.getStateID("", 1)}.*`);
        for (const state in states) {
            const obj = await this.getObjectAsync(state);
            if (obj) {
                if (obj.native.name !== undefined && obj.native.name === name) {
                    await (0, utils_1.setStateChangedAsync)(this, state, value);
                    return;
                }
            }
        }
        this.logger.debug(`onStationPropertyChanged(): Property "${name}" not implemented in this adapter (station: ${station.getSerial()} value: ${JSON.stringify(value)})`);
    }
    async onDevicePropertyChanged(device, name, value) {
        const states = await this.getStatesAsync(`${device.getStateID("", 1)}.*`);
        for (const state in states) {
            const obj = await this.getObjectAsync(state);
            if (obj) {
                if (obj.native.name !== undefined && obj.native.name === name) {
                    await (0, utils_1.setStateChangedAsync)(this, state, value);
                    switch (name) {
                        case eufy_security_client_1.PropertyName.DeviceRTSPStream:
                            if (value === false) {
                                this.delStateAsync(device.getStateID(types_1.CameraStateID.RTSP_STREAM_URL));
                            }
                            break;
                    }
                    return;
                }
            }
        }
        this.logger.debug(`onDevicePropertyChanged(): Property "${name}" not implemented in this adapter (device: ${device.getSerial()} value: ${JSON.stringify(value)})`);
    }
    async startLivestream(device_sn) {
        try {
            const device = await this.eufy.getDevice(device_sn);
            const station = await this.eufy.getStation(device.getStationSerial());
            if (station.isConnected() || station.isEnergySavingDevice()) {
                if (!station.isLiveStreaming(device)) {
                    this.eufy.startStationLivestream(device_sn);
                }
                else {
                    this.logger.warn(`The stream for the device ${device_sn} cannot be started, because it is already streaming!`);
                }
            }
            else if (device.isCamera()) {
                const camera = device;
                if (!camera.isStreaming()) {
                    this.eufy.startCloudLivestream(device_sn);
                }
                else {
                    this.logger.warn(`The stream for the device ${device_sn} cannot be started, because it is already streaming!`);
                }
            }
        }
        catch (error) {
            this.logger.error("Start livestream - Error", error);
        }
    }
    async stopLivestream(device_sn) {
        try {
            const device = await this.eufy.getDevice(device_sn);
            const station = await this.eufy.getStation(device.getStationSerial());
            if (device.isCamera()) {
                const camera = device;
                if (await this.eufy.isStationConnected(device.getStationSerial()) && station.isLiveStreaming(camera)) {
                    await this.eufy.stopStationLivestream(device_sn);
                }
                else if (camera.isStreaming()) {
                    await this.eufy.stopCloudLivestream(device_sn);
                }
                else {
                    this.logger.warn(`The stream for the device ${device_sn} cannot be stopped, because it isn't streaming!`);
                }
            }
        }
        catch (error) {
            this.logger.error("Stop livestream - Error", error);
        }
    }
    async onCloudLivestreamStart(station, device, url) {
        this.setStateAsync(device.getStateID(types_1.CameraStateID.LIVESTREAM), { val: url, ack: true });
        const file_path = (0, utils_1.getDataFilePath)(this, station.getSerial(), types_1.DataLocation.LIVESTREAM, `${device.getSerial()}${types_1.STREAM_FILE_NAME_EXT}`);
        await (0, utils_1.sleep)(2000);
        const rtmpPromise = (0, video_1.ffmpegRTMPToHls)(this.config, url, file_path, this.logger);
        rtmpPromise.then(async () => {
            if (fs_extra_1.default.pathExistsSync(file_path)) {
                await (0, utils_1.removeFiles)(this, station.getSerial(), types_1.DataLocation.LAST_LIVESTREAM, device.getSerial());
                return true;
            }
            return false;
        })
            .then(async (result) => {
            if (result)
                await (0, utils_1.moveFiles)(this, station.getSerial(), device.getSerial(), types_1.DataLocation.LIVESTREAM, types_1.DataLocation.LAST_LIVESTREAM);
            return result;
        })
            .then(async (result) => {
            if (result) {
                const filename_without_ext = (0, utils_1.getDataFilePath)(this, station.getSerial(), types_1.DataLocation.LAST_LIVESTREAM, device.getSerial());
                if (fs_extra_1.default.pathExistsSync(`${filename_without_ext}${types_1.STREAM_FILE_NAME_EXT}`))
                    await (0, video_1.ffmpegPreviewImage)(this.config, `${filename_without_ext}${types_1.STREAM_FILE_NAME_EXT}`, `${filename_without_ext}${types_1.IMAGE_FILE_JPEG_EXT}`, this.logger, 5.5)
                        .then(() => {
                        this.setStateAsync(device.getStateID(types_1.CameraStateID.LAST_LIVESTREAM_PIC_URL), { val: `/${this.namespace}/${station.getSerial()}/${types_1.DataLocation.LAST_LIVESTREAM}/${device.getSerial()}${types_1.IMAGE_FILE_JPEG_EXT}`, ack: true });
                        try {
                            if (fs_extra_1.default.existsSync(`${filename_without_ext}${types_1.IMAGE_FILE_JPEG_EXT}`)) {
                                this.setStateAsync(device.getStateID(types_1.CameraStateID.LAST_LIVESTREAM_PIC_HTML), { val: (0, utils_1.getImageAsHTML)(fs_extra_1.default.readFileSync(`${filename_without_ext}${types_1.IMAGE_FILE_JPEG_EXT}`)), ack: true });
                            }
                        }
                        catch (error) {
                            this.logger.error(`Station: ${station.getSerial()} device: ${device.getSerial()} - Error`, error);
                        }
                    })
                        .catch((error) => {
                        this.logger.error(`ffmpegPreviewImage - station: ${station.getSerial()} device: ${device.getSerial()} - Error`, error);
                    });
            }
        })
            .catch(async (error) => {
            this.logger.error(`Station: ${station.getSerial()} device: ${device.getSerial()} - Error - Stopping livestream...`, error);
            await this.eufy.stopCloudLivestream(device.getSerial());
        });
        this.rtmpFFmpegPromise.set(device.getSerial(), rtmpPromise);
    }
    onCloudLivestreamStop(station, device) {
        this.logger.debug(`Station: ${station.getSerial()} device: ${device.getSerial()}`);
        this.delStateAsync(device.getStateID(types_1.CameraStateID.LIVESTREAM));
        const rtmpPromise = this.rtmpFFmpegPromise.get(device.getSerial());
        if (rtmpPromise) {
            rtmpPromise.stop();
            this.rtmpFFmpegPromise.delete(device.getSerial());
        }
    }
    async onStationLivestreamStart(station, device, metadata, videostream, audiostream) {
        try {
            const file_path = (0, utils_1.getDataFilePath)(this, station.getSerial(), types_1.DataLocation.LIVESTREAM, `${device.getSerial()}${types_1.STREAM_FILE_NAME_EXT}`);
            await (0, utils_1.removeFiles)(this, station.getSerial(), types_1.DataLocation.LIVESTREAM, device.getSerial()).catch();
            this.setStateAsync(device.getStateID(types_1.CameraStateID.LIVESTREAM), { val: `/${this.namespace}/${station.getSerial()}/${types_1.DataLocation.LIVESTREAM}/${device.getSerial()}${types_1.STREAM_FILE_NAME_EXT}`, ack: true });
            await (0, video_1.ffmpegStreamToHls)(this.config, this.namespace, metadata, videostream, audiostream, file_path, this.logger)
                .then(async () => {
                if (fs_extra_1.default.pathExistsSync(file_path)) {
                    await (0, utils_1.removeFiles)(this, station.getSerial(), types_1.DataLocation.LAST_LIVESTREAM, device.getSerial());
                    return true;
                }
                return false;
            })
                .then(async (result) => {
                if (result)
                    await (0, utils_1.moveFiles)(this, station.getSerial(), device.getSerial(), types_1.DataLocation.LIVESTREAM, types_1.DataLocation.LAST_LIVESTREAM);
                return result;
            })
                .then(async (result) => {
                if (result) {
                    const filename_without_ext = (0, utils_1.getDataFilePath)(this, station.getSerial(), types_1.DataLocation.LAST_LIVESTREAM, device.getSerial());
                    this.setStateAsync(device.getStateID(types_1.CameraStateID.LAST_LIVESTREAM_VIDEO_URL), { val: `/${this.namespace}/${station.getSerial()}/${types_1.DataLocation.LAST_LIVESTREAM}/${device.getSerial()}${types_1.STREAM_FILE_NAME_EXT}`, ack: true });
                    if (fs_extra_1.default.pathExistsSync(`${filename_without_ext}${types_1.STREAM_FILE_NAME_EXT}`))
                        await (0, video_1.ffmpegPreviewImage)(this.config, `${filename_without_ext}${types_1.STREAM_FILE_NAME_EXT}`, `${filename_without_ext}${types_1.IMAGE_FILE_JPEG_EXT}`, this.logger)
                            .then(() => {
                            this.setStateAsync(device.getStateID(types_1.CameraStateID.LAST_LIVESTREAM_PIC_URL), { val: `/${this.namespace}/${station.getSerial()}/${types_1.DataLocation.LAST_LIVESTREAM}/${device.getSerial()}${types_1.IMAGE_FILE_JPEG_EXT}`, ack: true });
                            try {
                                if (fs_extra_1.default.existsSync(`${filename_without_ext}${types_1.IMAGE_FILE_JPEG_EXT}`)) {
                                    this.setStateAsync(device.getStateID(types_1.CameraStateID.LAST_LIVESTREAM_PIC_HTML), { val: (0, utils_1.getImageAsHTML)(fs_extra_1.default.readFileSync(`${filename_without_ext}${types_1.IMAGE_FILE_JPEG_EXT}`)), ack: true });
                                }
                            }
                            catch (error) {
                                this.logger.error(`Station: ${station.getSerial()} device: ${device.getSerial()} - Error`, error);
                            }
                        })
                            .catch((error) => {
                            this.logger.error(`ffmpegPreviewImage - station: ${station.getSerial()} device: ${device.getSerial()} - Error`, error);
                        });
                }
            })
                .catch(async (error) => {
                this.logger.error(`Station: ${station.getSerial()} Device: ${device.getSerial()} - Error - Stopping livestream...`, error);
                await this.eufy.stopStationLivestream(device.getSerial());
            });
        }
        catch (error) {
            this.logger.error(`Station: ${station.getSerial()} Device: ${device.getSerial()} - Error - Stopping livestream...`, error);
            await this.eufy.stopStationLivestream(device.getSerial());
        }
    }
    onStationLivestreamStop(_station, device) {
        this.delStateAsync(device.getStateID(types_1.CameraStateID.LIVESTREAM));
    }
    async onStationDownloadFinish(_station, _device) {
        //this.logger.trace(`Station: ${station.getSerial()} channel: ${channel}`);
    }
    async onStationDownloadStart(station, device, metadata, videostream, audiostream) {
        try {
            await (0, utils_1.removeFiles)(this, station.getSerial(), types_1.DataLocation.TEMP, device.getSerial()).catch();
            const file_path = (0, utils_1.getDataFilePath)(this, station.getSerial(), types_1.DataLocation.TEMP, `${device.getSerial()}${types_1.STREAM_FILE_NAME_EXT}`);
            await (0, video_1.ffmpegStreamToHls)(this.config, this.namespace, metadata, videostream, audiostream, file_path, this.logger)
                .then(async () => {
                if (fs_extra_1.default.pathExistsSync(file_path)) {
                    await (0, utils_1.removeFiles)(this, station.getSerial(), types_1.DataLocation.LAST_EVENT, device.getSerial());
                    return true;
                }
                return false;
            })
                .then(async (result) => {
                if (result)
                    await (0, utils_1.moveFiles)(this, station.getSerial(), device.getSerial(), types_1.DataLocation.TEMP, types_1.DataLocation.LAST_EVENT);
                return result;
            })
                .then(async (result) => {
                if (result) {
                    const filename_without_ext = (0, utils_1.getDataFilePath)(this, station.getSerial(), types_1.DataLocation.LAST_EVENT, device.getSerial());
                    (0, utils_1.setStateAsync)(this, device.getStateID(types_1.CameraStateID.LAST_EVENT_VIDEO_URL), "Last captured video URL", `/${this.namespace}/${station.getSerial()}/${types_1.DataLocation.LAST_EVENT}/${device.getSerial()}${types_1.STREAM_FILE_NAME_EXT}`, "url");
                    if (fs_extra_1.default.pathExistsSync(`${filename_without_ext}${types_1.STREAM_FILE_NAME_EXT}`))
                        await (0, video_1.ffmpegPreviewImage)(this.config, `${filename_without_ext}${types_1.STREAM_FILE_NAME_EXT}`, `${filename_without_ext}${types_1.IMAGE_FILE_JPEG_EXT}`, this.logger)
                            .then(() => {
                            (0, utils_1.setStateAsync)(this, device.getStateID(types_1.CameraStateID.LAST_EVENT_PIC_URL), "Last event picture URL", `/${this.namespace}/${station.getSerial()}/${types_1.DataLocation.LAST_EVENT}/${device.getSerial()}${types_1.IMAGE_FILE_JPEG_EXT}`, "url");
                            try {
                                if (fs_extra_1.default.existsSync(`${filename_without_ext}${types_1.IMAGE_FILE_JPEG_EXT}`)) {
                                    const image_data = (0, utils_1.getImageAsHTML)(fs_extra_1.default.readFileSync(`${filename_without_ext}${types_1.IMAGE_FILE_JPEG_EXT}`));
                                    (0, utils_1.setStateAsync)(this, device.getStateID(types_1.CameraStateID.LAST_EVENT_PIC_HTML), "Last event picture HTML image", image_data, "html");
                                }
                            }
                            catch (error) {
                                this.logger.error(`Station: ${station.getSerial()} device: ${device.getSerial()} - Error`, error);
                            }
                        })
                            .catch((error) => {
                            this.logger.error(`ffmpegPreviewImage - station: ${station.getSerial()} device: ${device.getSerial()} - Error`, error);
                        });
                }
            })
                .catch(async (error) => {
                this.logger.error(`Station: ${station.getSerial()} Device: ${device.getSerial()} - Error - Cancelling download...`, error);
                await this.eufy.cancelStationDownload(device.getSerial());
            });
        }
        catch (error) {
            this.logger.error(`Station: ${station.getSerial()} Device: ${device.getSerial()} - Error - Cancelling download...`, error);
            await this.eufy.cancelStationDownload(device.getSerial());
        }
    }
    onStationRTSPUrl(station, device, value) {
        (0, utils_1.setStateChangedAsync)(this, device.getStateID(types_1.CameraStateID.RTSP_STREAM_URL), value);
    }
    async onStationConnect(station) {
        await this.setObjectNotExistsAsync(station.getStateID(types_1.StationStateID.CONNECTION), {
            type: "state",
            common: {
                name: "Connection",
                type: "boolean",
                role: "indicator.connection",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setStateAsync(station.getStateID(types_1.StationStateID.CONNECTION), { val: true, ack: true });
    }
    async onStationClose(station) {
        await this.setObjectNotExistsAsync(station.getStateID(types_1.StationStateID.CONNECTION), {
            type: "state",
            common: {
                name: "Connection",
                type: "boolean",
                role: "indicator.connection",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setStateAsync(station.getStateID(types_1.StationStateID.CONNECTION), { val: false, ack: true });
    }
    onTFARequest() {
        this.logger.warn(`Two factor authentication request received, please enter valid verification code in state ${this.namespace}.verify_code`);
        this.verify_code = true;
    }
    onCaptchaRequest(captchaId, captcha) {
        this.captchaId = captchaId;
        this.logger.warn(`Captcha authentication request received, please enter valid captcha in state ${this.namespace}.captcha`);
        this.logger.warn(`Captcha: <img src="${captcha}">`);
        this.setStateAsync("received_captcha_html", { val: `<img src="${captcha}">`, ack: true });
    }
}
exports.euSec = euSec;
if (module.parent) {
    // Export the constructor in compact mode
    module.exports = (options) => new euSec(options);
}
else {
    // otherwise start the instance directly
    (() => new euSec())();
}
//# sourceMappingURL=main.js.map