/*
 * Created with @iobroker/create-adapter v2.5.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from "@iobroker/adapter-core";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { strict } from "assert";
import * as path from "path";
import { Camera, Device, Station, PushMessage, P2PConnectionType, EufySecurity, EufySecurityConfig, CommandResult, CommandType, ErrorCode, PropertyValue, PropertyName, StreamMetadata, PropertyMetadataNumeric, PropertyMetadataAny, CommandName, PanTiltDirection, DeviceNotFoundError, LoginOptions, Picture, StationNotFoundError, ensureError, LogLevel } from "eufy-security-client";
import { getAlpha2Code as getCountryCode } from "i18n-iso-countries"
import { isValid as isValidLanguageCode } from "@cospired/i18n-iso-languages"
import { Readable } from "stream";
import util from "util";
import childProcess from "child_process";
import pathToGo2rtc from "go2rtc-static";
import pathToFfmpeg from "ffmpeg-for-homebridge";

import { DeviceStateID, DataLocation, RoleMapping, StationStateID } from "./lib/types";
import { convertCamelCaseToSnakeCase, getImageAsHTML, handleUpdate, removeFiles, removeLastChar, setStateChangedAsync } from "./lib/utils";
import { PersistentData } from "./lib/interfaces";
import { ioBrokerLogger } from "./lib/log";
import { streamToGo2rtc } from "./lib/video";

export class euSec extends utils.Adapter {

    private eufy!: EufySecurity;
    /*private downloadEvent: {
        [index: string]: NodeJS.Timeout;
    } = {};*/

    private persistentFile: string = "adapter.json";
    private persistentDriverFile: string = "driver.json";
    private logger!: ioBrokerLogger;
    private persistentData: PersistentData = {
        version: ""
    };
    private captchaId: string | null = null;
    private verify_code = false;
    private skipInit = false;

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            ...options,
            name: "eusec",
        });

        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        // this.on("objectChange", this.onObjectChange.bind(this));
        this.on("message", this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));
    }

    public restartAdapter(): void {
        this.skipInit = true;
        this.restart();
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    private async onReady(): Promise<void> {

        this.logger = new ioBrokerLogger(this.log as ioBroker.Logger);

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
                Object.keys(connection).forEach(async id => {
                    await this.setStateAsync(id, { val: false, ack: true });
                });
        } catch (error) {
            this.logger.error("Reset connection states - Error", error);
        }

        try {
            const sensorList = [
                PropertyName.DeviceMotionDetected,
                PropertyName.DevicePersonDetected,
                PropertyName.DeviceSoundDetected,
                PropertyName.DeviceCryingDetected,
                PropertyName.DevicePetDetected,
                PropertyName.DeviceRinging
            ];
            for(const sensorName of sensorList) {
                const sensors = await this.getStatesAsync(`*.${convertCamelCaseToSnakeCase(sensorName)}`);
                if (sensors)
                    Object.keys(sensors).forEach(async id => {
                        await this.setStateAsync(id, { val: false, ack: true });
                    });
            }
        } catch (error) {
            this.logger.error("Reset sensor states - Error", error);
        }

        try {
            if (await this.fileExistsAsync(this.namespace, this.persistentFile)) {
                const fileContent = await this.readFileAsync(this.namespace, this.persistentFile);
                this.persistentData = JSON.parse(fileContent.file.toString("utf8")) as PersistentData;
            }
        } catch (error) {
            this.logger.debug("No adapter stored data from last exit found.", error);
        }

        let persistentDriverData: string = "{}";
        try {
            if (await this.fileExistsAsync(this.namespace, this.persistentDriverFile)) {
                const fileContent = await this.readFileAsync(this.namespace, this.persistentDriverFile);
                persistentDriverData = fileContent.file.toString("utf8");
            }
        } catch (error) {
            this.logger.debug("No driver stored data from last exit found.", error);
        }

        this.subscribeStates("verify_code");
        this.subscribeStates("captcha");

        const hosts = await this.getForeignObjectsAsync("system.host.*", "host");
        if (hosts !== undefined && hosts !== null && Object.values(hosts).length !== 0) {
            if (this.config.hostname === "") {
                this.config.hostname = Object.values(hosts)[0].native.os.hostname;
            }

            const nodeVersion = Object.values(hosts)[0].native.process.versions.node;
            const nodeMajorVersion = nodeVersion.split(".")[0];

            let fixNeeded;
            switch (parseInt(nodeMajorVersion)) {
                case 18:
                    fixNeeded = nodeVersion.localeCompare("18.19.1", undefined, { numeric: true, sensitivity: "base" });
                    break;
                case 20:
                    fixNeeded = nodeVersion.localeCompare("20.11.1", undefined, { numeric: true, sensitivity: "base" });
                    break;
                default:
                    fixNeeded = nodeVersion.localeCompare("21.6.2", undefined, { numeric: true, sensitivity: "base" });
                    break;
            }
            if (fixNeeded >= 0) {
                const adapter = await this.getForeignObjectAsync(`system.adapter.${this.namespace}`);
                if (adapter !== undefined && adapter !== null) {
                    if (!adapter.common.nodeProcessParams?.includes("--security-revert=CVE-2023-46809")) {
                        adapter.common.nodeProcessParams = ["--security-revert=CVE-2023-46809"]
                        await this.setForeignObjectAsync(`system.adapter.${this.namespace}`, adapter);
                        this.log.warn("Required fix to use livestreaming with this version of Node.js (CVE-2023-46809) applied. Restart of the adapter initiated to activate the fix.");
                        this.restartAdapter();
                    }
                }
            }
        }

        if (!this.skipInit) {
            const systemConfig = await this.getForeignObjectAsync("system.config");
            let countryCode = undefined;
            let languageCode = undefined;
            if (systemConfig) {
                countryCode = getCountryCode(systemConfig.common.country, "en");
                if (isValidLanguageCode(systemConfig.common.language))
                    languageCode = systemConfig.common.language;
            }
            if (this.config.country !== "iobroker") {
                countryCode = this.config.country;
            }

            // Handling adapter version update
            try {
                if (this.persistentData.version !== this.version) {
                    const currentVersion = Number.parseFloat(removeLastChar(this.version!, "."));
                    const previousVersion = this.persistentData.version !== "" && this.persistentData.version !== undefined ? Number.parseFloat(removeLastChar(this.persistentData.version, ".")) : 0;
                    this.logger.debug(`Handling of adapter update - currentVersion: ${currentVersion} previousVersion: ${previousVersion}`);

                    if (previousVersion < currentVersion) {
                        await handleUpdate(this, this.logger, previousVersion, currentVersion);
                        this.persistentData.version = this.version!;
                        await this.writePersistentData();
                    }
                }
            } catch (error) {
                this.logger.error(`Handling of adapter update - Error:`, error);
            }

            let connectionType = P2PConnectionType.QUICKEST;
            if (this.config.p2pConnectionType === "only_local") {
                connectionType = P2PConnectionType.ONLY_LOCAL;
            }

            if (this.config.username !== "" && this.config.password !== "") {
                const config: EufySecurityConfig = {
                    username: this.config.username,
                    password: this.config.password,
                    country: countryCode,
                    language: languageCode,
                    persistentData: persistentDriverData,
                    eventDurationSeconds: this.config.eventDuration,
                    p2pConnectionSetup: connectionType,
                    pollingIntervalMinutes: this.config.pollingInterval,
                    acceptInvitations: this.config.acceptInvitations,
                    logging: {
                        level: this.log.level === "silly" ? LogLevel.Trace : this.log.level === "debug" ? LogLevel.Debug : this.log.level === "info" ? LogLevel.Info : this.log.level === "warn" ? LogLevel.Warn : this.log.level === "error" ? LogLevel.Error : LogLevel.Info
                    }
                };

                this.eufy = await EufySecurity.initialize(config, this.logger);
                this.eufy.on("persistent data", (data: string) => this.onPersistentData(data))
                this.eufy.on("station added", (station: Station) => this.onStationAdded(station));
                this.eufy.on("device added", (device: Device) => this.onDeviceAdded(device));
                this.eufy.on("station removed", (station: Station) => this.onStationRemoved(station));
                this.eufy.on("device removed", (device: Device) => this.onDeviceRemoved(device));
                this.eufy.on("push message", (messages) => this.handlePushNotification(messages));
                this.eufy.on("push connect", () => this.onPushConnect());
                this.eufy.on("push close", () => this.onPushClose());
                this.eufy.on("mqtt connect", () => this.onMQTTConnect());
                this.eufy.on("mqtt close", () => this.onMQTTClose());
                this.eufy.on("connect", () => this.onConnect());
                this.eufy.on("close", () => this.onClose());

                this.eufy.on("device property changed", (device: Device, name: string, value: PropertyValue) => this.onDevicePropertyChanged(device, name, value));

                this.eufy.on("station command result", (station: Station, result: CommandResult) => this.onStationCommandResult(station, result));
                //this.eufy.on("station download start", (station: Station, device: Device, metadata: StreamMetadata, videostream: Readable, audiostream: Readable) => this.onStationDownloadStart(station, device, metadata, videostream, audiostream));
                //this.eufy.on("station download finish", (station: Station, device: Device) => this.onStationDownloadFinish(station, device));
                this.eufy.on("station livestream start", (station: Station, device: Device, metadata: StreamMetadata, videostream: Readable, audiostream: Readable) => this.onStationLivestreamStart(station, device, metadata, videostream, audiostream));
                this.eufy.on("station livestream stop", (station: Station, device: Device) => this.onStationLivestreamStop(station, device));
                this.eufy.on("station rtsp url",  (station: Station, device: Device, value: string) => this.onStationRTSPUrl(station, device, value));
                this.eufy.on("station property changed", (station: Station, name: string, value: PropertyValue) => this.onStationPropertyChanged(station, name, value));
                this.eufy.on("station connect", (station: Station) => this.onStationConnect(station));
                this.eufy.on("station close", (station: Station) => this.onStationClose(station));
                this.eufy.on("tfa request", () => this.onTFARequest());
                this.eufy.on("captcha request", (captchaId: string, captcha: string) => this.onCaptchaRequest(captchaId, captcha));
                this.eufy.setCameraMaxLivestreamDuration(this.config.maxLivestreamDuration);

                await this.eufy.connect();

                if (pathToGo2rtc) {
                    const go2rtcConfig: {
                        [index: string]: {
                            [index: string]: string | number | null
                        }
                    } = {
                        "api": {
                            "listen": `:${this.config.go2rtc_api_port}`
                        },
                        "rtsp": {
                            "listen": `:${this.config.go2rtc_rtsp_port}`
                        },
                        "srtp": {
                            "listen": `:${this.config.go2rtc_srtp_port}`
                        },
                        "webrtc": {
                            "listen": `:${this.config.go2rtc_webrtc_port}`
                        },
                        "ffmpeg": {
                            "bin": pathToFfmpeg !== "" && pathToFfmpeg !== undefined ? pathToFfmpeg : "ffmpeg",
                        },
                        "streams": {},
                        /*"log": {
                            "level": "debug",  // default level
                            "api": "debug",
                            "exec": "debug",
                            "ngrok": "debug",
                            "rtsp": "debug",
                            "streams": "debug",
                            "webrtc": "debug",
                        }*/
                    };
                    if (this.config.go2rtc_rtsp_username !== "" && this.config.go2rtc_rtsp_password !== "") {
                        go2rtcConfig.rtsp.username = this.config.go2rtc_rtsp_username;
                        go2rtcConfig.rtsp.password = this.config.go2rtc_rtsp_password;
                    }
                    for (const device of await this.eufy.getDevices()) {
                        go2rtcConfig.streams[device.getSerial()] = null;
                    }
                    const go2rtc = childProcess.spawn(pathToGo2rtc, ["-config", JSON.stringify(go2rtcConfig)], { shell: false, detached: false, windowsHide: true });
                    go2rtc.on("error", (error) => {
                        this.log.error(`go2rtc error: ${error}`);
                    });
                    go2rtc.stdout.setEncoding("utf8");
                    go2rtc.stdout.on("data", (data) => {
                        this.log.info(`go2rtc started: ${data}`);
                    });
                    go2rtc.stderr.setEncoding("utf8");
                    go2rtc.stderr.on("data", (data) => {
                        this.log.error(`go2rtc error: ${data}`);
                    });
                    go2rtc.on("close", (exitcode) => {
                        this.log.info(`go2rtc terminated with exitcode ${exitcode}`);
                    });
                    process.on("exit", () => {
                        go2rtc.kill();
                    });
                }
            }
            // Delete cunknown channels without childs
            const channels = await this.getChannelsAsync();
            for (const channel of channels) {
                if (channel.common.name === "unknown") {
                    const states = await this.getStatesAsync(`${channel._id}.*`);
                    if (Object.keys(states).length === 0) {
                        await this.delObjectAsync(channel._id);
                    }
                }
            }
        }
    }

    public async writePersistentData(): Promise<void> {
        try {
            await this.writeFileAsync(this.namespace, this.persistentFile, JSON.stringify(this.persistentData));
        } catch(error) {
            this.logger.error(`writePersistentData() - Error: ${error}`);
        }
    }

    private onPersistentData(data: string): void {
        this.writeFileAsync(this.namespace, this.persistentDriverFile, data).catch((error) => {
            this.logger.error(`writePersistentDriverData() - Error: ${error}`);
        });
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    private async onUnload(callback: () => void): Promise<void> {
        try {

            await this.writePersistentData();

            if (this.eufy) {
                if (this.eufy.isConnected())
                    await this.setStateAsync("info.connection", { val: false, ack: true }).catch();
                this.eufy.removeAllListeners();
                this.eufy.close();
            }

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
                    await this.eufy.connect({ verifyCode: state.val as string } as LoginOptions);
                    this.verify_code = false;
                    await this.delStateAsync(id);
                }
            } else if (station_sn == "captcha") {
                if (this.eufy && this.captchaId) {
                    this.logger.info(`Captcha received, send it. (captcha: ${state.val})`);
                    await this.eufy.connect({
                        captcha: {
                            captchaCode: state.val as string,
                            captchaId: this.captchaId
                        }
                    } as LoginOptions);
                    this.captchaId = null;
                    await this.delStateAsync(id);
                    await this.delStateAsync("received_captcha_html");
                }
            } else if (device_type == "station") {
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
                        switch(station_state_name) {
                            case StationStateID.REBOOT:
                                await station.rebootHUB();
                                break;
                            case StationStateID.TRIGGER_ALARM_SOUND:
                                await station.triggerStationAlarmSound(this.config.alarmSoundDuration);
                                break;
                            case StationStateID.RESET_ALARM_SOUND:
                                await station.resetStationAlarmSound();
                                break;
                        }
                    }
                } catch (error) {
                    this.logger.error(`station - Error:`, error);
                }
            } else {
                try {
                    const device_sn = values[4];
                    const obj = await this.getObjectAsync(id);
                    if (obj) {
                        if (obj.native.name !== undefined) {
                            try {
                                await this.eufy.setDeviceProperty(device_sn, obj.native.name, obj.common.type === "object" ? JSON.parse(state.val as string) : state.val);
                            } catch (error) {
                                this.logger.error(`Error in setting property value (property: ${obj.native.name} value: ${state.val})`, error);
                            }
                            return;
                        }
                    }

                    const device_state_name = values[5];
                    const station = await this.eufy.getStation(station_sn);
                    const device = await this.eufy.getDevice(device_sn);

                    switch(device_state_name) {
                        case DeviceStateID.START_STREAM:
                            await this.startLivestream(device_sn);
                            break;
                        case DeviceStateID.STOP_STREAM:
                            await this.stopLivestream(device_sn);
                            break;
                        case DeviceStateID.TRIGGER_ALARM_SOUND:
                            await station.triggerDeviceAlarmSound(device, this.config.alarmSoundDuration);
                            break;
                        case DeviceStateID.RESET_ALARM_SOUND:
                            await station.resetDeviceAlarmSound(device);
                            break;
                        case DeviceStateID.ROTATE_360:
                            await station.panAndTilt(device, PanTiltDirection.ROTATE360);
                            break;
                        case DeviceStateID.PAN_LEFT:
                            await station.panAndTilt(device, PanTiltDirection.LEFT);
                            break;
                        case DeviceStateID.PAN_RIGHT:
                            await station.panAndTilt(device, PanTiltDirection.RIGHT);
                            break;
                        case DeviceStateID.TILT_UP:
                            await station.panAndTilt(device, PanTiltDirection.UP);
                            break;
                        case DeviceStateID.TILT_DOWN:
                            await station.panAndTilt(device, PanTiltDirection.DOWN);
                            break;
                        case DeviceStateID.CALIBRATE:
                            if (device.isLock()) {
                                await station.calibrateLock(device);
                            } else {
                                await station.calibrate(device);
                            }
                            break;
                        case DeviceStateID.UNLOCK:
                            await station.unlock(device);
                            break;
                        case DeviceStateID.SET_DEFAULT_ANGLE:
                            await station.setDefaultAngle(device);
                            break;
                        case DeviceStateID.SET_PRIVACY_ANGLE:
                            await station.setPrivacyAngle(device);
                            break;
                        case DeviceStateID.OPEN_BOX:
                            await station.open(device);
                            break;
                    }
                } catch (error) {
                    this.logger.error(`cameras - Error:`, error);
                }
            }
        } else {
            // The state was deleted
            this.logger.debug(`state ${id} deleted`);
        }
    }

    /**
     * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
     * Using this method requires "common.message" property to be set to true in io-package.json
     */
    private async onMessage(obj: ioBroker.Message): Promise<void> {
        if (typeof obj === "object" && obj.message) {
            try {
                if (obj.command === "quickResponse") {
                    this.log.debug(`quickResponse command - message: ${JSON.stringify(obj.message)}`);
                    if (typeof obj.message === "object" &&
                        typeof obj.message.station_sn === "string" && obj.message.station_sn !== "" &&
                        typeof obj.message.device_sn === "string" && obj.message.device_sn !== "" &&
                        typeof obj.message.voice_id === "number") {
                        try {
                            const station = await this.eufy.getStation(obj.message.station_sn);
                            const device = await this.eufy.getDevice(obj.message.device_sn);

                            if (device.hasCommand(CommandName.DeviceQuickResponse)) {
                                await station.quickResponse(device, obj.message.voice_id);
                                if (obj.callback)
                                    this.sendTo(obj.from, obj.command, {
                                        sended: true,
                                        result: "quickResponse command sended"
                                    }, obj.callback);
                            } else {
                                if (obj.callback)
                                    this.sendTo(obj.from, obj.command, {
                                        sended: false,
                                        result: "quickResponse command not supported by specified device"
                                    }, obj.callback);
                            }
                        } catch (error) {
                            if (error instanceof StationNotFoundError) {
                                if (obj.callback)
                                    this.sendTo(obj.from, obj.command, {
                                        sended: false,
                                        result: "quickResponse command not sended because specified station doesn't exists"
                                    }, obj.callback);
                            } else if (error instanceof DeviceNotFoundError) {
                                if (obj.callback)
                                    this.sendTo(obj.from, obj.command, {
                                        sended: false,
                                        result: "quickResponse command not sended because specified device doesn't exists"
                                    }, obj.callback);
                            } else {
                                throw error;
                            }
                        }
                    } else {
                        if (obj.callback)
                            this.sendTo(obj.from, obj.command, {
                                sended: false,
                                result: "quickResponse command not sended because some required parameters are missing"
                            }, obj.callback);
                    }
                } else if (obj.command === "getQuickResponseVoices") {
                    this.log.debug(`getQuickResponseVoices command - message: ${JSON.stringify(obj.message)}`);
                    if (typeof obj.message === "object" &&
                        typeof obj.message.device_sn === "string" && obj.message.device_sn !== "") {
                        const voices = await this.eufy.getApi().getVoices(obj.message.device_sn);

                        if (obj.callback)
                            this.sendTo(obj.from, obj.command, {
                                sended: true,
                                result: voices
                            }, obj.callback);
                    } else {
                        if (obj.callback)
                            this.sendTo(obj.from, obj.command, {
                                sended: false,
                                result: "getQuickResponseVoices command not sended because some required parameters are missing"
                            }, obj.callback);
                    }
                } else if (obj.command === "snooze") {
                    this.log.debug(`snooze command - message: ${JSON.stringify(obj.message)}`);
                    if (typeof obj.message === "object" &&
                        typeof obj.message.station_sn === "string" && obj.message.station_sn !== "" &&
                        typeof obj.message.device_sn === "string" && obj.message.device_sn !== "" &&
                        typeof obj.message.snooze_time === "number" &&
                        (obj.message.snooze_chime === undefined || typeof obj.message.snooze_chime === "boolean") &&
                        (obj.message.snooze_homebase === undefined || typeof obj.message.snooze_homebase === "boolean") &&
                        (obj.message.snooze_motion === undefined || typeof obj.message.snooze_motion === "boolean")) {
                        try {
                            const station = await this.eufy.getStation(obj.message.station_sn);
                            const device = await this.eufy.getDevice(obj.message.device_sn);

                            if (device.hasCommand(CommandName.DeviceSnooze)) {
                                await station.snooze(device, {
                                    snooze_time: obj.message.snooze_time,
                                    snooze_chime: obj.message.snooze_chime,
                                    snooze_homebase: obj.message.snooze_homebase,
                                    snooze_motion: obj.message.snooze_motion,
                                });
                                if (obj.callback)
                                    this.sendTo(obj.from, obj.command, {
                                        sended: true,
                                        result: "snooze command sended"
                                    }, obj.callback);
                            } else {
                                if (obj.callback)
                                    this.sendTo(obj.from, obj.command, {
                                        sended: false,
                                        result: "snooze command not supported by specified device"
                                    }, obj.callback);
                            }
                        } catch (error) {
                            if (error instanceof StationNotFoundError) {
                                if (obj.callback)
                                    this.sendTo(obj.from, obj.command, {
                                        sended: false,
                                        result: "snooze command not sended because specified station doesn't exists"
                                    }, obj.callback);
                            } else if (error instanceof DeviceNotFoundError) {
                                if (obj.callback)
                                    this.sendTo(obj.from, obj.command, {
                                        sended: false,
                                        result: "snooze command not sended because specified device doesn't exists"
                                    }, obj.callback);
                            } else {
                                throw error;
                            }
                        }
                    } else {
                        if (obj.callback)
                            this.sendTo(obj.from, obj.command, {
                                sended: false,
                                result: "snooze command not sended because some required parameters are missing"
                            }, obj.callback);
                    }
                } else if (obj.command === "chime") {
                    this.log.debug(`snooze command - message: ${JSON.stringify(obj.message)}`);
                    if (typeof obj.message === "object" &&
                        typeof obj.message.station_sn === "string" && obj.message.station_sn !== "" &&
                        (obj.message.ringtone === undefined || typeof obj.message.ringtone === "number")) {
                        try {
                            const station = await this.eufy.getStation(obj.message.station_sn);

                            if (station.hasCommand(CommandName.StationChime)) {
                                await station.chimeHomebase(obj.message.ringtone !== undefined && typeof obj.message.ringtone === "number" ? obj.message.ringtone : 0);
                                if (obj.callback)
                                    this.sendTo(obj.from, obj.command, {
                                        sended: true,
                                        result: "chime command sended"
                                    }, obj.callback);
                            } else {
                                if (obj.callback)
                                    this.sendTo(obj.from, obj.command, {
                                        sended: false,
                                        result: "chime command not supported by specified station"
                                    }, obj.callback);
                            }

                            if (obj.callback)
                                this.sendTo(obj.from, obj.command, "chime command sended", obj.callback);
                        } catch (error) {
                            if (error instanceof StationNotFoundError) {
                                if (obj.callback)
                                    this.sendTo(obj.from, obj.command, {
                                        sended: false,
                                        result: "snooze command not sended because specified station doesn't exists"
                                    }, obj.callback);
                            } else {
                                throw error;
                            }
                        }
                    }
                } else if (obj.command === "pollRefresh") {
                    this.log.debug(`pollRefresh command`);
                    await this.eufy.refreshCloudData();

                    if (obj.callback)
                        this.sendTo(obj.from, obj.command, {
                            sended: true,
                            result: "pollRefresh command sended"
                        }, obj.callback);
                } else {
                    const errorMessage = `Received unknown message: ${JSON.stringify(obj.message)}`;
                    this.log.warn(errorMessage);
                    if (obj.callback)
                        this.sendTo(obj.from, obj.command, {
                            sended: false,
                            result: errorMessage
                        }, obj.callback);
                }
            } catch (error) {
                const errorMessage = `Error during processing of received message: ${error instanceof Error ? `${error.name} - ${error.message}` : error }`;
                this.log.error(errorMessage);
                if (obj.callback)
                    this.sendTo(obj.from, obj.command, {
                        sended: false,
                        result: errorMessage
                    }, obj.callback);
            }
        }
    }

    private getStateCommon(property: PropertyMetadataAny): ioBroker.StateCommon {
        const state: ioBroker.StateCommon = {
            name: property.label!,
            type: property.type,
            role: "state",
            read: property.readable,
            write: property.writeable,
            def: property.default
        };
        switch (property.type) {
            case "number": {
                const numberProperty = property as PropertyMetadataNumeric;
                state.min = numberProperty.min;
                state.max = numberProperty.max;
                state.states = numberProperty.states;
                state.unit = numberProperty.unit;
                state.step = numberProperty.steps;
                state.role = RoleMapping[property.name] !== undefined ? RoleMapping[property.name] : "value";
                break;
            }
            case "string": {
                state.role = RoleMapping[property.name] !== undefined ? RoleMapping[property.name] : "text";
                break;
            }
            case "boolean": {
                state.role = RoleMapping[property.name] !== undefined ? RoleMapping[property.name] : (property.writeable ? "switch.enable" : "state");
                break;
            }
        }
        return state;
    }

    private async createAndSetState(device: Device | Station, property: PropertyMetadataAny): Promise<void> {
        if (property.name !== PropertyName.Type && property.name !== PropertyName.DeviceStationSN) {
            const state = this.getStateCommon(property);
            const id: string = device.getStateID(convertCamelCaseToSnakeCase(property.name));
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
                if (obj.common !== undefined && !util.isDeepStrictEqual(obj.common, state)) {
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
            } else {
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
                await setStateChangedAsync(this as unknown as ioBroker.Adapter, id, (property.type === "string" || property.type === "object") && typeof value === "object" ? JSON.stringify(value) : value);
        }
    }

    private async onDeviceAdded(device: Device): Promise<void> {
        this.logger.debug(`onDeviceAdded - device: ${device.getSerial()}`);

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
        for(const property of Object.values(metadata)) {
            if (property.name !== PropertyName.DevicePicture)
                this.createAndSetState(device, property);
        }

        if (device.hasProperty(PropertyName.DevicePicture)) {
            await this.setObjectNotExistsAsync(device.getStateID(DeviceStateID.PICTURE_URL), {
                type: "state",
                common: {
                    name: "Picture URL",
                    type: "string",
                    role: "url",
                    read: true,
                    write: false,
                },
                native: {},
            });
            await this.setObjectNotExistsAsync(device.getStateID(DeviceStateID.PICTURE_HTML), {
                type: "state",
                common: {
                    name: "Picture HTML image",
                    type: "string",
                    role: "html",
                    read: true,
                    write: false,
                },
                native: {},
            });
        }

        if (device.hasCommand(CommandName.DeviceTriggerAlarmSound)) {
            await this.setObjectNotExistsAsync(device.getStateID(DeviceStateID.TRIGGER_ALARM_SOUND), {
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
            await this.setObjectNotExistsAsync(device.getStateID(DeviceStateID.RESET_ALARM_SOUND), {
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
        if (device.hasCommand(CommandName.DevicePanAndTilt)) {
            await this.setObjectNotExistsAsync(device.getStateID(DeviceStateID.PAN_LEFT), {
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
            await this.setObjectNotExistsAsync(device.getStateID(DeviceStateID.PAN_RIGHT), {
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
            await this.setObjectNotExistsAsync(device.getStateID(DeviceStateID.ROTATE_360), {
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
            await this.setObjectNotExistsAsync(device.getStateID(DeviceStateID.TILT_UP), {
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
            await this.setObjectNotExistsAsync(device.getStateID(DeviceStateID.TILT_DOWN), {
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
        if (device.hasCommand(CommandName.DeviceLockCalibration)) {
            await this.setObjectNotExistsAsync(device.getStateID(DeviceStateID.CALIBRATE), {
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
        if (device.hasCommand(CommandName.DeviceUnlock)) {
            await this.setObjectNotExistsAsync(device.getStateID(DeviceStateID.UNLOCK), {
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
        if (device.hasCommand(CommandName.DeviceSetDefaultAngle)) {
            await this.setObjectNotExistsAsync(device.getStateID(DeviceStateID.SET_DEFAULT_ANGLE), {
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
        if (device.hasCommand(CommandName.DeviceSetPrivacyAngle)) {
            await this.setObjectNotExistsAsync(device.getStateID(DeviceStateID.SET_PRIVACY_ANGLE), {
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
        if (device.hasCommand(CommandName.DeviceCalibrate)) {
            await this.setObjectNotExistsAsync(device.getStateID(DeviceStateID.CALIBRATE), {
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
        if (device.hasCommand(CommandName.DeviceOpen)) {
            await this.setObjectNotExistsAsync(device.getStateID(DeviceStateID.OPEN_BOX), {
                type: "state",
                common: {
                    name: "Open Box",
                    type: "boolean",
                    role: "button.start",
                    read: false,
                    write: true,
                },
                native: {},
            });
        }
        if (device.hasCommand(CommandName.DeviceStartLivestream)) {
            // Start Stream
            await this.setObjectNotExistsAsync(device.getStateID(DeviceStateID.START_STREAM), {
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
            await this.setObjectNotExistsAsync(device.getStateID(DeviceStateID.STOP_STREAM), {
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
            await this.setObjectNotExistsAsync(device.getStateID(DeviceStateID.LIVESTREAM), {
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

            // Livestream RTSP URL
            await this.setObjectNotExistsAsync(device.getStateID(DeviceStateID.LIVESTREAM_RTSP), {
                type: "state",
                common: {
                    name: "Livestream RTSP URL",
                    type: "string",
                    role: "url",
                    read: true,
                    write: false,
                },
                native: {},
            });
        }

        if (device.hasProperty(PropertyName.DeviceRTSPStream)) {
            // RTSP Stream URL
            await this.setObjectNotExistsAsync(device.getStateID(DeviceStateID.RTSP_STREAM_URL), {
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

        //TODO: Deactivated because the decryption of the download has changed.
        /*if (device.hasCommand(CommandName.DeviceStartDownload)) {
            // Last event video URL
            await this.setObjectNotExistsAsync(device.getStateID(DeviceStateID.LAST_EVENT_VIDEO_URL), {
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
            await this.setObjectNotExistsAsync(device.getStateID(DeviceStateID.LAST_EVENT_PIC_URL), {
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
            await this.setObjectNotExistsAsync(device.getStateID(DeviceStateID.LAST_EVENT_PIC_HTML), {
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
        }*/
    }

    private async onDeviceRemoved(device: Device): Promise<void> {
        this.delObjectAsync(device.getStateID("", 0), { recursive: true }).catch((error) => {
            this.logger.error(`Error deleting states of removed device`, error);
        });
        removeFiles(this as unknown as ioBroker.Adapter, device.getStationSerial(), DataLocation.LAST_EVENT, device.getSerial()).catch((error) => {
            this.logger.error(`Error deleting fs contents of removed device`, error);
        });
    }

    private async onStationAdded(station: Station): Promise<void> {
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

        await this.setObjectNotExistsAsync(station.getStateID(StationStateID.CONNECTION), {
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
        await this.setStateAsync(station.getStateID(StationStateID.CONNECTION), { val: false, ack: true });

        const metadata = station.getPropertiesMetadata();
        for(const property of Object.values(metadata)) {
            this.createAndSetState(station, property);
        }

        // Reboot station
        if (station.hasCommand(CommandName.StationReboot)) {
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
        }
        // Alarm Sound
        if (station.hasCommand(CommandName.StationTriggerAlarmSound)) {
            await this.setObjectNotExistsAsync(station.getStateID(StationStateID.TRIGGER_ALARM_SOUND), {
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
            await this.setObjectNotExistsAsync(station.getStateID(StationStateID.RESET_ALARM_SOUND), {
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

    private async onStationRemoved(station: Station): Promise<void> {
        this.delObjectAsync(station.getStateID("", 0), { recursive: true }).catch((error) => {
            this.logger.error(`Error deleting states of removed station`, error);
        });
        this.delFileAsync(this.namespace, station.getSerial()).catch((error) => {
            this.logger.error(`Error deleting fs contents of removed station`, error);
        });
    }

    /*private async downloadEventVideo(device: Device, event_time: number, full_path: string | undefined, cipher_id: number | undefined): Promise<void> {
        this.logger.debug(`Device: ${device.getSerial()} full_path: ${full_path} cipher_id: ${cipher_id}`);
        try {
            if (!isEmpty(full_path) && cipher_id !== undefined) {
                const station = await this.eufy.getStation(device.getStationSerial());

                if (station !== undefined) {
                    if (this.downloadEvent[device.getSerial()])
                        clearTimeout(this.downloadEvent[device.getSerial()]);

                    let videoLength = getVideoClipLength(device);
                    const time_passed = (new Date().getTime() - new Date(event_time).getTime()) / 1000;

                    if (time_passed >= videoLength)
                        videoLength = 1;
                    else
                        videoLength = videoLength - time_passed;

                    this.logger.info(`Downloading video event for device ${device.getSerial()} in ${videoLength} seconds...`);
                    this.downloadEvent[device.getSerial()] = setTimeout(async () => {
                        station.startDownload(device, full_path!, cipher_id);
                    }, videoLength * 1000);
                }
            }
        } catch (error) {
            this.logger.error(`Device: ${device.getSerial()} - Error`, error);
        }
    }*/

    private async handlePushNotification(message: PushMessage): Promise<void> {
        try {
            if (message.device_sn !== undefined) {
                //TODO: Deactivated because the decryption of the download has changed.
                /*const device: Device = await this.eufy.getDevice(message.device_sn);
                if ((message.push_count === 1 || message.push_count === undefined) && (message.file_path !== undefined && message.file_path !== "" && message.cipher !== undefined))
                    if (this.config.autoDownloadVideo)
                        await this.downloadEventVideo(device, message.event_time, message.file_path, message.cipher);*/
            }
        } catch (error) {
            if (error instanceof DeviceNotFoundError) {
                //Do nothing
            } else {
                this.logger.error("Handling push notification - Error", error);
            }
        }
    }

    private async onConnect(): Promise<void> {
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

        const stations = await this.eufy.getStations();
        const stationSerials: string[] = [];
        for(const station of stations) {
            stationSerials.push(station.getSerial());
        }
        const devices = await this.eufy.getDevices();
        const deviceSerials: string[] = [];
        for(const device of devices) {
            deviceSerials.push(device.getSerial());
        }

        // Delete obsolete stations
        try {
            const allDevices = await this.getDevicesAsync();
            const reg = new RegExp(`^${this.namespace}\.[0-9A-Z]+$`);
            for (const id of allDevices) {
                if (id._id.match(reg)) {
                    const serial = id._id.replace(`${this.namespace}.`, "");
                    if (!stationSerials.includes(serial)) {
                        await this.delObjectAsync(id._id, { recursive: true });
                    }
                }
            }
        } catch (error) {
            this.log.error(`Delete obsolete stations ERROR - ${JSON.stringify(error)}`);
        }

        // Delete obsolete devices
        try {
            const allDevices = await this.getDevicesAsync();
            const reg = new RegExp(`^${this.namespace}\.[0-9A-Z]+\.[a-z]+\.[0-9A-Z]+$`);
            for (const id of allDevices) {
                if (id._id.match(reg)) {
                    const values = id._id.split(".");
                    const stateChannel = values[3];
                    const serial = values[4];
                    if (!deviceSerials.includes(serial) ||
                        (deviceSerials.includes(serial) && devices[deviceSerials.indexOf(serial)].getStateChannel() !== "unknown" && stateChannel === "unknown")) {
                        await this.delObjectAsync(id._id, { recursive: true });
                    }
                }
            }
        } catch (error) {
            this.log.error(`Delete obsolete devices ERROR - ${JSON.stringify(error)}`);
        }

        // Delete obsolete properties
        try {
            const all = await this.getStatesAsync("*");
            if (all) {
                Object.keys(all).forEach(async (stateid) => {
                    const object = await this.getObjectAsync(stateid);
                    if (object?.native?.name !== undefined) {
                        const tmp = stateid.split(".");
                        if (tmp.length >= 5) {
                            const stationSerial = tmp[2];
                            const deviceSerial = tmp[4];

                            if (deviceSerial.match(/^[A-Z0-9]+/)) {
                                // Device
                                try {
                                    const device = await this.eufy.getDevice(deviceSerial);
                                    if (!device.hasProperty(object.native.name)) {
                                        this.delObjectAsync(stateid);
                                    }
                                } catch (error) {
                                    if (error instanceof DeviceNotFoundError) {
                                    } else {
                                        this.log.error(`Delete obsolete properties ERROR - device - ${JSON.stringify(error)}`);
                                    }
                                }
                            } else {
                                // Station
                                try {
                                    const station = await this.eufy.getStation(stationSerial);
                                    if (!station.hasProperty(object.native.name)) {
                                        this.delObjectAsync(stateid);
                                    }
                                } catch (error) {
                                    if (error instanceof StationNotFoundError) {
                                    } else {
                                        this.log.error(`Delete obsolete properties ERROR - station - ${JSON.stringify(error)}`);
                                    }
                                }
                            }
                        }
                    }
                });
            }
        } catch (error) {
            this.log.error(`Delete obsolete properties ERROR - ${JSON.stringify(error)}`);
        }

        // Delete obsolete directories/files
        try {
            const contents = await this.readDirAsync(this.namespace, "");
            for (const content of contents.filter((fn) => fn.file.match("^T[0-9A-Z]+$") !== null && fn.isDir)) {
                if (!stationSerials.includes(content.file)) {
                    await this.delFileAsync(this.namespace, content.file);
                } else {
                    const dirContents = await this.readDirAsync(this.namespace, content.file);
                    for (const dir of dirContents.filter((fn) => Object.values(DataLocation).includes(fn.file) && fn.isDir)) {
                        const files = await this.readDirAsync(this.namespace, path.join(content.file, dir.file));
                        let deletedFiles = 0;
                        for (const file of files.filter((fn) => !deviceSerials.includes(fn.file.substring(0, 16)) && !fn.isDir)) {
                            await this.delFileAsync(this.namespace, path.join(content.file, dir.file, file.file));
                            deletedFiles++;
                        }
                        if (deletedFiles === files.length) {
                            await this.delFileAsync(this.namespace, path.join(content.file, dir.file));
                        }
                    }
                }
            }
        } catch (error) {
            this.log.error(`Delete obsolete directories/files ERROR - ${error}`);
        }
    }

    private async onClose(): Promise<void> {
        await this.setStateAsync("info.connection", { val: false, ack: true }).catch();
    }

    public getPersistentData(): PersistentData {
        return this.persistentData;
    }

    private async onPushConnect(): Promise<void> {
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

    private async onPushClose(): Promise<void> {
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

    private async onMQTTConnect(): Promise<void> {
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

    private async onMQTTClose(): Promise<void> {
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

    private async onStationCommandResult(station: Station, result: CommandResult): Promise<void> {
        if (result.return_code !== 0 && result.command_type !== CommandType.P2P_QUERY_STATUS_IN_LOCK) {
            this.logger.error(`Station: ${station.getSerial()} command ${CommandType[result.command_type]} failed with error: ${ErrorCode[result.return_code]} (${result.return_code})`);
        }
    }

    private async onStationPropertyChanged(station: Station, name: string, value: PropertyValue): Promise<void> {
        const states = await this.getStatesAsync(`${station.getStateID("", 1)}.*`);
        for (const state in states) {
            const obj = await this.getObjectAsync(state);
            if (obj) {
                if (obj.native.name !== undefined && obj.native.name === name) {
                    await setStateChangedAsync(this as unknown as ioBroker.Adapter, state, (obj.common.type === "string" || obj.common.type === "object") && typeof value === "object" ? JSON.stringify(value) : value);
                    return;
                }
            }
        }
        this.logger.debug(`onStationPropertyChanged(): Property "${name}" not implemented in this adapter (station: ${station.getSerial()} value: ${JSON.stringify(value)})`);
    }

    private async onDevicePropertyChanged(device: Device, name: string, value: PropertyValue): Promise<void> {
        const states = await this.getStatesAsync(`${device.getStateID("", 1)}.*`);
        for (const state in states) {
            const obj = await this.getObjectAsync(state);
            if (obj) {
                if (obj.native.name !== undefined && obj.native.name === name) {
                    await setStateChangedAsync(this as unknown as ioBroker.Adapter, state, (obj.common.type === "string" || obj.common.type === "object") && typeof value === "object" ? JSON.stringify(value) : value);
                    switch(name) {
                        case PropertyName.DeviceRTSPStream:
                            if (value as boolean === false) {
                                this.delStateAsync(device.getStateID(DeviceStateID.RTSP_STREAM_URL));
                            }
                            break;
                    }
                    return;
                }
            }
        }
        if (name === PropertyName.DevicePicture) {
            try {
                const picture = value as Picture;
                const fileName = `${device.getSerial()}.${picture.type.ext}`;
                const filePath = path.join(device.getStationSerial(), DataLocation.LAST_EVENT);
                if (!await this.fileExistsAsync(this.namespace, filePath)) {
                    await this.mkdirAsync(this.namespace, filePath);
                }
                await this.writeFileAsync(this.namespace, path.join(filePath, fileName), picture.data);

                await this.setStateAsync(device.getStateID(DeviceStateID.PICTURE_URL), `/files/${this.namespace}/${device.getStationSerial()}/${DataLocation.LAST_EVENT}/${device.getSerial()}.${picture.type.ext}`, true);
                await setStateChangedAsync(this as unknown as ioBroker.Adapter, device.getStateID(DeviceStateID.PICTURE_HTML), getImageAsHTML(picture.data, picture.type.mime));
            } catch (err) {
                const error = ensureError(err);
                this.logger.error("onDevicePropertyChanged - Property picture - Error", error);
            }
        } else {
            this.logger.debug(`onDevicePropertyChanged(): Property "${name}" not implemented in this adapter (device: ${device.getSerial()} value: ${JSON.stringify(value)})`);
        }
    }

    private async startLivestream(device_sn: string): Promise<void> {
        try {
            const device = await this.eufy.getDevice(device_sn);
            const station = await this.eufy.getStation(device.getStationSerial());

            if (station.isConnected() || station.isEnergySavingDevice()) {
                if (!station.isLiveStreaming(device)) {
                    this.eufy.startStationLivestream(device_sn);
                } else {
                    this.logger.warn(`The stream for the device ${device_sn} cannot be started, because it is already streaming!`);
                }
            } else {
                this.logger.warn(`The stream for the device ${device_sn} cannot be started, because there is no connection to station ${station.getSerial()}!`);
            }
        } catch (error) {
            this.logger.error("Start livestream - Error", error);
        }
    }

    private async stopLivestream(device_sn: string): Promise<void> {
        try {
            const device = await this.eufy.getDevice(device_sn);
            const station = await this.eufy.getStation(device.getStationSerial());
            if (device.isCamera()) {
                const camera = device as Camera;
                if (await this.eufy.isStationConnected(device.getStationSerial()) && station.isLiveStreaming(camera)) {
                    await this.eufy.stopStationLivestream(device_sn);
                } else {
                    this.logger.warn(`The stream for the device ${device_sn} cannot be stopped, because it isn't streaming!`);
                }
            }

        } catch (error) {
            this.logger.error("Stop livestream - Error", error);
        }
    }

    private async onStationLivestreamStart(station: Station, device: Device, metadata: StreamMetadata, videostream: Readable, audiostream: Readable): Promise<void> {
        try {
            this.setStateAsync(device.getStateID(DeviceStateID.LIVESTREAM), { val: `${this.config.https ? "https" : "http"}://${this.config.hostname}:${this.config.go2rtc_api_port}/stream.html?src=${device.getSerial()}`, ack: true });
            this.setStateAsync(device.getStateID(DeviceStateID.LIVESTREAM_RTSP), { val: `rtsp://${this.config.hostname}:${this.config.go2rtc_rtsp_port}/${device.getSerial()}`, ack: true });
            //await ffmpegStreamToGo2rtc(this.config, this.namespace, device.getSerial(), metadata, videostream, audiostream, this.logger);
            await streamToGo2rtc(device.getSerial(), videostream, audiostream, this.logger, this.config, this.namespace, metadata).catch((error) => {
                this.logger.debug(`Station: ${station.getSerial()} Device: ${device.getSerial()} - Stopping livestream...`, error);
            });
        } catch(error) {
            this.logger.error(`Station: ${station.getSerial()} Device: ${device.getSerial()} - Error - Stopping livestream...`, error);
            this.eufy.stopStationLivestream(device.getSerial())
                .catch(async (error) => {
                    this.logger.error(`Station: ${station.getSerial()} Device: ${device.getSerial()} - Error during stopping livestream...`, error);
                });
        }
    }

    private onStationLivestreamStop(_station: Station, device: Device): void {
        this.delStateAsync(device.getStateID(DeviceStateID.LIVESTREAM));
        this.delStateAsync(device.getStateID(DeviceStateID.LIVESTREAM_RTSP));
    }

    /*private async onStationDownloadFinish(_station: Station, _device: Device): Promise<void> {
        //this.logger.trace(`Station: ${station.getSerial()} channel: ${channel}`);
    }*/

    /*private async onStationDownloadStart(station: Station, device: Device, metadata: StreamMetadata, videostream: Readable, audiostream: Readable): Promise<void> {
        try {
            //TODO: Deactivated because the decryption of the download has changed.
            await removeFiles(this, station.getSerial(), DataLocation.TEMP, device.getSerial()).catch();
            const file_path = getDataFilePath(this, station.getSerial(), DataLocation.TEMP, `${device.getSerial()}${STREAM_FILE_NAME_EXT}`);

            await ffmpegStreamToHls(this.config, this.namespace, metadata, videostream, audiostream, file_path, this.logger)
                .then(async () => {
                    if (fse.pathExistsSync(file_path)) {
                        await removeFiles(this, station.getSerial(), DataLocation.LAST_EVENT, device.getSerial());
                        return true;
                    }
                    return false;
                })
                .then(async (result) => {
                    if (result)
                        await moveFiles(this, station.getSerial(), device.getSerial(), DataLocation.TEMP, DataLocation.LAST_EVENT);
                    return result;
                })
                .then(async (result) => {
                    if (result) {
                        const filename_without_ext = getDataFilePath(this, station.getSerial(), DataLocation.LAST_EVENT, device.getSerial());
                        setStateAsync(this, device.getStateID(DeviceStateID.LAST_EVENT_VIDEO_URL), "Last captured video URL", `/${this.namespace}/${station.getSerial()}/${DataLocation.LAST_EVENT}/${device.getSerial()}${STREAM_FILE_NAME_EXT}`, "url");
                        if (fse.pathExistsSync(`${filename_without_ext}${STREAM_FILE_NAME_EXT}`))
                            await ffmpegPreviewImage(this.config, `${filename_without_ext}${STREAM_FILE_NAME_EXT}`, `${filename_without_ext}${IMAGE_FILE_JPEG_EXT}`, this.logger)
                                .then(() => {
                                    setStateAsync(this, device.getStateID(DeviceStateID.LAST_EVENT_PIC_URL), "Last event picture URL", `/${this.namespace}/${station.getSerial()}/${DataLocation.LAST_EVENT}/${device.getSerial()}${IMAGE_FILE_JPEG_EXT}`, "url");
                                    try {
                                        if (fse.existsSync(`${filename_without_ext}${IMAGE_FILE_JPEG_EXT}`)) {
                                            const image_data = getImageAsHTML(fse.readFileSync(`${filename_without_ext}${IMAGE_FILE_JPEG_EXT}`));
                                            setStateAsync(this, device.getStateID(DeviceStateID.LAST_EVENT_PIC_HTML), "Last event picture HTML image", image_data, "html");
                                        }
                                    } catch (error) {
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
        } catch(error) {
            this.logger.error(`Station: ${station.getSerial()} Device: ${device.getSerial()} - Error - Cancelling download...`, error);
            await this.eufy.cancelStationDownload(device.getSerial());
        }
    }*/

    private onStationRTSPUrl(station: Station, device: Device, value: string): void {
        setStateChangedAsync(this as unknown as ioBroker.Adapter, device.getStateID(DeviceStateID.RTSP_STREAM_URL), value);
    }

    private async onStationConnect(station: Station): Promise<void> {
        await this.setObjectNotExistsAsync(station.getStateID(StationStateID.CONNECTION), {
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
        await this.setStateAsync(station.getStateID(StationStateID.CONNECTION), { val: true, ack: true });
    }

    private async onStationClose(station: Station): Promise<void> {
        await this.setObjectNotExistsAsync(station.getStateID(StationStateID.CONNECTION), {
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
        await this.setStateAsync(station.getStateID(StationStateID.CONNECTION), { val: false, ack: true });
    }

    private onTFARequest(): void {
        this.logger.warn(`Two factor authentication request received, please enter valid verification code in state ${this.namespace}.verify_code`);
        this.verify_code= true;
    }

    private onCaptchaRequest(captchaId: string, captcha: string): void {
        this.captchaId = captchaId;
        this.logger.warn(`Captcha authentication request received, please enter valid captcha in state ${this.namespace}.captcha`);
        this.logger.warn(`Captcha: <img src="${captcha}">`);
        this.setStateAsync("received_captcha_html", { val: `<img src="${captcha}">`, ack: true });
    }

}

if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new euSec(options);
} else {
    // otherwise start the instance directly
    (() => new euSec())();
}