"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndoorCameraStateID = exports.DoorbellStateID = exports.KeyPadStateID = exports.MotionSensorStateID = exports.EntrySensorStateID = exports.StationStateID = exports.CameraStateID = exports.DeviceStateID = exports.VerfyCodeTypes = exports.ResponseErrorCode = exports.GuardMode = exports.AlarmMode = exports.ParamType = exports.DeviceType = void 0;
var DeviceType;
(function (DeviceType) {
    //List retrieved from com.oceanwing.battery.cam.binder.model.QueryDeviceData
    DeviceType[DeviceType["BATTERY_DOORBELL"] = 7] = "BATTERY_DOORBELL";
    DeviceType[DeviceType["BATTERY_DOORBELL_2"] = 16] = "BATTERY_DOORBELL_2";
    DeviceType[DeviceType["CAMERA"] = 1] = "CAMERA";
    DeviceType[DeviceType["CAMERA2"] = 9] = "CAMERA2";
    DeviceType[DeviceType["CAMERA2C"] = 8] = "CAMERA2C";
    DeviceType[DeviceType["CAMERA2C_PRO"] = 15] = "CAMERA2C_PRO";
    DeviceType[DeviceType["CAMERA2_PRO"] = 14] = "CAMERA2_PRO";
    DeviceType[DeviceType["CAMERA_E"] = 4] = "CAMERA_E";
    DeviceType[DeviceType["DOORBELL"] = 5] = "DOORBELL";
    DeviceType[DeviceType["FLOODLIGHT"] = 3] = "FLOODLIGHT";
    DeviceType[DeviceType["INDOOR_CAMERA"] = 30] = "INDOOR_CAMERA";
    DeviceType[DeviceType["INDOOR_CAMERA_1080"] = 34] = "INDOOR_CAMERA_1080";
    DeviceType[DeviceType["INDOOR_PT_CAMERA"] = 31] = "INDOOR_PT_CAMERA";
    DeviceType[DeviceType["INDOOR_PT_CAMERA_1080"] = 35] = "INDOOR_PT_CAMERA_1080";
    DeviceType[DeviceType["KEYPAD"] = 11] = "KEYPAD";
    DeviceType[DeviceType["LOCK_ADVANCED"] = 51] = "LOCK_ADVANCED";
    DeviceType[DeviceType["LOCK_ADVANCED_NO_FINGER"] = 53] = "LOCK_ADVANCED_NO_FINGER";
    DeviceType[DeviceType["LOCK_BASIC"] = 50] = "LOCK_BASIC";
    DeviceType[DeviceType["LOCK_BASIC_NO_FINGER"] = 52] = "LOCK_BASIC_NO_FINGER";
    DeviceType[DeviceType["MOTION_SENSOR"] = 10] = "MOTION_SENSOR";
    DeviceType[DeviceType["SENSOR"] = 2] = "SENSOR";
    DeviceType[DeviceType["SOLO_CAMERA"] = 32] = "SOLO_CAMERA";
    DeviceType[DeviceType["SOLO_CAMERA_PRO"] = 33] = "SOLO_CAMERA_PRO";
    DeviceType[DeviceType["STATION"] = 0] = "STATION";
})(DeviceType = exports.DeviceType || (exports.DeviceType = {}));
var ParamType;
(function (ParamType) {
    //List retrieved from com.oceanwing.battery.cam.binder.model.CameraParams
    ParamType[ParamType["CHIME_STATE"] = 2015] = "CHIME_STATE";
    ParamType[ParamType["DETECT_EXPOSURE"] = 2023] = "DETECT_EXPOSURE";
    ParamType[ParamType["DETECT_MODE"] = 2004] = "DETECT_MODE";
    ParamType[ParamType["DETECT_MOTION_SENSITIVE"] = 2005] = "DETECT_MOTION_SENSITIVE";
    ParamType[ParamType["DETECT_SCENARIO"] = 2028] = "DETECT_SCENARIO";
    ParamType[ParamType["DETECT_SWITCH"] = 2027] = "DETECT_SWITCH";
    ParamType[ParamType["DETECT_ZONE"] = 2006] = "DETECT_ZONE";
    ParamType[ParamType["DOORBELL_AUDIO_RECODE"] = 2042] = "DOORBELL_AUDIO_RECODE";
    ParamType[ParamType["DOORBELL_BRIGHTNESS"] = 2032] = "DOORBELL_BRIGHTNESS";
    ParamType[ParamType["DOORBELL_DISTORTION"] = 2033] = "DOORBELL_DISTORTION";
    ParamType[ParamType["DOORBELL_HDR"] = 2029] = "DOORBELL_HDR";
    ParamType[ParamType["DOORBELL_IR_MODE"] = 2030] = "DOORBELL_IR_MODE";
    ParamType[ParamType["DOORBELL_LED_NIGHT_MODE"] = 2039] = "DOORBELL_LED_NIGHT_MODE";
    ParamType[ParamType["DOORBELL_MOTION_ADVANCE_OPTION"] = 2041] = "DOORBELL_MOTION_ADVANCE_OPTION";
    ParamType[ParamType["DOORBELL_MOTION_NOTIFICATION"] = 2035] = "DOORBELL_MOTION_NOTIFICATION";
    ParamType[ParamType["DOORBELL_NOTIFICATION_JUMP_MODE"] = 2038] = "DOORBELL_NOTIFICATION_JUMP_MODE";
    ParamType[ParamType["DOORBELL_NOTIFICATION_OPEN"] = 2036] = "DOORBELL_NOTIFICATION_OPEN";
    ParamType[ParamType["DOORBELL_RECORD_QUALITY"] = 2034] = "DOORBELL_RECORD_QUALITY";
    ParamType[ParamType["DOORBELL_RING_RECORD"] = 2040] = "DOORBELL_RING_RECORD";
    ParamType[ParamType["DOORBELL_SNOOZE_START_TIME"] = 2037] = "DOORBELL_SNOOZE_START_TIME";
    ParamType[ParamType["DOORBELL_VIDEO_QUALITY"] = 2031] = "DOORBELL_VIDEO_QUALITY";
    ParamType[ParamType["NIGHT_VISUAL"] = 2002] = "NIGHT_VISUAL";
    ParamType[ParamType["OPEN_DEVICE"] = 2001] = "OPEN_DEVICE";
    ParamType[ParamType["RINGING_VOLUME"] = 2022] = "RINGING_VOLUME";
    ParamType[ParamType["SDCARD"] = 2010] = "SDCARD";
    ParamType[ParamType["UN_DETECT_ZONE"] = 2007] = "UN_DETECT_ZONE";
    ParamType[ParamType["VOLUME"] = 2003] = "VOLUME";
    // Inferred from source
    ParamType[ParamType["SNOOZE_MODE"] = 1271] = "SNOOZE_MODE";
    ParamType[ParamType["WATERMARK_MODE"] = 1214] = "WATERMARK_MODE";
    ParamType[ParamType["DEVICE_UPGRADE_NOW"] = 1134] = "DEVICE_UPGRADE_NOW";
    ParamType[ParamType["CAMERA_UPGRADE_NOW"] = 1133] = "CAMERA_UPGRADE_NOW";
    ParamType[ParamType["SCHEDULE_MODE"] = 1257] = "SCHEDULE_MODE";
    ParamType[ParamType["GUARD_MODE"] = 1224] = "GUARD_MODE";
    ParamType[ParamType["FLOODLIGHT_MANUAL_SWITCH"] = 1400] = "FLOODLIGHT_MANUAL_SWITCH";
    ParamType[ParamType["FLOODLIGHT_MANUAL_BRIGHTNESS"] = 1401] = "FLOODLIGHT_MANUAL_BRIGHTNESS";
    ParamType[ParamType["FLOODLIGHT_MOTION_BRIGHTNESS"] = 1412] = "FLOODLIGHT_MOTION_BRIGHTNESS";
    ParamType[ParamType["FLOODLIGHT_SCHEDULE_BRIGHTNESS"] = 1413] = "FLOODLIGHT_SCHEDULE_BRIGHTNESS";
    ParamType[ParamType["FLOODLIGHT_MOTION_SENSITIVTY"] = 1272] = "FLOODLIGHT_MOTION_SENSITIVTY";
    ParamType[ParamType["CAMERA_SPEAKER_VOLUME"] = 1230] = "CAMERA_SPEAKER_VOLUME";
    ParamType[ParamType["CAMERA_RECORD_ENABLE_AUDIO"] = 1366] = "CAMERA_RECORD_ENABLE_AUDIO";
    ParamType[ParamType["CAMERA_RECORD_RETRIGGER_INTERVAL"] = 1250] = "CAMERA_RECORD_RETRIGGER_INTERVAL";
    ParamType[ParamType["CAMERA_RECORD_CLIP_LENGTH"] = 1249] = "CAMERA_RECORD_CLIP_LENGTH";
    ParamType[ParamType["CAMERA_IR_CUT"] = 1013] = "CAMERA_IR_CUT";
    ParamType[ParamType["CAMERA_PIR"] = 1011] = "CAMERA_PIR";
    ParamType[ParamType["CAMERA_WIFI_RSSI"] = 1142] = "CAMERA_WIFI_RSSI";
    ParamType[ParamType["CAMERA_MOTION_ZONES"] = 1204] = "CAMERA_MOTION_ZONES";
    // Set only params?
    ParamType[ParamType["PUSH_MSG_MODE"] = 1252] = "PUSH_MSG_MODE";
})(ParamType = exports.ParamType || (exports.ParamType = {}));
var AlarmMode;
(function (AlarmMode) {
    AlarmMode[AlarmMode["AWAY"] = 0] = "AWAY";
    AlarmMode[AlarmMode["HOME"] = 1] = "HOME";
    AlarmMode[AlarmMode["DISARMED"] = 63] = "DISARMED";
})(AlarmMode = exports.AlarmMode || (exports.AlarmMode = {}));
var GuardMode;
(function (GuardMode) {
    GuardMode[GuardMode["AWAY"] = 0] = "AWAY";
    GuardMode[GuardMode["HOME"] = 1] = "HOME";
    GuardMode[GuardMode["DISARMED"] = 63] = "DISARMED";
    GuardMode[GuardMode["SCHEDULE"] = 2] = "SCHEDULE";
    GuardMode[GuardMode["GEO"] = 47] = "GEO";
    GuardMode[GuardMode["CUSTOM1"] = 3] = "CUSTOM1";
    GuardMode[GuardMode["CUSTOM2"] = 4] = "CUSTOM2";
    GuardMode[GuardMode["CUSTOM3"] = 5] = "CUSTOM3";
    GuardMode[GuardMode["OFF"] = 6] = "OFF";
})(GuardMode = exports.GuardMode || (exports.GuardMode = {}));
var ResponseErrorCode;
(function (ResponseErrorCode) {
    ResponseErrorCode[ResponseErrorCode["CODE_CONNECT_ERROR"] = 997] = "CODE_CONNECT_ERROR";
    ResponseErrorCode[ResponseErrorCode["CODE_NEED_VERIFY_CODE"] = 26052] = "CODE_NEED_VERIFY_CODE";
    ResponseErrorCode[ResponseErrorCode["CODE_NETWORK_ERROR"] = 998] = "CODE_NETWORK_ERROR";
    ResponseErrorCode[ResponseErrorCode["CODE_PHONE_NONE_SUPPORT"] = 26058] = "CODE_PHONE_NONE_SUPPORT";
    ResponseErrorCode[ResponseErrorCode["CODE_SERVER_ERROR"] = 999] = "CODE_SERVER_ERROR";
    ResponseErrorCode[ResponseErrorCode["CODE_VERIFY_CODE_ERROR"] = 26050] = "CODE_VERIFY_CODE_ERROR";
    ResponseErrorCode[ResponseErrorCode["CODE_VERIFY_CODE_EXPIRED"] = 26051] = "CODE_VERIFY_CODE_EXPIRED";
    ResponseErrorCode[ResponseErrorCode["CODE_VERIFY_CODE_MAX"] = 26053] = "CODE_VERIFY_CODE_MAX";
    ResponseErrorCode[ResponseErrorCode["CODE_VERIFY_CODE_NONE_MATCH"] = 26054] = "CODE_VERIFY_CODE_NONE_MATCH";
    ResponseErrorCode[ResponseErrorCode["CODE_VERIFY_PASSWORD_ERROR"] = 26055] = "CODE_VERIFY_PASSWORD_ERROR";
    ResponseErrorCode[ResponseErrorCode["CODE_WHATEVER_ERROR"] = 0] = "CODE_WHATEVER_ERROR";
    ResponseErrorCode[ResponseErrorCode["RESP_ERROR_CODE_SESSION_TIMEOUT"] = 401] = "RESP_ERROR_CODE_SESSION_TIMEOUT";
})(ResponseErrorCode = exports.ResponseErrorCode || (exports.ResponseErrorCode = {}));
var VerfyCodeTypes;
(function (VerfyCodeTypes) {
    VerfyCodeTypes[VerfyCodeTypes["TYPE_SMS"] = 0] = "TYPE_SMS";
    VerfyCodeTypes[VerfyCodeTypes["TYPE_PUSH"] = 1] = "TYPE_PUSH";
    VerfyCodeTypes[VerfyCodeTypes["TYPE_EMAIL"] = 2] = "TYPE_EMAIL";
})(VerfyCodeTypes = exports.VerfyCodeTypes || (exports.VerfyCodeTypes = {}));
exports.DeviceStateID = {
    NAME: "name",
    MODEL: "model",
    SERIAL_NUMBER: "serial_number",
    HARDWARE_VERSION: "hardware_version",
    SOFTWARE_VERSION: "software_version",
};
exports.CameraStateID = Object.assign(Object.assign({}, exports.DeviceStateID), { STATE: "state", MAC_ADDRESS: "mac_address", LAST_EVENT_PICTURE_URL: "last_event_pic_url", LAST_EVENT_PICTURE_HTML: "last_event_pic_html", LIVESTREAM: "livestream", START_STREAM: "start_stream", STOP_STREAM: "stop_stream", BATTERY: "battery", BATTERY_TEMPERATURE: "battery_temperature", LAST_CHARGE_TOTAL_EVENTS: "last_charge_total_events", LAST_CHARGE_USED_DAYS: "last_charge_used_days", LAST_CHARGE_FILTERED_EVENTS: "last_charge_filtered_events", LAST_CHARGE_SAVED_EVENTS: "last_charge_saved_events", WIFI_RSSI: "wifi_rssi", MOTION_DETECTED: "motion_detected", PERSON_DETECTED: "person_detected", LAST_PERSON_IDENTIFIED: "last_person_identified", LAST_CAPTURED_PIC_URL: "last_captured_pic_url", LAST_CAPTURED_PIC_HTML: "last_captured_pic_html" });
exports.StationStateID = Object.assign(Object.assign({}, exports.DeviceStateID), { GUARD_MODE: "guard_mode", CURRENT_MODE: "current_mode", IP_ADDRESS: "ip_address", LAN_IP_ADDRESS: "lan_ip_address", MAC_ADDRESS: "mac_address" });
exports.EntrySensorStateID = Object.assign(Object.assign({}, exports.DeviceStateID), { STATE: "state", SENSOR_OPEN: "sensor_open", LOW_BATTERY: "low_battery", SENSOR_CHANGE_TIME: "sensor_change_time" });
exports.MotionSensorStateID = Object.assign(Object.assign({}, exports.DeviceStateID), { STATE: "state", LOW_BATTERY: "low_battery", MOTION_DETECTED: "motion_detected" });
exports.KeyPadStateID = Object.assign(Object.assign({}, exports.DeviceStateID), { STATE: "state", LOW_BATTERY: "low_battery" });
exports.DoorbellStateID = Object.assign(Object.assign({}, exports.CameraStateID), { RINGING: "ringing" });
exports.IndoorCameraStateID = Object.assign(Object.assign({}, exports.CameraStateID), { CRYING_DETECTED: "crying_detected", SOUND_DETECTED: "sound_detected", PET_DETECTED: "pet_detected" });
