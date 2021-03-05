/// <reference types="node" />
import { Socket } from "dgram";
import NodeRSA from "node-rsa";
import { P2PMessageParts } from "./interfaces";
import { CommandType } from "./types";
export declare const MAGIC_WORD = "XZYH";
export declare const isPrivateIp: (ip: string) => boolean;
export declare const buildLookupWithKeyPayload: (socket: Socket, p2pDid: string, dskKey: string) => Buffer;
export declare const buildCheckCamPayload: (p2pDid: string) => Buffer;
export declare const buildIntCommandPayload: (value: number, strValue?: string, channel?: number) => Buffer;
export declare const buildStringTypeCommandPayload: (strValue: string, strValueSub: string, channel?: number) => Buffer;
export declare const buildIntStringCommandPayload: (value: number, valueSub?: number, strValue?: string, strValueSub?: string, channel?: number) => Buffer;
export declare const sendMessage: (socket: Socket, address: {
    host: string;
    port: number;
}, msgID: Buffer, payload?: Buffer | undefined) => Promise<number>;
export declare const hasHeader: (msg: Buffer, searchedType: Buffer) => boolean;
export declare const buildCommandHeader: (seqNumber: number, commandType: CommandType) => Buffer;
export declare const buildCommandWithStringTypePayload: (value: string, channel?: number) => Buffer;
export declare const sortP2PMessageParts: (messages: P2PMessageParts) => Buffer;
export declare const getRSAPrivateKey: (pem: string) => NodeRSA;
export declare const getNewRSAPrivateKey: () => NodeRSA;
export declare const decryptAESData: (hexkey: string, data: Buffer) => Buffer;
