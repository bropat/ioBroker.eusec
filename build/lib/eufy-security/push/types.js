"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PushNotificationStateID = exports.ServerPushEvent = exports.PushEvent = void 0;
var PushEvent;
(function (PushEvent) {
    PushEvent[PushEvent["PUSH_SECURITY_EVT"] = 1] = "PUSH_SECURITY_EVT";
    PushEvent[PushEvent["PUSH_TFCARD_EVT"] = 2] = "PUSH_TFCARD_EVT";
    PushEvent[PushEvent["PUSH_DOOR_SENSOR_EVT"] = 3] = "PUSH_DOOR_SENSOR_EVT";
    PushEvent[PushEvent["PUSH_CAM_STATE_EVT"] = 4] = "PUSH_CAM_STATE_EVT";
    PushEvent[PushEvent["PUSH_GSENSOR_EVT"] = 5] = "PUSH_GSENSOR_EVT";
    PushEvent[PushEvent["PUSH_BATTERY_LOW_EVT"] = 6] = "PUSH_BATTERY_LOW_EVT";
    PushEvent[PushEvent["PUSH_BATTERY_HOT_EVT"] = 7] = "PUSH_BATTERY_HOT_EVT";
    PushEvent[PushEvent["PUSH_LIGHT_STATE_EVT"] = 8] = "PUSH_LIGHT_STATE_EVT";
    PushEvent[PushEvent["PUSH_MODE_SWITCH"] = 9] = "PUSH_MODE_SWITCH";
    PushEvent[PushEvent["PUSH_ALARM_EVT"] = 10] = "PUSH_ALARM_EVT";
    PushEvent[PushEvent["PUSH_BATTERY_FULL_EVT"] = 11] = "PUSH_BATTERY_FULL_EVT";
    PushEvent[PushEvent["PUSH_REPEATER_RSSI_WEAK_EVT"] = 12] = "PUSH_REPEATER_RSSI_WEAK_EVT";
    PushEvent[PushEvent["PUSH_UPGRADE_STATUS"] = 13] = "PUSH_UPGRADE_STATUS";
    PushEvent[PushEvent["PUSH_MOTION_SENSOR_PIR"] = 14] = "PUSH_MOTION_SENSOR_PIR";
    PushEvent[PushEvent["PUSH_ALARM_DELAY_EVT"] = 16] = "PUSH_ALARM_DELAY_EVT";
    PushEvent[PushEvent["PUSH_HUB_BATT_POWERED_EVT"] = 17] = "PUSH_HUB_BATT_POWERED_EVT";
    PushEvent[PushEvent["PUSH_SENSOR_NO_OPEN"] = 18] = "PUSH_SENSOR_NO_OPEN";
})(PushEvent = exports.PushEvent || (exports.PushEvent = {}));
var ServerPushEvent;
(function (ServerPushEvent) {
    ServerPushEvent[ServerPushEvent["PUSH_INVITE_DEVICE"] = 10300] = "PUSH_INVITE_DEVICE";
    ServerPushEvent[ServerPushEvent["PUSH_REMOVE_DEVICE"] = 10200] = "PUSH_REMOVE_DEVICE";
    ServerPushEvent[ServerPushEvent["PUSH_REMOVE_HOMEBASE"] = 10100] = "PUSH_REMOVE_HOMEBASE";
    ServerPushEvent[ServerPushEvent["PUSH_VERIFICATION"] = 10500] = "PUSH_VERIFICATION";
})(ServerPushEvent = exports.ServerPushEvent || (exports.ServerPushEvent = {}));
exports.PushNotificationStateID = {
    CONTENT: "content",
    DEVICE_SERIALNUMBER: "device_sn",
    EVENT_TIME: "event_time",
    PAYLOAD: "payload",
    PUSH_TIME: "push_time",
    STATION_SERIALNUMBER: "station_sn",
    TITLE: "title",
    TYPE: "type"
};
