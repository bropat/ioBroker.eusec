
/*export interface AdapterConfig {
    username: string;
    password: string;
    pollingInterval: number;
    maxLivestreamDuration: number;
    eventDuration: number;
    verificationMethod: number;
    p2pConnectionType: string;
    acceptInvitations: boolean;
    alarmSoundDuration: number;
    go2rtc_api_port: number;
    go2rtc_rtsp_port: number;
    go2rtc_srtp_port: number;
    go2rtc_webrtc_port: number;
    go2rtc_rtsp_username: string;
    go2rtc_rtsp_password: string;
    hostname: string;
    https: boolean;
}*/

export interface PersistentData {
    version: string;
}

export interface IRoleMapping {
    [index: string]: string;
}