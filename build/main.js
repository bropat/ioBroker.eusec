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
const eufy_security_client_1 = require("eufy-security-client");
const EufySecurityAPI = __importStar(require("./lib/eufy-security/eufy-security"));
const types_1 = require("./lib/eufy-security/types");
const utils_1 = require("./lib/eufy-security/utils");
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
                    name: "Global connection",
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
            try {
                const last_captured_pic_url = yield this.getStatesAsync("*.last_captured_pic_url");
                Object.keys(last_captured_pic_url).forEach((id) => __awaiter(this, void 0, void 0, function* () {
                    yield this.delObjectAsync(id);
                }));
            }
            catch (error) {
            }
            try {
                const last_captured_pic_html = yield this.getStatesAsync("*.last_captured_pic_html");
                Object.keys(last_captured_pic_html).forEach((id) => __awaiter(this, void 0, void 0, function* () {
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
            this.subscribeStates("test_button");
            await this.setObjectNotExistsAsync("test_button2", {
                type: "state",
                common: {
                    name: "Test button2",
                    type: "boolean",
                    role: "button",
                    read: false,
                    write: true,
                },
                native: {},
            });
            this.subscribeStates("test_button2");*/
            // END
            this.subscribeStates("verify_code");
            this.eufy = new EufySecurityAPI.EufySecurity(this);
            this.eufy.on("stations", (stations) => this.handleStations(stations));
            this.eufy.on("devices", (devices) => this.handleDevices(devices));
            this.eufy.on("push_notification", (messages) => this.handlePushNotification(messages));
            this.eufy.on("connect", () => this.onConnect());
            this.eufy.on("disconnect", () => this.onDisconnect());
            this.eufy.on("start_livestream", (station, device, url) => this.onStartLivestream(station, device, url));
            this.eufy.on("stop_livestream", (station, device) => this.onStopLivestream(station, device));
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
                // don't do anything if the state is acked
                if (!id || state.ack) {
                    this.log.debug(`state ${id} changed: ${state.val} (ack = ${state.ack}) was already acknowledged, ignore it...`);
                    return;
                }
                this.log.debug(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
                const values = id.split(".");
                const station_sn = values[2];
                const device_type = values[3];
                if (station_sn == "verify_code") {
                    if (this.eufy) {
                        this.log.info(`Verification code received, send it. (verify_code: ${state.val})`);
                        this.eufy.logon(state.val);
                        yield this.delStateAsync(id);
                    }
                }
                else if (station_sn == "test_button") {
                    //TODO: Test to remove!
                    this.log.debug("TEST button pressed");
                    if (this.eufy) {
                        //await this.eufy.getStation("T8010P23201721F8").rebootHUB();
                        //await this.eufy.getStation("T8010P23201721F8").setStatusLed(this.eufy.getDevice("T8114P022022261F"), true);
                        //await this.eufy.getStation("T8010P23201721F8").startLivestream(this.eufy.getDevice("T8114P022022261F"));
                        //await this.eufy.getStation("T8010P23201721F8").startLivestream(this.eufy.getDevice("T8114P0220223A5A"));
                        //await this.eufy.getStation("T8010P23201721F8").startDownload("/media/mmcblk0p1/Camera00/20201231171631.dat");
                        /*const device = this.eufy.getDevice("T8114P0220223A5A");
                        await this.eufy.getStation("T8010P23201721F8").cancelDownload(device);*/
                        //await this.eufy.getApi().sendVerifyCode(VerfyCodeTypes.TYPE_PUSH);
                        yield this.eufy.getStation("T8010P23201721F8").getCameraInfo();
                        //await this.eufy.getStation("T8010P23201721F8").setGuardMode(2);
                        //await this.eufy.getStation("T8010P23201721F8").getStorageInfo();
                    }
                }
                else if (station_sn == "test_button2") {
                    //TODO: Test to remove!
                    this.log.debug("TEST button2 pressed");
                    if (this.eufy) {
                        try {
                            const device = this.eufy.getDevice("T8114P0220223A5A");
                            if (device)
                                //this._startDownload("T8010P23201721F8", device.getStoragePath("20201008191909"), 92);
                                this._startDownload("T8010P23201721F8", "/media/mmcblk0p1/Camera00/20210213171152.dat", 92);
                            //await this.eufy.getStation("T8010P23201721F8").startDownload(`/media/mmcblk0p1/Camera00/${20201008191909}.dat`, cipher.private_key);
                        }
                        catch (error) {
                            this.log.error(error);
                        }
                        //await this.eufy.getStation("T8010P23201721F8").startDownload("/media/mmcblk0p1/Camera01/20210111071357.dat");
                        //await this.eufy.getStation("T8010P23201721F8").setStatusLed(this.eufy.getDevice("T8114P022022261F"), false);
                        //await this.eufy.getStation("T8010P23201721F8").stopLivestream(this.eufy.getDevice("T8114P022022261F"));
                        //await this.eufy.getStation("T8010P23201721F8").stopLivestream(this.eufy.getDevice("T8114P0220223A5A"));
                    }
                }
                else if (device_type == "cameras") {
                    try {
                        const device_sn = values[4];
                        const device_state_name = values[5];
                        const station = this.eufy.getStation(station_sn);
                        const device = this.eufy.getDevice(device_sn);
                        if (this.eufy) {
                            switch (device_state_name) {
                                case types_1.CameraStateID.START_STREAM:
                                    this.eufy.startLivestream(device_sn);
                                    break;
                                case types_1.CameraStateID.STOP_STREAM:
                                    this.eufy.stopLivestream(device_sn);
                                    break;
                                case types_1.CameraStateID.LED_STATUS:
                                    if (device && state.val !== null)
                                        station.setStatusLed(device, state.val);
                                    break;
                                case types_1.CameraStateID.ENABLED:
                                    if (device && state.val !== null)
                                        station.enableDevice(device, state.val);
                                    break;
                                case types_1.CameraStateID.ANTITHEFT_DETECTION:
                                    if (device && state.val !== null)
                                        station.setAntiTheftDetection(device, state.val);
                                    break;
                                case types_1.CameraStateID.AUTO_NIGHTVISION:
                                    if (device && state.val !== null)
                                        station.setAutoNightVision(device, state.val);
                                    break;
                                case types_1.CameraStateID.WATERMARK:
                                    if (device && state.val !== null)
                                        station.setWatermark(device, state.val);
                                    break;
                            }
                        }
                    }
                    catch (error) {
                        this.log.error(`onStateChange(): cameras - Error: ${error}`);
                    }
                }
                else if (device_type == "station") {
                    const station_state_name = values[4];
                    if (this.eufy) {
                        const station = this.eufy.getStation(station_sn);
                        switch (station_state_name) {
                            case types_1.StationStateID.GUARD_MODE:
                                yield station.setGuardMode(state.val);
                                break;
                            case types_1.StationStateID.REBOOT:
                                yield station.rebootHUB();
                                break;
                        }
                    }
                }
            }
            else {
                // The state was deleted
                this.log.debug(`state ${id} deleted`);
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
                    try {
                        yield utils_1.setStateChangedWithTimestamp(this, camera.getStateID(types_1.CameraStateID.STATE), Number.parseInt(camera.getParameter(eufy_security_client_1.CommandType.CMD_GET_DEV_STATUS).value), camera.getParameter(eufy_security_client_1.CommandType.CMD_GET_DEV_STATUS).modified);
                    }
                    catch (error) {
                    }
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
                    yield utils_1.saveImageStates(this, camera.getLastCameraImageURL(), camera.getLastCameraImageTimestamp(), camera.getSerial(), camera.getStateID(types_1.CameraStateID.LAST_EVENT_PICTURE_URL), camera.getStateID(types_1.CameraStateID.LAST_EVENT_PICTURE_HTML), "Last event picture").catch(() => {
                        this.log.error(`handleDevices(): State LAST_EVENT_PICTURE_URL of device ${camera.getSerial()} - saveImageStates(): url ${camera.getLastCameraImageURL()}`);
                    });
                    //TODO: As soon as we release the p2p download of videos, unlock this
                    // Last event video URL
                    /*await this.setObjectNotExistsAsync(camera.getStateID(CameraStateID.LAST_EVENT_VIDEO_URL), {
                        type: "state",
                        common: {
                            name: "Last captured video URL",
                            type: "string",
                            role: "state",
                            read: true,
                            write: false,
                            def: ""
                        },
                        native: {},
                    });*/
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
                    // Last livestream video URL
                    yield this.setObjectNotExistsAsync(camera.getStateID(types_1.CameraStateID.LAST_LIVESTREAM_VIDEO_URL), {
                        type: "state",
                        common: {
                            name: "Last livestream video URL",
                            type: "string",
                            role: "state",
                            read: true,
                            write: false,
                        },
                        native: {},
                    });
                    // Last livestream picture URL
                    yield this.setObjectNotExistsAsync(camera.getStateID(types_1.CameraStateID.LAST_LIVESTREAM_PIC_URL), {
                        type: "state",
                        common: {
                            name: "Last livestream picture URL",
                            type: "string",
                            role: "state",
                            read: true,
                            write: false,
                        },
                        native: {},
                    });
                    // Last livestream picture HTML
                    yield this.setObjectNotExistsAsync(camera.getStateID(types_1.CameraStateID.LAST_LIVESTREAM_PIC_HTML), {
                        type: "state",
                        common: {
                            name: "Last livestream picture HTML image",
                            type: "string",
                            role: "state",
                            read: true,
                            write: false,
                        },
                        native: {},
                    });
                    // Device enabled
                    yield this.setObjectNotExistsAsync(camera.getStateID(types_1.CameraStateID.ENABLED), {
                        type: "state",
                        common: {
                            name: "Device enabled",
                            type: "boolean",
                            role: "state",
                            read: true,
                            write: true,
                        },
                        native: {},
                    });
                    yield utils_1.setStateChangedAsync(this, camera.getStateID(types_1.CameraStateID.ENABLED), camera.isEnabled());
                    // Watermark
                    let watermark_state = {
                        0: "OFF",
                        1: "TIMESTAMP",
                        2: "TIMESTAMP_AND_LOGO"
                    };
                    if (camera.getDeviceType() === eufy_security_client_1.DeviceType.DOORBELL || camera.isSoloCameras()) {
                        watermark_state = {
                            0: "OFF",
                            1: "TIMESTAMP"
                        };
                    }
                    else if (camera.isBatteryDoorbell() || camera.isBatteryDoorbell2() || camera.getDeviceType() === eufy_security_client_1.DeviceType.CAMERA || camera.getDeviceType() === eufy_security_client_1.DeviceType.CAMERA_E) {
                        watermark_state = {
                            1: "ON",
                            2: "OFF"
                        };
                    }
                    yield this.setObjectNotExistsAsync(camera.getStateID(types_1.CameraStateID.WATERMARK), {
                        type: "state",
                        common: {
                            name: "Watermark",
                            type: "number",
                            role: "state",
                            read: true,
                            write: true,
                            states: watermark_state
                        },
                        native: {},
                    });
                    try {
                        yield utils_1.setStateChangedWithTimestamp(this, camera.getStateID(types_1.CameraStateID.WATERMARK), Number.parseInt(camera.getParameter(eufy_security_client_1.CommandType.CMD_SET_DEVS_OSD).value), camera.getParameter(eufy_security_client_1.CommandType.CMD_SET_DEVS_OSD).modified);
                    }
                    catch (error) {
                    }
                    if (camera.isCamera2Product()) {
                        // Antitheft detection
                        yield this.setObjectNotExistsAsync(camera.getStateID(types_1.CameraStateID.ANTITHEFT_DETECTION), {
                            type: "state",
                            common: {
                                name: "Antitheft detection",
                                type: "boolean",
                                role: "state",
                                read: true,
                                write: true
                            },
                            native: {},
                        });
                        try {
                            yield utils_1.setStateChangedWithTimestamp(this, camera.getStateID(types_1.CameraStateID.ANTITHEFT_DETECTION), camera.getParameter(eufy_security_client_1.CommandType.CMD_EAS_SWITCH).value === "1" ? true : false, camera.getParameter(eufy_security_client_1.CommandType.CMD_EAS_SWITCH).modified);
                        }
                        catch (error) {
                        }
                    }
                    // Auto Nightvision
                    yield this.setObjectNotExistsAsync(camera.getStateID(types_1.CameraStateID.AUTO_NIGHTVISION), {
                        type: "state",
                        common: {
                            name: "Auto nightvision",
                            type: "boolean",
                            role: "state",
                            read: true,
                            write: true
                        },
                        native: {},
                    });
                    try {
                        yield utils_1.setStateChangedWithTimestamp(this, camera.getStateID(types_1.CameraStateID.AUTO_NIGHTVISION), camera.getParameter(eufy_security_client_1.CommandType.CMD_IRCUT_SWITCH).value === "1" ? true : false, camera.getParameter(eufy_security_client_1.CommandType.CMD_IRCUT_SWITCH).modified);
                    }
                    catch (error) {
                    }
                    if (camera.isCamera2Product() || camera.isIndoorCamera() || camera.isSoloCameras() || camera.isFloodLight()) {
                        // LED Status
                        yield this.setObjectNotExistsAsync(camera.getStateID(types_1.CameraStateID.LED_STATUS), {
                            type: "state",
                            common: {
                                name: "LED status",
                                type: "boolean",
                                role: "state",
                                read: true,
                                write: true
                            },
                            native: {},
                        });
                        try {
                            yield utils_1.setStateChangedWithTimestamp(this, camera.getStateID(types_1.CameraStateID.LED_STATUS), camera.getParameter(eufy_security_client_1.CommandType.CMD_DEV_LED_SWITCH).value === "1" ? true : false, camera.getParameter(eufy_security_client_1.CommandType.CMD_DEV_LED_SWITCH).modified);
                        }
                        catch (error) {
                        }
                    }
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
                        try {
                            yield utils_1.setStateChangedWithTimestamp(this, camera.getStateID(types_1.CameraStateID.BATTERY), Number.parseInt(camera.getParameter(eufy_security_client_1.CommandType.CMD_GET_BATTERY).value), camera.getParameter(eufy_security_client_1.CommandType.CMD_GET_BATTERY).modified);
                        }
                        catch (error) {
                        }
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
                        try {
                            yield utils_1.setStateChangedWithTimestamp(this, camera.getStateID(types_1.CameraStateID.BATTERY_TEMPERATURE), Number.parseInt(camera.getParameter(eufy_security_client_1.CommandType.CMD_GET_BATTERY_TEMP).value), camera.getParameter(eufy_security_client_1.CommandType.CMD_GET_BATTERY_TEMP).modified);
                        }
                        catch (error) {
                        }
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
                    try {
                        yield utils_1.setStateChangedWithTimestamp(this, camera.getStateID(types_1.CameraStateID.WIFI_RSSI), Number.parseInt(camera.getParameter(eufy_security_client_1.CommandType.CMD_GET_WIFI_RSSI).value), camera.getParameter(eufy_security_client_1.CommandType.CMD_GET_WIFI_RSSI).modified);
                    }
                    catch (error) {
                    }
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
                    try {
                        yield utils_1.setStateChangedWithTimestamp(this, sensor.getStateID(types_1.EntrySensorStateID.STATE), Number.parseInt(sensor.getParameter(eufy_security_client_1.CommandType.CMD_GET_DEV_STATUS).value), sensor.getParameter(eufy_security_client_1.CommandType.CMD_GET_DEV_STATUS).modified);
                    }
                    catch (error) {
                    }
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
                    if (sensor.getParameter(eufy_security_client_1.CommandType.CMD_ENTRY_SENSOR_STATUS))
                        yield utils_1.setStateChangedWithTimestamp(this, sensor.getStateID(types_1.EntrySensorStateID.SENSOR_OPEN), sensor.getParameter(eufy_security_client_1.CommandType.CMD_ENTRY_SENSOR_STATUS).value === "1", sensor.getParameter(eufy_security_client_1.CommandType.CMD_ENTRY_SENSOR_STATUS).modified);
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
                    if (sensor.getParameter(eufy_security_client_1.CommandType.CMD_ENTRY_SENSOR_BAT_STATE))
                        yield utils_1.setStateChangedWithTimestamp(this, sensor.getStateID(types_1.EntrySensorStateID.LOW_BATTERY), sensor.getParameter(eufy_security_client_1.CommandType.CMD_ENTRY_SENSOR_BAT_STATE).value === "1", sensor.getParameter(eufy_security_client_1.CommandType.CMD_ENTRY_SENSOR_BAT_STATE).modified);
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
                    if (sensor.getParameter(eufy_security_client_1.CommandType.CMD_ENTRY_SENSOR_CHANGE_TIME))
                        yield utils_1.setStateChangedWithTimestamp(this, sensor.getStateID(types_1.EntrySensorStateID.SENSOR_CHANGE_TIME), sensor.getParameter(eufy_security_client_1.CommandType.CMD_ENTRY_SENSOR_CHANGE_TIME).value, sensor.getParameter(eufy_security_client_1.CommandType.CMD_ENTRY_SENSOR_CHANGE_TIME).modified);
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
                    try {
                        yield utils_1.setStateChangedWithTimestamp(this, sensor.getStateID(types_1.MotionSensorStateID.STATE), Number.parseInt(sensor.getParameter(eufy_security_client_1.CommandType.CMD_GET_DEV_STATUS).value), sensor.getParameter(eufy_security_client_1.CommandType.CMD_GET_DEV_STATUS).modified);
                    }
                    catch (error) {
                    }
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
                    if (sensor.getParameter(eufy_security_client_1.CommandType.CMD_MOTION_SENSOR_BAT_STATE))
                        yield utils_1.setStateChangedWithTimestamp(this, sensor.getStateID(types_1.MotionSensorStateID.LOW_BATTERY), sensor.getParameter(eufy_security_client_1.CommandType.CMD_MOTION_SENSOR_BAT_STATE).value === "1", sensor.getParameter(eufy_security_client_1.CommandType.CMD_MOTION_SENSOR_BAT_STATE).modified);
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
                    try {
                        yield utils_1.setStateChangedWithTimestamp(this, keypad.getStateID(types_1.KeyPadStateID.STATE), Number.parseInt(keypad.getParameter(eufy_security_client_1.CommandType.CMD_GET_DEV_STATUS).value), keypad.getParameter(eufy_security_client_1.CommandType.CMD_GET_DEV_STATUS).modified);
                    }
                    catch (error) {
                    }
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
                    if (keypad.getParameter(eufy_security_client_1.CommandType.CMD_KEYPAD_BATTERY_CAP_STATE))
                        yield utils_1.setStateChangedWithTimestamp(this, keypad.getStateID(types_1.KeyPadStateID.LOW_BATTERY), keypad.getParameter(eufy_security_client_1.CommandType.CMD_KEYPAD_BATTERY_CAP_STATE).value === "1", keypad.getParameter(eufy_security_client_1.CommandType.CMD_KEYPAD_BATTERY_CAP_STATE).modified);
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
                //TODO: Change this implementation!
                const lan_ip_address = station.getParameter(eufy_security_client_1.CommandType.CMD_GET_HUB_LAN_IP);
                if (lan_ip_address && eufy_security_client_1.isPrivateIp(lan_ip_address.value))
                    yield utils_1.setStateChangedWithTimestamp(this, station.getStateID(types_1.StationStateID.LAN_IP_ADDRESS), lan_ip_address.value, lan_ip_address.modified);
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
                const guard_mode = station.getParameter(eufy_security_client_1.ParamType.GUARD_MODE);
                try {
                    yield utils_1.setStateChangedWithTimestamp(this, station.getStateID(types_1.StationStateID.GUARD_MODE), Number.parseInt(guard_mode.value), guard_mode.modified);
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
                    const schedule_mode = station.getParameter(eufy_security_client_1.ParamType.SCHEDULE_MODE);
                    if (schedule_mode && guard_mode)
                        yield utils_1.setStateChangedWithTimestamp(this, station.getStateID(types_1.StationStateID.CURRENT_MODE), guard_mode.value === "2" ? Number.parseInt(schedule_mode.value) : Number.parseInt(guard_mode.value), guard_mode.value === "2" ? station.getParameter(eufy_security_client_1.ParamType.SCHEDULE_MODE).modified : guard_mode.modified);
                }
                catch (error) {
                    this.log.error(`handleStations(): CURRENT_MODE - Error: ${error}`);
                }
                // Reboot station
                yield this.setObjectNotExistsAsync(station.getStateID(types_1.StationStateID.REBOOT), {
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
            }));
        });
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _startDownload(station_sn, full_path, cipher_id) {
        /*TODO: Directly downloading the video when receiving the push notification results
                in receiving a very short video (about 2 sec.). Start the download after a
                delay that depends on the configured power mode of the device
                in the meantime this feature was switched off
        */
        /*const station = this.eufy.getStation(station_sn);
        if (station && !isEmpty(full_path) && cipher_id !== undefined) {
            station.startDownload(full_path!, cipher_id);
        }*/
    }
    handlePushNotification(push_msg) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.log.debug(`handlePushNotifications(): push_msg: ${JSON.stringify(push_msg)}`);
                if (push_msg.type) {
                    if (push_msg.type == eufy_security_client_1.ServerPushEvent.VERIFICATION) {
                        this.log.debug(`handlePushNotifications(): Received push verification event: ${JSON.stringify(push_msg)}`);
                    }
                    else if (eufy_security_client_1.Device.isDoorbell(push_msg.type)) {
                        const device = this.eufy.getDevice(push_msg.device_sn);
                        if (device) {
                            switch (push_msg.event_type) {
                                case eufy_security_client_1.DoorbellPushEvent.MOTION_DETECTION:
                                    if (!utils_1.isEmpty(push_msg.pic_url)) {
                                        yield this.setStateAsync(device.getStateID(types_1.DoorbellStateID.MOTION_DETECTED), { val: true, ack: true });
                                        yield utils_1.saveImageStates(this, push_msg.pic_url, push_msg.event_time, device.getSerial(), device.getStateID(types_1.DoorbellStateID.LAST_EVENT_PICTURE_URL), device.getStateID(types_1.DoorbellStateID.LAST_EVENT_PICTURE_HTML), "Last captured picture", "last_captured_").catch(() => {
                                            this.log.error(`handlePushNotifications(): DoorbellPushEvent.MOTION_DETECTION of device ${device.getSerial()} - saveImageStates(): url ${push_msg.pic_url}`);
                                        });
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
                                    if (push_msg.push_count === 1)
                                        this._startDownload(push_msg.station_sn, push_msg.file_path, push_msg.cipher);
                                    break;
                                case eufy_security_client_1.DoorbellPushEvent.FACE_DETECTION:
                                    if (!utils_1.isEmpty(push_msg.pic_url)) {
                                        yield this.setStateAsync(device.getStateID(types_1.DoorbellStateID.PERSON_DETECTED), { val: true, ack: true });
                                        yield utils_1.saveImageStates(this, push_msg.pic_url, push_msg.event_time, device.getSerial(), device.getStateID(types_1.DoorbellStateID.LAST_EVENT_PICTURE_URL), device.getStateID(types_1.DoorbellStateID.LAST_EVENT_PICTURE_HTML), "Last captured picture", "last_captured_").catch(() => {
                                            this.log.error(`handlePushNotifications(): DoorbellPushEvent.FACE_DETECTION of device ${device.getSerial()} - saveImageStates(): url ${push_msg.pic_url}`);
                                        });
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
                                    if (push_msg.push_count === 1)
                                        this._startDownload(push_msg.station_sn, push_msg.file_path, push_msg.cipher);
                                    break;
                                case eufy_security_client_1.DoorbellPushEvent.PRESS_DOORBELL:
                                    yield this.setStateAsync(device.getStateID(types_1.DoorbellStateID.RINGING), { val: true, ack: true });
                                    if (this.ringing[device.getSerial()])
                                        clearTimeout(this.ringing[device.getSerial()]);
                                    this.ringing[device.getSerial()] = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                                        yield this.setStateAsync(device.getStateID(types_1.DoorbellStateID.RINGING), { val: false, ack: true });
                                    }), this.config.eventDuration * 1000);
                                    break;
                                default:
                                    this.log.debug(`handlePushNotifications(): Unhandled doorbell push event: ${JSON.stringify(push_msg)}`);
                                    break;
                            }
                        }
                        else {
                            this.log.debug(`handlePushNotifications(): DoorbellPushEvent - Device not found: ${push_msg.device_sn}`);
                        }
                    }
                    else if (eufy_security_client_1.Device.isIndoorCamera(push_msg.type)) {
                        const device = this.eufy.getDevice(push_msg.device_sn);
                        if (device) {
                            switch (push_msg.event_type) {
                                case eufy_security_client_1.IndoorPushEvent.MOTION_DETECTION:
                                    if (!utils_1.isEmpty(push_msg.pic_url)) {
                                        yield this.setStateAsync(device.getStateID(types_1.IndoorCameraStateID.MOTION_DETECTED), { val: true, ack: true });
                                        yield utils_1.saveImageStates(this, push_msg.pic_url, push_msg.event_time, device.getSerial(), device.getStateID(types_1.IndoorCameraStateID.LAST_EVENT_PICTURE_URL), device.getStateID(types_1.IndoorCameraStateID.LAST_EVENT_PICTURE_HTML), "Last captured picture", "last_captured_").catch(() => {
                                            this.log.error(`handlePushNotifications(): IndoorPushEvent.MOTION_DETECTION of device ${device.getSerial()} - saveImageStates(): url ${push_msg.pic_url}`);
                                        });
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
                                    if (push_msg.push_count === 1)
                                        this._startDownload(push_msg.station_sn, push_msg.file_path, push_msg.cipher);
                                    break;
                                case eufy_security_client_1.IndoorPushEvent.FACE_DETECTION:
                                    if (!utils_1.isEmpty(push_msg.pic_url)) {
                                        yield this.setStateAsync(device.getStateID(types_1.IndoorCameraStateID.PERSON_DETECTED), { val: true, ack: true });
                                        yield utils_1.saveImageStates(this, push_msg.pic_url, push_msg.event_time, device.getSerial(), device.getStateID(types_1.IndoorCameraStateID.LAST_EVENT_PICTURE_URL), device.getStateID(types_1.IndoorCameraStateID.LAST_EVENT_PICTURE_HTML), "Last captured picture", "last_captured_").catch(() => {
                                            this.log.error(`handlePushNotifications(): IndoorPushEvent.FACE_DETECTION of device ${device.getSerial()} - saveImageStates(): url ${push_msg.pic_url}`);
                                        });
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
                                    if (push_msg.push_count === 1)
                                        this._startDownload(push_msg.station_sn, push_msg.file_path, push_msg.cipher);
                                    break;
                                case eufy_security_client_1.IndoorPushEvent.CRYIG_DETECTION:
                                    if (!utils_1.isEmpty(push_msg.pic_url)) {
                                        yield this.setStateAsync(device.getStateID(types_1.IndoorCameraStateID.CRYING_DETECTED), { val: true, ack: true });
                                        yield utils_1.saveImageStates(this, push_msg.pic_url, push_msg.event_time, device.getSerial(), device.getStateID(types_1.IndoorCameraStateID.LAST_EVENT_PICTURE_URL), device.getStateID(types_1.IndoorCameraStateID.LAST_EVENT_PICTURE_HTML), "Last captured picture", "last_captured_").catch(() => {
                                            this.log.error(`handlePushNotifications(): IndoorPushEvent.CRYIG_DETECTION of device ${device.getSerial()} - saveImageStates(): url ${push_msg.pic_url}`);
                                        });
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
                                    if (push_msg.push_count === 1)
                                        this._startDownload(push_msg.station_sn, push_msg.file_path, push_msg.cipher);
                                    break;
                                case eufy_security_client_1.IndoorPushEvent.SOUND_DETECTION:
                                    if (!utils_1.isEmpty(push_msg.pic_url)) {
                                        yield this.setStateAsync(device.getStateID(types_1.IndoorCameraStateID.SOUND_DETECTED), { val: true, ack: true });
                                        yield utils_1.saveImageStates(this, push_msg.pic_url, push_msg.event_time, device.getSerial(), device.getStateID(types_1.IndoorCameraStateID.LAST_EVENT_PICTURE_URL), device.getStateID(types_1.IndoorCameraStateID.LAST_EVENT_PICTURE_HTML), "Last captured picture", "last_captured_").catch(() => {
                                            this.log.error(`handlePushNotifications(): IndoorPushEvent.SOUND_DETECTION of device ${device.getSerial()} - saveImageStates(): url ${push_msg.pic_url}`);
                                        });
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
                                    if (push_msg.push_count === 1)
                                        this._startDownload(push_msg.station_sn, push_msg.file_path, push_msg.cipher);
                                    break;
                                case eufy_security_client_1.IndoorPushEvent.PET_DETECTION:
                                    if (!utils_1.isEmpty(push_msg.pic_url)) {
                                        yield this.setStateAsync(device.getStateID(types_1.IndoorCameraStateID.PET_DETECTED), { val: true, ack: true });
                                        yield utils_1.saveImageStates(this, push_msg.pic_url, push_msg.event_time, device.getSerial(), device.getStateID(types_1.IndoorCameraStateID.LAST_EVENT_PICTURE_URL), device.getStateID(types_1.IndoorCameraStateID.LAST_EVENT_PICTURE_HTML), "Last captured picture", "last_captured_").catch(() => {
                                            this.log.error(`handlePushNotifications(): IndoorPushEvent.PET_DETECTION of device ${device.getSerial()} - saveImageStates(): url ${push_msg.pic_url}`);
                                        });
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
                                    if (push_msg.push_count === 1)
                                        this._startDownload(push_msg.station_sn, push_msg.file_path, push_msg.cipher);
                                    break;
                                default:
                                    this.log.debug(`handlePushNotifications(): Unhandled indoor camera push event: ${JSON.stringify(push_msg)}`);
                                    break;
                            }
                        }
                        else {
                            this.log.debug(`handlePushNotifications(): IndoorPushEvent - Device not found: ${push_msg.device_sn}`);
                        }
                    }
                    else if (push_msg.type) {
                        if (push_msg.event_type) {
                            let device;
                            switch (push_msg.event_type) {
                                case eufy_security_client_1.CusPushEvent.SECURITY: // Cam movement detected event
                                    device = this.eufy.getDevice(push_msg.device_sn);
                                    if (device) {
                                        if (push_msg.fetch_id) {
                                            if (!utils_1.isEmpty(push_msg.pic_url)) {
                                                yield utils_1.saveImageStates(this, push_msg.pic_url, push_msg.event_time, device.getSerial(), device.getStateID(types_1.CameraStateID.LAST_EVENT_PICTURE_URL), device.getStateID(types_1.CameraStateID.LAST_EVENT_PICTURE_HTML), "Last captured picture", "last_captured_").catch(() => {
                                                    this.log.error(`handlePushNotifications(): CusPushEvent.SECURITY of device ${device.getSerial()} - saveImageStates(): url ${push_msg.pic_url}`);
                                                });
                                                if (utils_1.isEmpty(push_msg.person_name)) {
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
                                                    yield this.setStateAsync(device.getStateID(types_1.CameraStateID.LAST_PERSON_IDENTIFIED), { val: !utils_1.isEmpty(push_msg.person_name) ? push_msg.person_name : "Unknown", ack: true });
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
                                        if (push_msg.push_count === 1)
                                            this._startDownload(push_msg.station_sn, push_msg.file_path, push_msg.cipher);
                                    }
                                    else {
                                        this.log.debug(`handlePushNotifications(): CusPushEvent.SECURITY - Device not found: ${push_msg.device_sn}`);
                                    }
                                    break;
                                case eufy_security_client_1.CusPushEvent.MODE_SWITCH: // Changing Guard mode event
                                    this.log.info(`Received push notification for changing guard mode (guard_mode: ${push_msg.station_guard_mode} current_mode: ${push_msg.station_current_mode}) for station ${push_msg.station_sn}}.`);
                                    const station = this.eufy.getStation(push_msg.station_sn);
                                    if (station) {
                                        if (push_msg.station_guard_mode !== undefined && push_msg.station_current_mode !== undefined) {
                                            yield utils_1.setStateChangedWithTimestamp(this, station.getStateID(types_1.StationStateID.GUARD_MODE), push_msg.station_guard_mode, push_msg.event_time);
                                            yield utils_1.setStateChangedWithTimestamp(this, station.getStateID(types_1.StationStateID.CURRENT_MODE), push_msg.station_current_mode, push_msg.event_time);
                                        }
                                        else {
                                            this.log.warn(`handlePushNotifications(): Station MODE_SWITCH event (${push_msg.event_type}): Missing required data to handle event: ${JSON.stringify(push_msg)}`);
                                        }
                                    }
                                    else {
                                        this.log.warn(`handlePushNotifications(): Station MODE_SWITCH event (${push_msg.event_type}): Station Unknown: ${push_msg.station_sn}`);
                                    }
                                    break;
                                case eufy_security_client_1.CusPushEvent.DOOR_SENSOR: // EntrySensor open/close change event
                                    device = this.eufy.getDevice(push_msg.device_sn);
                                    if (device) {
                                        yield utils_1.setStateChangedAsync(this, device.getStateID(types_1.EntrySensorStateID.SENSOR_OPEN), push_msg.sensor_open ? push_msg.sensor_open : false);
                                    }
                                    else {
                                        this.log.debug(`handlePushNotifications(): CusPushEvent.DOOR_SENSOR - Device not found: ${push_msg.device_sn}`);
                                    }
                                    break;
                                case eufy_security_client_1.CusPushEvent.MOTION_SENSOR_PIR: // MotionSensor movement detected event
                                    device = this.eufy.getDevice(push_msg.device_sn);
                                    if (device) {
                                        yield this.setStateAsync(device.getStateID(types_1.MotionSensorStateID.MOTION_DETECTED), { val: true, ack: true });
                                        if (this.motionDetected[device.getSerial()])
                                            clearTimeout(this.motionDetected[device.getSerial()]);
                                        this.motionDetected[device.getSerial()] = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                                            yield this.setStateAsync(device.getStateID(types_1.MotionSensorStateID.MOTION_DETECTED), { val: false, ack: true });
                                        }), eufy_security_client_1.MotionSensor.MOTION_COOLDOWN_MS);
                                    }
                                    else {
                                        this.log.debug(`handlePushNotifications(): CusPushEvent.MOTION_SENSOR_PIR - Device not found: ${push_msg.device_sn}`);
                                    }
                                    break;
                                default:
                                    this.log.debug(`handlePushNotifications(): Unhandled push event: ${JSON.stringify(push_msg)}`);
                                    break;
                            }
                        }
                        else {
                            this.log.warn(`handlePushNotifications(): Cus unknown push data: ${JSON.stringify(push_msg)}`);
                        }
                    }
                    else {
                        this.log.warn(`handlePushNotifications(): Unhandled push event - data: ${JSON.stringify(push_msg)}`);
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
            this.eufy.registerPushNotifications(this.getPersistentData().push_credentials, this.getPersistentData().push_persistentIds);
            Object.values(this.eufy.getStations()).forEach(function (station) {
                station.connect();
            });
        });
    }
    onDisconnect() {
        return __awaiter(this, void 0, void 0, function* () {
            this.log.silly(`onDisconnect(): `);
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
    onStartLivestream(station, device, url) {
        return __awaiter(this, void 0, void 0, function* () {
            this.log.silly(`onStartLivestream(): station: ${station.getSerial()} device: ${device.getSerial()} url: ${url}`);
            this.setStateAsync(device.getStateID(types_1.CameraStateID.LIVESTREAM), { val: url, ack: true });
        });
    }
    onStopLivestream(station, device) {
        return __awaiter(this, void 0, void 0, function* () {
            this.log.silly(`onStopLivestream(): station: ${station.getSerial()} device: ${device.getSerial()}`);
            this.delStateAsync(device.getStateID(types_1.CameraStateID.LIVESTREAM));
        });
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
