/*
 * Created with @iobroker/create-adapter v1.28.0
 */

import * as utils from "@iobroker/adapter-core";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { strict } from "assert";
import * as path from "path";
import * as fs from "fs";
import * as EufySecurityAPI from "./lib/eufy-security/eufy-security";
import * as Interface from "./lib/eufy-security/interfaces"
import { Devices, Stations } from "./lib/eufy-security/http/interfaces";
import { CameraStateID, DeviceStateID, GuardMode, ParamType, StationStateID/*, VerfyCodeTypes*/ } from "./lib/eufy-security/http/types";
import { decrypt, generateSerialnumber, generateUDID, getPushNotificationStateID, md5, setStateChangedAsync } from "./lib/eufy-security/utils";
import { PushMessage, Credentials } from "./lib/eufy-security/push/models";
import { PushEvent, PushNotificationStateID, ServerPushEvent } from "./lib/eufy-security/push/types";
import { PersistentData } from "./lib/eufy-security/interfaces";
import { Station } from "./lib/eufy-security/http/station";
import { CommandType } from "./lib/eufy-security/p2p/types";
import { Camera } from "./lib/eufy-security/http/device";

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

    private eufy?: EufySecurityAPI.EufySecurity;
    private refreshTimeout?: NodeJS.Timeout;

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
                name: "Cloud connection",
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

        // Type
        await this.setObjectNotExistsAsync(getPushNotificationStateID(PushNotificationStateID.TYPE), {
            type: "state",
            common: {
                name: "Type",
                type: "number",
                role: "state",
                read: true,
                write: false,
            },
            native: {},
        });
        // Title
        await this.setObjectNotExistsAsync(getPushNotificationStateID(PushNotificationStateID.TITLE), {
            type: "state",
            common: {
                name: "Title",
                type: "string",
                role: "text",
                read: true,
                write: false,
            },
            native: {},
        });
        // Content
        await this.setObjectNotExistsAsync(getPushNotificationStateID(PushNotificationStateID.CONTENT), {
            type: "state",
            common: {
                name: "Content",
                type: "string",
                role: "text",
                read: true,
                write: false,
            },
            native: {},
        });
        // Station Serialnumber
        await this.setObjectNotExistsAsync(getPushNotificationStateID(PushNotificationStateID.STATION_SERIALNUMBER), {
            type: "state",
            common: {
                name: "Station Serialnumber",
                type: "string",
                role: "text",
                read: true,
                write: false,
            },
            native: {},
        });
        // Device Serialnumber
        await this.setObjectNotExistsAsync(getPushNotificationStateID(PushNotificationStateID.DEVICE_SERIALNUMBER), {
            type: "state",
            common: {
                name: "Device Serialnumber",
                type: "string",
                role: "text",
                read: true,
                write: false,
            },
            native: {},
        });
        // Payload
        await this.setObjectNotExistsAsync(getPushNotificationStateID(PushNotificationStateID.PAYLOAD), {
            type: "state",
            common: {
                name: "Payload",
                type: "string",
                role: "text",
                read: true,
                write: false,
            },
            native: {},
        });
        // Event Time
        await this.setObjectNotExistsAsync(getPushNotificationStateID(PushNotificationStateID.EVENT_TIME), {
            type: "state",
            common: {
                name: "Event Time",
                type: "number",
                role: "state",
                read: true,
                write: false,
            },
            native: {},
        });
        // Push Time
        await this.setObjectNotExistsAsync(getPushNotificationStateID(PushNotificationStateID.PUSH_TIME), {
            type: "state",
            common: {
                name: "Push Time",
                type: "number",
                role: "state",
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
            if (fs.statSync(this.persistentFile).isFile()) {
                const fileContent = fs.readFileSync(this.persistentFile, "utf8");
                this.persistentData = JSON.parse(fileContent);
            }
        } catch (err) {
            this.log.debug("No stored data from last exit found.");
        }

        //TODO: Temporary Test to be removed!
        /*await this.setObjectNotExistsAsync("test_push", {
            type: "state",
            common: {
                name: "Test push",
                type: "boolean",
                role: "button",
                read: false,
                write: true,
            },
            native: {},
        });
        this.subscribeStates("test_push");*/
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

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    private onUnload(callback: () => void): void {
        try {
            if (this.eufy)
                this.setPushPersistentIds(this.eufy.getPushPersistentIds());

            this.writePersistentData();

            if (this.refreshTimeout)
                clearTimeout(this.refreshTimeout);

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
                    this.eufy.logon(state.val as number);
                    await this.delStateAsync(id);
                }
            /*} else if (station_sn == "test_push") {
                //TODO: Test to remove!
                this.log.debug("TEST PUSH pressed");
                if (this.eufy)
                    await this.eufy.getApi().sendVerifyCode(VerfyCodeTypes.TYPE_PUSH);
                    //await this.eufy.getStation("T8010P23201721F8").getCameraInfo();
            */
            } else if (device_type == "cameras") {
                const device_sn = values[4];
                const device_state_name = values[5];
                if (this.eufy) {
                    switch(device_state_name) {
                        case CameraStateID.START_STREAM:
                            await this.setStateAsync(`${station_sn}.${device_type}.${device_sn}.${CameraStateID.LIVESTREAM}`, { val: await this.eufy.startCameraStream(device_sn), ack: true });
                            break;

                        case CameraStateID.STOP_STREAM:
                            await this.eufy.stopCameraStream(device_sn);
                            break;
                    }
                }
            } else if (device_type == "station") {
                const station_state_name = values[4];
                if (this.eufy) {
                    switch(station_state_name) {
                        case StationStateID.GUARD_MODE:
                            await this.eufy.getStation(station_sn).setGuardMode(<GuardMode>state.val);
                            await this.setStateAsync(`${station_sn}.${device_type}.${station_state_name}`, {...state, ack: true });
                            break;
                    }
                }
            }
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
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

                // Last camera URL
                await this.setObjectNotExistsAsync(camera.getStateID(CameraStateID.LAST_CAMERA_URL), {
                    type: "state",
                    common: {
                        name: "Last camera URL",
                        type: "string",
                        role: "text.url",
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                await setStateChangedAsync(this, camera.getStateID(CameraStateID.LAST_CAMERA_URL), camera.getLastCameraImageURL());

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

                // Battery
                //TODO: Rework to display only if device has battery, indipendently of device type
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
                await setStateChangedAsync(this, camera.getStateID(CameraStateID.BATTERY), camera.getParameters()[CommandType.CMD_GET_BATTERY]);
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

            // IP Address
            await this.setObjectNotExistsAsync(station.getStateID(StationStateID.LAN_IP_ADDRESS), {
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
            await setStateChangedAsync(this, station.getStateID(StationStateID.LAN_IP_ADDRESS), station.getIPAddress());

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
            await setStateChangedAsync(this, station.getStateID(StationStateID.LAN_IP_ADDRESS), station.getParameter(CommandType.CMD_GET_HUB_LAN_IP));

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
            await setStateChangedAsync(this, station.getStateID(StationStateID.GUARD_MODE), station.getParameter(ParamType.GUARD_MODE));

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
            await setStateChangedAsync(this, station.getStateID(StationStateID.CURRENT_MODE), station.getParameter(ParamType.SCHEDULE_MODE));

        });
    }

    private async handlePushNotifications(push_msg: PushMessage): Promise<void> {
        this.log.debug(`handlePushNotifications(): push_msg: ` + JSON.stringify(push_msg));

        // Type
        await this.setStateAsync(getPushNotificationStateID(PushNotificationStateID.TYPE), { val: Number.parseInt(push_msg.payload.type), ack: true });
        // Title
        await this.setStateAsync(getPushNotificationStateID(PushNotificationStateID.TITLE), { val: push_msg.payload.title, ack: true });
        // Content
        await this.setStateAsync(getPushNotificationStateID(PushNotificationStateID.CONTENT), { val: push_msg.payload.content, ack: true });
        // Station Serialnumber
        await this.setStateAsync(getPushNotificationStateID(PushNotificationStateID.STATION_SERIALNUMBER), { val: push_msg.payload.station_sn, ack: true });
        // Device Serialnumber
        await this.setStateAsync(getPushNotificationStateID(PushNotificationStateID.DEVICE_SERIALNUMBER), { val: push_msg.payload.device_sn, ack: true });
        // Payload
        await this.setStateAsync(getPushNotificationStateID(PushNotificationStateID.PAYLOAD), { val: JSON.stringify(push_msg.payload.payload), ack: true });
        // Event Time
        await this.setStateAsync(getPushNotificationStateID(PushNotificationStateID.EVENT_TIME), { val: Number.parseInt(push_msg.payload.event_time), ack: true });
        // Push Time
        await this.setStateAsync(getPushNotificationStateID(PushNotificationStateID.PUSH_TIME), { val: Number.parseInt(push_msg.payload.push_time), ack: true });

        const type = Number.parseInt(push_msg.payload.type);
        if (type == ServerPushEvent.PUSH_VERIFICATION) {
            this.log.debug(`handlePushNotifications(): Received push verification event: ` + JSON.stringify(push_msg.payload));
            //push_msg.payload.payload.verify_code
        } else {
            switch (push_msg.payload.payload.a) {
                case PushEvent.PUSH_SECURITY_EVT: // Cam movement detected event
                    //TODO: Finish implementation!
                    /*adapter.
                    if (push_msg.data.payload.i) {
                        ""
                    } else {
                        "Motion detected."
                    }*/
                    break;

                case PushEvent.PUSH_MODE_SWITCH: // Changing Guard mode event

                    if (this.eufy) {
                        const station = this.eufy.getStation(push_msg.payload.payload.s);

                        if (push_msg.payload.payload.arming &&  push_msg.payload.payload.mode) {
                            await this.setStateAsync(station.getStateID(StationStateID.GUARD_MODE), { val: push_msg.payload.payload.arming, ack: true });
                            await this.setStateAsync(station.getStateID(StationStateID.CURRENT_MODE), { val: push_msg.payload.payload.mode, ack: true });
                        }
                        this.log.info(`Received push notification for changing guard mode (guard_mode: ${push_msg.payload.payload.arming} current_mode: ${push_msg.payload.payload.mode}) for station ${station.getSerial()}}.`);
                    }
                    break;

                default:
                    this.log.debug(`handlePushNotifications(): Unhandled push event: ` + JSON.stringify(push_msg.payload));
                    break;
            }
        }
    }

    private async onConnect(): Promise<void> {
        this.log.silly(`onConnect(): `);
        await this.setStateAsync("info.connection", { val: true, ack: true });
        await this.refreshData(this);

        if (this.eufy) {

            const api_base = this.eufy.getApi().getAPIBase();
            const token = this.eufy.getApi().getToken();
            const token_expiration = this.eufy.getApi().getTokenExpiration();

            if (api_base) {
                this.log.debug(`onConnect(): save api_base - api_base: ${api_base}`);
                this.setAPIBase(api_base);
            }

            if (token && token_expiration) {
                this.log.debug(`onConnect(): save token and expiration - token: ${token} token_expiration: ${token_expiration}`);
                this.setCloudToken(token, token_expiration);
            }

            await this.eufy.registerPushNotifications(this.getPersistentData().push_persistentIds);
            Object.values(this.eufy.getStations()).forEach(function (station: Station) {
                station.connect();
            });
        }
    }

    private async onNotConnected(): Promise<void> {
        this.log.silly(`onNotConnected(): `);
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

    public setPushCredentials(credentials: Credentials): void {
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

}

if (module.parent) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new EufySecurity(options);
} else {
    // otherwise start the instance directly
    (() => new EufySecurity())();
}