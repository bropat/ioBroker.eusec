import { AlarmMode } from "../http/types";
import { CmdCameraInfoResponse, CommandResult } from "./models";
import { CommandType } from "./types";

interface P2PInterfaceEvents {
    "alarm_mode": (mode: AlarmMode) => void;
    "camera_info": (camera_info: CmdCameraInfoResponse) => void;
    "connected": () => void;
    "disconnected": () => void;
    "command": (result: CommandResult) => void;
}

export declare interface P2PInterface {

    on<U extends keyof P2PInterfaceEvents>(
        event: U, listener: P2PInterfaceEvents[U]
    ): this;

    emit<U extends keyof P2PInterfaceEvents>(
        event: U, ...args: Parameters<P2PInterfaceEvents[U]>
    ): boolean;

}

export interface P2PMessageState {
    sequence: number;
    command_type: CommandType;
    nested_command_type?: CommandType;
    channel: number;
    data: Buffer;
    retries: number;
    acknowledged: boolean;
    return_code: number;
    timeout?: NodeJS.Timeout;
}