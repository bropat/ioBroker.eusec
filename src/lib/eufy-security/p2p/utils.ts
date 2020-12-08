import { Socket } from "dgram";
import { CommandType } from "./types";

export const MAGIC_WORD = "XZYH";

export const isPrivateIp = (ip: string): boolean =>
    /^(::f{4}:)?10\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})$/i.test(ip) ||
    /^(::f{4}:)?192\.168\.([0-9]{1,3})\.([0-9]{1,3})$/i.test(ip) ||
    /^(::f{4}:)?172\.(1[6-9]|2\d|30|31)\.([0-9]{1,3})\.([0-9]{1,3})$/i.test(ip) ||
    /^(::f{4}:)?127\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})$/i.test(ip) ||
    /^(::f{4}:)?169\.254\.([0-9]{1,3})\.([0-9]{1,3})$/i.test(ip) ||
    /^f[cd][0-9a-f]{2}:/i.test(ip) ||
    /^fe80:/i.test(ip) ||
    /^::1$/.test(ip) ||
    /^::$/.test(ip);

const reverse = <T>(promise: Promise<any>): Promise<T> => {
    return new Promise((resolve, reject) => Promise.resolve(promise).then(reject, resolve));
};

export const promiseAny = <T>(iterable: Array<Promise<any>>): Promise<T> => {
    return reverse(Promise.all([...iterable].map(reverse)));
};

const applyLength = (inp: Array<number>, bufferLength: number | null = null, bigendian = false): Array<number> => {
    if (!bufferLength) {
        return inp;
    }

    if (bufferLength < inp.length && !bigendian) {
        return inp.slice(0, bufferLength);
    } else if (bufferLength < inp.length && bigendian) {
        return inp.slice(inp.length - bufferLength);
    } else if (bufferLength > inp.length) {
        for (let i = 0; i <= bufferLength - inp.length; i++) {
            inp.push(0);
        }
        return inp;
    }

    return inp;
};

const stringWithLength = (input: string, targetByteLength = 128): Buffer => {
    const stringAsBuffer = Buffer.from(input);
    const postZeros = Buffer.alloc(targetByteLength - stringAsBuffer.byteLength);
    return Buffer.concat([stringAsBuffer, postZeros]);
};

const intToArray = (inp: string | number): Array<number> => {
    const digit = parseInt(inp.toString(), 10);
    let str = digit.toString(16);
    switch (str.length) {
        case 1:
            str = "00000" + str;
            break;
        case 2:
            str = "0000" + str;
            break;
        case 3:
            str = "000" + str;
            break;
        case 4:
            str = "00" + str;
            break;
        case 5:
            str = "0" + str;
            break;
    }
    const first = parseInt(str.substr(0, 2), 16);
    const second = parseInt(str.substr(2, 2), 16);
    const third = parseInt(str.substr(4, 2), 16);
    return [first, second, third];
};

export const intToBufferBE = (inp: string | number, bufferLength: number | null = null): Buffer => {
    const array = intToArray(inp);
    return Buffer.from(applyLength(array, bufferLength, true));
};

export const intToBufferLE = (inp: string | number, bufferLength: number | null = null): Buffer => {
    const array = intToArray(inp);
    array.reverse();
    return Buffer.from(applyLength(array, bufferLength));
};

const p2pDidToBuffer = (p2pDid: string): Buffer => {
    const p2pArray = p2pDid.split("-");
    const buf1 = Buffer.from(p2pArray[0]);
    const fst = intToBufferBE(p2pArray[1]);
    const numeric = Buffer.concat([Buffer.from([0x00, 0x00]), fst]);
    const buf2 = Buffer.from(numeric);
    const buf3 = Buffer.from(p2pArray[2]);
    const buf4 = Buffer.from([0x00, 0x00, 0x00]);
    return Buffer.concat([buf1, buf2, buf3, buf4], 20);
};

export const buildLookupWithKeyPayload = (socket: Socket, p2pDid: string, dskKey: string): Buffer => {
    const p2pDidBuffer = p2pDidToBuffer(p2pDid);

    const port = socket.address().port;
    const portAsBuffer = intToBufferBE(port);
    const portLittleEndianBuffer = Buffer.from([portAsBuffer[2], portAsBuffer[1]]);
    const ip = socket.address().address;
    const ipAsBuffer = Buffer.from(ip.split("."));

    const splitter = Buffer.from([0x00, 0x00]);
    const magic = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0x04, 0x00, 0x00]);

    const dskKeyAsBuffer = Buffer.from(dskKey);

    const fourEmpty = Buffer.from([0x00, 0x00, 0x00, 0x00]);
    return Buffer.concat([p2pDidBuffer, splitter, portLittleEndianBuffer, ipAsBuffer, magic, dskKeyAsBuffer, fourEmpty]);
};

export const buildCheckCamPayload = (p2pDid: string): Buffer => {
    const p2pDidBuffer = p2pDidToBuffer(p2pDid);
    const magic = Buffer.from([0x00, 0x00, 0x00]);
    return Buffer.concat([p2pDidBuffer, magic]);
};

export const buildIntCommandPayload = (value: number, actor: string): Buffer => {
    const headerBuffer = Buffer.from([0x84, 0x00]);
    const magicBuffer = Buffer.from([0x00, 0x00, 0x01, 0x00, 0xff, 0x00, 0x00, 0x00]);
    const valueBuffer = Buffer.from([value]);
    const magicBuffer2 = Buffer.from([0x00, 0x00, 0x00]);
    const actorBuffer = Buffer.from(actor);
    const rest = Buffer.alloc(88);
    return Buffer.concat([
        headerBuffer,
        magicBuffer,
        valueBuffer,
        magicBuffer2,
        actorBuffer,
        rest
    ]);
};

export const buildStringTypeCommandPayload = (strValue: string, actor: string): Buffer => {
    const magic = Buffer.from([0x05, 0x01, 0x00, 0x00, 0x01, 0x00, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const strValueBuffer = stringWithLength(strValue, 128);
    const valueStrSubBuffer = stringWithLength(actor, 128);
    return Buffer.concat([magic, strValueBuffer, valueStrSubBuffer]);
};

export const buildIntStringCommandPayload = (value: number, actor: string, channel = 0): Buffer => {
    const headerBuffer = Buffer.from([0x88, 0x00]);
    const emptyBuffer = Buffer.from([0x00, 0x00]);
    const magicBuffer = Buffer.from([0x01, 0x00]);
    const channelBuffer = Buffer.from([channel, 0x00]);
    const valueBuffer = Buffer.from([value, 0x00]);
    const actorBuffer = Buffer.from(actor);
    const rest = Buffer.alloc(88);

    return Buffer.concat([
        headerBuffer,
        emptyBuffer,
        magicBuffer,
        channelBuffer,
        emptyBuffer,
        channelBuffer,
        emptyBuffer,
        valueBuffer,
        emptyBuffer,
        actorBuffer,
        rest,
    ]);
};

export const sendMessage = async (socket: Socket, address: { host: string; port: number }, msgID: Buffer, payload?: Buffer): Promise<number> => {
    if (!payload)
        payload = Buffer.from([]);
    const payloadLen = Buffer.from([Math.floor(payload.length / 256), payload.length % 256]);
    const message = Buffer.concat([msgID, payloadLen, payload], 4 + payload.length);

    return new Promise((resolve, reject) => {
        socket.send(message, address.port, address.host, (err, bytes) => {
            return err ? reject(err) : resolve(bytes);
        });
    });
};

export const hasHeader = (msg: Buffer, searchedType: Buffer): boolean => {
    const header = Buffer.allocUnsafe(2);
    msg.copy(header, 0, 0, 2);
    return Buffer.compare(header, searchedType) === 0;
};

export const buildCommandHeader = (seqNumber: number, commandType: CommandType): Buffer => {
    const dataTypeBuffer = Buffer.from([0xd1, 0x00]);
    const seqAsBuffer = intToBufferBE(seqNumber, 2);
    const magicString = Buffer.from(MAGIC_WORD);
    const commandTypeBuffer = intToBufferLE(commandType, 2);
    return Buffer.concat([dataTypeBuffer, seqAsBuffer, magicString, commandTypeBuffer]);
};


export const buildCommandWithStringTypePayload = (value: string, channel = 0): Buffer => {
    // type = 6
    //setCommandWithString()

    const headerBuffer = Buffer.from([0x80, 0x00]);
    const emptyBuffer = Buffer.from([0x00, 0x00]);
    const magicBuffer = Buffer.from([0x01, 0x00]);
    const channelBuffer = Buffer.from([channel, 0x00]);
    const jsonBuffer = Buffer.from(value);

    return Buffer.concat([
        headerBuffer,
        emptyBuffer,
        magicBuffer,
        channelBuffer,
        emptyBuffer,
        jsonBuffer,
    ]);
};