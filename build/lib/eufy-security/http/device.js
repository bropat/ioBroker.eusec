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
exports.UnkownDevice = exports.Keypad = exports.Lock = exports.Sensor = exports.FloodlightCamera = exports.DoorbellCamera = exports.Camera = exports.Device = void 0;
const types_1 = require("./types");
const parameter_1 = require("./parameter");
const events_1 = require("events");
class Device extends events_1.EventEmitter {
    constructor(api, device) {
        super();
        this.parameters = {};
        this.api = api;
        this.device = device;
        this.log = api.getLog();
        this.loadParameters();
    }
    loadParameters() {
        this.device.params.forEach(param => {
            this.parameters[param.param_type] = parameter_1.Parameter.readValue(param.param_type, param.param_value);
        });
        this.log.debug(`Device.loadParameters(): device_sn: ${this.getSerial()} parameters: ${JSON.stringify(this.parameters)}`);
    }
    getParameter(param_type) {
        return this.parameters[param_type];
    }
    getParameters() {
        return this.parameters;
    }
    update(device) {
        this.device = device;
        this.device.params.forEach(param => {
            if (this.parameters[param.param_type] != param.param_value) {
                this.parameters[param.param_type] = parameter_1.Parameter.readValue(param.param_type, param.param_value);
                this.emit("parameter", this, param.param_type, param.param_value);
            }
        });
    }
    static isCamera(type) {
        if (type == types_1.DeviceType.CAMERA ||
            type == types_1.DeviceType.CAMERA2 ||
            type == types_1.DeviceType.CAMERA_E ||
            type == types_1.DeviceType.CAMERA2C ||
            type == types_1.DeviceType.INDOOR_CAMERA ||
            type == types_1.DeviceType.INDOOR_PT_CAMERA ||
            type == types_1.DeviceType.FLOODLIGHT ||
            type == types_1.DeviceType.DOORBELL ||
            type == types_1.DeviceType.BATTERY_DOORBELL ||
            type == types_1.DeviceType.BATTERY_DOORBELL_2 ||
            type == types_1.DeviceType.CAMERA2C_PRO ||
            type == types_1.DeviceType.CAMERA2_PRO ||
            type == types_1.DeviceType.INDOOR_CAMERA_1080 ||
            type == types_1.DeviceType.INDOOR_PT_CAMERA_1080 ||
            type == types_1.DeviceType.SOLO_CAMERA ||
            type == types_1.DeviceType.SOLO_CAMERA_PRO)
            return true;
        return false;
    }
    static isStation(type) {
        if (type == types_1.DeviceType.STATION)
            return true;
        return false;
    }
    static isSensor(type) {
        if (type == types_1.DeviceType.SENSOR ||
            type == types_1.DeviceType.MOTION_SENSOR)
            return true;
        return false;
    }
    static isKeyPad(type) {
        return types_1.DeviceType.KEYPAD == type;
    }
    static isDoorbell(type) {
        if (type == types_1.DeviceType.DOORBELL ||
            type == types_1.DeviceType.BATTERY_DOORBELL ||
            type == types_1.DeviceType.BATTERY_DOORBELL_2)
            return true;
        return false;
    }
    static isFloodLight(type) {
        return types_1.DeviceType.FLOODLIGHT == type;
    }
    static isLock(type) {
        return Device.isLockBasic(type) || Device.isLockAdvanced(type) || Device.isLockBasicNoFinger(type) || Device.isLockAdvancedNoFinger(type);
    }
    static isLockBasic(type) {
        return types_1.DeviceType.LOCK_BASIC == type;
    }
    static isLockBasicNoFinger(type) {
        return types_1.DeviceType.LOCK_BASIC_NO_FINGER == type;
    }
    static isLockAdvanced(type) {
        return types_1.DeviceType.LOCK_ADVANCED == type;
    }
    static isLockAdvancedNoFinger(type) {
        return types_1.DeviceType.LOCK_ADVANCED_NO_FINGER == type;
    }
    static isBatteryDoorbell(type) {
        return types_1.DeviceType.BATTERY_DOORBELL == type;
    }
    static isBatteryDoorbell2(type) {
        return types_1.DeviceType.BATTERY_DOORBELL_2 == type;
    }
    //static isIndoorCameras(type: number): boolean {
    //    return l.I(this.device_sn);
    //}
    static isSoloCamera(type) {
        return types_1.DeviceType.SOLO_CAMERA == type;
    }
    static isSoloCameraPro(type) {
        return types_1.DeviceType.SOLO_CAMERA_PRO == type;
    }
    static isSoloCameras(type) {
        return Device.isSoloCamera(type) || Device.isSoloCameraPro(type);
    }
    static isCamera2(type) {
        //T8114
        return types_1.DeviceType.CAMERA2 == type;
    }
    static isCamera2C(type) {
        //T8113
        return types_1.DeviceType.CAMERA2C == type;
    }
    static isCamera2Pro(type) {
        //T8140
        return types_1.DeviceType.CAMERA2_PRO == type;
    }
    static isCamera2CPro(type) {
        //T8142
        return types_1.DeviceType.CAMERA2C_PRO == type;
    }
    static isCamera2Product(type) {
        return Device.isCamera2(type) || Device.isCamera2C(type) || Device.isCamera2Pro(type) || Device.isCamera2CPro(type);
    }
    static isEntrySensor(type) {
        //T8900
        return types_1.DeviceType.SENSOR == type;
    }
    static isMotionSensor(type) {
        return types_1.DeviceType.MOTION_SENSOR == type;
    }
    isCamera() {
        return Device.isCamera(this.device.device_type);
    }
    isFloodLight() {
        return types_1.DeviceType.FLOODLIGHT == this.device.device_type;
    }
    isDoorbell() {
        return Device.isDoorbell(this.device.device_type);
    }
    isLock() {
        return Device.isLock(this.device.device_type);
    }
    isLockBasic() {
        return Device.isLockBasic(this.device.device_type);
    }
    isLockBasicNoFinger() {
        return Device.isLockBasicNoFinger(this.device.device_type);
    }
    isLockAdvanced() {
        return Device.isLockAdvanced(this.device.device_type);
    }
    isLockAdvancedNoFinger() {
        return Device.isLockAdvancedNoFinger(this.device.device_type);
    }
    isBatteryDoorbell() {
        return Device.isBatteryDoorbell(this.device.device_type);
    }
    isBatteryDoorbell2() {
        return Device.isBatteryDoorbell2(this.device.device_type);
    }
    isSoloCamera() {
        return Device.isSoloCamera(this.device.device_type);
    }
    isSoloCameraPro() {
        return Device.isSoloCameraPro(this.device.device_type);
    }
    isSoloCameras() {
        return Device.isSoloCameras(this.device.device_type);
    }
    isCamera2() {
        return Device.isCamera2(this.device.device_type);
    }
    isCamera2C() {
        return Device.isCamera2C(this.device.device_type);
    }
    isCamera2Pro() {
        return Device.isCamera2Pro(this.device.device_type);
    }
    isCamera2CPro() {
        return Device.isCamera2CPro(this.device.device_type);
    }
    isCamera2Product() {
        return Device.isCamera2Product(this.device.device_type);
    }
    isEntrySensor() {
        return Device.isEntrySensor(this.device.device_type);
    }
    isKeyPad() {
        return Device.isKeyPad(this.device.device_type);
    }
    isMotionSensor() {
        return Device.isMotionSensor(this.device.device_type);
    }
    getDeviceKey() {
        return this.device.station_sn + this.device.device_channel;
    }
    getDeviceType() {
        return this.device.device_type;
    }
    getHardwareVersion() {
        return this.device.main_hw_version;
    }
    getSoftwareVersion() {
        return this.device.main_sw_version;
    }
    getModel() {
        return this.device.device_model;
    }
    getName() {
        return this.device.device_name;
    }
    getSerial() {
        return this.device.device_sn;
    }
    getStationSerial() {
        return this.device.station_sn;
    }
    setParameters(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const tmp_params = [];
            params.forEach(param => {
                tmp_params.push({ param_type: param.param_type, param_value: parameter_1.Parameter.writeValue(param.param_type, param.param_value) });
            });
            try {
                const response = yield this.api.request("post", "app/upload_devs_params", {
                    device_sn: this.device.device_sn,
                    station_sn: this.device.station_sn,
                    json: tmp_params
                });
                this.log.debug(`Device.setParameters(): Response: ${JSON.stringify(response.data)}`);
                if (response.status == 200) {
                    const result = response.data;
                    if (result.code == 0) {
                        const dataresult = result.data;
                        this.log.debug("New Parameters successfully set.");
                        this.log.info(`Device.setParameters(): New Parameters set. response: ${JSON.stringify(dataresult)}`);
                    }
                    else
                        this.log.error(`Device.setParameters(): Response code not ok (code: ${result.code} msg: ${result.msg})`);
                }
                else {
                    this.log.error(`Device.setParameters(): Status return code not 200 (status: ${response.status} text: ${response.statusText}`);
                }
            }
            catch (error) {
                this.log.error(`Device.setParameters(): error: ${error}`);
            }
        });
    }
    getStateID(state, level = 2) {
        switch (level) {
            case 0:
                return `${this.getStationSerial()}.${this.getStateChannel()}`;
            case 1:
                return `${this.getStationSerial()}.${this.getStateChannel()}.${this.getSerial()}`;
            default:
                if (state)
                    return `${this.getStationSerial()}.${this.getStateChannel()}.${this.getSerial()}.${state}`;
                throw new Error("No state value passed.");
        }
    }
}
exports.Device = Device;
class Camera extends Device {
    constructor() {
        super(...arguments);
        this.is_streaming = false;
    }
    getStateChannel() {
        return "cameras";
    }
    getLastCameraImageURL() {
        return this.device.cover_path;
    }
    getMACAddress() {
        return this.device.wifi_mac;
    }
    startDetection() {
        return __awaiter(this, void 0, void 0, function* () {
            // Start camera detection.
            yield this.setParameters([{ param_type: types_1.ParamType.DETECT_SWITCH, param_value: 1 }]);
        });
    }
    startStream() {
        return __awaiter(this, void 0, void 0, function* () {
            // Start the camera stream and return the RTSP URL.
            try {
                const response = yield this.api.request("post", "web/equipment/start_stream", {
                    device_sn: this.device.device_sn,
                    station_sn: this.device.station_sn,
                    proto: 2
                });
                this.log.debug(`Camera.startStream(): Response: ${JSON.stringify(response.data)}`);
                if (response.status == 200) {
                    const result = response.data;
                    if (result.code == 0) {
                        const dataresult = result.data;
                        this.is_streaming = true;
                        this.log.info(`Livestream of camera ${this.device.device_sn} started.`);
                        return dataresult.url;
                    }
                    else
                        this.log.error(`Camera.startStream(): Response code not ok (code: ${result.code} msg: ${result.msg})`);
                }
                else {
                    this.log.error(`Camera.startStream(): Status return code not 200 (status: ${response.status} text: ${response.statusText}`);
                }
            }
            catch (error) {
                this.log.error(`Camera.startStream(): error: ${error}`);
            }
            return "";
        });
    }
    stopDetection() {
        return __awaiter(this, void 0, void 0, function* () {
            // Stop camera detection.
            yield this.setParameters([{ param_type: types_1.ParamType.DETECT_SWITCH, param_value: 0 }]);
        });
    }
    stopStream() {
        return __awaiter(this, void 0, void 0, function* () {
            // Stop the camera stream.
            try {
                const response = yield this.api.request("post", "web/equipment/stop_stream", {
                    device_sn: this.device.device_sn,
                    station_sn: this.device.station_sn,
                    proto: 2
                });
                this.log.debug(`Camera.stopStream(): Response: ${JSON.stringify(response.data)}`);
                if (response.status == 200) {
                    const result = response.data;
                    if (result.code == 0) {
                        this.is_streaming = false;
                        this.log.info(`Livestream of camera ${this.device.device_sn} stopped.`);
                    }
                    else {
                        this.log.error(`Camera.stopStream(): Response code not ok (code: ${result.code} msg: ${result.msg})`);
                    }
                }
                else {
                    this.log.error(`Camera.stopStream(): Status return code not 200 (status: ${response.status} text: ${response.statusText}`);
                }
            }
            catch (error) {
                this.log.error(`Camera.stopStream(): error: ${error}`);
            }
        });
    }
    isStreaming() {
        return this.is_streaming;
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            //TODO: Stop other things if implemented such as detection feature
            if (this.is_streaming)
                yield this.stopStream();
        });
    }
}
exports.Camera = Camera;
class DoorbellCamera extends Camera {
}
exports.DoorbellCamera = DoorbellCamera;
class FloodlightCamera extends Camera {
}
exports.FloodlightCamera = FloodlightCamera;
class Sensor extends Device {
    getStateChannel() {
        return "sensors";
    }
}
exports.Sensor = Sensor;
class Lock extends Device {
    getStateChannel() {
        return "locks";
    }
}
exports.Lock = Lock;
class Keypad extends Device {
    getStateChannel() {
        return "keypads";
    }
}
exports.Keypad = Keypad;
class UnkownDevice extends Device {
    getStateChannel() {
        return "unknown";
    }
}
exports.UnkownDevice = UnkownDevice;
