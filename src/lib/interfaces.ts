
export interface AdapterConfig {
    username: string;
    password: string;
    pollingInterval: number;
    maxLivestreamDuration: number;
    eventDuration: number;
    verificationMethod: number;
    p2pConnectionType: string;
    acceptInvitations: boolean;
    alarmSoundDuration: number;
}

export interface PersistentData {
    version: string;
}

export interface ImageResponse {
    status: number;
    statusText: string;
    imageUrl: string;
    imageHtml: string;
}

export interface IStoppablePromise<T> extends Promise<T> {
    stop: () => void;
}

export interface IRoleMapping {
    [index: string]: string;
}