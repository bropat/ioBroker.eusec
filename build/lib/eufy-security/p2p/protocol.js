"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscoveryP2PClientProtocol = exports.BaseP2PClientProtocol = void 0;
const dgram_1 = require("dgram");
const utils_1 = require("./utils");
const types_1 = require("./types");
class BaseP2PClientProtocol {
    constructor(log) {
        this.addressTimeoutInMs = 30 * 1000;
        this.log = log;
    }
    bind(socket) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => {
                socket.bind(0, () => resolve());
            });
        });
    }
    close(socket) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => {
                socket.close(() => resolve());
            });
        });
    }
}
exports.BaseP2PClientProtocol = BaseP2PClientProtocol;
/*export class LocalDiscoveryP2PClientProtocol extends BaseP2PClientProtocol {

    private readonly LOCAL_PORT = 32108;
    private host = "";

    public setHost(host: string): void {
        this.host = host;
    }

    public async lookup(): Promise<Array<Address>> {
        if (this.host != "") {
            this.log.debug("lookup(): host: " + this.host);
            return new Promise(async (resolve, reject) => {
                let timer: NodeJS.Timeout | null = null;

                const socket = createSocket("udp4");
                await this.bind(socket);
                const addresses: Array<Address> = [];

                this.log.debug("lookup(): socket created and binded.");

                socket.on("message", (msg: Buffer, rinfo: RemoteInfo) => {
                    this.log.debug("lookup(): message: msg: " + msg + " rinfo.size: " + rinfo.size);
                    if (hasHeader(msg, ResponseMessageType.LOCAL_LOOKUP_RESP)) {
                        if (!!timer) {
                            clearTimeout(timer);
                        }
                        this.close(socket);
                        addresses.push({ host: rinfo.address, port: rinfo.port });
                        resolve(addresses);
                    }
                });

                const payload = Buffer.from([0, 0]);
                this.log.debug("lookup(): sending message...");
                await sendMessage(socket, { host: this.host, port: this.LOCAL_PORT }, RequestMessageType.LOCAL_LOOKUP, payload);
                this.log.debug("lookup(): message send.");

                timer = setTimeout(() => {
                    this.log.debug("lookup(): timeout!!!!");
                    this.close(socket);
                    reject(`Timeout on address: ${this.host}`);
                }, this.addressTimeoutInMs);
            });
        } else
            throw new Error("Host Parameter must be set!");
    }
}*/
class DiscoveryP2PClientProtocol extends BaseP2PClientProtocol {
    constructor() {
        super(...arguments);
        this.addresses = [
            { host: "18.197.212.165", port: 32100 },
            { host: "34.235.4.153", port: 32100 },
            { host: "54.153.101.7", port: 32100 },
            { host: "18.223.127.200", port: 32100 },
            { host: "54.223.148.206", port: 32100 },
            { host: "13.251.222.7", port: 32100 },
        ];
        this.p2p_did = "";
        this.dsk_key = "";
    }
    setP2PDid(p2p_did) {
        this.p2p_did = p2p_did;
    }
    setDSKKey(dsk_key) {
        this.dsk_key = dsk_key;
    }
    lookup() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.p2p_did != null && this.dsk_key != null) {
                return utils_1.promiseAny(this.addresses.map((address) => this.lookupByAddress(address, this.p2p_did, this.dsk_key)));
            }
            throw new Error("P2P-Did and DSK-Key Parameter must be set!");
        });
    }
    lookupByAddress(address, p2pDid, dskKey) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                let timer = null;
                const socket = dgram_1.createSocket("udp4");
                socket.on("error", (error) => reject(error));
                yield this.bind(socket); // Bind to a random port
                // Register listener
                const addresses = [];
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                socket.on("message", (msg, rInfo) => {
                    if (utils_1.hasHeader(msg, types_1.ResponseMessageType.LOOKUP_ADDR)) {
                        const port = msg[7] * 256 + msg[6];
                        const ip = `${msg[11]}.${msg[10]}.${msg[9]}.${msg[8]}`;
                        addresses.push({ host: ip, port: port });
                        if (addresses.length === 2) {
                            if (!!timer) {
                                clearTimeout(timer);
                            }
                            this.close(socket);
                            resolve(addresses);
                        }
                    }
                });
                // Send lookup message
                const msgId = types_1.RequestMessageType.LOOKUP_WITH_KEY;
                const payload = utils_1.buildLookupWithKeyPayload(socket, p2pDid, dskKey);
                yield utils_1.sendMessage(socket, address, msgId, payload);
                timer = setTimeout(() => {
                    this.close(socket);
                    reject(`Timeout on address: ${JSON.stringify(address)}`);
                }, this.addressTimeoutInMs);
            }));
        });
    }
}
exports.DiscoveryP2PClientProtocol = DiscoveryP2PClientProtocol;
