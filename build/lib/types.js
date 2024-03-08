"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var types_exports = {};
__export(types_exports, {
  DataLocation: () => DataLocation,
  DeviceStateID: () => DeviceStateID,
  IMAGE_FILE_JPEG_EXT: () => IMAGE_FILE_JPEG_EXT,
  RoleMapping: () => RoleMapping,
  STREAM_FILE_NAME_EXT: () => STREAM_FILE_NAME_EXT,
  StationStateID: () => StationStateID
});
module.exports = __toCommonJS(types_exports);
var import_eufy_security_client = require("eufy-security-client");
const DataLocation = {
  LAST_EVENT: "last_event"
};
const STREAM_FILE_NAME_EXT = ".m3u8";
const IMAGE_FILE_JPEG_EXT = ".jpg";
const RoleMapping = {
  [import_eufy_security_client.PropertyName.Name]: "info.name",
  [import_eufy_security_client.PropertyName.StationMacAddress]: "info.mac",
  [import_eufy_security_client.PropertyName.StationLANIpAddress]: "info.ip",
  [import_eufy_security_client.PropertyName.DeviceState]: "info.status",
  [import_eufy_security_client.PropertyName.DeviceBattery]: "value.battery",
  [import_eufy_security_client.PropertyName.DeviceBatteryTemp]: "value.temperature",
  [import_eufy_security_client.PropertyName.DeviceMotionDetected]: "sensor.motion",
  [import_eufy_security_client.PropertyName.DevicePersonDetected]: "sensor.motion",
  [import_eufy_security_client.PropertyName.DeviceRinging]: "sensor",
  [import_eufy_security_client.PropertyName.DeviceCryingDetected]: "sensor.noise",
  [import_eufy_security_client.PropertyName.DeviceSoundDetected]: "sensor.noise",
  [import_eufy_security_client.PropertyName.DevicePetDetected]: "sensor",
  [import_eufy_security_client.PropertyName.DeviceSensorOpen]: "sensor",
  [import_eufy_security_client.PropertyName.DeviceBatteryLow]: "indicator.lowbat",
  [import_eufy_security_client.PropertyName.DeviceLockStatus]: "info.status",
  [import_eufy_security_client.PropertyName.DeviceDogLickDetected]: "sensor",
  [import_eufy_security_client.PropertyName.DeviceDogPoopDetected]: "sensor",
  [import_eufy_security_client.PropertyName.DeviceVehicleDetected]: "sensor",
  [import_eufy_security_client.PropertyName.DeviceRadarMotionDetected]: "sensor.motion",
  [import_eufy_security_client.PropertyName.DeviceStrangerPersonDetected]: "sensor.motion",
  [import_eufy_security_client.PropertyName.DeviceIdentityPersonDetected]: "sensor.motion",
  [import_eufy_security_client.PropertyName.DeviceChargingStatus]: "info.status"
};
const DeviceStateID = {
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
  OPEN_BOX: "open_box"
};
const StationStateID = {
  REBOOT: "reboot",
  CONNECTION: "connection",
  TRIGGER_ALARM_SOUND: "trigger_alarm_sound",
  RESET_ALARM_SOUND: "reset_alarm_sound"
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DataLocation,
  DeviceStateID,
  IMAGE_FILE_JPEG_EXT,
  RoleMapping,
  STREAM_FILE_NAME_EXT,
  StationStateID
});
//# sourceMappingURL=types.js.map
