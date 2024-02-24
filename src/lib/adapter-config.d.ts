// This file extends the AdapterConfig type from "@types/iobroker"

// Augment the globally declared type ioBroker.AdapterConfig
declare global {
    namespace ioBroker {
        interface AdapterConfig {
            username: string;
            password: string;
            country: string;
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
        }
    }
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export {};