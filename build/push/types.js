"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndoorPushMessageType = exports.IndoorPushEvent = exports.DoorbellPushEvent = exports.ServerPushEvent = exports.CusPushMode = exports.CusPushAlarmType = exports.CusPushEvent = void 0;
var CusPushEvent;
(function (CusPushEvent) {
    CusPushEvent[CusPushEvent["SECURITY"] = 1] = "SECURITY";
    CusPushEvent[CusPushEvent["TFCARD"] = 2] = "TFCARD";
    CusPushEvent[CusPushEvent["DOOR_SENSOR"] = 3] = "DOOR_SENSOR";
    CusPushEvent[CusPushEvent["CAM_STATE"] = 4] = "CAM_STATE";
    CusPushEvent[CusPushEvent["GSENSOR"] = 5] = "GSENSOR";
    CusPushEvent[CusPushEvent["BATTERY_LOW"] = 6] = "BATTERY_LOW";
    CusPushEvent[CusPushEvent["BATTERY_HOT"] = 7] = "BATTERY_HOT";
    CusPushEvent[CusPushEvent["LIGHT_STATE"] = 8] = "LIGHT_STATE";
    CusPushEvent[CusPushEvent["MODE_SWITCH"] = 9] = "MODE_SWITCH";
    CusPushEvent[CusPushEvent["ALARM"] = 10] = "ALARM";
    CusPushEvent[CusPushEvent["BATTERY_FULL"] = 11] = "BATTERY_FULL";
    CusPushEvent[CusPushEvent["REPEATER_RSSI_WEAK"] = 12] = "REPEATER_RSSI_WEAK";
    CusPushEvent[CusPushEvent["UPGRADE_STATUS"] = 13] = "UPGRADE_STATUS";
    CusPushEvent[CusPushEvent["MOTION_SENSOR_PIR"] = 14] = "MOTION_SENSOR_PIR";
    CusPushEvent[CusPushEvent["ALARM_DELAY"] = 16] = "ALARM_DELAY";
    CusPushEvent[CusPushEvent["HUB_BATT_POWERED"] = 17] = "HUB_BATT_POWERED";
    CusPushEvent[CusPushEvent["SENSOR_NO_OPEN"] = 18] = "SENSOR_NO_OPEN";
})(CusPushEvent = exports.CusPushEvent || (exports.CusPushEvent = {}));
var CusPushAlarmType;
(function (CusPushAlarmType) {
    CusPushAlarmType[CusPushAlarmType["HUB_STOP"] = 0] = "HUB_STOP";
    CusPushAlarmType[CusPushAlarmType["DEV_STOP"] = 1] = "DEV_STOP";
    CusPushAlarmType[CusPushAlarmType["GSENSOR"] = 2] = "GSENSOR";
    CusPushAlarmType[CusPushAlarmType["PIR"] = 3] = "PIR";
    CusPushAlarmType[CusPushAlarmType["APP"] = 4] = "APP";
    CusPushAlarmType[CusPushAlarmType["HOT"] = 5] = "HOT";
    CusPushAlarmType[CusPushAlarmType["DOOR"] = 6] = "DOOR";
    CusPushAlarmType[CusPushAlarmType["CAMERA"] = 7] = "CAMERA";
    CusPushAlarmType[CusPushAlarmType["EVT"] = 10] = "EVT";
    CusPushAlarmType[CusPushAlarmType["DELAY_EVT"] = 16] = "DELAY_EVT";
})(CusPushAlarmType = exports.CusPushAlarmType || (exports.CusPushAlarmType = {}));
var CusPushMode;
(function (CusPushMode) {
    CusPushMode[CusPushMode["SWITCH_FROM_KEYPAD"] = 1] = "SWITCH_FROM_KEYPAD";
    CusPushMode[CusPushMode["SWITCH_FROM_APP"] = 2] = "SWITCH_FROM_APP";
    CusPushMode[CusPushMode["SWITCH"] = 9] = "SWITCH";
})(CusPushMode = exports.CusPushMode || (exports.CusPushMode = {}));
var ServerPushEvent;
(function (ServerPushEvent) {
    ServerPushEvent[ServerPushEvent["INVITE_DEVICE"] = 10300] = "INVITE_DEVICE";
    ServerPushEvent[ServerPushEvent["REMOVE_DEVICE"] = 10200] = "REMOVE_DEVICE";
    ServerPushEvent[ServerPushEvent["REMOVE_HOMEBASE"] = 10100] = "REMOVE_HOMEBASE";
    ServerPushEvent[ServerPushEvent["VERIFICATION"] = 10500] = "VERIFICATION";
    ServerPushEvent[ServerPushEvent["WEB_ACTION"] = 10800] = "WEB_ACTION";
})(ServerPushEvent = exports.ServerPushEvent || (exports.ServerPushEvent = {}));
var DoorbellPushEvent;
(function (DoorbellPushEvent) {
    DoorbellPushEvent[DoorbellPushEvent["BACKGROUND_ACTIVE"] = 3100] = "BACKGROUND_ACTIVE";
    DoorbellPushEvent[DoorbellPushEvent["MOTION_DETECTION"] = 3101] = "MOTION_DETECTION";
    DoorbellPushEvent[DoorbellPushEvent["FACE_DETECTION"] = 3102] = "FACE_DETECTION";
    DoorbellPushEvent[DoorbellPushEvent["PRESS_DOORBELL"] = 3103] = "PRESS_DOORBELL";
    DoorbellPushEvent[DoorbellPushEvent["OFFLINE"] = 3106] = "OFFLINE";
    DoorbellPushEvent[DoorbellPushEvent["ONLINE"] = 3107] = "ONLINE";
})(DoorbellPushEvent = exports.DoorbellPushEvent || (exports.DoorbellPushEvent = {}));
var IndoorPushEvent;
(function (IndoorPushEvent) {
    IndoorPushEvent[IndoorPushEvent["MOTION_DETECTION"] = 3101] = "MOTION_DETECTION";
    IndoorPushEvent[IndoorPushEvent["FACE_DETECTION"] = 3102] = "FACE_DETECTION";
    IndoorPushEvent[IndoorPushEvent["CRYIG_DETECTION"] = 3104] = "CRYIG_DETECTION";
    IndoorPushEvent[IndoorPushEvent["SOUND_DETECTION"] = 3105] = "SOUND_DETECTION";
    IndoorPushEvent[IndoorPushEvent["PET_DETECTION"] = 3106] = "PET_DETECTION";
})(IndoorPushEvent = exports.IndoorPushEvent || (exports.IndoorPushEvent = {}));
var IndoorPushMessageType;
(function (IndoorPushMessageType) {
    IndoorPushMessageType[IndoorPushMessageType["INDOOR"] = 18] = "INDOOR";
    IndoorPushMessageType[IndoorPushMessageType["TFCARD"] = 2] = "TFCARD";
})(IndoorPushMessageType = exports.IndoorPushMessageType || (exports.IndoorPushMessageType = {}));
