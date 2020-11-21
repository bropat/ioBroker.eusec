import { AlarmMode } from "../http/types";
import { CmdCameraInfoResponse } from "./models";

interface P2PInterfaceEvents {
    "alarm_mode": (mode: AlarmMode) => void;
    "camera_info": (camera_info: CmdCameraInfoResponse) => void;
    "connected": () => void;
    "disconnected": () => void;
}

export declare interface P2PInterface {

    on<U extends keyof P2PInterfaceEvents>(
        event: U, listener: P2PInterfaceEvents[U]
    ): this;

    emit<U extends keyof P2PInterfaceEvents>(
        event: U, ...args: Parameters<P2PInterfaceEvents[U]>
    ): boolean;

}