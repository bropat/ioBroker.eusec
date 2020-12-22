import { createSocket, Socket, RemoteInfo } from "dgram";
import { promiseAny, buildLookupWithKeyPayload, sendMessage, hasHeader } from "./utils";
import { RequestMessageType, ResponseMessageType } from "./types";
import { Address } from "./models";

export abstract class BaseP2PClientProtocol {

    protected readonly addressTimeoutInMs = 30 * 1000;
    protected log: ioBroker.Logger;

    constructor(log: ioBroker.Logger) {
        this.log = log;
    }

    protected async bind(socket: Socket): Promise<void> {
        return new Promise((resolve) => {
            socket.bind(0, () => resolve());
        });
    }

    protected async close(socket: Socket): Promise<void> {
        return new Promise((resolve) => {
            socket.close(() => resolve());
        });
    }

    public abstract lookup(): Promise<Array<Address>>;

}

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

export class DiscoveryP2PClientProtocol extends BaseP2PClientProtocol {

    private addresses: Array<Address> = [
        { host: "18.197.212.165", port: 32100 },    // Germany Frankfurt
        { host: "34.235.4.153", port: 32100 },      // USA Ashburn
        { host: "54.153.101.7", port: 32100 },      // USA San Francisco
        { host: "18.223.127.200", port: 32100 },    // USA Columbus
        { host: "54.223.148.206", port: 32100 },    // China Beijing
        { host: "13.251.222.7", port: 32100 },      // Singapore
    ];
    private p2p_did = "";
    private dsk_key = "";

    public setP2PDid(p2p_did: string): void {
        this.p2p_did = p2p_did;
    }

    public setDSKKey(dsk_key: string): void {
        this.dsk_key = dsk_key;
    }

    public async lookup(): Promise<Array<Address>> {
        if (this.p2p_did != null && this.dsk_key != null) {
            return promiseAny(this.addresses.map((address) => this.lookupByAddress(address, this.p2p_did, this.dsk_key)));
        }
        throw new Error("P2P-Did and DSK-Key Parameter must be set!");
    }

    private async lookupByAddress(address: Address, p2pDid: string, dskKey: string): Promise<Array<Address>> {
        return new Promise(async (resolve, reject) => {
            let timer: NodeJS.Timeout | null = null;

            const socket = createSocket("udp4");
            socket.on("error", (error: Error) => reject(error));
            await this.bind(socket); // Bind to a random port

            // Register listener
            const addresses: Array<Address> = [];
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            socket.on("message", (msg: Buffer, rInfo: RemoteInfo) => {
                if (hasHeader(msg, ResponseMessageType.LOOKUP_ADDR)) {
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
            const msgId = RequestMessageType.LOOKUP_WITH_KEY;
            const payload = buildLookupWithKeyPayload(socket, p2pDid, dskKey);
            await sendMessage(socket, address, msgId, payload);
            timer = setTimeout(() => {
                this.close(socket);
                reject(`Timeout on address: ${JSON.stringify(address)}`);
            }, this.addressTimeoutInMs);
        });
    }
}