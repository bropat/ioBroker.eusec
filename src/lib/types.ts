import { PropertyName } from "eufy-security-client";

import { IRoleMapping } from "./interfaces";

export const DataLocation = {
    LAST_EVENT: "last_event",
}

export const STREAM_FILE_NAME_EXT = ".m3u8";
export const IMAGE_FILE_JPEG_EXT = ".jpg";

export const RoleMapping: IRoleMapping = {
    [PropertyName.Name]: "info.name",
    [PropertyName.StationMacAddress]: "info.mac",
    [PropertyName.StationLANIpAddress]: "info.ip",
    [PropertyName.DeviceState]: "info.status",
    [PropertyName.DeviceBattery]: "value.battery",
    [PropertyName.DeviceBatteryTemp]: "value.temperature",
    [PropertyName.DeviceMotionDetected]: "sensor.motion",
    [PropertyName.DevicePersonDetected]: "sensor.motion",
    [PropertyName.DeviceRinging]: "sensor",
    [PropertyName.DeviceCryingDetected]: "sensor.noise",
    [PropertyName.DeviceSoundDetected]: "sensor.noise",
    [PropertyName.DevicePetDetected]: "sensor",
    [PropertyName.DeviceSensorOpen]: "sensor",
    [PropertyName.DeviceBatteryLow]: "indicator.lowbat",
    [PropertyName.DeviceLockStatus]: "info.status",
    [PropertyName.DeviceDogLickDetected]: "sensor",
    [PropertyName.DeviceDogPoopDetected]: "sensor",
    [PropertyName.DeviceVehicleDetected]: "sensor",
    [PropertyName.DeviceRadarMotionDetected]: "sensor.motion",
    [PropertyName.DeviceStrangerPersonDetected]: "sensor.motion",
    [PropertyName.DeviceIdentityPersonDetected]: "sensor.motion",
    [PropertyName.DeviceChargingStatus]: "info.status",
}

export const DeviceStateID = {
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
    OPEN_BOX: "open_box",
}

export const StationStateID = {
    REBOOT: "reboot",
    CONNECTION: "connection",
    TRIGGER_ALARM_SOUND: "trigger_alarm_sound",
    RESET_ALARM_SOUND: "reset_alarm_sound",
}