"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartSafeStateID = exports.LockStateID = exports.IndoorCameraStateID = exports.DoorbellStateID = exports.KeyPadStateID = exports.MotionSensorStateID = exports.EntrySensorStateID = exports.StationStateID = exports.CameraStateID = exports.DeviceStateID = exports.RoleMapping = exports.IMAGE_FILE_PNG_EXT = exports.IMAGE_FILE_JPEG_EXT = exports.STREAM_FILE_NAME_EXT = exports.DataLocation = void 0;
const eufy_security_client_1 = require("eufy-security-client");
exports.DataLocation = {
    LIVESTREAM: "live",
    LAST_LIVESTREAM: "last_live",
    LAST_EVENT: "last_event",
    TEMP: "tmp"
};
exports.STREAM_FILE_NAME_EXT = ".m3u8";
exports.IMAGE_FILE_JPEG_EXT = ".jpeg";
exports.IMAGE_FILE_PNG_EXT = ".png";
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
};
exports.DeviceStateID = {
    NAME: "name",
    MODEL: "model",
    SERIAL_NUMBER: "serial_number",
    HARDWARE_VERSION: "hardware_version",
    SOFTWARE_VERSION: "software_version",
    ENABLED: "device_enabled"
};
exports.CameraStateID = {
    ...exports.DeviceStateID,
    STATE: "state",
    MAC_ADDRESS: "mac_address",
    LAST_EVENT_PIC_URL: "last_event_pic_url",
    LAST_EVENT_PIC_HTML: "last_event_pic_html",
    LAST_EVENT_VIDEO_URL: "last_event_video_url",
    LIVESTREAM: "livestream",
    LAST_LIVESTREAM_VIDEO_URL: "last_livestream_video_url",
    LAST_LIVESTREAM_PIC_URL: "last_livestream_pic_url",
    LAST_LIVESTREAM_PIC_HTML: "last_livestream_pic_html",
    START_STREAM: "start_stream",
    STOP_STREAM: "stop_stream",
    BATTERY: "battery",
    BATTERY_TEMPERATURE: "battery_temperature",
    LAST_CHARGE_TOTAL_EVENTS: "last_charge_total_events",
    LAST_CHARGE_USED_DAYS: "last_charge_used_days",
    LAST_CHARGE_FILTERED_EVENTS: "last_charge_filtered_events",
    LAST_CHARGE_SAVED_EVENTS: "last_charge_saved_events",
    WIFI_RSSI: "wifi_rssi",
    MOTION_DETECTED: "motion_detected",
    PERSON_DETECTED: "person_detected",
    LAST_PERSON_IDENTIFIED: "last_person_identified",
    WATERMARK: "watermark",
    ANTITHEFT_DETECTION: "antitheft_detection",
    AUTO_NIGHTVISION: "auto_nightvision",
    MOTION_DETECTION: "motion_detection",
    LED_STATUS: "led_status",
    RTSP_STREAM: "rtsp_stream",
    RTSP_STREAM_URL: "rtsp_stream_url",
    TRIGGER_ALARM_SOUND: "trigger_alarm_sound",
    RESET_ALARM_SOUND: "reset_alarm_sound",
};
exports.StationStateID = {
    ...exports.DeviceStateID,
    GUARD_MODE: "guard_mode",
    CURRENT_MODE: "current_mode",
    LAN_IP_ADDRESS: "lan_ip_address",
    MAC_ADDRESS: "mac_address",
    REBOOT: "reboot",
    CONNECTION: "connection",
    TRIGGER_ALARM_SOUND: "trigger_alarm_sound",
    RESET_ALARM_SOUND: "reset_alarm_sound",
};
exports.EntrySensorStateID = {
    ...exports.DeviceStateID,
    STATE: "state",
    SENSOR_OPEN: "sensor_open",
    LOW_BATTERY: "low_battery",
    SENSOR_CHANGE_TIME: "sensor_change_time",
};
exports.MotionSensorStateID = {
    ...exports.DeviceStateID,
    STATE: "state",
    LOW_BATTERY: "low_battery",
    MOTION_DETECTED: "motion_detected",
};
exports.KeyPadStateID = {
    ...exports.DeviceStateID,
    STATE: "state",
    LOW_BATTERY: "low_battery",
};
exports.DoorbellStateID = {
    ...exports.CameraStateID,
    RINGING: "ringing",
};
exports.IndoorCameraStateID = {
    ...exports.CameraStateID,
    CRYING_DETECTED: "crying_detected",
    SOUND_DETECTED: "sound_detected",
    SOUND_DETECTION: "sound_detection",
    PET_DETECTED: "pet_detected",
    PET_DETECTION: "pet_detection",
    PAN_LEFT: "pan_left",
    PAN_RIGHT: "pan_right",
    TILT_UP: "tilt_up",
    TILT_DOWN: "titl_down",
    ROTATE_360: "rotate_360",
    SET_DEFAULT_ANGLE: "set_default_angle",
    SET_PRIVACY_ANGLE: "set_privacy_angle",
};
exports.LockStateID = {
    ...exports.DeviceStateID,
    STATE: "state",
    BATTERY: "battery",
    WIFI_RSSI: "wifi_rssi",
    LOCK: "lock",
    LOCK_STATUS: "lock_status",
    CALIBRATE: "calibrate",
};
exports.SmartSafeStateID = {
    ...exports.DeviceStateID,
    STATE: "state",
    BATTERY: "battery",
    WIFI_RSSI: "wifi_rssi",
    UNLOCK: "unlock",
};
//# sourceMappingURL=types.js.map