"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StationStateID = exports.DeviceStateID = exports.RoleMapping = exports.IMAGE_FILE_JPEG_EXT = exports.STREAM_FILE_NAME_EXT = exports.DataLocation = void 0;
const eufy_security_client_1 = require("eufy-security-client");
exports.DataLocation = {
    LIVESTREAM: "live",
    LAST_LIVESTREAM: "last_live",
    LAST_EVENT: "last_event",
    TEMP: "tmp"
};
exports.STREAM_FILE_NAME_EXT = ".m3u8";
exports.IMAGE_FILE_JPEG_EXT = ".jpg";
exports.RoleMapping = {
    [eufy_security_client_1.PropertyName.Name]: "info.name",
    [eufy_security_client_1.PropertyName.StationMacAddress]: "info.mac",
    [eufy_security_client_1.PropertyName.StationLANIpAddress]: "info.ip",
    [eufy_security_client_1.PropertyName.DeviceState]: "info.status",
    [eufy_security_client_1.PropertyName.DeviceBattery]: "value.battery",
    [eufy_security_client_1.PropertyName.DeviceBatteryTemp]: "value.temperature",
    [eufy_security_client_1.PropertyName.DeviceMotionDetected]: "sensor.motion",
    [eufy_security_client_1.PropertyName.DevicePersonDetected]: "sensor.motion",
    [eufy_security_client_1.PropertyName.DeviceRinging]: "sensor",
    [eufy_security_client_1.PropertyName.DeviceCryingDetected]: "sensor.noise",
    [eufy_security_client_1.PropertyName.DeviceSoundDetected]: "sensor.noise",
    [eufy_security_client_1.PropertyName.DevicePetDetected]: "sensor",
    [eufy_security_client_1.PropertyName.DeviceSensorOpen]: "sensor",
    [eufy_security_client_1.PropertyName.DeviceBatteryLow]: "indicator.lowbat",
    [eufy_security_client_1.PropertyName.DeviceLockStatus]: "info.status",
    [eufy_security_client_1.PropertyName.DeviceDogLickDetected]: "sensor",
    [eufy_security_client_1.PropertyName.DeviceDogPoopDetected]: "sensor",
    [eufy_security_client_1.PropertyName.DeviceVehicleDetected]: "sensor",
    [eufy_security_client_1.PropertyName.DeviceRadarMotionDetected]: "sensor.motion",
    [eufy_security_client_1.PropertyName.DeviceStrangerPersonDetected]: "sensor.motion",
    [eufy_security_client_1.PropertyName.DeviceIdentityPersonDetected]: "sensor.motion",
    [eufy_security_client_1.PropertyName.DeviceChargingStatus]: "info.status",
};
exports.DeviceStateID = {
    /*LAST_EVENT_PIC_URL: "last_event_pic_url",
    LAST_EVENT_PIC_HTML: "last_event_pic_html",
    LAST_EVENT_VIDEO_URL: "last_event_video_url",*/
    LIVESTREAM: "livestream",
    START_STREAM: "start_stream",
    STOP_STREAM: "stop_stream",
    RTSP_STREAM_URL: "rtsp_stream_url",
    TRIGGER_ALARM_SOUND: "trigger_alarm_sound",
    RESET_ALARM_SOUND: "reset_alarm_sound",
    PICTURE_URL: "picture_url",
    PICTURE_HTML: "picture_html",
    LIVESTREAM_RTSP: "livestream_rtsp",
    PAN_LEFT: "pan_left",
    PAN_RIGHT: "pan_right",
    TILT_UP: "tilt_up",
    TILT_DOWN: "titl_down",
    ROTATE_360: "rotate_360",
    SET_DEFAULT_ANGLE: "set_default_angle",
    SET_PRIVACY_ANGLE: "set_privacy_angle",
    CALIBRATE: "calibrate",
    UNLOCK: "unlock",
};
exports.StationStateID = {
    REBOOT: "reboot",
    CONNECTION: "connection",
    TRIGGER_ALARM_SOUND: "trigger_alarm_sound",
    RESET_ALARM_SOUND: "reset_alarm_sound",
};
//# sourceMappingURL=types.js.map