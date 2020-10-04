import { Cameras, Stations } from "./http/interfaces";

interface EufySecurityInterfaceEvents {
    "cameras": (cameras: Cameras, adapter: ioBroker.Adapter) => void;
    "stations": (stations: Stations, adapter: ioBroker.Adapter) => void;
}

export declare interface EufySecurityInterface {

    on<U extends keyof EufySecurityInterfaceEvents>(
        event: U, listener: EufySecurityInterfaceEvents[U], adapter: ioBroker.Adapter
    ): this;

    emit<U extends keyof EufySecurityInterfaceEvents>(
        event: U, ...args: Parameters<EufySecurityInterfaceEvents[U]>
    ): boolean;

}

export interface AdapterConfig {
    username: string;
    password: string;
    pollingInterval: number;
    maxLivestreamDuration: number;
}