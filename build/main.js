"use strict";
/*
 * Created with @iobroker/create-adapter v1.28.0
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
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
const utils = __importStar(require("@iobroker/adapter-core"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const EufySecurityAPI = __importStar(require("./lib/eufy-security/eufy-security"));
const types_1 = require("./lib/eufy-security/http/types");
const utils_1 = require("./lib/eufy-security/utils");
const types_2 = require("./lib/eufy-security/push/types");
const types_3 = require("./lib/eufy-security/p2p/types");
const device_1 = require("./lib/eufy-security/http/device");
class EufySecurity extends utils.Adapter {
    constructor(options = {}) {
        super(Object.assign(Object.assign({}, options), { name: "eufy-security" }));
        this.personDetected = {};
        this.motionDetected = {};
        this.ringing = {};
        this.cryingDetected = {};
        this.soundDetected = {};
        this.petDetected = {};
        this.persistentData = {
            api_base: "",
            cloud_token: "",
            cloud_token_expiration: 0,
            openudid: "",
            serial_number: "",
            push_credentials: undefined,
            push_persistentIds: [],
            login_hash: ""
        };
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        // this.on("objectChange", this.onObjectChange.bind(this));
        // this.on("message", this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));
        const data_dir = utils.getAbsoluteInstanceDataDir(this);
        this.persistentFile = data_dir + path.sep + "persistent.json";
        if (!fs.existsSync(data_dir))
            fs.mkdirSync(data_dir);
    }
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    onReady() {
        return __awaiter(this, void 0, void 0, function* () {
            this.getForeignObject("system.config", (err, obj) => {
                if (!this.supportsFeature || !this.supportsFeature("ADAPTER_AUTO_DECRYPT_NATIVE")) {
                    if (obj && obj.native && obj.native.secret) {
                        //noinspection JSUnresolvedVariable
                        this.config.password = utils_1.decrypt(obj.native.secret, this.config.password);
                    }
                    else {
                        //noinspection JSUnresolvedVariable
                        this.config.password = utils_1.decrypt("yx6eWMwGK2AE4k1Yoxt3E5pT", this.config.password);
                    }
                }
            });
            yield this.setObjectNotExistsAsync("verify_code", {
                type: "state",
                common: {
                    name: "2FA verification code",
                    type: "number",
                    role: "state",
                    read: true,
                    write: true,
                },
                native: {},
            });
            yield this.setObjectNotExistsAsync("info", {
                type: "channel",
                common: {
                    name: "info"
                },
                native: {},
            });
            yield this.setObjectNotExistsAsync("info.connection", {
                type: "state",
                common: {
                    name: "Cloud connection",
                    type: "boolean",
                    role: "indicator.connection",
                    read: true,
                    write: false,
                },
                native: {},
            });
            yield this.setStateAsync("info.connection", { val: false, ack: true });
            yield this.setObjectNotExistsAsync("info.push_connection", {
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
            // Remove old states of previous adapter versions
            try {
                const schedule_modes = yield this.getStatesAsync("*.schedule_mode");
                Object.keys(schedule_modes).forEach((id) => __awaiter(this, void 0, void 0, function* () {
                    yield this.delObjectAsync(id);
                }));
            }
            catch (error) {
            }
            try {
                const push_notifications = yield this.getStatesAsync("push_notification.*");
                Object.keys(push_notifications).forEach((id) => __awaiter(this, void 0, void 0, function* () {
                    yield this.delObjectAsync(id);
                }));
                yield this.delObjectAsync("push_notification");
            }
            catch (error) {
            }
            try {
                const last_camera_url = yield this.getStatesAsync("*.last_camera_url");
                Object.keys(last_camera_url).forEach((id) => __awaiter(this, void 0, void 0, function* () {
                    yield this.delObjectAsync(id);
                }));
            }
            catch (error) {
            }
            try {
                const captured_pic_url = yield this.getStatesAsync("*.captured_pic_url");
                Object.keys(captured_pic_url).forEach((id) => __awaiter(this, void 0, void 0, function* () {
                    yield this.delObjectAsync(id);
                }));
            }
            catch (error) {
            }
            try {
                const person_identified = yield this.getStatesAsync("*.person_identified");
                Object.keys(person_identified).forEach((id) => __awaiter(this, void 0, void 0, function* () {
                    yield this.delObjectAsync(id);
                }));
            }
            catch (error) {
            }
            // End
            // Reset event states if necessary (for example because of an unclean exit)
            yield this.initializeEvents(types_1.CameraStateID.PERSON_DETECTED);
            yield this.initializeEvents(types_1.CameraStateID.MOTION_DETECTED);
            yield this.initializeEvents(types_1.DoorbellStateID.RINGING);
            yield this.initializeEvents(types_1.IndoorCameraStateID.CRYING_DETECTED);
            yield this.initializeEvents(types_1.IndoorCameraStateID.SOUND_DETECTED);
            yield this.initializeEvents(types_1.IndoorCameraStateID.PET_DETECTED);
            try {
                if (fs.statSync(this.persistentFile).isFile()) {
                    const fileContent = fs.readFileSync(this.persistentFile, "utf8");
                    this.persistentData = JSON.parse(fileContent);
                }
            }
            catch (err) {
                this.log.debug("No stored data from last exit found.");
            }
            //TODO: Temporary Test to be removed!
            /*await this.setObjectNotExistsAsync("test_button", {
                type: "state",
                common: {
                    name: "Test button",
                    type: "boolean",
                    role: "button",
                    read: false,
                    write: true,
                },
                native: {},
            });
            this.subscribeStates("test_button");*/
            // END
            this.subscribeStates("verify_code");
            this.eufy = new EufySecurityAPI.EufySecurity(this);
            this.eufy.on("stations", (stations) => this.handleStations(stations));
            this.eufy.on("devices", (devices) => this.handleDevices(devices));
            this.eufy.on("push_notifications", (messages) => this.handlePushNotifications(messages));
            this.eufy.on("connected", () => this.onConnect());
            this.eufy.on("not_connected", () => this.onNotConnected());
            const api = this.eufy.getApi();
            if (this.persistentData.api_base && this.persistentData.api_base != "") {
                this.log.debug(`onReady(): Load previous api_base: ${this.persistentData.api_base}`);
                api.setAPIBase(this.persistentData.api_base);
            }
            if (this.persistentData.login_hash && this.persistentData.login_hash != "") {
                this.log.debug(`onReady(): Load previous login_hash: ${this.persistentData.login_hash}`);
                if (utils_1.md5(`${this.config.username}:${this.config.password}`) != this.persistentData.login_hash) {
                    this.log.info(`Authentication properties changed, invalidate saved cloud token.`);
                    this.persistentData.cloud_token = "";
                    this.persistentData.cloud_token_expiration = 0;
                }
            }
            else {
                this.persistentData.cloud_token = "";
                this.persistentData.cloud_token_expiration = 0;
            }
            if (this.persistentData.cloud_token && this.persistentData.cloud_token != "") {
                this.log.debug(`onReady(): Load previous token: ${this.persistentData.cloud_token} token_expiration: ${this.persistentData.cloud_token_expiration}`);
                api.setToken(this.persistentData.cloud_token);
                api.setTokenExpiration(new Date(this.persistentData.cloud_token_expiration));
            }
            if (!this.persistentData.openudid || this.persistentData.openudid == "") {
                this.persistentData.openudid = utils_1.generateUDID();
                this.log.debug(`onReady(): Generated new openudid: ${this.persistentData.openudid}`);
            }
            api.setOpenUDID(this.persistentData.openudid);
            if (!this.persistentData.serial_number || this.persistentData.serial_number == "") {
                this.persistentData.serial_number = utils_1.generateSerialnumber(12);
                this.log.debug(`onReady(): Generated new serial_number: ${this.persistentData.serial_number}`);
            }
            api.setSerialNumber(this.persistentData.serial_number);
            yield this.eufy.logon();
        });
    }
    writePersistentData() {
        this.persistentData.login_hash = utils_1.md5(`${this.config.username}:${this.config.password}`);
        fs.writeFileSync(this.persistentFile, JSON.stringify(this.persistentData));
    }
    refreshData(adapter) {
        return __awaiter(this, void 0, void 0, function* () {
            adapter.log.silly(`refreshData(): pollingInterval: ${adapter.config.pollingInterval}`);
            if (adapter.eufy) {
                adapter.log.info("Refresh data from cloud and schedule next refresh.");
                yield adapter.eufy.refreshData();
                adapter.refreshTimeout = setTimeout(() => { this.refreshData(adapter); }, adapter.config.pollingInterval * 60 * 1000);
            }
        });
    }
    initializeEvents(state) {
        return __awaiter(this, void 0, void 0, function* () {
            const states = yield this.getStatesAsync(`*.${state}`);
            for (const id of Object.keys(states)) {
                const state = states[id];
                if (state.val === true) {
                    yield this.setStateAsync(id, { val: false, ack: true });
                }
            }
        });
    }
    clearEvents(events, state) {
        return __awaiter(this, void 0, void 0, function* () {
            for (const serialnr of Object.keys(events)) {
                clearTimeout(events[serialnr]);
                const states = yield this.getStatesAsync(`*.${serialnr}.${state}`);
                for (const id of Object.keys(states)) {
                    yield this.setStateAsync(id, { val: false, ack: true });
                }
            }
        });
    }
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    onUnload(callback) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (this.eufy)
                    this.setPushPersistentIds(this.eufy.getPushPersistentIds());
                this.writePersistentData();
                if (this.refreshTimeout)
                    clearTimeout(this.refreshTimeout);
                yield this.clearEvents(this.personDetected, types_1.CameraStateID.PERSON_DETECTED);
                yield this.clearEvents(this.motionDetected, types_1.CameraStateID.MOTION_DETECTED);
                yield this.clearEvents(this.ringing, types_1.DoorbellStateID.RINGING);
                yield this.clearEvents(this.cryingDetected, types_1.IndoorCameraStateID.CRYING_DETECTED);
                yield this.clearEvents(this.soundDetected, types_1.IndoorCameraStateID.SOUND_DETECTED);
                yield this.clearEvents(this.petDetected, types_1.IndoorCameraStateID.PET_DETECTED);
                if (this.eufy)
                    this.eufy.close();
                callback();
            }
            catch (e) {
                callback();
            }
        });
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
    onStateChange(id, state) {
        return __awaiter(this, void 0, void 0, function* () {
            if (state) {
                // The state was changed
                this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
                // don't do anything if the state is acked
                if (!id || state.ack) {
                    return;
                }
                const values = id.split(".");
                const station_sn = values[2];
                const device_type = values[3];
                if (station_sn == "verify_code") {
                    if (this.eufy) {
                        this.log.info(`Verification code received, send it. (verify_code: ${state.val})`);
                        this.eufy.logon(state.val);
                        yield this.delStateAsync(id);
                    }
                    /*} else if (station_sn == "test_button") {
                        //TODO: Test to remove!
                        this.log.debug("TEST button pressed");
                        if (this.eufy) {
                            //await this.eufy.getApi().sendVerifyCode(VerfyCodeTypes.TYPE_PUSH);
                            //await this.eufy.getStation("T8010P23201721F8").getCameraInfo();
                            //await this.eufy.getStation("T8010P23201721F8").setGuardMode(2);
                            //await this.eufy.getStation("T8010P23201721F8").getStorageInfo();
                        }*/
                }
                else if (device_type == "cameras") {
                    const device_sn = values[4];
                    const device_state_name = values[5];
                    if (this.eufy) {
                        switch (device_state_name) {
                            case types_1.CameraStateID.START_STREAM:
                                yield this.setStateAsync(`${station_sn}.${device_type}.${device_sn}.${types_1.CameraStateID.LIVESTREAM}`, { val: yield this.eufy.startCameraStream(device_sn), ack: true });
                                break;
                            case types_1.CameraStateID.STOP_STREAM:
                                yield this.eufy.stopCameraStream(device_sn);
                                break;
                        }
                    }
                }
                else if (device_type == "station") {
                    const station_state_name = values[4];
                    if (this.eufy) {
                        switch (station_state_name) {
                            case types_1.StationStateID.GUARD_MODE:
                                yield this.eufy.getStation(station_sn).setGuardMode(state.val);
                                //await this.setStateAsync(`${station_sn}.${device_type}.${station_state_name}`, {...state, ack: true });
                                break;
                        }
                    }
                }
            }
            else {
                // The state was deleted
                this.log.info(`state ${id} deleted`);
            }
        });
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
    handleDevices(devices) {
        return __awaiter(this, void 0, void 0, function* () {
            this.log.debug(`handleDevices(): count: ${Object.keys(devices).length}`);
            Object.values(devices).forEach((device) => __awaiter(this, void 0, void 0, function* () {
                yield this.setObjectNotExistsAsync(device.getStateID("", 0), {
                    type: "channel",
                    common: {
                        name: device.getStateChannel()
                    },
                    native: {},
                });
                yield this.setObjectNotExistsAsync(device.getStateID("", 1), {
                    type: "device",
                    common: {
                        name: device.getName()
                    },
                    native: {},
                });
                // Name
                yield this.setObjectNotExistsAsync(device.getStateID(types_1.DeviceStateID.NAME), {
                    type: "state",
                    common: {
                        name: "Name",
                        type: "string",
                        role: "text",
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                yield utils_1.setStateChangedAsync(this, device.getStateID(types_1.DeviceStateID.NAME), device.getName());
                // Model
                yield this.setObjectNotExistsAsync(device.getStateID(types_1.DeviceStateID.MODEL), {
                    type: "state",
                    common: {
                        name: "Model",
                        type: "string",
                        role: "text",
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                yield utils_1.setStateChangedAsync(this, device.getStateID(types_1.DeviceStateID.MODEL), device.getModel());
                // Serial
                yield this.setObjectNotExistsAsync(device.getStateID(types_1.DeviceStateID.SERIAL_NUMBER), {
                    type: "state",
                    common: {
                        name: "Serial number",
                        type: "string",
                        role: "text",
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                yield utils_1.setStateChangedAsync(this, device.getStateID(types_1.DeviceStateID.SERIAL_NUMBER), device.getSerial());
                // Software version
                yield this.setObjectNotExistsAsync(device.getStateID(types_1.DeviceStateID.SOFTWARE_VERSION), {
                    type: "state",
                    common: {
                        name: "Software version",
                        type: "string",
                        role: "text",
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                yield utils_1.setStateChangedAsync(this, device.getStateID(types_1.DeviceStateID.SOFTWARE_VERSION), device.getSoftwareVersion());
                // Hardware version
                yield this.setObjectNotExistsAsync(device.getStateID(types_1.DeviceStateID.HARDWARE_VERSION), {
                    type: "state",
                    common: {
                        name: "Hardware version",
                        type: "string",
                        role: "text",
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                yield utils_1.setStateChangedAsync(this, device.getStateID(types_1.DeviceStateID.HARDWARE_VERSION), device.getHardwareVersion());
                if (device.isCamera()) {
                    const camera = device;
                    // State
                    yield this.setObjectNotExistsAsync(camera.getStateID(types_1.CameraStateID.STATE), {
                        type: "state",
                        common: {
                            name: "State",
                            type: "number",
                            role: "state",
                            read: true,
                            write: false,
                            states: {
                                0: "OFFLINE",
                                1: "ONLINE",
                                2: "MANUALLY_DISABLED",
                                3: "OFFLINE_LOWBAT",
                                4: "REMOVE_AND_READD",
                                5: "RESET_AND_READD"
                            }
                        },
                        native: {},
                    });
                    yield utils_1.setStateChangedAsync(this, camera.getStateID(types_1.CameraStateID.STATE), camera.getState());
                    // Mac address
                    yield this.setObjectNotExistsAsync(camera.getStateID(types_1.CameraStateID.MAC_ADDRESS), {
                        type: "state",
                        common: {
                            name: "MAC Address",
                            type: "string",
                            role: "text",
                            read: true,
                            write: false,
                        },
                        native: {},
                    });
                    yield utils_1.setStateChangedAsync(this, camera.getStateID(types_1.CameraStateID.MAC_ADDRESS), camera.getMACAddress());
                    // Last event picture
                    yield utils_1.saveImageStates(this, camera.getLastCameraImageURL(), camera.getSerial(), camera.getStateID(types_1.CameraStateID.LAST_EVENT_PICTURE_URL), camera.getStateID(types_1.CameraStateID.LAST_EVENT_PICTURE_HTML), "Last event picture");
                    // Start Stream
                    yield this.setObjectNotExistsAsync(camera.getStateID(types_1.CameraStateID.START_STREAM), {
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
                    yield this.setObjectNotExistsAsync(camera.getStateID(types_1.CameraStateID.STOP_STREAM), {
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
                    yield this.setObjectNotExistsAsync(camera.getStateID(types_1.CameraStateID.LIVESTREAM), {
                        type: "state",
                        common: {
                            name: "Livestream URL",
                            type: "string",
                            role: "text.url",
                            read: true,
                            write: false,
                        },
                        native: {},
                    });
                    // Battery
                    if (camera.hasBattery()) {
                        yield this.setObjectNotExistsAsync(camera.getStateID(types_1.CameraStateID.BATTERY), {
                            type: "state",
                            common: {
                                name: "Battery",
                                type: "number",
                                role: "value",
                                unit: "%",
                                min: 0,
                                max: 100,
                                read: true,
                                write: false,
                            },
                            native: {},
                        });
                        yield utils_1.setStateChangedAsync(this, camera.getStateID(types_1.CameraStateID.BATTERY), camera.getBatteryValue());
                        yield this.setObjectNotExistsAsync(camera.getStateID(types_1.CameraStateID.BATTERY_TEMPERATURE), {
                            type: "state",
                            common: {
                                name: "Battery temperature",
                                type: "number",
                                role: "value",
                                unit: "°C",
                                read: true,
                                write: false,
                            },
                            native: {},
                        });
                        yield utils_1.setStateChangedAsync(this, camera.getStateID(types_1.CameraStateID.BATTERY_TEMPERATURE), camera.getBatteryTemperature());
                        // Last Charge Used Days
                        yield this.setObjectNotExistsAsync(camera.getStateID(types_1.CameraStateID.LAST_CHARGE_USED_DAYS), {
                            type: "state",
                            common: {
                                name: "Used days since last charge",
                                type: "number",
                                role: "value",
                                read: true,
                                write: false,
                            },
                            native: {},
                        });
                        yield utils_1.setStateChangedAsync(this, camera.getStateID(types_1.CameraStateID.LAST_CHARGE_USED_DAYS), camera.getLastChargingDays());
                        // Last Charge Total Events
                        yield this.setObjectNotExistsAsync(camera.getStateID(types_1.CameraStateID.LAST_CHARGE_TOTAL_EVENTS), {
                            type: "state",
                            common: {
                                name: "Total events since last charge",
                                type: "number",
                                role: "value",
                                read: true,
                                write: false,
                            },
                            native: {},
                        });
                        yield utils_1.setStateChangedAsync(this, camera.getStateID(types_1.CameraStateID.LAST_CHARGE_TOTAL_EVENTS), camera.getLastChargingTotalEvents());
                        // Last Charge Saved Events
                        yield this.setObjectNotExistsAsync(camera.getStateID(types_1.CameraStateID.LAST_CHARGE_SAVED_EVENTS), {
                            type: "state",
                            common: {
                                name: "Saved/Recorded events since last charge",
                                type: "number",
                                role: "value",
                                read: true,
                                write: false,
                            },
                            native: {},
                        });
                        yield utils_1.setStateChangedAsync(this, camera.getStateID(types_1.CameraStateID.LAST_CHARGE_SAVED_EVENTS), camera.getLastChargingRecordedEvents());
                        // Last Charge Filtered Events
                        yield this.setObjectNotExistsAsync(camera.getStateID(types_1.CameraStateID.LAST_CHARGE_FILTERED_EVENTS), {
                            type: "state",
                            common: {
                                name: "Filtered false events since last charge",
                                type: "number",
                                role: "value",
                                read: true,
                                write: false,
                            },
                            native: {},
                        });
                        yield utils_1.setStateChangedAsync(this, camera.getStateID(types_1.CameraStateID.LAST_CHARGE_FILTERED_EVENTS), camera.getLastChargingFalseEvents());
                    }
                    // Wifi RSSI
                    yield this.setObjectNotExistsAsync(camera.getStateID(types_1.CameraStateID.WIFI_RSSI), {
                        type: "state",
                        common: {
                            name: "Wifi RSSI",
                            type: "number",
                            role: "value",
                            read: true,
                            write: false,
                        },
                        native: {},
                    });
                    yield utils_1.setStateChangedAsync(this, camera.getStateID(types_1.CameraStateID.WIFI_RSSI), camera.getWifiRssi());
                    // Motion detected
                    yield this.setObjectNotExistsAsync(camera.getStateID(types_1.CameraStateID.MOTION_DETECTED), {
                        type: "state",
                        common: {
                            name: "Motion detected",
                            type: "boolean",
                            role: "state",
                            read: true,
                            write: false,
                            def: false
                        },
                        native: {},
                    });
                    // Person detected
                    yield this.setObjectNotExistsAsync(camera.getStateID(types_1.CameraStateID.PERSON_DETECTED), {
                        type: "state",
                        common: {
                            name: "Person detected",
                            type: "boolean",
                            role: "state",
                            read: true,
                            write: false,
                            def: false
                        },
                        native: {},
                    });
                    // Person identified
                    yield this.setObjectNotExistsAsync(camera.getStateID(types_1.CameraStateID.LAST_PERSON_IDENTIFIED), {
                        type: "state",
                        common: {
                            name: "Last person identified",
                            type: "string",
                            role: "state",
                            read: true,
                            write: false,
                            def: ""
                        },
                        native: {},
                    });
                    // Captured picture url (movement detected, person detected, human detected)
                    yield this.setObjectNotExistsAsync(camera.getStateID(types_1.CameraStateID.LAST_CAPTURED_PIC_URL), {
                        type: "state",
                        common: {
                            name: "Last captured picture URL",
                            type: "string",
                            role: "state",
                            read: true,
                            write: false,
                            def: ""
                        },
                        native: {},
                    });
                    // Captured picture html (movement detected, person detected, human detected)
                    yield this.setObjectNotExistsAsync(camera.getStateID(types_1.CameraStateID.LAST_CAPTURED_PIC_HTML), {
                        type: "state",
                        common: {
                            name: "Last captured picture HTML image",
                            type: "string",
                            role: "state",
                            read: true,
                            write: false,
                            def: ""
                        },
                        native: {},
                    });
                    if (camera.isDoorbell()) {
                        // Ring event
                        yield this.setObjectNotExistsAsync(camera.getStateID(types_1.DoorbellStateID.RINGING), {
                            type: "state",
                            common: {
                                name: "Ringing",
                                type: "boolean",
                                role: "state",
                                read: true,
                                write: false,
                                def: false
                            },
                            native: {},
                        });
                    }
                    else if (camera.isIndoorCamera()) {
                        // Crying detected event
                        yield this.setObjectNotExistsAsync(camera.getStateID(types_1.IndoorCameraStateID.CRYING_DETECTED), {
                            type: "state",
                            common: {
                                name: "Crying detected",
                                type: "boolean",
                                role: "state",
                                read: true,
                                write: false,
                                def: false
                            },
                            native: {},
                        });
                        // Sound detected event
                        yield this.setObjectNotExistsAsync(camera.getStateID(types_1.IndoorCameraStateID.SOUND_DETECTED), {
                            type: "state",
                            common: {
                                name: "Sound detected",
                                type: "boolean",
                                role: "state",
                                read: true,
                                write: false,
                                def: false
                            },
                            native: {},
                        });
                        // Pet detected event
                        yield this.setObjectNotExistsAsync(camera.getStateID(types_1.IndoorCameraStateID.PET_DETECTED), {
                            type: "state",
                            common: {
                                name: "Pet detected",
                                type: "boolean",
                                role: "state",
                                read: true,
                                write: false,
                                def: false
                            },
                            native: {},
                        });
                    }
                }
                else if (device.isEntrySensor()) {
                    const sensor = device;
                    // State
                    yield this.setObjectNotExistsAsync(sensor.getStateID(types_1.EntrySensorStateID.STATE), {
                        type: "state",
                        common: {
                            name: "State",
                            type: "number",
                            role: "state",
                            read: true,
                            write: false,
                            states: {
                                0: "OFFLINE",
                                1: "ONLINE",
                                2: "MANUALLY_DISABLED",
                                3: "OFFLINE_LOWBAT",
                                4: "REMOVE_AND_READD",
                                5: "RESET_AND_READD"
                            }
                        },
                        native: {},
                    });
                    yield utils_1.setStateChangedAsync(this, sensor.getStateID(types_1.EntrySensorStateID.STATE), sensor.getState());
                    // Sensor Open
                    yield this.setObjectNotExistsAsync(sensor.getStateID(types_1.EntrySensorStateID.SENSOR_OPEN), {
                        type: "state",
                        common: {
                            name: "Sensor open",
                            type: "boolean",
                            role: "state",
                            read: true,
                            write: false,
                        },
                        native: {},
                    });
                    yield utils_1.setStateChangedAsync(this, sensor.getStateID(types_1.EntrySensorStateID.SENSOR_OPEN), sensor.isSensorOpen());
                    // Low Battery
                    yield this.setObjectNotExistsAsync(sensor.getStateID(types_1.EntrySensorStateID.LOW_BATTERY), {
                        type: "state",
                        common: {
                            name: "Low Battery",
                            type: "boolean",
                            role: "state",
                            read: true,
                            write: false,
                        },
                        native: {},
                    });
                    yield utils_1.setStateChangedAsync(this, sensor.getStateID(types_1.EntrySensorStateID.LOW_BATTERY), sensor.isBatteryLow());
                    // Sensor change time
                    yield this.setObjectNotExistsAsync(sensor.getStateID(types_1.EntrySensorStateID.SENSOR_CHANGE_TIME), {
                        type: "state",
                        common: {
                            name: "Sensor change time",
                            type: "string",
                            role: "state",
                            read: true,
                            write: false,
                        },
                        native: {},
                    });
                    yield utils_1.setStateChangedAsync(this, sensor.getStateID(types_1.EntrySensorStateID.SENSOR_CHANGE_TIME), sensor.getSensorChangeTime());
                }
                else if (device.isMotionSensor()) {
                    const sensor = device;
                    // State
                    yield this.setObjectNotExistsAsync(sensor.getStateID(types_1.MotionSensorStateID.STATE), {
                        type: "state",
                        common: {
                            name: "State",
                            type: "number",
                            role: "state",
                            read: true,
                            write: false,
                            states: {
                                0: "OFFLINE",
                                1: "ONLINE",
                                2: "MANUALLY_DISABLED",
                                3: "OFFLINE_LOWBAT",
                                4: "REMOVE_AND_READD",
                                5: "RESET_AND_READD"
                            }
                        },
                        native: {},
                    });
                    yield utils_1.setStateChangedAsync(this, sensor.getStateID(types_1.MotionSensorStateID.STATE), sensor.getState());
                    // Low Battery
                    yield this.setObjectNotExistsAsync(sensor.getStateID(types_1.MotionSensorStateID.LOW_BATTERY), {
                        type: "state",
                        common: {
                            name: "Low Battery",
                            type: "boolean",
                            role: "state",
                            read: true,
                            write: false,
                        },
                        native: {},
                    });
                    yield utils_1.setStateChangedAsync(this, sensor.getStateID(types_1.MotionSensorStateID.LOW_BATTERY), sensor.isBatteryLow());
                    // Motion detected
                    yield this.setObjectNotExistsAsync(sensor.getStateID(types_1.MotionSensorStateID.MOTION_DETECTED), {
                        type: "state",
                        common: {
                            name: "Motion detected",
                            type: "boolean",
                            role: "state",
                            read: true,
                            write: false,
                            def: false
                        },
                        native: {},
                    });
                }
                else if (device.isKeyPad()) {
                    const keypad = device;
                    // State
                    yield this.setObjectNotExistsAsync(keypad.getStateID(types_1.KeyPadStateID.STATE), {
                        type: "state",
                        common: {
                            name: "State",
                            type: "number",
                            role: "state",
                            read: true,
                            write: false,
                            states: {
                                0: "OFFLINE",
                                1: "ONLINE",
                                2: "MANUALLY_DISABLED",
                                3: "OFFLINE_LOWBAT",
                                4: "REMOVE_AND_READD",
                                5: "RESET_AND_READD"
                            }
                        },
                        native: {},
                    });
                    yield utils_1.setStateChangedAsync(this, keypad.getStateID(types_1.KeyPadStateID.STATE), keypad.getState());
                    // Low Battery
                    yield this.setObjectNotExistsAsync(keypad.getStateID(types_1.KeyPadStateID.LOW_BATTERY), {
                        type: "state",
                        common: {
                            name: "Low Battery",
                            type: "boolean",
                            role: "state",
                            read: true,
                            write: false,
                        },
                        native: {},
                    });
                    yield utils_1.setStateChangedAsync(this, keypad.getStateID(types_1.KeyPadStateID.LOW_BATTERY), keypad.isBatteryLow());
                }
            }));
        });
    }
    handleStations(stations) {
        return __awaiter(this, void 0, void 0, function* () {
            this.log.debug(`handleStations(): count: ${Object.keys(stations).length}`);
            Object.values(stations).forEach((station) => __awaiter(this, void 0, void 0, function* () {
                this.subscribeStates(`${station.getStateID("", 0)}.*`);
                yield this.setObjectNotExistsAsync(station.getStateID("", 0), {
                    type: "device",
                    common: {
                        name: station.getName()
                    },
                    native: {},
                });
                yield this.setObjectNotExistsAsync(station.getStateID("", 1), {
                    type: "channel",
                    common: {
                        name: station.getStateChannel()
                    },
                    native: {},
                });
                // Station info
                // Name
                yield this.setObjectNotExistsAsync(station.getStateID(types_1.StationStateID.NAME), {
                    type: "state",
                    common: {
                        name: "Name",
                        type: "string",
                        role: "text",
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                yield utils_1.setStateChangedAsync(this, station.getStateID(types_1.StationStateID.NAME), station.getName());
                // Model
                yield this.setObjectNotExistsAsync(station.getStateID(types_1.StationStateID.MODEL), {
                    type: "state",
                    common: {
                        name: "Model",
                        type: "string",
                        role: "text",
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                yield utils_1.setStateChangedAsync(this, station.getStateID(types_1.StationStateID.MODEL), station.getModel());
                // Serial
                yield this.setObjectNotExistsAsync(station.getStateID(types_1.StationStateID.SERIAL_NUMBER), {
                    type: "state",
                    common: {
                        name: "Serial number",
                        type: "string",
                        role: "text",
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                yield utils_1.setStateChangedAsync(this, station.getStateID(types_1.StationStateID.SERIAL_NUMBER), station.getSerial());
                // Software version
                yield this.setObjectNotExistsAsync(station.getStateID(types_1.StationStateID.SOFTWARE_VERSION), {
                    type: "state",
                    common: {
                        name: "Software version",
                        type: "string",
                        role: "text",
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                yield utils_1.setStateChangedAsync(this, station.getStateID(types_1.StationStateID.SOFTWARE_VERSION), station.getSoftwareVersion());
                // Hardware version
                yield this.setObjectNotExistsAsync(station.getStateID(types_1.StationStateID.HARDWARE_VERSION), {
                    type: "state",
                    common: {
                        name: "Hardware version",
                        type: "string",
                        role: "text",
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                yield utils_1.setStateChangedAsync(this, station.getStateID(types_1.StationStateID.HARDWARE_VERSION), station.getHardwareVersion());
                // IP Address
                yield this.setObjectNotExistsAsync(station.getStateID(types_1.StationStateID.LAN_IP_ADDRESS), {
                    type: "state",
                    common: {
                        name: "IP Address",
                        type: "string",
                        role: "text",
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                yield utils_1.setStateChangedAsync(this, station.getStateID(types_1.StationStateID.LAN_IP_ADDRESS), station.getIPAddress());
                // MAC Address
                yield this.setObjectNotExistsAsync(station.getStateID(types_1.StationStateID.MAC_ADDRESS), {
                    type: "state",
                    common: {
                        name: "MAC Address",
                        type: "string",
                        role: "text",
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                yield utils_1.setStateChangedAsync(this, station.getStateID(types_1.StationStateID.MAC_ADDRESS), station.getMACAddress());
                // LAN IP Address
                yield this.setObjectNotExistsAsync(station.getStateID(types_1.StationStateID.LAN_IP_ADDRESS), {
                    type: "state",
                    common: {
                        name: "LAN IP Address",
                        type: "string",
                        role: "text",
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                yield utils_1.setStateChangedAsync(this, station.getStateID(types_1.StationStateID.LAN_IP_ADDRESS), station.getParameter(types_3.CommandType.CMD_GET_HUB_LAN_IP));
                // Station Paramters
                // Guard Mode
                yield this.setObjectNotExistsAsync(station.getStateID(types_1.StationStateID.GUARD_MODE), {
                    type: "state",
                    common: {
                        name: "Guard Mode",
                        type: "number",
                        role: "state",
                        read: true,
                        write: true,
                        states: {
                            0: "AWAY",
                            1: "HOME",
                            2: "SCHEDULE",
                            3: "CUSTOM1",
                            4: "CUSTOM2",
                            5: "CUSTOM3",
                            47: "GEO",
                            63: "DISARMED"
                        }
                    },
                    native: {},
                });
                try {
                    yield utils_1.setStateChangedAsync(this, station.getStateID(types_1.StationStateID.GUARD_MODE), Number.parseInt(station.getParameter(types_1.ParamType.GUARD_MODE)));
                }
                catch (error) {
                    this.log.error(`handleStations(): GUARD_MODE - Error: ${error}`);
                }
                // Current Alarm Mode
                yield this.setObjectNotExistsAsync(station.getStateID(types_1.StationStateID.CURRENT_MODE), {
                    type: "state",
                    common: {
                        name: "Current Mode",
                        type: "number",
                        role: "state",
                        read: true,
                        write: false,
                        states: {
                            0: "AWAY",
                            1: "HOME",
                            63: "DISARMED"
                        }
                    },
                    native: {},
                });
                //APP_CMD_GET_ALARM_MODE = 1151
                try {
                    yield utils_1.setStateChangedAsync(this, station.getStateID(types_1.StationStateID.CURRENT_MODE), Number.parseInt(station.getParameter(types_1.ParamType.SCHEDULE_MODE)));
                }
                catch (error) {
                    this.log.error(`handleStations(): CURRENT_MODE - Error: ${error}`);
                }
            }));
        });
    }
    handlePushNotifications(push_msg) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.log.debug(`handlePushNotifications(): push_msg: ${JSON.stringify(push_msg)}`);
                let type = -1; //Unknown
                if (push_msg.payload.doorbell) {
                    type = 5;
                }
                else if (push_msg.payload.type) {
                    type = push_msg.payload.type;
                }
                if (type) {
                    if (type == types_2.ServerPushEvent.VERIFICATION) {
                        this.log.debug(`handlePushNotifications(): Received push verification event: ${JSON.stringify(push_msg.payload)}`);
                    }
                    else if (device_1.Device.isDoorbell(type)) {
                        let push_data;
                        let device;
                        if (push_msg.payload.doorbell) {
                            push_data = JSON.parse(push_msg.payload.doorbell);
                            device = this.eufy.getDevice(push_data.device_sn);
                        }
                        else {
                            push_data = push_msg.payload.payload;
                            device = this.eufy.getDevice(push_msg.payload.device_sn);
                        }
                        switch (push_data.event_type) {
                            case types_2.DoorbellPushEvent.MOTION_DETECTION:
                                if (!utils_1.isEmpty(push_data.pic_url)) {
                                    yield this.setStateAsync(device.getStateID(types_1.DoorbellStateID.MOTION_DETECTED), { val: true, ack: true });
                                    if (push_data.pic_url !== undefined && push_data.pic_url !== null && push_data.pic_url !== "")
                                        yield utils_1.saveImageStates(this, push_data.pic_url, device.getSerial(), device.getStateID(types_1.DoorbellStateID.LAST_CAPTURED_PIC_URL), device.getStateID(types_1.DoorbellStateID.LAST_CAPTURED_PIC_HTML), "Last captured picture", "last_captured_");
                                    if (this.motionDetected[device.getSerial()])
                                        clearTimeout(this.motionDetected[device.getSerial()]);
                                    this.motionDetected[device.getSerial()] = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                                        yield this.setStateAsync(device.getStateID(types_1.DoorbellStateID.MOTION_DETECTED), { val: false, ack: true });
                                    }), this.config.eventDuration * 1000);
                                }
                                else {
                                    yield this.setStateAsync(device.getStateID(types_1.DoorbellStateID.MOTION_DETECTED), { val: true, ack: true });
                                    if (this.motionDetected[device.getSerial()])
                                        clearTimeout(this.motionDetected[device.getSerial()]);
                                    this.motionDetected[device.getSerial()] = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                                        yield this.setStateAsync(device.getStateID(types_1.DoorbellStateID.MOTION_DETECTED), { val: false, ack: true });
                                    }), this.config.eventDuration * 1000);
                                }
                                break;
                            case types_2.DoorbellPushEvent.FACE_DETECTION:
                                if (!utils_1.isEmpty(push_data.pic_url)) {
                                    yield this.setStateAsync(device.getStateID(types_1.DoorbellStateID.PERSON_DETECTED), { val: true, ack: true });
                                    if (push_data.pic_url !== undefined && push_data.pic_url !== null && push_data.pic_url !== "")
                                        yield utils_1.saveImageStates(this, push_data.pic_url, device.getSerial(), device.getStateID(types_1.DoorbellStateID.LAST_CAPTURED_PIC_URL), device.getStateID(types_1.DoorbellStateID.LAST_CAPTURED_PIC_HTML), "Last captured picture", "last_captured_");
                                    yield this.setStateAsync(device.getStateID(types_1.DoorbellStateID.LAST_PERSON_IDENTIFIED), { val: "Unknown", ack: true });
                                    if (this.personDetected[device.getSerial()])
                                        clearTimeout(this.personDetected[device.getSerial()]);
                                    this.personDetected[device.getSerial()] = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                                        yield this.setStateAsync(device.getStateID(types_1.DoorbellStateID.PERSON_DETECTED), { val: false, ack: true });
                                    }), this.config.eventDuration * 1000);
                                }
                                else {
                                    yield this.setStateAsync(device.getStateID(types_1.DoorbellStateID.PERSON_DETECTED), { val: true, ack: true });
                                    yield this.setStateAsync(device.getStateID(types_1.DoorbellStateID.LAST_PERSON_IDENTIFIED), { val: "Unknown", ack: true });
                                    if (this.personDetected[device.getSerial()])
                                        clearTimeout(this.personDetected[device.getSerial()]);
                                    this.personDetected[device.getSerial()] = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                                        yield this.setStateAsync(device.getStateID(types_1.DoorbellStateID.PERSON_DETECTED), { val: false, ack: true });
                                    }), this.config.eventDuration * 1000);
                                }
                                break;
                            case types_2.DoorbellPushEvent.PRESS_DOORBELL:
                                yield this.setStateAsync(device.getStateID(types_1.DoorbellStateID.RINGING), { val: true, ack: true });
                                if (this.ringing[device.getSerial()])
                                    clearTimeout(this.ringing[device.getSerial()]);
                                this.ringing[device.getSerial()] = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                                    yield this.setStateAsync(device.getStateID(types_1.DoorbellStateID.RINGING), { val: false, ack: true });
                                }), this.config.eventDuration * 1000);
                                break;
                            default:
                                this.log.debug(`handlePushNotifications(): Unhandled doorbell push event: ${JSON.stringify(push_msg.payload)}`);
                                break;
                        }
                    }
                    else if (device_1.Device.isIndoorCamera(type)) {
                        const push_data = push_msg.payload.payload;
                        const device = this.eufy.getDevice(push_data.device_sn);
                        switch (push_data.event_type) {
                            case types_2.IndoorPushEvent.MOTION_DETECTION:
                                if (!utils_1.isEmpty(push_data.pic_url)) {
                                    yield this.setStateAsync(device.getStateID(types_1.IndoorCameraStateID.MOTION_DETECTED), { val: true, ack: true });
                                    if (push_data.pic_url !== undefined && push_data.pic_url !== null && push_data.pic_url !== "")
                                        yield utils_1.saveImageStates(this, push_data.pic_url, device.getSerial(), device.getStateID(types_1.IndoorCameraStateID.LAST_CAPTURED_PIC_URL), device.getStateID(types_1.IndoorCameraStateID.LAST_CAPTURED_PIC_HTML), "Last captured picture", "last_captured_");
                                    if (this.motionDetected[device.getSerial()])
                                        clearTimeout(this.motionDetected[device.getSerial()]);
                                    this.motionDetected[device.getSerial()] = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                                        yield this.setStateAsync(device.getStateID(types_1.IndoorCameraStateID.MOTION_DETECTED), { val: false, ack: true });
                                    }), this.config.eventDuration * 1000);
                                }
                                else {
                                    yield this.setStateAsync(device.getStateID(types_1.IndoorCameraStateID.MOTION_DETECTED), { val: true, ack: true });
                                    if (this.motionDetected[device.getSerial()])
                                        clearTimeout(this.motionDetected[device.getSerial()]);
                                    this.motionDetected[device.getSerial()] = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                                        yield this.setStateAsync(device.getStateID(types_1.IndoorCameraStateID.MOTION_DETECTED), { val: false, ack: true });
                                    }), this.config.eventDuration * 1000);
                                }
                                break;
                            case types_2.IndoorPushEvent.FACE_DETECTION:
                                if (!utils_1.isEmpty(push_data.pic_url)) {
                                    yield this.setStateAsync(device.getStateID(types_1.IndoorCameraStateID.PERSON_DETECTED), { val: true, ack: true });
                                    if (push_data.pic_url !== undefined && push_data.pic_url !== null && push_data.pic_url !== "")
                                        yield utils_1.saveImageStates(this, push_data.pic_url, device.getSerial(), device.getStateID(types_1.IndoorCameraStateID.LAST_CAPTURED_PIC_URL), device.getStateID(types_1.IndoorCameraStateID.LAST_CAPTURED_PIC_HTML), "Last captured picture", "last_captured_");
                                    yield this.setStateAsync(device.getStateID(types_1.IndoorCameraStateID.LAST_PERSON_IDENTIFIED), { val: "Unknown", ack: true });
                                    if (this.personDetected[device.getSerial()])
                                        clearTimeout(this.personDetected[device.getSerial()]);
                                    this.personDetected[device.getSerial()] = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                                        yield this.setStateAsync(device.getStateID(types_1.IndoorCameraStateID.PERSON_DETECTED), { val: false, ack: true });
                                    }), this.config.eventDuration * 1000);
                                }
                                else {
                                    yield this.setStateAsync(device.getStateID(types_1.IndoorCameraStateID.PERSON_DETECTED), { val: true, ack: true });
                                    yield this.setStateAsync(device.getStateID(types_1.IndoorCameraStateID.LAST_PERSON_IDENTIFIED), { val: "Unknown", ack: true });
                                    if (this.personDetected[device.getSerial()])
                                        clearTimeout(this.personDetected[device.getSerial()]);
                                    this.personDetected[device.getSerial()] = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                                        yield this.setStateAsync(device.getStateID(types_1.IndoorCameraStateID.PERSON_DETECTED), { val: false, ack: true });
                                    }), this.config.eventDuration * 1000);
                                }
                                break;
                            case types_2.IndoorPushEvent.CRYIG_DETECTION:
                                if (!utils_1.isEmpty(push_data.pic_url)) {
                                    yield this.setStateAsync(device.getStateID(types_1.IndoorCameraStateID.CRYING_DETECTED), { val: true, ack: true });
                                    if (push_data.pic_url !== undefined && push_data.pic_url !== null && push_data.pic_url !== "")
                                        yield utils_1.saveImageStates(this, push_data.pic_url, device.getSerial(), device.getStateID(types_1.IndoorCameraStateID.LAST_CAPTURED_PIC_URL), device.getStateID(types_1.IndoorCameraStateID.LAST_CAPTURED_PIC_HTML), "Last captured picture", "last_captured_");
                                    if (this.cryingDetected[device.getSerial()])
                                        clearTimeout(this.cryingDetected[device.getSerial()]);
                                    this.cryingDetected[device.getSerial()] = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                                        yield this.setStateAsync(device.getStateID(types_1.IndoorCameraStateID.CRYING_DETECTED), { val: false, ack: true });
                                    }), this.config.eventDuration * 1000);
                                }
                                else {
                                    yield this.setStateAsync(device.getStateID(types_1.IndoorCameraStateID.CRYING_DETECTED), { val: true, ack: true });
                                    if (this.cryingDetected[device.getSerial()])
                                        clearTimeout(this.cryingDetected[device.getSerial()]);
                                    this.cryingDetected[device.getSerial()] = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                                        yield this.setStateAsync(device.getStateID(types_1.IndoorCameraStateID.CRYING_DETECTED), { val: false, ack: true });
                                    }), this.config.eventDuration * 1000);
                                }
                                break;
                            case types_2.IndoorPushEvent.SOUND_DETECTION:
                                if (!utils_1.isEmpty(push_data.pic_url)) {
                                    yield this.setStateAsync(device.getStateID(types_1.IndoorCameraStateID.SOUND_DETECTED), { val: true, ack: true });
                                    if (push_data.pic_url !== undefined && push_data.pic_url !== null && push_data.pic_url !== "")
                                        yield utils_1.saveImageStates(this, push_data.pic_url, device.getSerial(), device.getStateID(types_1.IndoorCameraStateID.LAST_CAPTURED_PIC_URL), device.getStateID(types_1.IndoorCameraStateID.LAST_CAPTURED_PIC_HTML), "Last captured picture", "last_captured_");
                                    if (this.soundDetected[device.getSerial()])
                                        clearTimeout(this.soundDetected[device.getSerial()]);
                                    this.soundDetected[device.getSerial()] = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                                        yield this.setStateAsync(device.getStateID(types_1.IndoorCameraStateID.SOUND_DETECTED), { val: false, ack: true });
                                    }), this.config.eventDuration * 1000);
                                }
                                else {
                                    yield this.setStateAsync(device.getStateID(types_1.IndoorCameraStateID.SOUND_DETECTED), { val: true, ack: true });
                                    if (this.soundDetected[device.getSerial()])
                                        clearTimeout(this.soundDetected[device.getSerial()]);
                                    this.soundDetected[device.getSerial()] = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                                        yield this.setStateAsync(device.getStateID(types_1.IndoorCameraStateID.SOUND_DETECTED), { val: false, ack: true });
                                    }), this.config.eventDuration * 1000);
                                }
                                break;
                            case types_2.IndoorPushEvent.PET_DETECTION:
                                if (!utils_1.isEmpty(push_data.pic_url)) {
                                    yield this.setStateAsync(device.getStateID(types_1.IndoorCameraStateID.PET_DETECTED), { val: true, ack: true });
                                    if (push_data.pic_url !== undefined && push_data.pic_url !== null && push_data.pic_url !== "")
                                        yield utils_1.saveImageStates(this, push_data.pic_url, device.getSerial(), device.getStateID(types_1.IndoorCameraStateID.LAST_CAPTURED_PIC_URL), device.getStateID(types_1.IndoorCameraStateID.LAST_CAPTURED_PIC_HTML), "Last captured picture", "last_captured_");
                                    if (this.petDetected[device.getSerial()])
                                        clearTimeout(this.petDetected[device.getSerial()]);
                                    this.petDetected[device.getSerial()] = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                                        yield this.setStateAsync(device.getStateID(types_1.IndoorCameraStateID.PET_DETECTED), { val: false, ack: true });
                                    }), this.config.eventDuration * 1000);
                                }
                                else {
                                    yield this.setStateAsync(device.getStateID(types_1.IndoorCameraStateID.PET_DETECTED), { val: true, ack: true });
                                    if (this.petDetected[device.getSerial()])
                                        clearTimeout(this.petDetected[device.getSerial()]);
                                    this.petDetected[device.getSerial()] = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                                        yield this.setStateAsync(device.getStateID(types_1.IndoorCameraStateID.PET_DETECTED), { val: false, ack: true });
                                    }), this.config.eventDuration * 1000);
                                }
                                break;
                            default:
                                this.log.debug(`handlePushNotifications(): Unhandled indoor camera push event: ${JSON.stringify(push_msg.payload)}`);
                                break;
                        }
                    }
                    else if (type !== -1) {
                        const push_data = push_msg.payload.payload;
                        if (push_data.a) {
                            let device;
                            switch (push_data.a) {
                                case types_2.CusPushEvent.SECURITY: // Cam movement detected event
                                    device = this.eufy.getDevice(push_msg.payload.device_sn);
                                    if (!utils_1.isEmpty(push_data.i)) {
                                        if (!utils_1.isEmpty(push_data.pic_url)) {
                                            if (push_data.pic_url !== undefined && push_data.pic_url !== null && push_data.pic_url !== "")
                                                yield utils_1.saveImageStates(this, push_data.pic_url, device.getSerial(), device.getStateID(types_1.CameraStateID.LAST_CAPTURED_PIC_URL), device.getStateID(types_1.CameraStateID.LAST_CAPTURED_PIC_HTML), "Last captured picture", "last_captured_");
                                            if (utils_1.isEmpty(push_data.f)) {
                                                // Someone spotted
                                                yield this.setStateAsync(device.getStateID(types_1.CameraStateID.PERSON_DETECTED), { val: true, ack: true });
                                                yield this.setStateAsync(device.getStateID(types_1.CameraStateID.LAST_PERSON_IDENTIFIED), { val: "Unknown", ack: true });
                                                if (this.personDetected[device.getSerial()])
                                                    clearTimeout(this.personDetected[device.getSerial()]);
                                                this.personDetected[device.getSerial()] = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                                                    yield this.setStateAsync(device.getStateID(types_1.CameraStateID.PERSON_DETECTED), { val: false, ack: true });
                                                }), this.config.eventDuration * 1000);
                                            }
                                            else {
                                                // Person identified
                                                yield this.setStateAsync(device.getStateID(types_1.CameraStateID.PERSON_DETECTED), { val: true, ack: true });
                                                yield this.setStateAsync(device.getStateID(types_1.CameraStateID.LAST_PERSON_IDENTIFIED), { val: push_data.f !== undefined && push_data.f !== null ? push_data.f : "Unknown", ack: true });
                                                if (this.personDetected[device.getSerial()])
                                                    clearTimeout(this.personDetected[device.getSerial()]);
                                                this.personDetected[device.getSerial()] = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                                                    yield this.setStateAsync(device.getStateID(types_1.CameraStateID.PERSON_DETECTED), { val: false, ack: true });
                                                }), this.config.eventDuration * 1000);
                                            }
                                        }
                                        else {
                                            // Someone spotted
                                            yield this.setStateAsync(device.getStateID(types_1.CameraStateID.PERSON_DETECTED), { val: true, ack: true });
                                            yield this.setStateAsync(device.getStateID(types_1.CameraStateID.LAST_PERSON_IDENTIFIED), { val: "Unknown", ack: true });
                                            if (this.personDetected[device.getSerial()])
                                                clearTimeout(this.personDetected[device.getSerial()]);
                                            this.personDetected[device.getSerial()] = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                                                yield this.setStateAsync(device.getStateID(types_1.CameraStateID.PERSON_DETECTED), { val: false, ack: true });
                                            }), this.config.eventDuration * 1000);
                                        }
                                    }
                                    else {
                                        // Motion detected
                                        yield this.setStateAsync(device.getStateID(types_1.CameraStateID.MOTION_DETECTED), { val: true, ack: true });
                                        if (this.motionDetected[device.getSerial()])
                                            clearTimeout(this.motionDetected[device.getSerial()]);
                                        this.motionDetected[device.getSerial()] = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                                            yield this.setStateAsync(device.getStateID(types_1.CameraStateID.MOTION_DETECTED), { val: false, ack: true });
                                        }), this.config.eventDuration * 1000);
                                    }
                                    break;
                                case types_2.CusPushEvent.MODE_SWITCH: // Changing Guard mode event
                                    this.log.info(`Received push notification for changing guard mode (guard_mode: ${push_data.arming} current_mode: ${push_data.mode}) for station ${push_data.s}}.`);
                                    const station = (_a = this.eufy) === null || _a === void 0 ? void 0 : _a.getStation(push_data.s);
                                    if (station) {
                                        if (push_data.arming && push_data.mode) {
                                            yield this.setStateAsync(station.getStateID(types_1.StationStateID.GUARD_MODE), { val: push_data.arming, ack: true });
                                            yield this.setStateAsync(station.getStateID(types_1.StationStateID.CURRENT_MODE), { val: push_data.mode, ack: true });
                                        }
                                        else {
                                            this.log.warn(`handlePushNotifications(): Station MODE_SWITCH event (${push_data.a}): Missing required data to handle event: ${JSON.stringify(push_msg.payload)}`);
                                        }
                                    }
                                    else {
                                        this.log.warn(`handlePushNotifications(): Station MODE_SWITCH event (${push_data.a}): Station Unknown: ${push_data.s}`);
                                    }
                                    break;
                                case types_2.CusPushEvent.DOOR_SENSOR: // EntrySensor open/close change event
                                    device = this.eufy.getDevice(push_msg.payload.device_sn);
                                    yield utils_1.setStateChangedAsync(this, device.getStateID(types_1.EntrySensorStateID.SENSOR_OPEN), push_data.e === "1" ? true : false);
                                    break;
                                case types_2.CusPushEvent.MOTION_SENSOR_PIR: // MotionSensor movement detected event
                                    device = this.eufy.getDevice(push_msg.payload.device_sn);
                                    yield this.setStateAsync(device.getStateID(types_1.MotionSensorStateID.MOTION_DETECTED), { val: true, ack: true });
                                    if (this.motionDetected[device.getSerial()])
                                        clearTimeout(this.motionDetected[device.getSerial()]);
                                    this.motionDetected[device.getSerial()] = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                                        yield this.setStateAsync(device.getStateID(types_1.MotionSensorStateID.MOTION_DETECTED), { val: false, ack: true });
                                    }), device_1.MotionSensor.MOTION_COOLDOWN_MS);
                                    break;
                                default:
                                    this.log.debug(`handlePushNotifications(): Unhandled push event: ${JSON.stringify(push_msg.payload)}`);
                                    break;
                            }
                        }
                        else {
                            this.log.warn(`handlePushNotifications(): Cus unknown push data: ${JSON.stringify(push_msg.payload)}`);
                        }
                    }
                    else {
                        this.log.warn(`handlePushNotifications(): Unhandled push event - data: ${JSON.stringify(push_msg.payload)}`);
                    }
                }
            }
            catch (error) {
                this.log.error(`handlePushNotifications(): Error: ${error}`);
            }
        });
    }
    onConnect() {
        return __awaiter(this, void 0, void 0, function* () {
            this.log.silly(`onConnect(): `);
            yield this.setStateAsync("info.connection", { val: true, ack: true });
            yield this.refreshData(this);
            const api = this.eufy.getApi();
            const api_base = api.getAPIBase();
            const token = api.getToken();
            let token_expiration = api.getTokenExpiration();
            const trusted_token_expiration = api.getTrustedTokenExpiration();
            if ((token_expiration === null || token_expiration === void 0 ? void 0 : token_expiration.getTime()) !== trusted_token_expiration.getTime())
                try {
                    const trusted_devices = yield api.listTrustDevice();
                    trusted_devices.forEach(trusted_device => {
                        if (trusted_device.is_current_device === 1) {
                            token_expiration = trusted_token_expiration;
                            api.setTokenExpiration(token_expiration);
                            this.log.debug(`onConnect(): This device is trusted. Token expiration extended to: ${token_expiration})`);
                        }
                    });
                }
                catch (error) {
                    this.log.error(`onConnect(): trusted_devices - Error: ${error}`);
                }
            if (api_base) {
                this.log.debug(`onConnect(): save api_base - api_base: ${api_base}`);
                this.setAPIBase(api_base);
            }
            if (token && token_expiration) {
                this.log.debug(`onConnect(): save token and expiration - token: ${token} token_expiration: ${token_expiration}`);
                this.setCloudToken(token, token_expiration);
            }
            this.eufy.registerPushNotifications(this.getPersistentData().push_persistentIds);
            Object.values(this.eufy.getStations()).forEach(function (station) {
                station.connect();
            });
        });
    }
    onNotConnected() {
        return __awaiter(this, void 0, void 0, function* () {
            this.log.silly(`onNotConnected(): `);
            yield this.setStateAsync("info.connection", { val: false, ack: true });
        });
    }
    setAPIBase(api_base) {
        this.persistentData.api_base = api_base;
        this.writePersistentData();
    }
    setCloudToken(token, expiration) {
        this.persistentData.cloud_token = token;
        this.persistentData.cloud_token_expiration = expiration.getTime();
        this.writePersistentData();
    }
    setPushCredentials(credentials) {
        this.persistentData.push_credentials = credentials;
        this.writePersistentData();
    }
    getPersistentData() {
        return this.persistentData;
    }
    setPushPersistentIds(persistentIds) {
        this.persistentData.push_persistentIds = persistentIds;
        //this.writePersistentData();
    }
}
exports.EufySecurity = EufySecurity;
if (module.parent) {
    // Export the constructor in compact mode
    module.exports = (options) => new EufySecurity(options);
}
else {
    // otherwise start the instance directly
    (() => new EufySecurity())();
}
