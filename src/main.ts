/*
 * Created with @iobroker/create-adapter v1.28.0
 */

import * as utils from "@iobroker/adapter-core";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { strict } from "assert";
import * as path from "path";
import * as fs from "fs";
import { Camera, Device, EntrySensor, Keypad, MotionSensor, Devices, Station, Stations, CommandType, isPrivateIp, PushMessage, Credentials, DoorbellPushEvent, IndoorPushEvent, CusPushEvent, ServerPushEvent, ParamType, GuardMode, DeviceType } from "eufy-security-client";

import * as EufySecurityAPI from "./lib/eufy-security/eufy-security";
import * as Interface from "./lib/eufy-security/interfaces"
import { CameraStateID, DeviceStateID, DoorbellStateID, EntrySensorStateID, IndoorCameraStateID, KeyPadStateID, MotionSensorStateID, StationStateID } from "./lib/eufy-security/types";
import { decrypt, generateSerialnumber, generateUDID, isEmpty, md5, saveImageStates, setStateChangedAsync, setStateChangedWithTimestamp } from "./lib/eufy-security/utils";
import { PersistentData } from "./lib/eufy-security/interfaces";

// Augment the adapter.config object with the actual types
// TODO: delete this in the next version
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace ioBroker {
        // eslint-disable-next-line @typescript-eslint/no-empty-interface
        interface AdapterConfig extends Interface.AdapterConfig{
            // Define the shape of your options here (recommended)
            // Or use a catch-all approach
            //[key: string]: any;
        }
    }
}

export class EufySecurity extends utils.Adapter {

    private eufy!: EufySecurityAPI.EufySecurity;
    private refreshTimeout?: NodeJS.Timeout;
    private personDetected: {
        [index: string]: NodeJS.Timeout;
    } = {};
    private motionDetected: {
        [index: string]: NodeJS.Timeout;
    } = {};
    private ringing: {
        [index: string]: NodeJS.Timeout;
    } = {};
    private cryingDetected: {
        [index: string]: NodeJS.Timeout;
    } = {};
    private soundDetected: {
        [index: string]: NodeJS.Timeout;
    } = {};
    private petDetected: {
        [index: string]: NodeJS.Timeout;
    } = {};

    private persistentFile: string;
    private persistentData: PersistentData = {
        api_base: "",
        cloud_token: "",
        cloud_token_expiration: 0,
        openudid: "",
        serial_number: "",
        push_credentials: undefined,
        push_persistentIds: [],
        login_hash: ""
    };

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            ...options,
            name: "eufy-security",
        });
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
    private async onReady(): Promise<void> {

        this.getForeignObject("system.config", (err, obj) => {
            if (!this.supportsFeature || !this.supportsFeature("ADAPTER_AUTO_DECRYPT_NATIVE")) {
                if (obj && obj.native && obj.native.secret) {
                    //noinspection JSUnresolvedVariable
                    this.config.password = decrypt(obj.native.secret, this.config.password);
                } else {
                    //noinspection JSUnresolvedVariable
                    this.config.password = decrypt("yx6eWMwGK2AE4k1Yoxt3E5pT", this.config.password);
                }
            }
        });

        await this.setObjectNotExistsAsync("verify_code", {
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

        // Remove old states of previous adapter versions
        try {
            const schedule_modes = await this.getStatesAsync("*.schedule_mode");
            Object.keys(schedule_modes).forEach(async id => {
                await this.delObjectAsync(id);
            });
        } catch (error) {
        }
        try {
            const push_notifications = await this.getStatesAsync("push_notification.*");
            Object.keys(push_notifications).forEach(async id => {
                await this.delObjectAsync(id);
            });
            await this.delObjectAsync("push_notification");
        } catch (error) {
        }
        try {
            const last_camera_url = await this.getStatesAsync("*.last_camera_url");
            Object.keys(last_camera_url).forEach(async id => {
                await this.delObjectAsync(id);
            });
        } catch (error) {
        }
        try {
            const captured_pic_url = await this.getStatesAsync("*.captured_pic_url");
            Object.keys(captured_pic_url).forEach(async id => {
                await this.delObjectAsync(id);
            });
        } catch (error) {
        }
        try {
            const person_identified = await this.getStatesAsync("*.person_identified");
            Object.keys(person_identified).forEach(async id => {
                await this.delObjectAsync(id);
            });
        } catch (error) {
        }
        try {
            const last_captured_pic_url = await this.getStatesAsync("*.last_captured_pic_url");
            Object.keys(last_captured_pic_url).forEach(async id => {
                await this.delObjectAsync(id);
            });
        } catch (error) {
        }
        try {
            const last_captured_pic_html = await this.getStatesAsync("*.last_captured_pic_html");
            Object.keys(last_captured_pic_html).forEach(async id => {
                await this.delObjectAsync(id);
            });
        } catch (error) {
        }
        // End

        // Reset event states if necessary (for example because of an unclean exit)
        await this.initializeEvents(CameraStateID.PERSON_DETECTED);
        await this.initializeEvents(CameraStateID.MOTION_DETECTED);
        await this.initializeEvents(DoorbellStateID.RINGING);
        await this.initializeEvents(IndoorCameraStateID.CRYING_DETECTED);
        await this.initializeEvents(IndoorCameraStateID.SOUND_DETECTED);
        await this.initializeEvents(IndoorCameraStateID.PET_DETECTED);

        try {
            if (fs.statSync(this.persistentFile).isFile()) {
                const fileContent = fs.readFileSync(this.persistentFile, "utf8");
                this.persistentData = JSON.parse(fileContent);
            }
        } catch (err) {
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
            if (md5(`${this.config.username}:${this.config.password}`) != this.persistentData.login_hash) {
                this.log.info(`Authentication properties changed, invalidate saved cloud token.`);
                this.persistentData.cloud_token = "";
                this.persistentData.cloud_token_expiration = 0;
            }
        } else {
            this.persistentData.cloud_token = "";
            this.persistentData.cloud_token_expiration = 0;
        }
        if (this.persistentData.cloud_token && this.persistentData.cloud_token != "") {
            this.log.debug(`onReady(): Load previous token: ${this.persistentData.cloud_token} token_expiration: ${this.persistentData.cloud_token_expiration}`);
            api.setToken(this.persistentData.cloud_token);
            api.setTokenExpiration(new Date(this.persistentData.cloud_token_expiration));
        }
        if (!this.persistentData.openudid || this.persistentData.openudid == "") {
            this.persistentData.openudid = generateUDID();
            this.log.debug(`onReady(): Generated new openudid: ${this.persistentData.openudid}`);

        }
        api.setOpenUDID(this.persistentData.openudid);
        if (!this.persistentData.serial_number || this.persistentData.serial_number == "") {
            this.persistentData.serial_number = generateSerialnumber(12);
            this.log.debug(`onReady(): Generated new serial_number: ${this.persistentData.serial_number}`);
        }
        api.setSerialNumber(this.persistentData.serial_number);

        await this.eufy.logon();
    }

    public writePersistentData(): void {
        this.persistentData.login_hash = md5(`${this.config.username}:${this.config.password}`);
        fs.writeFileSync(this.persistentFile, JSON.stringify(this.persistentData));
    }

    public async refreshData(adapter: EufySecurity): Promise<void> {
        adapter.log.silly(`refreshData(): pollingInterval: ${adapter.config.pollingInterval}`);
        if (adapter.eufy) {
            adapter.log.info("Refresh data from cloud and schedule next refresh.");
            await adapter.eufy.refreshData();
            adapter.refreshTimeout = setTimeout(() => { this.refreshData(adapter); }, adapter.config.pollingInterval * 60 * 1000);
        }
    }

    private async initializeEvents(state: string): Promise<void> {
        const states = await this.getStatesAsync(`*.${state}`);
        for (const id of Object.keys(states)) {
            const state = states[id];
            if (state.val === true) {
                await this.setStateAsync(id, { val: false, ack: true });
            }
        }
    }

    private async clearEvents(events: {
        [index: string]: NodeJS.Timeout;
    }, state: string): Promise<void> {
        for (const serialnr of Object.keys(events)) {
            clearTimeout(events[serialnr]);
            const states = await this.getStatesAsync(`*.${serialnr}.${state}`);
            for (const id of Object.keys(states)) {
                await this.setStateAsync(id, { val: false, ack: true });
            }
        }
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    private async onUnload(callback: () => void): Promise<void> {
        try {
            if (this.eufy)
                this.setPushPersistentIds(this.eufy.getPushPersistentIds());

            this.writePersistentData();

            if (this.refreshTimeout)
                clearTimeout(this.refreshTimeout);

            await this.clearEvents(this.personDetected, CameraStateID.PERSON_DETECTED);
            await this.clearEvents(this.motionDetected, CameraStateID.MOTION_DETECTED);
            await this.clearEvents(this.ringing, DoorbellStateID.RINGING);
            await this.clearEvents(this.cryingDetected, IndoorCameraStateID.CRYING_DETECTED);
            await this.clearEvents(this.soundDetected, IndoorCameraStateID.SOUND_DETECTED);
            await this.clearEvents(this.petDetected, IndoorCameraStateID.PET_DETECTED);

            if (this.eufy)
                this.eufy.close();

            callback();
        } catch (e) {
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
    private async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
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
                    this.eufy.logon(state.val as number);
                    await this.delStateAsync(id);
                }
            } else if (station_sn == "test_button") {
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
                    await this.eufy.getStation("T8010P23201721F8").getCameraInfo();
                    //await this.eufy.getStation("T8010P23201721F8").setGuardMode(2);
                    //await this.eufy.getStation("T8010P23201721F8").getStorageInfo();
                }
            } else if (station_sn == "test_button2") {
                //TODO: Test to remove!
                this.log.debug("TEST button2 pressed");
                if (this.eufy) {
                    try {
                        const device = this.eufy.getDevice("T8114P0220223A5A");
                        if (device)
                            //this._startDownload("T8010P23201721F8", device.getStoragePath("20201008191909"), 92);
                            this._startDownload("T8010P23201721F8", "/media/mmcblk0p1/Camera00/20210213171152.dat", 92);
                        //await this.eufy.getStation("T8010P23201721F8").startDownload(`/media/mmcblk0p1/Camera00/${20201008191909}.dat`, cipher.private_key);
                    } catch (error) {
                        this.log.error(error);
                    }
                    //await this.eufy.getStation("T8010P23201721F8").startDownload("/media/mmcblk0p1/Camera01/20210111071357.dat");
                    //await this.eufy.getStation("T8010P23201721F8").setStatusLed(this.eufy.getDevice("T8114P022022261F"), false);
                    //await this.eufy.getStation("T8010P23201721F8").stopLivestream(this.eufy.getDevice("T8114P022022261F"));
                    //await this.eufy.getStation("T8010P23201721F8").stopLivestream(this.eufy.getDevice("T8114P0220223A5A"));
                }
            } else if (device_type == "cameras") {
                try {
                    const device_sn = values[4];
                    const device_state_name = values[5];
                    const station = this.eufy.getStation(station_sn);
                    const device = this.eufy.getDevice(device_sn);

                    if (this.eufy) {
                        switch(device_state_name) {
                            case CameraStateID.START_STREAM:
                                this.eufy.startLivestream(device_sn);
                                break;

                            case CameraStateID.STOP_STREAM:
                                this.eufy.stopLivestream(device_sn);
                                break;

                            case CameraStateID.LED_STATUS:
                                if (device && state.val !== null)
                                    station.setStatusLed(device, state.val as boolean);
                                break;

                            case CameraStateID.ENABLED:
                                if (device && state.val !== null)
                                    station.enableDevice(device, state.val as boolean);
                                break;

                            case CameraStateID.ANTITHEFT_DETECTION:
                                if (device && state.val !== null)
                                    station.setAntiTheftDetection(device, state.val as boolean);
                                break;

                            case CameraStateID.AUTO_NIGHTVISION:
                                if (device && state.val !== null)
                                    station.setAutoNightVision(device, state.val as boolean);
                                break;

                            case CameraStateID.WATERMARK:
                                if (device && state.val !== null)
                                    station.setWatermark(device, state.val as number);
                                break;
                        }
                    }
                } catch (error) {
                    this.log.error(`onStateChange(): cameras - Error: ${error}`);
                }
            } else if (device_type == "station") {
                const station_state_name = values[4];
                if (this.eufy) {
                    const station = this.eufy.getStation(station_sn);
                    switch(station_state_name) {
                        case StationStateID.GUARD_MODE:
                            await station.setGuardMode(<GuardMode>state.val);
                            break;
                        case StationStateID.REBOOT:
                            await station.rebootHUB();
                            break;
                    }
                }
            }
        } else {
            // The state was deleted
            this.log.debug(`state ${id} deleted`);
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

    private async handleDevices(devices: Devices): Promise<void> {
        this.log.debug(`handleDevices(): count: ${Object.keys(devices).length}`);

        Object.values(devices).forEach(async device => {

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

            // Name
            await this.setObjectNotExistsAsync(device.getStateID(DeviceStateID.NAME), {
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
            await setStateChangedAsync(this, device.getStateID(DeviceStateID.NAME), device.getName());

            // Model
            await this.setObjectNotExistsAsync(device.getStateID(DeviceStateID.MODEL), {
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
            await setStateChangedAsync(this, device.getStateID(DeviceStateID.MODEL), device.getModel());

            // Serial
            await this.setObjectNotExistsAsync(device.getStateID(DeviceStateID.SERIAL_NUMBER), {
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
            await setStateChangedAsync(this, device.getStateID(DeviceStateID.SERIAL_NUMBER), device.getSerial());

            // Software version
            await this.setObjectNotExistsAsync(device.getStateID(DeviceStateID.SOFTWARE_VERSION), {
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
            await setStateChangedAsync(this, device.getStateID(DeviceStateID.SOFTWARE_VERSION), device.getSoftwareVersion());

            // Hardware version
            await this.setObjectNotExistsAsync(device.getStateID(DeviceStateID.HARDWARE_VERSION), {
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
            await setStateChangedAsync(this, device.getStateID(DeviceStateID.HARDWARE_VERSION), device.getHardwareVersion());

            if (device.isCamera()) {

                const camera = device as Camera;

                // State
                await this.setObjectNotExistsAsync(camera.getStateID(CameraStateID.STATE), {
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
                    await setStateChangedWithTimestamp(this, camera.getStateID(CameraStateID.STATE), Number.parseInt(camera.getParameter(CommandType.CMD_GET_DEV_STATUS).value), camera.getParameter(CommandType.CMD_GET_DEV_STATUS).modified);
                } catch(error) {
                }

                // Mac address
                await this.setObjectNotExistsAsync(camera.getStateID(CameraStateID.MAC_ADDRESS), {
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
                await setStateChangedAsync(this, camera.getStateID(CameraStateID.MAC_ADDRESS), camera.getMACAddress());

                // Last event picture
                await saveImageStates(this, camera.getLastCameraImageURL(), camera.getLastCameraImageTimestamp(), camera.getSerial(), camera.getStateID(CameraStateID.LAST_EVENT_PICTURE_URL),camera.getStateID(CameraStateID.LAST_EVENT_PICTURE_HTML), "Last event picture").catch(() => {
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
                await this.setObjectNotExistsAsync(camera.getStateID(CameraStateID.START_STREAM), {
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
                await this.setObjectNotExistsAsync(camera.getStateID(CameraStateID.STOP_STREAM), {
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
                await this.setObjectNotExistsAsync(camera.getStateID(CameraStateID.LIVESTREAM), {
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
                await this.setObjectNotExistsAsync(camera.getStateID(CameraStateID.LAST_LIVESTREAM_VIDEO_URL), {
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
                await this.setObjectNotExistsAsync(camera.getStateID(CameraStateID.LAST_LIVESTREAM_PIC_URL), {
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
                await this.setObjectNotExistsAsync(camera.getStateID(CameraStateID.LAST_LIVESTREAM_PIC_HTML), {
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
                await this.setObjectNotExistsAsync(camera.getStateID(CameraStateID.ENABLED), {
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
                await setStateChangedAsync(this, camera.getStateID(CameraStateID.ENABLED), camera.isEnabled());

                // Watermark
                let watermark_state: Record<string, string> = {
                    0: "OFF",
                    1: "TIMESTAMP",
                    2: "TIMESTAMP_AND_LOGO"
                };
                if (camera.getDeviceType() === DeviceType.DOORBELL || camera.isSoloCameras()) {
                    watermark_state = {
                        0: "OFF",
                        1: "TIMESTAMP"
                    };
                } else if (camera.isBatteryDoorbell() || camera.isBatteryDoorbell2() || camera.getDeviceType() === DeviceType.CAMERA || camera.getDeviceType() === DeviceType.CAMERA_E) {
                    watermark_state = {
                        1: "ON",
                        2: "OFF"
                    };
                }
                await this.setObjectNotExistsAsync(camera.getStateID(CameraStateID.WATERMARK), {
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
                    await setStateChangedWithTimestamp(this, camera.getStateID(CameraStateID.WATERMARK), Number.parseInt(camera.getParameter(CommandType.CMD_SET_DEVS_OSD).value), camera.getParameter(CommandType.CMD_SET_DEVS_OSD).modified);
                } catch (error) {
                }

                if (camera.isCamera2Product()) {
                    // Antitheft detection
                    await this.setObjectNotExistsAsync(camera.getStateID(CameraStateID.ANTITHEFT_DETECTION), {
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
                        await setStateChangedWithTimestamp(this, camera.getStateID(CameraStateID.ANTITHEFT_DETECTION), camera.getParameter(CommandType.CMD_EAS_SWITCH).value === "1" ? true : false, camera.getParameter(CommandType.CMD_EAS_SWITCH).modified);
                    } catch (error) {
                    }
                }

                // Auto Nightvision
                await this.setObjectNotExistsAsync(camera.getStateID(CameraStateID.AUTO_NIGHTVISION), {
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
                    await setStateChangedWithTimestamp(this, camera.getStateID(CameraStateID.AUTO_NIGHTVISION), camera.getParameter(CommandType.CMD_IRCUT_SWITCH).value === "1" ? true : false, camera.getParameter(CommandType.CMD_IRCUT_SWITCH).modified);
                } catch (error) {
                }

                if (camera.isCamera2Product() || camera.isIndoorCamera() || camera.isSoloCameras() || camera.isFloodLight()) {
                    // LED Status
                    await this.setObjectNotExistsAsync(camera.getStateID(CameraStateID.LED_STATUS), {
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
                        await setStateChangedWithTimestamp(this, camera.getStateID(CameraStateID.LED_STATUS), camera.getParameter(CommandType.CMD_DEV_LED_SWITCH).value === "1" ? true : false, camera.getParameter(CommandType.CMD_DEV_LED_SWITCH).modified);
                    } catch (error) {
                    }
                }

                // Battery
                if (camera.hasBattery()) {
                    await this.setObjectNotExistsAsync(camera.getStateID(CameraStateID.BATTERY), {
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
                        await setStateChangedWithTimestamp(this, camera.getStateID(CameraStateID.BATTERY), Number.parseInt(camera.getParameter(CommandType.CMD_GET_BATTERY).value), camera.getParameter(CommandType.CMD_GET_BATTERY).modified);
                    } catch (error) {
                    }

                    await this.setObjectNotExistsAsync(camera.getStateID(CameraStateID.BATTERY_TEMPERATURE), {
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
                        await setStateChangedWithTimestamp(this, camera.getStateID(CameraStateID.BATTERY_TEMPERATURE), Number.parseInt(camera.getParameter(CommandType.CMD_GET_BATTERY_TEMP).value), camera.getParameter(CommandType.CMD_GET_BATTERY_TEMP).modified);
                    } catch (error) {
                    }

                    // Last Charge Used Days
                    await this.setObjectNotExistsAsync(camera.getStateID(CameraStateID.LAST_CHARGE_USED_DAYS), {
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
                    await setStateChangedAsync(this, camera.getStateID(CameraStateID.LAST_CHARGE_USED_DAYS), camera.getLastChargingDays());

                    // Last Charge Total Events
                    await this.setObjectNotExistsAsync(camera.getStateID(CameraStateID.LAST_CHARGE_TOTAL_EVENTS), {
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
                    await setStateChangedAsync(this, camera.getStateID(CameraStateID.LAST_CHARGE_TOTAL_EVENTS), camera.getLastChargingTotalEvents());

                    // Last Charge Saved Events
                    await this.setObjectNotExistsAsync(camera.getStateID(CameraStateID.LAST_CHARGE_SAVED_EVENTS), {
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
                    await setStateChangedAsync(this, camera.getStateID(CameraStateID.LAST_CHARGE_SAVED_EVENTS), camera.getLastChargingRecordedEvents());

                    // Last Charge Filtered Events
                    await this.setObjectNotExistsAsync(camera.getStateID(CameraStateID.LAST_CHARGE_FILTERED_EVENTS), {
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
                    await setStateChangedAsync(this, camera.getStateID(CameraStateID.LAST_CHARGE_FILTERED_EVENTS), camera.getLastChargingFalseEvents());
                }

                // Wifi RSSI
                await this.setObjectNotExistsAsync(camera.getStateID(CameraStateID.WIFI_RSSI), {
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
                    await setStateChangedWithTimestamp(this, camera.getStateID(CameraStateID.WIFI_RSSI), Number.parseInt(camera.getParameter(CommandType.CMD_GET_WIFI_RSSI).value), camera.getParameter(CommandType.CMD_GET_WIFI_RSSI).modified);
                } catch (error) {
                }

                // Motion detected
                await this.setObjectNotExistsAsync(camera.getStateID(CameraStateID.MOTION_DETECTED), {
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
                await this.setObjectNotExistsAsync(camera.getStateID(CameraStateID.PERSON_DETECTED), {
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
                await this.setObjectNotExistsAsync(camera.getStateID(CameraStateID.LAST_PERSON_IDENTIFIED), {
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
                    await this.setObjectNotExistsAsync(camera.getStateID(DoorbellStateID.RINGING), {
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
                } else if (camera.isIndoorCamera()) {
                    // Crying detected event
                    await this.setObjectNotExistsAsync(camera.getStateID(IndoorCameraStateID.CRYING_DETECTED), {
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
                    await this.setObjectNotExistsAsync(camera.getStateID(IndoorCameraStateID.SOUND_DETECTED), {
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
                    await this.setObjectNotExistsAsync(camera.getStateID(IndoorCameraStateID.PET_DETECTED), {
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
            } else if (device.isEntrySensor()) {
                const sensor = device as EntrySensor;

                // State
                await this.setObjectNotExistsAsync(sensor.getStateID(EntrySensorStateID.STATE), {
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
                    await setStateChangedWithTimestamp(this, sensor.getStateID(EntrySensorStateID.STATE), Number.parseInt(sensor.getParameter(CommandType.CMD_GET_DEV_STATUS).value), sensor.getParameter(CommandType.CMD_GET_DEV_STATUS).modified);
                } catch (error) {
                }

                // Sensor Open
                await this.setObjectNotExistsAsync(sensor.getStateID(EntrySensorStateID.SENSOR_OPEN), {
                    type: "state",
                    common: {
                        name: "Sensor open",
                        type: "boolean",
                        role: "state",  //TODO: check correct role!
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                if (sensor.getParameter(CommandType.CMD_ENTRY_SENSOR_STATUS))
                    await setStateChangedWithTimestamp(this, sensor.getStateID(EntrySensorStateID.SENSOR_OPEN), sensor.getParameter(CommandType.CMD_ENTRY_SENSOR_STATUS).value === "1", sensor.getParameter(CommandType.CMD_ENTRY_SENSOR_STATUS).modified);

                // Low Battery
                await this.setObjectNotExistsAsync(sensor.getStateID(EntrySensorStateID.LOW_BATTERY), {
                    type: "state",
                    common: {
                        name: "Low Battery",
                        type: "boolean",
                        role: "state",  //TODO: check correct role!
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                if (sensor.getParameter(CommandType.CMD_ENTRY_SENSOR_BAT_STATE))
                    await setStateChangedWithTimestamp(this, sensor.getStateID(EntrySensorStateID.LOW_BATTERY), sensor.getParameter(CommandType.CMD_ENTRY_SENSOR_BAT_STATE).value === "1", sensor.getParameter(CommandType.CMD_ENTRY_SENSOR_BAT_STATE).modified);

                // Sensor change time
                await this.setObjectNotExistsAsync(sensor.getStateID(EntrySensorStateID.SENSOR_CHANGE_TIME), {
                    type: "state",
                    common: {
                        name: "Sensor change time",
                        type: "string",
                        role: "state",  //TODO: check correct role!
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                if (sensor.getParameter(CommandType.CMD_ENTRY_SENSOR_CHANGE_TIME))
                    await setStateChangedWithTimestamp(this, sensor.getStateID(EntrySensorStateID.SENSOR_CHANGE_TIME), sensor.getParameter(CommandType.CMD_ENTRY_SENSOR_CHANGE_TIME).value, sensor.getParameter(CommandType.CMD_ENTRY_SENSOR_CHANGE_TIME).modified);

            } else if (device.isMotionSensor()) {
                const sensor = device as MotionSensor;

                // State
                await this.setObjectNotExistsAsync(sensor.getStateID(MotionSensorStateID.STATE), {
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
                    await setStateChangedWithTimestamp(this, sensor.getStateID(MotionSensorStateID.STATE), Number.parseInt(sensor.getParameter(CommandType.CMD_GET_DEV_STATUS).value), sensor.getParameter(CommandType.CMD_GET_DEV_STATUS).modified);
                } catch (error) {
                }

                // Low Battery
                await this.setObjectNotExistsAsync(sensor.getStateID(MotionSensorStateID.LOW_BATTERY), {
                    type: "state",
                    common: {
                        name: "Low Battery",
                        type: "boolean",
                        role: "state",  //TODO: check correct role!
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                if (sensor.getParameter(CommandType.CMD_MOTION_SENSOR_BAT_STATE))
                    await setStateChangedWithTimestamp(this, sensor.getStateID(MotionSensorStateID.LOW_BATTERY), sensor.getParameter(CommandType.CMD_MOTION_SENSOR_BAT_STATE).value === "1", sensor.getParameter(CommandType.CMD_MOTION_SENSOR_BAT_STATE).modified);

                // Motion detected
                await this.setObjectNotExistsAsync(sensor.getStateID(MotionSensorStateID.MOTION_DETECTED), {
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
            } else if (device.isKeyPad()) {
                const keypad = device as Keypad;

                // State
                await this.setObjectNotExistsAsync(keypad.getStateID(KeyPadStateID.STATE), {
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
                    await setStateChangedWithTimestamp(this, keypad.getStateID(KeyPadStateID.STATE), Number.parseInt(keypad.getParameter(CommandType.CMD_GET_DEV_STATUS).value), keypad.getParameter(CommandType.CMD_GET_DEV_STATUS).modified);
                } catch (error) {
                }

                // Low Battery
                await this.setObjectNotExistsAsync(keypad.getStateID(KeyPadStateID.LOW_BATTERY), {
                    type: "state",
                    common: {
                        name: "Low Battery",
                        type: "boolean",
                        role: "state",  //TODO: check correct role!
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                if (keypad.getParameter(CommandType.CMD_KEYPAD_BATTERY_CAP_STATE))
                    await setStateChangedWithTimestamp(this, keypad.getStateID(KeyPadStateID.LOW_BATTERY), keypad.getParameter(CommandType.CMD_KEYPAD_BATTERY_CAP_STATE).value === "1", keypad.getParameter(CommandType.CMD_KEYPAD_BATTERY_CAP_STATE).modified);
            }
        });
    }

    private async handleStations(stations: Stations): Promise<void> {
        this.log.debug(`handleStations(): count: ${Object.keys(stations).length}`);

        Object.values(stations).forEach(async station => {
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

            // Station info
            // Name
            await this.setObjectNotExistsAsync(station.getStateID(StationStateID.NAME), {
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
            await setStateChangedAsync(this, station.getStateID(StationStateID.NAME), station.getName());

            // Model
            await this.setObjectNotExistsAsync(station.getStateID(StationStateID.MODEL), {
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
            await setStateChangedAsync(this, station.getStateID(StationStateID.MODEL), station.getModel());

            // Serial
            await this.setObjectNotExistsAsync(station.getStateID(StationStateID.SERIAL_NUMBER), {
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
            await setStateChangedAsync(this, station.getStateID(StationStateID.SERIAL_NUMBER), station.getSerial());

            // Software version
            await this.setObjectNotExistsAsync(station.getStateID(StationStateID.SOFTWARE_VERSION), {
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
            await setStateChangedAsync(this, station.getStateID(StationStateID.SOFTWARE_VERSION), station.getSoftwareVersion());

            // Hardware version
            await this.setObjectNotExistsAsync(station.getStateID(StationStateID.HARDWARE_VERSION), {
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
            await setStateChangedAsync(this, station.getStateID(StationStateID.HARDWARE_VERSION), station.getHardwareVersion());

            // MAC Address
            await this.setObjectNotExistsAsync(station.getStateID(StationStateID.MAC_ADDRESS), {
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
            await setStateChangedAsync(this, station.getStateID(StationStateID.MAC_ADDRESS), station.getMACAddress());

            // LAN IP Address
            await this.setObjectNotExistsAsync(station.getStateID(StationStateID.LAN_IP_ADDRESS), {
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
            const lan_ip_address = station.getParameter(CommandType.CMD_GET_HUB_LAN_IP);
            if (lan_ip_address && isPrivateIp(lan_ip_address.value))
                await setStateChangedWithTimestamp(this, station.getStateID(StationStateID.LAN_IP_ADDRESS), lan_ip_address.value, lan_ip_address.modified);

            // Station Paramters
            // Guard Mode
            await this.setObjectNotExistsAsync(station.getStateID(StationStateID.GUARD_MODE), {
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
            const guard_mode = station.getParameter(ParamType.GUARD_MODE);
            try {
                await setStateChangedWithTimestamp(this, station.getStateID(StationStateID.GUARD_MODE), Number.parseInt(guard_mode.value), guard_mode.modified);
            } catch (error) {
                this.log.error(`handleStations(): GUARD_MODE - Error: ${error}`);
            }

            // Current Alarm Mode
            await this.setObjectNotExistsAsync(station.getStateID(StationStateID.CURRENT_MODE), {
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
                const schedule_mode = station.getParameter(ParamType.SCHEDULE_MODE);
                if (schedule_mode && guard_mode)
                    await setStateChangedWithTimestamp(this, station.getStateID(StationStateID.CURRENT_MODE), guard_mode.value === "2" ? Number.parseInt(schedule_mode.value) : Number.parseInt(guard_mode.value), guard_mode.value === "2" ? station.getParameter(ParamType.SCHEDULE_MODE).modified : guard_mode.modified);
            } catch (error) {
                this.log.error(`handleStations(): CURRENT_MODE - Error: ${error}`);
            }

            // Reboot station
            await this.setObjectNotExistsAsync(station.getStateID(StationStateID.REBOOT), {
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

        });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private _startDownload(station_sn: string, full_path: string | undefined, cipher_id: number | undefined): void {
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

    private async handlePushNotification(push_msg: PushMessage): Promise<void> {
        try {
            this.log.debug(`handlePushNotifications(): push_msg: ${JSON.stringify(push_msg)}`);

            if (push_msg.type) {
                if (push_msg.type == ServerPushEvent.VERIFICATION) {
                    this.log.debug(`handlePushNotifications(): Received push verification event: ${JSON.stringify(push_msg)}`);
                } else if (Device.isDoorbell(push_msg.type)) {
                    const device: Device | null = this.eufy.getDevice(push_msg.device_sn);
                    if (device) {
                        switch (push_msg.event_type) {
                            case DoorbellPushEvent.MOTION_DETECTION:
                                if (!isEmpty(push_msg.pic_url)) {
                                    await this.setStateAsync(device.getStateID(DoorbellStateID.MOTION_DETECTED), { val: true, ack: true });
                                    await saveImageStates(this, push_msg.pic_url!, push_msg.event_time, device.getSerial(), device.getStateID(DoorbellStateID.LAST_EVENT_PICTURE_URL), device.getStateID(DoorbellStateID.LAST_EVENT_PICTURE_HTML), "Last captured picture", "last_captured_").catch(() => {
                                        this.log.error(`handlePushNotifications(): DoorbellPushEvent.MOTION_DETECTION of device ${device.getSerial()} - saveImageStates(): url ${push_msg.pic_url}`);
                                    });

                                    if (this.motionDetected[device.getSerial()])
                                        clearTimeout(this.motionDetected[device.getSerial()]);
                                    this.motionDetected[device.getSerial()] = setTimeout(async () => {
                                        await this.setStateAsync(device.getStateID(DoorbellStateID.MOTION_DETECTED), { val: false, ack: true });
                                    }, this.config.eventDuration * 1000);
                                } else {
                                    await this.setStateAsync(device.getStateID(DoorbellStateID.MOTION_DETECTED), { val: true, ack: true });
                                    if (this.motionDetected[device.getSerial()])
                                        clearTimeout(this.motionDetected[device.getSerial()]);
                                    this.motionDetected[device.getSerial()] = setTimeout(async () => {
                                        await this.setStateAsync(device.getStateID(DoorbellStateID.MOTION_DETECTED), { val: false, ack: true });
                                    }, this.config.eventDuration * 1000);
                                }
                                if (push_msg.push_count === 1)
                                    this._startDownload(push_msg.station_sn, push_msg.file_path, push_msg.cipher);
                                break;
                            case DoorbellPushEvent.FACE_DETECTION:
                                if (!isEmpty(push_msg.pic_url)) {
                                    await this.setStateAsync(device.getStateID(DoorbellStateID.PERSON_DETECTED), { val: true, ack: true });
                                    await saveImageStates(this, push_msg.pic_url!, push_msg.event_time, device.getSerial(), device.getStateID(DoorbellStateID.LAST_EVENT_PICTURE_URL), device.getStateID(DoorbellStateID.LAST_EVENT_PICTURE_HTML), "Last captured picture", "last_captured_").catch(() => {
                                        this.log.error(`handlePushNotifications(): DoorbellPushEvent.FACE_DETECTION of device ${device.getSerial()} - saveImageStates(): url ${push_msg.pic_url}`);
                                    });

                                    await this.setStateAsync(device.getStateID(DoorbellStateID.LAST_PERSON_IDENTIFIED), { val: "Unknown", ack: true });
                                    if (this.personDetected[device.getSerial()])
                                        clearTimeout(this.personDetected[device.getSerial()]);
                                    this.personDetected[device.getSerial()] = setTimeout(async () => {
                                        await this.setStateAsync(device.getStateID(DoorbellStateID.PERSON_DETECTED), { val: false, ack: true });
                                    }, this.config.eventDuration * 1000);
                                } else {
                                    await this.setStateAsync(device.getStateID(DoorbellStateID.PERSON_DETECTED), { val: true, ack: true });
                                    await this.setStateAsync(device.getStateID(DoorbellStateID.LAST_PERSON_IDENTIFIED), { val: "Unknown", ack: true });
                                    if (this.personDetected[device.getSerial()])
                                        clearTimeout(this.personDetected[device.getSerial()]);
                                    this.personDetected[device.getSerial()] = setTimeout(async () => {
                                        await this.setStateAsync(device.getStateID(DoorbellStateID.PERSON_DETECTED), { val: false, ack: true });
                                    }, this.config.eventDuration * 1000);
                                }
                                if (push_msg.push_count === 1)
                                    this._startDownload(push_msg.station_sn, push_msg.file_path, push_msg.cipher);
                                break;
                            case DoorbellPushEvent.PRESS_DOORBELL:
                                await this.setStateAsync(device.getStateID(DoorbellStateID.RINGING), { val: true, ack: true });
                                if (this.ringing[device.getSerial()])
                                    clearTimeout(this.ringing[device.getSerial()]);
                                this.ringing[device.getSerial()] = setTimeout(async () => {
                                    await this.setStateAsync(device.getStateID(DoorbellStateID.RINGING), { val: false, ack: true });
                                }, this.config.eventDuration * 1000);
                                break;
                            default:
                                this.log.debug(`handlePushNotifications(): Unhandled doorbell push event: ${JSON.stringify(push_msg)}`);
                                break;
                        }
                    } else {
                        this.log.debug(`handlePushNotifications(): DoorbellPushEvent - Device not found: ${push_msg.device_sn}`);
                    }
                } else if (Device.isIndoorCamera(push_msg.type)) {
                    const device = this.eufy.getDevice(push_msg.device_sn);

                    if (device) {
                        switch (push_msg.event_type) {
                            case IndoorPushEvent.MOTION_DETECTION:
                                if (!isEmpty(push_msg.pic_url)) {
                                    await this.setStateAsync(device.getStateID(IndoorCameraStateID.MOTION_DETECTED), { val: true, ack: true });
                                    await saveImageStates(this, push_msg.pic_url!, push_msg.event_time, device.getSerial(), device.getStateID(IndoorCameraStateID.LAST_EVENT_PICTURE_URL), device.getStateID(IndoorCameraStateID.LAST_EVENT_PICTURE_HTML), "Last captured picture", "last_captured_").catch(() => {
                                        this.log.error(`handlePushNotifications(): IndoorPushEvent.MOTION_DETECTION of device ${device.getSerial()} - saveImageStates(): url ${push_msg.pic_url}`);
                                    });
                                    if (this.motionDetected[device.getSerial()])
                                        clearTimeout(this.motionDetected[device.getSerial()]);
                                    this.motionDetected[device.getSerial()] = setTimeout(async () => {
                                        await this.setStateAsync(device.getStateID(IndoorCameraStateID.MOTION_DETECTED), { val: false, ack: true });
                                    }, this.config.eventDuration * 1000);
                                } else {
                                    await this.setStateAsync(device.getStateID(IndoorCameraStateID.MOTION_DETECTED), { val: true, ack: true });
                                    if (this.motionDetected[device.getSerial()])
                                        clearTimeout(this.motionDetected[device.getSerial()]);
                                    this.motionDetected[device.getSerial()] = setTimeout(async () => {
                                        await this.setStateAsync(device.getStateID(IndoorCameraStateID.MOTION_DETECTED), { val: false, ack: true });
                                    }, this.config.eventDuration * 1000);
                                }
                                if (push_msg.push_count === 1)
                                    this._startDownload(push_msg.station_sn, push_msg.file_path, push_msg.cipher);
                                break;
                            case IndoorPushEvent.FACE_DETECTION:
                                if (!isEmpty(push_msg.pic_url)) {
                                    await this.setStateAsync(device.getStateID(IndoorCameraStateID.PERSON_DETECTED), { val: true, ack: true });
                                    await saveImageStates(this, push_msg.pic_url!, push_msg.event_time, device.getSerial(), device.getStateID(IndoorCameraStateID.LAST_EVENT_PICTURE_URL), device.getStateID(IndoorCameraStateID.LAST_EVENT_PICTURE_HTML), "Last captured picture", "last_captured_").catch(() => {
                                        this.log.error(`handlePushNotifications(): IndoorPushEvent.FACE_DETECTION of device ${device.getSerial()} - saveImageStates(): url ${push_msg.pic_url}`);
                                    });
                                    await this.setStateAsync(device.getStateID(IndoorCameraStateID.LAST_PERSON_IDENTIFIED), { val: "Unknown", ack: true });
                                    if (this.personDetected[device.getSerial()])
                                        clearTimeout(this.personDetected[device.getSerial()]);
                                    this.personDetected[device.getSerial()] = setTimeout(async () => {
                                        await this.setStateAsync(device.getStateID(IndoorCameraStateID.PERSON_DETECTED), { val: false, ack: true });
                                    }, this.config.eventDuration * 1000);
                                } else {
                                    await this.setStateAsync(device.getStateID(IndoorCameraStateID.PERSON_DETECTED), { val: true, ack: true });
                                    await this.setStateAsync(device.getStateID(IndoorCameraStateID.LAST_PERSON_IDENTIFIED), { val: "Unknown", ack: true });
                                    if (this.personDetected[device.getSerial()])
                                        clearTimeout(this.personDetected[device.getSerial()]);
                                    this.personDetected[device.getSerial()] = setTimeout(async () => {
                                        await this.setStateAsync(device.getStateID(IndoorCameraStateID.PERSON_DETECTED), { val: false, ack: true });
                                    }, this.config.eventDuration * 1000);
                                }
                                if (push_msg.push_count === 1)
                                    this._startDownload(push_msg.station_sn, push_msg.file_path, push_msg.cipher);
                                break;
                            case IndoorPushEvent.CRYIG_DETECTION:
                                if (!isEmpty(push_msg.pic_url)) {
                                    await this.setStateAsync(device.getStateID(IndoorCameraStateID.CRYING_DETECTED), { val: true, ack: true });
                                    await saveImageStates(this, push_msg.pic_url!, push_msg.event_time, device.getSerial(), device.getStateID(IndoorCameraStateID.LAST_EVENT_PICTURE_URL), device.getStateID(IndoorCameraStateID.LAST_EVENT_PICTURE_HTML), "Last captured picture", "last_captured_").catch(() => {
                                        this.log.error(`handlePushNotifications(): IndoorPushEvent.CRYIG_DETECTION of device ${device.getSerial()} - saveImageStates(): url ${push_msg.pic_url}`);
                                    });
                                    if (this.cryingDetected[device.getSerial()])
                                        clearTimeout(this.cryingDetected[device.getSerial()]);
                                    this.cryingDetected[device.getSerial()] = setTimeout(async () => {
                                        await this.setStateAsync(device.getStateID(IndoorCameraStateID.CRYING_DETECTED), { val: false, ack: true });
                                    }, this.config.eventDuration * 1000);
                                } else {
                                    await this.setStateAsync(device.getStateID(IndoorCameraStateID.CRYING_DETECTED), { val: true, ack: true });
                                    if (this.cryingDetected[device.getSerial()])
                                        clearTimeout(this.cryingDetected[device.getSerial()]);
                                    this.cryingDetected[device.getSerial()] = setTimeout(async () => {
                                        await this.setStateAsync(device.getStateID(IndoorCameraStateID.CRYING_DETECTED), { val: false, ack: true });
                                    }, this.config.eventDuration * 1000);
                                }
                                if (push_msg.push_count === 1)
                                    this._startDownload(push_msg.station_sn, push_msg.file_path, push_msg.cipher);
                                break;
                            case IndoorPushEvent.SOUND_DETECTION:
                                if (!isEmpty(push_msg.pic_url)) {
                                    await this.setStateAsync(device.getStateID(IndoorCameraStateID.SOUND_DETECTED), { val: true, ack: true });
                                    await saveImageStates(this, push_msg.pic_url!, push_msg.event_time, device.getSerial(), device.getStateID(IndoorCameraStateID.LAST_EVENT_PICTURE_URL), device.getStateID(IndoorCameraStateID.LAST_EVENT_PICTURE_HTML), "Last captured picture", "last_captured_").catch(() => {
                                        this.log.error(`handlePushNotifications(): IndoorPushEvent.SOUND_DETECTION of device ${device.getSerial()} - saveImageStates(): url ${push_msg.pic_url}`);
                                    });
                                    if (this.soundDetected[device.getSerial()])
                                        clearTimeout(this.soundDetected[device.getSerial()]);
                                    this.soundDetected[device.getSerial()] = setTimeout(async () => {
                                        await this.setStateAsync(device.getStateID(IndoorCameraStateID.SOUND_DETECTED), { val: false, ack: true });
                                    }, this.config.eventDuration * 1000);
                                } else {
                                    await this.setStateAsync(device.getStateID(IndoorCameraStateID.SOUND_DETECTED), { val: true, ack: true });
                                    if (this.soundDetected[device.getSerial()])
                                        clearTimeout(this.soundDetected[device.getSerial()]);
                                    this.soundDetected[device.getSerial()] = setTimeout(async () => {
                                        await this.setStateAsync(device.getStateID(IndoorCameraStateID.SOUND_DETECTED), { val: false, ack: true });
                                    }, this.config.eventDuration * 1000);
                                }
                                if (push_msg.push_count === 1)
                                    this._startDownload(push_msg.station_sn, push_msg.file_path, push_msg.cipher);
                                break;
                            case IndoorPushEvent.PET_DETECTION:
                                if (!isEmpty(push_msg.pic_url)) {
                                    await this.setStateAsync(device.getStateID(IndoorCameraStateID.PET_DETECTED), { val: true, ack: true });
                                    await saveImageStates(this, push_msg.pic_url!, push_msg.event_time, device.getSerial(), device.getStateID(IndoorCameraStateID.LAST_EVENT_PICTURE_URL), device.getStateID(IndoorCameraStateID.LAST_EVENT_PICTURE_HTML), "Last captured picture", "last_captured_").catch(() => {
                                        this.log.error(`handlePushNotifications(): IndoorPushEvent.PET_DETECTION of device ${device.getSerial()} - saveImageStates(): url ${push_msg.pic_url}`);
                                    });
                                    if (this.petDetected[device.getSerial()])
                                        clearTimeout(this.petDetected[device.getSerial()]);
                                    this.petDetected[device.getSerial()] = setTimeout(async () => {
                                        await this.setStateAsync(device.getStateID(IndoorCameraStateID.PET_DETECTED), { val: false, ack: true });
                                    }, this.config.eventDuration * 1000);
                                } else {
                                    await this.setStateAsync(device.getStateID(IndoorCameraStateID.PET_DETECTED), { val: true, ack: true });
                                    if (this.petDetected[device.getSerial()])
                                        clearTimeout(this.petDetected[device.getSerial()]);
                                    this.petDetected[device.getSerial()] = setTimeout(async () => {
                                        await this.setStateAsync(device.getStateID(IndoorCameraStateID.PET_DETECTED), { val: false, ack: true });
                                    }, this.config.eventDuration * 1000);
                                }
                                if (push_msg.push_count === 1)
                                    this._startDownload(push_msg.station_sn, push_msg.file_path, push_msg.cipher);
                                break;
                            default:
                                this.log.debug(`handlePushNotifications(): Unhandled indoor camera push event: ${JSON.stringify(push_msg)}`);
                                break;
                        }
                    } else {
                        this.log.debug(`handlePushNotifications(): IndoorPushEvent - Device not found: ${push_msg.device_sn}`);
                    }
                } else if (push_msg.type) {
                    if (push_msg.event_type) {
                        let device: Device | null;
                        switch (push_msg.event_type) {
                            case CusPushEvent.SECURITY: // Cam movement detected event
                                device = this.eufy.getDevice(push_msg.device_sn);

                                if (device) {
                                    if (push_msg.fetch_id) {
                                        if (!isEmpty(push_msg.pic_url)) {
                                            await saveImageStates(this, push_msg.pic_url!, push_msg.event_time, device.getSerial(), device.getStateID(CameraStateID.LAST_EVENT_PICTURE_URL), device.getStateID(CameraStateID.LAST_EVENT_PICTURE_HTML), "Last captured picture", "last_captured_").catch(() => {
                                                this.log.error(`handlePushNotifications(): CusPushEvent.SECURITY of device ${device!.getSerial()} - saveImageStates(): url ${push_msg.pic_url}`);
                                            });
                                            if (isEmpty(push_msg.person_name)) {
                                                // Someone spotted
                                                await this.setStateAsync(device.getStateID(CameraStateID.PERSON_DETECTED), { val: true, ack: true });
                                                await this.setStateAsync(device.getStateID(CameraStateID.LAST_PERSON_IDENTIFIED), { val: "Unknown", ack: true });
                                                if (this.personDetected[device.getSerial()])
                                                    clearTimeout(this.personDetected[device.getSerial()]);
                                                this.personDetected[device.getSerial()] = setTimeout(async () => {
                                                    await this.setStateAsync(device!.getStateID(CameraStateID.PERSON_DETECTED), { val: false, ack: true });
                                                }, this.config.eventDuration * 1000);
                                            } else {
                                                // Person identified
                                                await this.setStateAsync(device.getStateID(CameraStateID.PERSON_DETECTED), { val: true, ack: true });
                                                await this.setStateAsync(device.getStateID(CameraStateID.LAST_PERSON_IDENTIFIED), { val: !isEmpty(push_msg.person_name) ? push_msg.person_name! : "Unknown", ack: true });
                                                if (this.personDetected[device.getSerial()])
                                                    clearTimeout(this.personDetected[device.getSerial()]);
                                                this.personDetected[device.getSerial()] = setTimeout(async () => {
                                                    await this.setStateAsync(device!.getStateID(CameraStateID.PERSON_DETECTED), { val: false, ack: true });
                                                }, this.config.eventDuration * 1000);
                                            }
                                        } else {
                                            // Someone spotted
                                            await this.setStateAsync(device.getStateID(CameraStateID.PERSON_DETECTED), { val: true, ack: true });
                                            await this.setStateAsync(device.getStateID(CameraStateID.LAST_PERSON_IDENTIFIED), { val: "Unknown", ack: true });
                                            if (this.personDetected[device.getSerial()])
                                                clearTimeout(this.personDetected[device.getSerial()]);
                                            this.personDetected[device.getSerial()] = setTimeout(async () => {
                                                await this.setStateAsync(device!.getStateID(CameraStateID.PERSON_DETECTED), { val: false, ack: true });
                                            }, this.config.eventDuration * 1000);
                                        }
                                    } else {
                                        // Motion detected
                                        await this.setStateAsync(device.getStateID(CameraStateID.MOTION_DETECTED), { val: true, ack: true });
                                        if (this.motionDetected[device.getSerial()])
                                            clearTimeout(this.motionDetected[device.getSerial()]);
                                        this.motionDetected[device.getSerial()] = setTimeout(async () => {
                                            await this.setStateAsync(device!.getStateID(CameraStateID.MOTION_DETECTED), { val: false, ack: true });
                                        }, this.config.eventDuration * 1000);
                                    }
                                    if (push_msg.push_count === 1)
                                        this._startDownload(push_msg.station_sn, push_msg.file_path, push_msg.cipher);
                                } else {
                                    this.log.debug(`handlePushNotifications(): CusPushEvent.SECURITY - Device not found: ${push_msg.device_sn}`);
                                }
                                break;

                            case CusPushEvent.MODE_SWITCH: // Changing Guard mode event
                                this.log.info(`Received push notification for changing guard mode (guard_mode: ${push_msg.station_guard_mode} current_mode: ${push_msg.station_current_mode}) for station ${push_msg.station_sn}}.`);
                                const station = this.eufy.getStation(push_msg.station_sn);
                                if (station) {
                                    if (push_msg.station_guard_mode !== undefined && push_msg.station_current_mode !== undefined) {
                                        await setStateChangedWithTimestamp(this, station.getStateID(StationStateID.GUARD_MODE), push_msg.station_guard_mode, push_msg.event_time);
                                        await setStateChangedWithTimestamp(this, station.getStateID(StationStateID.CURRENT_MODE), push_msg.station_current_mode, push_msg.event_time);
                                    } else {
                                        this.log.warn(`handlePushNotifications(): Station MODE_SWITCH event (${push_msg.event_type}): Missing required data to handle event: ${JSON.stringify(push_msg)}`);
                                    }
                                } else {
                                    this.log.warn(`handlePushNotifications(): Station MODE_SWITCH event (${push_msg.event_type}): Station Unknown: ${push_msg.station_sn}`);
                                }
                                break;

                            case CusPushEvent.DOOR_SENSOR: // EntrySensor open/close change event
                                device = this.eufy.getDevice(push_msg.device_sn);
                                if (device) {
                                    await setStateChangedAsync(this, device.getStateID(EntrySensorStateID.SENSOR_OPEN), push_msg.sensor_open ? push_msg.sensor_open : false);
                                } else {
                                    this.log.debug(`handlePushNotifications(): CusPushEvent.DOOR_SENSOR - Device not found: ${push_msg.device_sn}`);
                                }
                                break;

                            case CusPushEvent.MOTION_SENSOR_PIR: // MotionSensor movement detected event
                                device = this.eufy.getDevice(push_msg.device_sn);
                                if (device) {
                                    await this.setStateAsync(device.getStateID(MotionSensorStateID.MOTION_DETECTED), { val: true, ack: true });
                                    if (this.motionDetected[device.getSerial()])
                                        clearTimeout(this.motionDetected[device.getSerial()]);
                                    this.motionDetected[device.getSerial()] = setTimeout(async () => {
                                        await this.setStateAsync(device!.getStateID(MotionSensorStateID.MOTION_DETECTED), { val: false, ack: true });
                                    }, MotionSensor.MOTION_COOLDOWN_MS);
                                } else {
                                    this.log.debug(`handlePushNotifications(): CusPushEvent.MOTION_SENSOR_PIR - Device not found: ${push_msg.device_sn}`);
                                }
                                break;

                            default:
                                this.log.debug(`handlePushNotifications(): Unhandled push event: ${JSON.stringify(push_msg)}`);
                                break;
                        }
                    } else {
                        this.log.warn(`handlePushNotifications(): Cus unknown push data: ${JSON.stringify(push_msg)}`);
                    }
                } else {
                    this.log.warn(`handlePushNotifications(): Unhandled push event - data: ${JSON.stringify(push_msg)}`);
                }
            }
        } catch (error) {
            this.log.error(`handlePushNotifications(): Error: ${error}`);
        }
    }

    private async onConnect(): Promise<void> {
        this.log.silly(`onConnect(): `);
        await this.setStateAsync("info.connection", { val: true, ack: true });
        await this.refreshData(this);

        const api = this.eufy.getApi();
        const api_base = api.getAPIBase();
        const token = api.getToken();
        let token_expiration = api.getTokenExpiration();
        const trusted_token_expiration = api.getTrustedTokenExpiration();

        if (token_expiration?.getTime() !== trusted_token_expiration.getTime())
            try {
                const trusted_devices = await api.listTrustDevice();
                trusted_devices.forEach(trusted_device => {
                    if (trusted_device.is_current_device === 1) {
                        token_expiration = trusted_token_expiration;
                        api.setTokenExpiration(token_expiration);
                        this.log.debug(`onConnect(): This device is trusted. Token expiration extended to: ${token_expiration})`);
                    }
                });
            } catch (error) {
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
        Object.values(this.eufy.getStations()).forEach(function (station: Station) {
            station.connect();
        });
    }

    private async onDisconnect(): Promise<void> {
        this.log.silly(`onDisconnect(): `);
        await this.setStateAsync("info.connection", { val: false, ack: true });
    }

    public setAPIBase(api_base: string): void {
        this.persistentData.api_base = api_base;
        this.writePersistentData();
    }

    public setCloudToken(token: string, expiration: Date): void {
        this.persistentData.cloud_token = token;
        this.persistentData.cloud_token_expiration = expiration.getTime();
        this.writePersistentData();
    }

    public setPushCredentials(credentials: Credentials | undefined): void {
        this.persistentData.push_credentials = credentials;
        this.writePersistentData();
    }

    public getPersistentData(): PersistentData {
        return this.persistentData;
    }

    public setPushPersistentIds(persistentIds: string[]): void {
        this.persistentData.push_persistentIds = persistentIds;
        //this.writePersistentData();
    }

    private async onStartLivestream(station: Station, device: Device, url: string): Promise<void> {
        this.log.silly(`onStartLivestream(): station: ${station.getSerial()} device: ${device.getSerial()} url: ${url}`);
        this.setStateAsync(device.getStateID(CameraStateID.LIVESTREAM), { val: url, ack: true });
    }

    private async onStopLivestream(station: Station, device: Device): Promise<void> {
        this.log.silly(`onStopLivestream(): station: ${station.getSerial()} device: ${device.getSerial()}`);
        this.delStateAsync(device.getStateID(CameraStateID.LIVESTREAM));
    }

}

if (module.parent) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new EufySecurity(options);
} else {
    // otherwise start the instance directly
    (() => new EufySecurity())();
}