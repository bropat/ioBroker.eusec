"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var utils = __toESM(require("@iobroker/adapter-core"));
var path = __toESM(require("path"));
var import_eufy_security_client = require("eufy-security-client");
var import_i18n_iso_countries = require("i18n-iso-countries");
var import_i18n_iso_languages = require("@cospired/i18n-iso-languages");
var import_fs_extra = __toESM(require("fs-extra"));
var import_util = __toESM(require("util"));
var import_child_process = __toESM(require("child_process"));
var import_go2rtc_static = __toESM(require("go2rtc-static"));
var import_os = __toESM(require("os"));
var import_ffmpeg_static = __toESM(require("ffmpeg-static"));
var import_types = require("./lib/types");
var import_utils = require("./lib/utils");
var import_log = require("./lib/log");
var import_video = require("./lib/video");
class euSec extends utils.Adapter {
  eufy;
  persistentFile;
  logger;
  persistentData = {
    version: ""
  };
  captchaId = null;
  verify_code = false;
  constructor(options = {}) {
    super({
      ...options,
      name: "eusec"
    });
    const data_dir = utils.getAbsoluteInstanceDataDir(this);
    this.persistentFile = path.join(data_dir, "adapter.json");
    if (!import_fs_extra.default.existsSync(data_dir))
      import_fs_extra.default.mkdirSync(data_dir);
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  async onReady() {
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
      if (import_fs_extra.default.statSync(this.persistentFile).isFile()) {
        const fileContent = import_fs_extra.default.readFileSync(this.persistentFile, "utf8");
        this.persistentData = JSON.parse(fileContent);
      }
    } catch (error) {
      this.logger.debug("No stored data from last exit found.", error);
    }
    this.subscribeStates("verify_code");
    this.subscribeStates("captcha");
    const systemConfig = await this.getForeignObjectAsync("system.config");
    let countryCode = void 0;
    let languageCode = void 0;
    if (systemConfig) {
      countryCode = (0, import_i18n_iso_countries.getAlpha2Code)(systemConfig.common.country, "en");
      if ((0, import_i18n_iso_languages.isValid)(systemConfig.common.language))
        languageCode = systemConfig.common.language;
    }
    if (this.config.hostname === "") {
      this.config.hostname = import_os.default.hostname();
    }
    try {
      if (this.persistentData.version !== this.version) {
        const currentVersion = Number.parseFloat((0, import_utils.removeLastChar)(this.version, "."));
        const previousVersion = this.persistentData.version !== "" && this.persistentData.version !== void 0 ? Number.parseFloat((0, import_utils.removeLastChar)(this.persistentData.version, ".")) : 0;
        this.logger.debug(`Handling of adapter update - currentVersion: ${currentVersion} previousVersion: ${previousVersion}`);
        if (previousVersion < currentVersion) {
          await (0, import_utils.handleUpdate)(this, this.logger, previousVersion);
          this.persistentData.version = this.version;
          this.writePersistentData();
        }
      }
    } catch (error) {
      this.logger.error(`Handling of adapter update - Error:`, error);
    }
    let connectionType = import_eufy_security_client.P2PConnectionType.QUICKEST;
    if (this.config.p2pConnectionType === "only_local") {
      connectionType = import_eufy_security_client.P2PConnectionType.ONLY_LOCAL;
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
      logging: {
        level: this.log.level === "silly" ? import_eufy_security_client.LogLevel.Trace : this.log.level === "debug" ? import_eufy_security_client.LogLevel.Debug : this.log.level === "info" ? import_eufy_security_client.LogLevel.Info : this.log.level === "warn" ? import_eufy_security_client.LogLevel.Warn : this.log.level === "error" ? import_eufy_security_client.LogLevel.Error : import_eufy_security_client.LogLevel.Info
      }
    };
    this.eufy = await import_eufy_security_client.EufySecurity.initialize(config, this.logger);
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
          "bin": import_ffmpeg_static.default !== "" && import_ffmpeg_static.default !== void 0 ? import_ffmpeg_static.default : "ffmpeg"
        },
        "streams": {}
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
    const channels = await this.getChannelsAsync();
    for (const channel of channels) {
      if (channel.common.name === "unknown") {
        this.log.warn(`Found unknown channel: ${channel._id}`);
        const states = await this.getStatesAsync(`${channel._id}.*`);
        this.log.warn(`states: ${JSON.stringify(states)} count: ${Object.keys(states).length}`);
        if (Object.keys(states).length === 0) {
          this.log.warn(`Delete channel: ${channel._id}`);
          await this.delObjectAsync(channel._id);
        }
      }
    }
  }
  writePersistentData() {
    try {
      import_fs_extra.default.writeFileSync(this.persistentFile, JSON.stringify(this.persistentData));
    } catch (error) {
      this.logger.error(`writePersistentData() - Error: ${error}`);
    }
  }
  async onUnload(callback) {
    try {
      this.writePersistentData();
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
          }
        } catch (error) {
          this.logger.error(`cameras - Error:`, error);
        }
      }
    } else {
      this.logger.debug(`state ${id} deleted`);
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
    import_fs_extra.default.remove(path.join(utils.getAbsoluteInstanceDataDir(this), station.getSerial())).catch((error) => {
      this.logger.error(`Error deleting fs contents of removed station`, error);
    });
  }
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
    new Promise(async (resolve, reject) => {
      try {
        const dir_path = path.join(utils.getAbsoluteInstanceDataDir(this));
        if (import_fs_extra.default.existsSync(dir_path)) {
          for (const content of import_fs_extra.default.readdirSync(dir_path).filter((fn) => fn.match("^T[0-9A-Z]+$") !== null)) {
            if (!stationSerials.includes(content)) {
              import_fs_extra.default.removeSync(path.join(dir_path, content));
            } else {
              for (const dir of import_fs_extra.default.readdirSync(path.join(dir_path, content))) {
                if (dir === import_types.DataLocation.LIVESTREAM || dir === import_types.DataLocation.LAST_LIVESTREAM || dir === import_types.DataLocation.TEMP) {
                  import_fs_extra.default.removeSync(path.join(dir_path, content, dir));
                } else {
                  const files = import_fs_extra.default.readdirSync(path.join(dir_path, content, dir));
                  let deletedFiles = 0;
                  for (const file of files) {
                    if (!deviceSerials.includes(file.substring(0, 16))) {
                      import_fs_extra.default.removeSync(path.join(dir_path, content, dir, file));
                      deletedFiles++;
                    }
                  }
                  if (deletedFiles === files.length) {
                    import_fs_extra.default.removeSync(path.join(dir_path, content, dir));
                  }
                }
              }
            }
          }
        }
        resolve();
      } catch (error) {
        reject(error);
      }
    }).catch((error) => {
      this.log.error(`Delete obsolete directories/files ERROR - ${JSON.stringify(error)}`);
    });
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
        const filePath = path.join(utils.getAbsoluteInstanceDataDir(this), device.getStationSerial(), import_types.DataLocation.LAST_EVENT);
        if (!import_fs_extra.default.existsSync(filePath)) {
          import_fs_extra.default.mkdirSync(filePath, { mode: 509, recursive: true });
        }
        await import_fs_extra.default.writeFile(path.join(filePath, fileName), picture.data);
        await (0, import_utils.setStateChangedAsync)(this, device.getStateID(import_types.DeviceStateID.PICTURE_URL), `/${this.namespace}/${device.getStationSerial()}/${import_types.DataLocation.LAST_EVENT}/${device.getSerial()}.${picture.type.ext}`);
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
//# sourceMappingURL=main.js.map
