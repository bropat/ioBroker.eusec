"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var main_exports = {};
__export(main_exports, {
  euSec: () => euSec
});
module.exports = __toCommonJS(main_exports);
var utils = __toESM(require("@iobroker/adapter-core"));
var path = __toESM(require("path"));
var import_eufy_security_client = require("eufy-security-client");
var import_i18n_iso_countries = require("i18n-iso-countries");
var import_i18n_iso_languages = require("@cospired/i18n-iso-languages");
var import_util = __toESM(require("util"));
var import_child_process = __toESM(require("child_process"));
var import_go2rtc_static = __toESM(require("go2rtc-static"));
var import_ffmpeg_for_homebridge = __toESM(require("ffmpeg-for-homebridge"));
var import_types = require("./lib/types");
var import_utils = require("./lib/utils");
var import_log = require("./lib/log");
var import_video = require("./lib/video");
class euSec extends utils.Adapter {
  eufy;
  /*private downloadEvent: {
      [index: string]: NodeJS.Timeout;
  } = {};*/
  persistentFile = "adapter.json";
  persistentDriverFile = "driver.json";
  logger;
  persistentData = {
    version: ""
  };
  captchaId = null;
  verify_code = false;
  skipInit = false;
  constructor(options = {}) {
    super({
      ...options,
      name: "eusec"
    });
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("message", this.onMessage.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  restartAdapter() {
    this.skipInit = true;
    this.restart();
  }
  /**
   * Is called when databases are connected and adapter received configuration.
   */
  async onReady() {
    var _a;
    this.logger = new import_log.ioBrokerLogger(this.log);
    await this.setObjectNotExistsAsync("verify_code", {
      type: "state",
      common: {
        name: "2FA verification code",
        type: "string",
        role: "state",
        read: true,
        write: true
      },
      native: {}
    });
    await this.setObjectNotExistsAsync("received_captcha_html", {
      type: "state",
      common: {
        name: "Received captcha image HTML",
        type: "string",
        role: "state",
        read: true,
        write: false
      },
      native: {}
    });
    await this.setObjectNotExistsAsync("captcha", {
      type: "state",
      common: {
        name: "Enter captcha",
        type: "string",
        role: "state",
        read: true,
        write: true
      },
      native: {}
    });
    await this.setObjectNotExistsAsync("info", {
      type: "channel",
      common: {
        name: "info"
      },
      native: {}
    });
    await this.setObjectNotExistsAsync("info.connection", {
      type: "state",
      common: {
        name: "Global connection",
        type: "boolean",
        role: "indicator.connection",
        read: true,
        write: false
      },
      native: {}
    });
    await this.setStateAsync("info.connection", { val: false, ack: true });
    await this.setObjectNotExistsAsync("info.push_connection", {
      type: "state",
      common: {
        name: "Push notification connection",
        type: "boolean",
        role: "indicator.connection",
        read: true,
        write: false
      },
      native: {}
    });
    await this.setStateAsync("info.push_connection", { val: false, ack: true });
    await this.setObjectNotExistsAsync("info.mqtt_connection", {
      type: "state",
      common: {
        name: "MQTT connection",
        type: "boolean",
        role: "indicator.connection",
        read: true,
        write: false
      },
      native: {}
    });
    await this.setStateAsync("info.mqtt_connection", { val: false, ack: true });
    try {
      const connection = await this.getStatesAsync("*.connection");
      if (connection)
        Object.keys(connection).forEach(async (id) => {
          await this.setStateAsync(id, { val: false, ack: true });
        });
    } catch (error) {
      this.logger.error("Reset connection states - Error", error);
    }
    try {
      const sensorList = [
        import_eufy_security_client.PropertyName.DeviceMotionDetected,
        import_eufy_security_client.PropertyName.DevicePersonDetected,
        import_eufy_security_client.PropertyName.DeviceSoundDetected,
        import_eufy_security_client.PropertyName.DeviceCryingDetected,
        import_eufy_security_client.PropertyName.DevicePetDetected,
        import_eufy_security_client.PropertyName.DeviceRinging
      ];
      for (const sensorName of sensorList) {
        const sensors = await this.getStatesAsync(`*.${(0, import_utils.convertCamelCaseToSnakeCase)(sensorName)}`);
        if (sensors)
          Object.keys(sensors).forEach(async (id) => {
            await this.setStateAsync(id, { val: false, ack: true });
          });
      }
    } catch (error) {
      this.logger.error("Reset sensor states - Error", error);
    }
    try {
      if (await this.fileExistsAsync(this.namespace, this.persistentFile)) {
        const fileContent = await this.readFileAsync(this.namespace, this.persistentFile);
        this.persistentData = JSON.parse(fileContent.file.toString("utf8"));
      }
    } catch (error) {
      this.logger.debug("No adapter stored data from last exit found.", error);
    }
    let persistentDriverData = "{}";
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
    if (hosts !== void 0 && hosts !== null && Object.values(hosts).length !== 0) {
      if (this.config.hostname === "") {
        this.config.hostname = Object.values(hosts)[0].native.os.hostname;
      }
      const nodeVersion = Object.values(hosts)[0].native.process.versions.node;
      const nodeMajorVersion = nodeVersion.split(".")[0];
      let fixNeeded;
      switch (parseInt(nodeMajorVersion)) {
        case 18:
          fixNeeded = nodeVersion.localeCompare("18.19.1", void 0, { numeric: true, sensitivity: "base" });
          break;
        case 20:
          fixNeeded = nodeVersion.localeCompare("20.11.1", void 0, { numeric: true, sensitivity: "base" });
          break;
        default:
          fixNeeded = nodeVersion.localeCompare("21.6.2", void 0, { numeric: true, sensitivity: "base" });
          break;
      }
      if (fixNeeded >= 0) {
        const adapter = await this.getForeignObjectAsync(`system.adapter.${this.namespace}`);
        if (adapter !== void 0 && adapter !== null) {
          if (!((_a = adapter.common.nodeProcessParams) == null ? void 0 : _a.includes("--security-revert=CVE-2023-46809"))) {
            adapter.common.nodeProcessParams = ["--security-revert=CVE-2023-46809"];
            await this.setForeignObjectAsync(`system.adapter.${this.namespace}`, adapter);
            this.log.warn("Required fix to use livestreaming with this version of Node.js (CVE-2023-46809) applied. Restart of the adapter initiated to activate the fix.");
            this.restartAdapter();
          }
        }
      }
    }
    if (!this.skipInit) {
      const systemConfig = await this.getForeignObjectAsync("system.config");
      let countryCode = void 0;
      let languageCode = void 0;
      if (systemConfig) {
        countryCode = (0, import_i18n_iso_countries.getAlpha2Code)(systemConfig.common.country, "en");
        if ((0, import_i18n_iso_languages.isValid)(systemConfig.common.language))
          languageCode = systemConfig.common.language;
      }
      if (this.config.country !== "iobroker") {
        countryCode = this.config.country;
      }
      try {
        if (this.persistentData.version !== this.version) {
          const currentVersion = Number.parseFloat((0, import_utils.removeLastChar)(this.version, "."));
          const previousVersion = this.persistentData.version !== "" && this.persistentData.version !== void 0 ? Number.parseFloat((0, import_utils.removeLastChar)(this.persistentData.version, ".")) : 0;
          this.logger.debug(`Handling of adapter update - currentVersion: ${currentVersion} previousVersion: ${previousVersion}`);
          if (previousVersion < currentVersion) {
            await (0, import_utils.handleUpdate)(this, this.logger, previousVersion, currentVersion);
            this.persistentData.version = this.version;
            await this.writePersistentData();
          }
        }
      } catch (error) {
        this.logger.error(`Handling of adapter update - Error:`, error);
      }
      let connectionType = import_eufy_security_client.P2PConnectionType.QUICKEST;
      if (this.config.p2pConnectionType === "only_local") {
        connectionType = import_eufy_security_client.P2PConnectionType.ONLY_LOCAL;
      }
      if (this.config.username !== "" && this.config.password !== "") {
        const config = {
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
            level: this.log.level === "silly" ? import_eufy_security_client.LogLevel.Trace : this.log.level === "debug" ? import_eufy_security_client.LogLevel.Debug : this.log.level === "info" ? import_eufy_security_client.LogLevel.Info : this.log.level === "warn" ? import_eufy_security_client.LogLevel.Warn : this.log.level === "error" ? import_eufy_security_client.LogLevel.Error : import_eufy_security_client.LogLevel.Info
          }
        };
        this.eufy = await import_eufy_security_client.EufySecurity.initialize(config, this.logger);
        this.eufy.on("persistent data", (data) => this.onPersistentData(data));
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
        this.eufy.on("device property changed", (device, name, value) => this.onDevicePropertyChanged(device, name, value));
        this.eufy.on("station command result", (station, result) => this.onStationCommandResult(station, result));
        this.eufy.on("station livestream start", (station, device, metadata, videostream, audiostream) => this.onStationLivestreamStart(station, device, metadata, videostream, audiostream));
        this.eufy.on("station livestream stop", (station, device) => this.onStationLivestreamStop(station, device));
        this.eufy.on("station rtsp url", (station, device, value) => this.onStationRTSPUrl(station, device, value));
        this.eufy.on("station property changed", (station, name, value) => this.onStationPropertyChanged(station, name, value));
        this.eufy.on("station connect", (station) => this.onStationConnect(station));
        this.eufy.on("station close", (station) => this.onStationClose(station));
        this.eufy.on("tfa request", () => this.onTFARequest());
        this.eufy.on("captcha request", (captchaId, captcha) => this.onCaptchaRequest(captchaId, captcha));
        this.eufy.setCameraMaxLivestreamDuration(this.config.maxLivestreamDuration);
        await this.eufy.connect();
        if (import_go2rtc_static.default) {
          const go2rtcConfig = {
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
              "bin": import_ffmpeg_for_homebridge.default !== "" && import_ffmpeg_for_homebridge.default !== void 0 ? import_ffmpeg_for_homebridge.default : "ffmpeg"
            },
            "streams": {}
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
          const go2rtc = import_child_process.default.spawn(import_go2rtc_static.default, ["-config", JSON.stringify(go2rtcConfig)], { shell: false, detached: false, windowsHide: true });
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
  async writePersistentData() {
    try {
      await this.writeFileAsync(this.namespace, this.persistentFile, JSON.stringify(this.persistentData));
    } catch (error) {
      this.logger.error(`writePersistentData() - Error: ${error}`);
    }
  }
  onPersistentData(data) {
    this.writeFileAsync(this.namespace, this.persistentDriverFile, data).catch((error) => {
      this.logger.error(`writePersistentDriverData() - Error: ${error}`);
    });
  }
  /**
   * Is called when adapter shuts down - callback has to be called under any circumstances!
   */
  async onUnload(callback) {
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
  async onStateChange(id, state) {
    if (state) {
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
      } else if (station_sn == "captcha") {
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
      } else if (device_type == "station") {
        try {
          const station_state_name = values[4];
          if (this.eufy) {
            const obj = await this.getObjectAsync(id);
            if (obj) {
              if (obj.native.name !== void 0) {
                await this.eufy.setStationProperty(station_sn, obj.native.name, state.val);
                return;
              }
            }
            const station = await this.eufy.getStation(station_sn);
            switch (station_state_name) {
              case import_types.StationStateID.REBOOT:
                await station.rebootHUB();
                break;
              case import_types.StationStateID.TRIGGER_ALARM_SOUND:
                await station.triggerStationAlarmSound(this.config.alarmSoundDuration);
                break;
              case import_types.StationStateID.RESET_ALARM_SOUND:
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
            if (obj.native.name !== void 0) {
              try {
                await this.eufy.setDeviceProperty(device_sn, obj.native.name, obj.common.type === "object" ? JSON.parse(state.val) : state.val);
              } catch (error) {
                this.logger.error(`Error in setting property value (property: ${obj.native.name} value: ${state.val})`, error);
              }
              return;
            }
          }
          const device_state_name = values[5];
          const station = await this.eufy.getStation(station_sn);
          const device = await this.eufy.getDevice(device_sn);
          switch (device_state_name) {
            case import_types.DeviceStateID.START_STREAM:
              await this.startLivestream(device_sn);
              break;
            case import_types.DeviceStateID.STOP_STREAM:
              await this.stopLivestream(device_sn);
              break;
            case import_types.DeviceStateID.TRIGGER_ALARM_SOUND:
              await station.triggerDeviceAlarmSound(device, this.config.alarmSoundDuration);
              break;
            case import_types.DeviceStateID.RESET_ALARM_SOUND:
              await station.resetDeviceAlarmSound(device);
              break;
            case import_types.DeviceStateID.ROTATE_360:
              await station.panAndTilt(device, import_eufy_security_client.PanTiltDirection.ROTATE360);
              break;
            case import_types.DeviceStateID.PAN_LEFT:
              await station.panAndTilt(device, import_eufy_security_client.PanTiltDirection.LEFT);
              break;
            case import_types.DeviceStateID.PAN_RIGHT:
              await station.panAndTilt(device, import_eufy_security_client.PanTiltDirection.RIGHT);
              break;
            case import_types.DeviceStateID.TILT_UP:
              await station.panAndTilt(device, import_eufy_security_client.PanTiltDirection.UP);
              break;
            case import_types.DeviceStateID.TILT_DOWN:
              await station.panAndTilt(device, import_eufy_security_client.PanTiltDirection.DOWN);
              break;
            case import_types.DeviceStateID.CALIBRATE:
              if (device.isLock()) {
                await station.calibrateLock(device);
              } else {
                await station.calibrate(device);
              }
              break;
            case import_types.DeviceStateID.UNLOCK:
              await station.unlock(device);
              break;
            case import_types.DeviceStateID.SET_DEFAULT_ANGLE:
              await station.setDefaultAngle(device);
              break;
            case import_types.DeviceStateID.SET_PRIVACY_ANGLE:
              await station.setPrivacyAngle(device);
              break;
            case import_types.DeviceStateID.OPEN_BOX:
              await station.open(device);
              break;
          }
        } catch (error) {
          this.logger.error(`cameras - Error:`, error);
        }
      }
    } else {
      this.logger.debug(`state ${id} deleted`);
    }
  }
  /**
   * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
   * Using this method requires "common.message" property to be set to true in io-package.json
   */
  async onMessage(obj) {
    if (typeof obj === "object" && obj.message) {
      try {
        if (obj.command === "quickResponse") {
          this.log.debug(`quickResponse command - message: ${JSON.stringify(obj.message)}`);
          if (typeof obj.message === "object" && typeof obj.message.station_sn === "string" && obj.message.station_sn !== "" && typeof obj.message.device_sn === "string" && obj.message.device_sn !== "" && typeof obj.message.voice_id === "number") {
            try {
              const station = await this.eufy.getStation(obj.message.station_sn);
              const device = await this.eufy.getDevice(obj.message.device_sn);
              if (device.hasCommand(import_eufy_security_client.CommandName.DeviceQuickResponse)) {
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
              if (error instanceof import_eufy_security_client.StationNotFoundError) {
                if (obj.callback)
                  this.sendTo(obj.from, obj.command, {
                    sended: false,
                    result: "quickResponse command not sended because specified station doesn't exists"
                  }, obj.callback);
              } else if (error instanceof import_eufy_security_client.DeviceNotFoundError) {
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
          if (typeof obj.message === "object" && typeof obj.message.device_sn === "string" && obj.message.device_sn !== "") {
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
          if (typeof obj.message === "object" && typeof obj.message.station_sn === "string" && obj.message.station_sn !== "" && typeof obj.message.device_sn === "string" && obj.message.device_sn !== "" && typeof obj.message.snooze_time === "number" && (obj.message.snooze_chime === void 0 || typeof obj.message.snooze_chime === "boolean") && (obj.message.snooze_homebase === void 0 || typeof obj.message.snooze_homebase === "boolean") && (obj.message.snooze_motion === void 0 || typeof obj.message.snooze_motion === "boolean")) {
            try {
              const station = await this.eufy.getStation(obj.message.station_sn);
              const device = await this.eufy.getDevice(obj.message.device_sn);
              if (device.hasCommand(import_eufy_security_client.CommandName.DeviceSnooze)) {
                await station.snooze(device, {
                  snooze_time: obj.message.snooze_time,
                  snooze_chime: obj.message.snooze_chime,
                  snooze_homebase: obj.message.snooze_homebase,
                  snooze_motion: obj.message.snooze_motion
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
              if (error instanceof import_eufy_security_client.StationNotFoundError) {
                if (obj.callback)
                  this.sendTo(obj.from, obj.command, {
                    sended: false,
                    result: "snooze command not sended because specified station doesn't exists"
                  }, obj.callback);
              } else if (error instanceof import_eufy_security_client.DeviceNotFoundError) {
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
          if (typeof obj.message === "object" && typeof obj.message.station_sn === "string" && obj.message.station_sn !== "" && (obj.message.ringtone === void 0 || typeof obj.message.ringtone === "number")) {
            try {
              const station = await this.eufy.getStation(obj.message.station_sn);
              if (station.hasCommand(import_eufy_security_client.CommandName.StationChime)) {
                await station.chimeHomebase(obj.message.ringtone !== void 0 && typeof obj.message.ringtone === "number" ? obj.message.ringtone : 0);
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
              if (error instanceof import_eufy_security_client.StationNotFoundError) {
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
        const errorMessage = `Error during processing of received message: ${error instanceof Error ? `${error.name} - ${error.message}` : error}`;
        this.log.error(errorMessage);
        if (obj.callback)
          this.sendTo(obj.from, obj.command, {
            sended: false,
            result: errorMessage
          }, obj.callback);
      }
    }
  }
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
        state.role = import_types.RoleMapping[property.name] !== void 0 ? import_types.RoleMapping[property.name] : "value";
        break;
      }
      case "string": {
        state.role = import_types.RoleMapping[property.name] !== void 0 ? import_types.RoleMapping[property.name] : "text";
        break;
      }
      case "boolean": {
        state.role = import_types.RoleMapping[property.name] !== void 0 ? import_types.RoleMapping[property.name] : property.writeable ? "switch.enable" : "state";
        break;
      }
    }
    return state;
  }
  async createAndSetState(device, property) {
    if (property.name !== import_eufy_security_client.PropertyName.Type && property.name !== import_eufy_security_client.PropertyName.DeviceStationSN) {
      const state = this.getStateCommon(property);
      const id = device.getStateID((0, import_utils.convertCamelCaseToSnakeCase)(property.name));
      const obj = await this.getObjectAsync(id);
      if (obj) {
        let changed = false;
        if (obj.native.name !== void 0 && obj.native.name !== property.name) {
          obj.native.name = property.name;
          changed = true;
        }
        if (obj.native.key !== void 0 && obj.native.key !== property.key) {
          obj.native.key = property.key;
          changed = true;
        }
        if (obj.native.commandId !== void 0 && obj.native.commandId !== property.commandId) {
          obj.native.commandId = property.commandId;
          changed = true;
        }
        if (obj.common !== void 0 && !import_util.default.isDeepStrictEqual(obj.common, state)) {
          changed = true;
        }
        if (changed) {
          const propertyMetadata = device.getPropertiesMetadata()[property.name];
          if (propertyMetadata !== void 0) {
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
            name: property.name
          }
        });
      }
      const value = device.getPropertyValue(property.name);
      if (value !== void 0)
        await (0, import_utils.setStateChangedAsync)(this, id, (property.type === "string" || property.type === "object") && typeof value === "object" ? JSON.stringify(value) : value);
    }
  }
  async onDeviceAdded(device) {
    this.logger.debug(`onDeviceAdded - device: ${device.getSerial()}`);
    await this.setObjectNotExistsAsync(device.getStateID("", 0), {
      type: "channel",
      common: {
        name: device.getStateChannel()
      },
      native: {}
    });
    await this.setObjectNotExistsAsync(device.getStateID("", 1), {
      type: "device",
      common: {
        name: device.getName()
      },
      native: {}
    });
    const metadata = device.getPropertiesMetadata();
    for (const property of Object.values(metadata)) {
      if (property.name !== import_eufy_security_client.PropertyName.DevicePicture)
        this.createAndSetState(device, property);
    }
    if (device.hasProperty(import_eufy_security_client.PropertyName.DevicePicture)) {
      await this.setObjectNotExistsAsync(device.getStateID(import_types.DeviceStateID.PICTURE_URL), {
        type: "state",
        common: {
          name: "Picture URL",
          type: "string",
          role: "url",
          read: true,
          write: false
        },
        native: {}
      });
      await this.setObjectNotExistsAsync(device.getStateID(import_types.DeviceStateID.PICTURE_HTML), {
        type: "state",
        common: {
          name: "Picture HTML image",
          type: "string",
          role: "html",
          read: true,
          write: false
        },
        native: {}
      });
    }
    if (device.hasCommand(import_eufy_security_client.CommandName.DeviceTriggerAlarmSound)) {
      await this.setObjectNotExistsAsync(device.getStateID(import_types.DeviceStateID.TRIGGER_ALARM_SOUND), {
        type: "state",
        common: {
          name: "Trigger Alarm Sound",
          type: "boolean",
          role: "button.start",
          read: false,
          write: true
        },
        native: {}
      });
      await this.setObjectNotExistsAsync(device.getStateID(import_types.DeviceStateID.RESET_ALARM_SOUND), {
        type: "state",
        common: {
          name: "Reset Alarm Sound",
          type: "boolean",
          role: "button.start",
          read: false,
          write: true
        },
        native: {}
      });
    }
    if (device.hasCommand(import_eufy_security_client.CommandName.DevicePanAndTilt)) {
      await this.setObjectNotExistsAsync(device.getStateID(import_types.DeviceStateID.PAN_LEFT), {
        type: "state",
        common: {
          name: "Pan Left",
          type: "boolean",
          role: "button.start",
          read: false,
          write: true
        },
        native: {}
      });
      await this.setObjectNotExistsAsync(device.getStateID(import_types.DeviceStateID.PAN_RIGHT), {
        type: "state",
        common: {
          name: "Pan Right",
          type: "boolean",
          role: "button.start",
          read: false,
          write: true
        },
        native: {}
      });
      await this.setObjectNotExistsAsync(device.getStateID(import_types.DeviceStateID.ROTATE_360), {
        type: "state",
        common: {
          name: "Rotate 360\xB0",
          type: "boolean",
          role: "button.start",
          read: false,
          write: true
        },
        native: {}
      });
      await this.setObjectNotExistsAsync(device.getStateID(import_types.DeviceStateID.TILT_UP), {
        type: "state",
        common: {
          name: "Tilt Up",
          type: "boolean",
          role: "button.start",
          read: false,
          write: true
        },
        native: {}
      });
      await this.setObjectNotExistsAsync(device.getStateID(import_types.DeviceStateID.TILT_DOWN), {
        type: "state",
        common: {
          name: "Tilt Down",
          type: "boolean",
          role: "button.start",
          read: false,
          write: true
        },
        native: {}
      });
    }
    if (device.hasCommand(import_eufy_security_client.CommandName.DeviceLockCalibration)) {
      await this.setObjectNotExistsAsync(device.getStateID(import_types.DeviceStateID.CALIBRATE), {
        type: "state",
        common: {
          name: "Calibrate Lock",
          type: "boolean",
          role: "button.start",
          read: false,
          write: true
        },
        native: {}
      });
    }
    if (device.hasCommand(import_eufy_security_client.CommandName.DeviceUnlock)) {
      await this.setObjectNotExistsAsync(device.getStateID(import_types.DeviceStateID.UNLOCK), {
        type: "state",
        common: {
          name: "Unlock",
          type: "boolean",
          role: "button.start",
          read: false,
          write: true
        },
        native: {}
      });
    }
    if (device.hasCommand(import_eufy_security_client.CommandName.DeviceSetDefaultAngle)) {
      await this.setObjectNotExistsAsync(device.getStateID(import_types.DeviceStateID.SET_DEFAULT_ANGLE), {
        type: "state",
        common: {
          name: "Set Default Angle",
          type: "boolean",
          role: "button.start",
          read: false,
          write: true
        },
        native: {}
      });
    }
    if (device.hasCommand(import_eufy_security_client.CommandName.DeviceSetPrivacyAngle)) {
      await this.setObjectNotExistsAsync(device.getStateID(import_types.DeviceStateID.SET_PRIVACY_ANGLE), {
        type: "state",
        common: {
          name: "Set Default Angle",
          type: "boolean",
          role: "button.start",
          read: false,
          write: true
        },
        native: {}
      });
    }
    if (device.hasCommand(import_eufy_security_client.CommandName.DeviceCalibrate)) {
      await this.setObjectNotExistsAsync(device.getStateID(import_types.DeviceStateID.CALIBRATE), {
        type: "state",
        common: {
          name: "Calibrate",
          type: "boolean",
          role: "button.start",
          read: false,
          write: true
        },
        native: {}
      });
    }
    if (device.hasCommand(import_eufy_security_client.CommandName.DeviceOpen)) {
      await this.setObjectNotExistsAsync(device.getStateID(import_types.DeviceStateID.OPEN_BOX), {
        type: "state",
        common: {
          name: "Open Box",
          type: "boolean",
          role: "button.start",
          read: false,
          write: true
        },
        native: {}
      });
    }
    if (device.hasCommand(import_eufy_security_client.CommandName.DeviceStartLivestream)) {
      await this.setObjectNotExistsAsync(device.getStateID(import_types.DeviceStateID.START_STREAM), {
        type: "state",
        common: {
          name: "Start stream",
          type: "boolean",
          role: "button.start",
          read: false,
          write: true
        },
        native: {}
      });
      await this.setObjectNotExistsAsync(device.getStateID(import_types.DeviceStateID.STOP_STREAM), {
        type: "state",
        common: {
          name: "Stop stream",
          type: "boolean",
          role: "button.stop",
          read: false,
          write: true
        },
        native: {}
      });
      await this.setObjectNotExistsAsync(device.getStateID(import_types.DeviceStateID.LIVESTREAM), {
        type: "state",
        common: {
          name: "Livestream URL",
          type: "string",
          role: "url",
          read: true,
          write: false
        },
        native: {}
      });
      await this.setObjectNotExistsAsync(device.getStateID(import_types.DeviceStateID.LIVESTREAM_RTSP), {
        type: "state",
        common: {
          name: "Livestream RTSP URL",
          type: "string",
          role: "url",
          read: true,
          write: false
        },
        native: {}
      });
    }
    if (device.hasProperty(import_eufy_security_client.PropertyName.DeviceRTSPStream)) {
      await this.setObjectNotExistsAsync(device.getStateID(import_types.DeviceStateID.RTSP_STREAM_URL), {
        type: "state",
        common: {
          name: "RTSP stream URL",
          type: "string",
          role: "url",
          read: true,
          write: false
        },
        native: {}
      });
    }
  }
  async onDeviceRemoved(device) {
    this.delObjectAsync(device.getStateID("", 0), { recursive: true }).catch((error) => {
      this.logger.error(`Error deleting states of removed device`, error);
    });
    (0, import_utils.removeFiles)(this, device.getStationSerial(), import_types.DataLocation.LAST_EVENT, device.getSerial()).catch((error) => {
      this.logger.error(`Error deleting fs contents of removed device`, error);
    });
  }
  async onStationAdded(station) {
    this.subscribeStates(`${station.getStateID("", 0)}.*`);
    await this.setObjectNotExistsAsync(station.getStateID("", 0), {
      type: "device",
      common: {
        name: station.getName()
      },
      native: {}
    });
    await this.setObjectNotExistsAsync(station.getStateID("", 1), {
      type: "channel",
      common: {
        name: station.getStateChannel()
      },
      native: {}
    });
    await this.setObjectNotExistsAsync(station.getStateID(import_types.StationStateID.CONNECTION), {
      type: "state",
      common: {
        name: "Connection",
        type: "boolean",
        role: "indicator.connection",
        read: true,
        write: false
      },
      native: {}
    });
    await this.setStateAsync(station.getStateID(import_types.StationStateID.CONNECTION), { val: false, ack: true });
    const metadata = station.getPropertiesMetadata();
    for (const property of Object.values(metadata)) {
      this.createAndSetState(station, property);
    }
    if (station.hasCommand(import_eufy_security_client.CommandName.StationReboot)) {
      await this.setObjectNotExistsAsync(station.getStateID(import_types.StationStateID.REBOOT), {
        type: "state",
        common: {
          name: "Reboot station",
          type: "boolean",
          role: "button.start",
          read: false,
          write: true
        },
        native: {}
      });
    }
    if (station.hasCommand(import_eufy_security_client.CommandName.StationTriggerAlarmSound)) {
      await this.setObjectNotExistsAsync(station.getStateID(import_types.StationStateID.TRIGGER_ALARM_SOUND), {
        type: "state",
        common: {
          name: "Trigger Alarm Sound",
          type: "boolean",
          role: "button.start",
          read: false,
          write: true
        },
        native: {}
      });
      await this.setObjectNotExistsAsync(station.getStateID(import_types.StationStateID.RESET_ALARM_SOUND), {
        type: "state",
        common: {
          name: "Reset Alarm Sound",
          type: "boolean",
          role: "button.start",
          read: false,
          write: true
        },
        native: {}
      });
    }
  }
  async onStationRemoved(station) {
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
  async handlePushNotification(message) {
    try {
      if (message.device_sn !== void 0) {
      }
    } catch (error) {
      if (error instanceof import_eufy_security_client.DeviceNotFoundError) {
      } else {
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
      native: {}
    });
    await this.setObjectNotExistsAsync("info.connection", {
      type: "state",
      common: {
        name: "Global connection",
        type: "boolean",
        role: "indicator.connection",
        read: true,
        write: false
      },
      native: {}
    });
    await this.setStateAsync("info.connection", { val: true, ack: true });
    const stations = await this.eufy.getStations();
    const stationSerials = [];
    for (const station of stations) {
      stationSerials.push(station.getSerial());
    }
    const devices = await this.eufy.getDevices();
    const deviceSerials = [];
    for (const device of devices) {
      deviceSerials.push(device.getSerial());
    }
    try {
      const allDevices = await this.getDevicesAsync();
      const reg = new RegExp(`^${this.namespace}.[0-9A-Z]+$`);
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
    try {
      const allDevices = await this.getDevicesAsync();
      const reg = new RegExp(`^${this.namespace}.[0-9A-Z]+.[a-z]+.[0-9A-Z]+$`);
      for (const id of allDevices) {
        if (id._id.match(reg)) {
          const values = id._id.split(".");
          const stateChannel = values[3];
          const serial = values[4];
          if (!deviceSerials.includes(serial) || deviceSerials.includes(serial) && devices[deviceSerials.indexOf(serial)].getStateChannel() !== "unknown" && stateChannel === "unknown") {
            await this.delObjectAsync(id._id, { recursive: true });
          }
        }
      }
    } catch (error) {
      this.log.error(`Delete obsolete devices ERROR - ${JSON.stringify(error)}`);
    }
    try {
      const all = await this.getStatesAsync("*");
      if (all) {
        Object.keys(all).forEach(async (stateid) => {
          var _a;
          const object = await this.getObjectAsync(stateid);
          if (((_a = object == null ? void 0 : object.native) == null ? void 0 : _a.name) !== void 0) {
            const tmp = stateid.split(".");
            if (tmp.length >= 5) {
              const stationSerial = tmp[2];
              const deviceSerial = tmp[4];
              if (deviceSerial.match(/^[A-Z0-9]+/)) {
                try {
                  const device = await this.eufy.getDevice(deviceSerial);
                  if (!device.hasProperty(object.native.name)) {
                    this.delObjectAsync(stateid);
                  }
                } catch (error) {
                  if (error instanceof import_eufy_security_client.DeviceNotFoundError) {
                  } else {
                    this.log.error(`Delete obsolete properties ERROR - device - ${JSON.stringify(error)}`);
                  }
                }
              } else {
                try {
                  const station = await this.eufy.getStation(stationSerial);
                  if (!station.hasProperty(object.native.name)) {
                    this.delObjectAsync(stateid);
                  }
                } catch (error) {
                  if (error instanceof import_eufy_security_client.StationNotFoundError) {
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
    try {
      const contents = await this.readDirAsync(this.namespace, "");
      for (const content of contents.filter((fn) => fn.file.match("^T[0-9A-Z]+$") !== null && fn.isDir)) {
        if (!stationSerials.includes(content.file)) {
          await this.delFileAsync(this.namespace, content.file);
        } else {
          const dirContents = await this.readDirAsync(this.namespace, content.file);
          for (const dir of dirContents.filter((fn) => Object.values(import_types.DataLocation).includes(fn.file) && fn.isDir)) {
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
  async onClose() {
    await this.setStateAsync("info.connection", { val: false, ack: true }).catch();
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
      native: {}
    });
    await this.setObjectNotExistsAsync("info.push_connection", {
      type: "state",
      common: {
        name: "Push notification connection",
        type: "boolean",
        role: "indicator.connection",
        read: true,
        write: false
      },
      native: {}
    });
    await this.setStateAsync("info.push_connection", { val: true, ack: true });
  }
  async onPushClose() {
    await this.setObjectNotExistsAsync("info", {
      type: "channel",
      common: {
        name: "info"
      },
      native: {}
    });
    await this.setObjectNotExistsAsync("info.push_connection", {
      type: "state",
      common: {
        name: "Push notification connection",
        type: "boolean",
        role: "indicator.connection",
        read: true,
        write: false
      },
      native: {}
    });
    await this.setStateAsync("info.push_connection", { val: false, ack: true });
  }
  async onMQTTConnect() {
    await this.setObjectNotExistsAsync("info", {
      type: "channel",
      common: {
        name: "info"
      },
      native: {}
    });
    await this.setObjectNotExistsAsync("info.mqtt_connection", {
      type: "state",
      common: {
        name: "MQTT connection",
        type: "boolean",
        role: "indicator.connection",
        read: true,
        write: false
      },
      native: {}
    });
    await this.setStateAsync("info.mqtt_connection", { val: true, ack: true });
  }
  async onMQTTClose() {
    await this.setObjectNotExistsAsync("info", {
      type: "channel",
      common: {
        name: "info"
      },
      native: {}
    });
    await this.setObjectNotExistsAsync("info.mqtt_connection", {
      type: "state",
      common: {
        name: "MQTT connection",
        type: "boolean",
        role: "indicator.connection",
        read: true,
        write: false
      },
      native: {}
    });
    await this.setStateAsync("info.mqtt_connection", { val: false, ack: true });
  }
  async onStationCommandResult(station, result) {
    if (result.return_code !== 0 && result.command_type !== import_eufy_security_client.CommandType.P2P_QUERY_STATUS_IN_LOCK) {
      this.logger.error(`Station: ${station.getSerial()} command ${import_eufy_security_client.CommandType[result.command_type]} failed with error: ${import_eufy_security_client.ErrorCode[result.return_code]} (${result.return_code})`);
    }
  }
  async onStationPropertyChanged(station, name, value) {
    const states = await this.getStatesAsync(`${station.getStateID("", 1)}.*`);
    for (const state in states) {
      const obj = await this.getObjectAsync(state);
      if (obj) {
        if (obj.native.name !== void 0 && obj.native.name === name) {
          await (0, import_utils.setStateChangedAsync)(this, state, (obj.common.type === "string" || obj.common.type === "object") && typeof value === "object" ? JSON.stringify(value) : value);
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
        if (obj.native.name !== void 0 && obj.native.name === name) {
          await (0, import_utils.setStateChangedAsync)(this, state, (obj.common.type === "string" || obj.common.type === "object") && typeof value === "object" ? JSON.stringify(value) : value);
          switch (name) {
            case import_eufy_security_client.PropertyName.DeviceRTSPStream:
              if (value === false) {
                this.delStateAsync(device.getStateID(import_types.DeviceStateID.RTSP_STREAM_URL));
              }
              break;
          }
          return;
        }
      }
    }
    if (name === import_eufy_security_client.PropertyName.DevicePicture) {
      try {
        const picture = value;
        const fileName = `${device.getSerial()}.${picture.type.ext}`;
        const filePath = path.join(device.getStationSerial(), import_types.DataLocation.LAST_EVENT);
        if (!await this.fileExistsAsync(this.namespace, filePath)) {
          await this.mkdirAsync(this.namespace, filePath);
        }
        await this.writeFileAsync(this.namespace, path.join(filePath, fileName), picture.data);
        await this.setStateAsync(device.getStateID(import_types.DeviceStateID.PICTURE_URL), `/files/${this.namespace}/${device.getStationSerial()}/${import_types.DataLocation.LAST_EVENT}/${device.getSerial()}.${picture.type.ext}`, true);
        await (0, import_utils.setStateChangedAsync)(this, device.getStateID(import_types.DeviceStateID.PICTURE_HTML), (0, import_utils.getImageAsHTML)(picture.data, picture.type.mime));
      } catch (err) {
        const error = (0, import_eufy_security_client.ensureError)(err);
        this.logger.error("onDevicePropertyChanged - Property picture - Error", error);
      }
    } else {
      this.logger.debug(`onDevicePropertyChanged(): Property "${name}" not implemented in this adapter (device: ${device.getSerial()} value: ${JSON.stringify(value)})`);
    }
  }
  async startLivestream(device_sn) {
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
  async stopLivestream(device_sn) {
    try {
      const device = await this.eufy.getDevice(device_sn);
      const station = await this.eufy.getStation(device.getStationSerial());
      if (device.isCamera()) {
        const camera = device;
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
  async onStationLivestreamStart(station, device, metadata, videostream, audiostream) {
    try {
      this.setStateAsync(device.getStateID(import_types.DeviceStateID.LIVESTREAM), { val: `${this.config.https ? "https" : "http"}://${this.config.hostname}:${this.config.go2rtc_api_port}/stream.html?src=${device.getSerial()}`, ack: true });
      this.setStateAsync(device.getStateID(import_types.DeviceStateID.LIVESTREAM_RTSP), { val: `rtsp://${this.config.hostname}:${this.config.go2rtc_rtsp_port}/${device.getSerial()}`, ack: true });
      await (0, import_video.streamToGo2rtc)(device.getSerial(), videostream, audiostream, this.logger, this.config, this.namespace, metadata).catch((error) => {
        this.logger.debug(`Station: ${station.getSerial()} Device: ${device.getSerial()} - Stopping livestream...`, error);
      });
    } catch (error) {
      this.logger.error(`Station: ${station.getSerial()} Device: ${device.getSerial()} - Error - Stopping livestream...`, error);
      this.eufy.stopStationLivestream(device.getSerial()).catch(async (error2) => {
        this.logger.error(`Station: ${station.getSerial()} Device: ${device.getSerial()} - Error during stopping livestream...`, error2);
      });
    }
  }
  onStationLivestreamStop(_station, device) {
    this.delStateAsync(device.getStateID(import_types.DeviceStateID.LIVESTREAM));
    this.delStateAsync(device.getStateID(import_types.DeviceStateID.LIVESTREAM_RTSP));
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
  onStationRTSPUrl(station, device, value) {
    (0, import_utils.setStateChangedAsync)(this, device.getStateID(import_types.DeviceStateID.RTSP_STREAM_URL), value);
  }
  async onStationConnect(station) {
    await this.setObjectNotExistsAsync(station.getStateID(import_types.StationStateID.CONNECTION), {
      type: "state",
      common: {
        name: "Connection",
        type: "boolean",
        role: "indicator.connection",
        read: true,
        write: false
      },
      native: {}
    });
    await this.setStateAsync(station.getStateID(import_types.StationStateID.CONNECTION), { val: true, ack: true });
  }
  async onStationClose(station) {
    await this.setObjectNotExistsAsync(station.getStateID(import_types.StationStateID.CONNECTION), {
      type: "state",
      common: {
        name: "Connection",
        type: "boolean",
        role: "indicator.connection",
        read: true,
        write: false
      },
      native: {}
    });
    await this.setStateAsync(station.getStateID(import_types.StationStateID.CONNECTION), { val: false, ack: true });
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
if (require.main !== module) {
  module.exports = (options) => new euSec(options);
} else {
  (() => new euSec())();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  euSec
});
//# sourceMappingURL=main.js.map
