import { PropertyName } from "eufy-security-client";

import { IRoleMapping, IStoppablePromise } from "./interfaces";

export const DataLocation = {
    LIVESTREAM: "live",
    LAST_LIVESTREAM: "last_live",
    LAST_EVENT: "last_event",
    TEMP: "tmp"
}

export const STREAM_FILE_NAME_EXT = ".m3u8";
export const IMAGE_FILE_JPEG_EXT = ".jpeg";
export const IMAGE_FILE_PNG_EXT = ".png";

export type StoppablePromise = IStoppablePromise<void>;

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
}

export const DeviceStateID = {
    NAME: "name",
    MODEL: "model",
    SERIAL_NUMBER: "serial_number",
    HARDWARE_VERSION: "hardware_version",
    SOFTWARE_VERSION: "software_version",
    ENABLED: "device_enabled"
}

export const CameraStateID = {
    ...DeviceStateID,
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
}

export const StationStateID = {
    ...DeviceStateID,
    GUARD_MODE: "guard_mode",
    CURRENT_MODE: "current_mode",
    LAN_IP_ADDRESS: "lan_ip_address",
    MAC_ADDRESS: "mac_address",
    REBOOT: "reboot",
    CONNECTION: "connection",
    TRIGGER_ALARM_SOUND: "trigger_alarm_sound",
    RESET_ALARM_SOUND: "reset_alarm_sound",
}

export const EntrySensorStateID = {
    ...DeviceStateID,
    STATE: "state",
    SENSOR_OPEN: "sensor_open",
    LOW_BATTERY: "low_battery",
    SENSOR_CHANGE_TIME: "sensor_change_time",
}

export const MotionSensorStateID = {
    ...DeviceStateID,
    STATE: "state",
    LOW_BATTERY: "low_battery",
    MOTION_DETECTED: "motion_detected",
}

export const KeyPadStateID = {
    ...DeviceStateID,
    STATE: "state",
    LOW_BATTERY: "low_battery",
}

export const DoorbellStateID = {
    ...CameraStateID,
    RINGING: "ringing",
}

export const IndoorCameraStateID = {
    ...CameraStateID,
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
}

export const LockStateID = {
    ...DeviceStateID,
    STATE: "state",
    BATTERY: "battery",
    WIFI_RSSI: "wifi_rssi",
    LOCK: "lock",
    LOCK_STATUS: "lock_status",
    CALIBRATE: "calibrate",
}