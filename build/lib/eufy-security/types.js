"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndoorCameraStateID = exports.DoorbellStateID = exports.KeyPadStateID = exports.MotionSensorStateID = exports.EntrySensorStateID = exports.StationStateID = exports.CameraStateID = exports.DeviceStateID = exports.IMAGE_FILE_PNG_EXT = exports.IMAGE_FILE_JPEG_EXT = exports.STREAM_FILE_NAME_EXT = exports.DataLocation = void 0;
exports.DataLocation = {
    LIVESTREAM: "live",
    LAST_LIVESTREAM: "last_live",
    LAST_EVENT: "last_event",
    TEMP: "tmp"
};
exports.STREAM_FILE_NAME_EXT = ".m3u8";
exports.IMAGE_FILE_JPEG_EXT = ".jpeg";
exports.IMAGE_FILE_PNG_EXT = ".png";
exports.DeviceStateID = {
    NAME: "name",
    MODEL: "model",
    SERIAL_NUMBER: "serial_number",
    HARDWARE_VERSION: "hardware_version",
    SOFTWARE_VERSION: "software_version",
    ENABLED: "device_enabled"
};
exports.CameraStateID = Object.assign(Object.assign({}, exports.DeviceStateID), { STATE: "state", MAC_ADDRESS: "mac_address", LAST_EVENT_PICTURE_URL: "last_event_pic_url", LAST_EVENT_PICTURE_HTML: "last_event_pic_html", LAST_EVENT_VIDEO_URL: "last_event_video_url", LIVESTREAM: "livestream", LAST_LIVESTREAM_VIDEO_URL: "last_livestream_video_url", LAST_LIVESTREAM_PIC_URL: "last_livestream_pic_url", LAST_LIVESTREAM_PIC_HTML: "last_livestream_pic_html", START_STREAM: "start_stream", STOP_STREAM: "stop_stream", BATTERY: "battery", BATTERY_TEMPERATURE: "battery_temperature", LAST_CHARGE_TOTAL_EVENTS: "last_charge_total_events", LAST_CHARGE_USED_DAYS: "last_charge_used_days", LAST_CHARGE_FILTERED_EVENTS: "last_charge_filtered_events", LAST_CHARGE_SAVED_EVENTS: "last_charge_saved_events", WIFI_RSSI: "wifi_rssi", MOTION_DETECTED: "motion_detected", PERSON_DETECTED: "person_detected", LAST_PERSON_IDENTIFIED: "last_person_identified", WATERMARK: "watermark", ANTITHEFT_DETECTION: "antitheft_detection", AUTO_NIGHTVISION: "auto_nightvision", MOTION_DETECTION: "motion_detection", LED_STATUS: "led_status", RTSP_STREAM: "rtsp_stream", RTSP_STREAM_URL: "rtsp_stream_url" });
exports.StationStateID = Object.assign(Object.assign({}, exports.DeviceStateID), { GUARD_MODE: "guard_mode", CURRENT_MODE: "current_mode", LAN_IP_ADDRESS: "lan_ip_address", MAC_ADDRESS: "mac_address", REBOOT: "reboot" });
exports.EntrySensorStateID = Object.assign(Object.assign({}, exports.DeviceStateID), { STATE: "state", SENSOR_OPEN: "sensor_open", LOW_BATTERY: "low_battery", SENSOR_CHANGE_TIME: "sensor_change_time" });
exports.MotionSensorStateID = Object.assign(Object.assign({}, exports.DeviceStateID), { STATE: "state", LOW_BATTERY: "low_battery", MOTION_DETECTED: "motion_detected" });
exports.KeyPadStateID = Object.assign(Object.assign({}, exports.DeviceStateID), { STATE: "state", LOW_BATTERY: "low_battery" });
exports.DoorbellStateID = Object.assign(Object.assign({}, exports.CameraStateID), { RINGING: "ringing" });
exports.IndoorCameraStateID = Object.assign(Object.assign({}, exports.CameraStateID), { CRYING_DETECTED: "crying_detected", SOUND_DETECTED: "sound_detected", SOUND_DETECTION: "sound_detection", PET_DETECTED: "pet_detected", PET_DETECTION: "pet_detection" });
