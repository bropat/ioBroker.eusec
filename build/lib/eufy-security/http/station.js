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
exports.Station = void 0;
const types_1 = require("./types");
const parameter_1 = require("./parameter");
const protocol_1 = require("../p2p/protocol");
const session_1 = require("../p2p/session");
const types_2 = require("../p2p/types");
const utils_1 = require("../p2p/utils");
const utils_2 = require("../utils");
class Station {
    constructor(api, hub) {
        this.dsk_key = "";
        this.dsk_expiration = null;
        this.p2p_session = null;
        this.parameters = {};
        this.api = api;
        this.hub = hub;
        this.log = api.getLog();
        this.update(hub);
    }
    getStateID(state) {
        return utils_2.getStationStateID(this, 2, state);
    }
    update(hub) {
        this.hub = hub;
        this.loadParameters();
    }
    getDeviceType() {
        return this.hub.device_type;
    }
    getHardwareVersion() {
        return this.hub.main_hw_version;
    }
    getMACAddress() {
        return this.hub.wifi_mac;
    }
    getModel() {
        return this.hub.station_model;
    }
    getName() {
        return this.hub.station_name;
    }
    getSerial() {
        return this.hub.station_sn;
    }
    getSoftwareVersion() {
        return this.hub.main_sw_version;
    }
    getIPAddress() {
        return this.hub.ip_addr;
    }
    loadParameters() {
        this.log.silly("Station.loadParameters():");
        this.hub.params.forEach(param => {
            //const param_type: string = ParamType[param.param_type];
            this.parameters[param.param_type] = parameter_1.Parameter.readValue(param.param_type, param.param_value);
        });
        this.log.debug(`Station.loadParameters(): station_sn: ${this.getSerial()} paramters: ${JSON.stringify(this.parameters)}`);
    }
    getParameter(param_type) {
        if (Object.values(types_1.ParamType).includes(param_type))
            return this.parameters[param_type];
        throw new Error(`Station Parameter doesn't exists: ${param_type}`);
    }
    getDSKKeys() {
        return __awaiter(this, void 0, void 0, function* () {
            this.log.silly("Station.getDSKKeys():");
            // Start the camera stream and return the RTSP URL.
            try {
                const response = yield this.api.request("post", "app/equipment/get_dsk_keys", {
                    station_sns: [this.getSerial()]
                });
                //TODO: obfuscate keys in log
                this.log.debug(`Station.getDSKKeys(): Response: ${JSON.stringify(response.data)}`);
                if (response.status == 200) {
                    const result = response.data;
                    if (result.code == 0) {
                        const dataresult = result.data;
                        dataresult.dsk_keys.forEach(key => {
                            if (key.station_sn == this.getSerial()) {
                                this.dsk_key = key.dsk_key;
                                this.dsk_expiration = new Date(key.expiration * 1000);
                                //TODO: obfuscate keys in log
                                this.log.debug(`Station.getDSKKeys(): dsk_key: ${this.dsk_key} dsk_expiration: ${this.dsk_expiration}`);
                            }
                        });
                    }
                    else
                        this.log.error(`Station.getDSKKeys(): Response code not ok (code: ${result.code} msg: ${result.msg})`);
                }
                else {
                    this.log.error(`Station.getDSKKeys(): Status return code not 200 (status: ${response.status} text: ${response.statusText}`);
                }
            }
            catch (error) {
                this.log.error(`Station.getDSKKeys(): error: ${error}`);
            }
        });
    }
    isConnected() {
        if (this.p2p_session)
            return this.p2p_session.isConnected();
        return false;
    }
    close() {
        this.log.info(`Disconnect from station ${this.getSerial()}.`);
        if (this.p2p_session) {
            this.p2p_session.close();
            this.p2p_session = null;
        }
    }
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            this.log.silly("Station.connect():");
            if (this.dsk_key == "" || (this.dsk_expiration && (new Date()).getTime() >= this.dsk_expiration.getTime())) {
                this.log.debug(`Station.connect(): DSK keys not present or expired, get/renew it. (dsk_expiration: ${this.dsk_expiration})`);
                yield this.getDSKKeys();
            }
            const proto = new protocol_1.DiscoveryP2PClientProtocol(this.log);
            proto.setDSKKey(this.dsk_key);
            proto.setP2PDid(this.hub.p2p_did);
            const addrs = yield proto.lookup();
            this.log.debug("Station.connect(): Discovered station addresses: " + addrs.length);
            if (addrs.length > 0) {
                let local_addr = null;
                for (const addr of addrs) {
                    this.log.debug("Station.connect(): Discovered station addresses: host: " + addr.host + " port: " + addr.port);
                    if (utils_1.isPrivateIp(addr.host)) {
                        local_addr = addr;
                    }
                }
                if (local_addr) {
                    this.p2p_session = new session_1.EufyP2PClientProtocol(local_addr, this.hub.p2p_did, this.hub.member.action_user_id, this.log);
                    this.log.info(`Connect to station ${this.getSerial()} on host ${local_addr.host} and port ${local_addr.port}.`);
                    return yield this.p2p_session.connect();
                }
                else {
                    this.log.error(`No local address discovered for station ${this.getSerial()}.`);
                }
            }
            else {
                this.log.error(`Discovering of connect details for station ${this.getSerial()} failed. Impossible to establish connection!`);
            }
            return false;
        });
    }
    setGuardMode(mode) {
        return __awaiter(this, void 0, void 0, function* () {
            this.log.silly("Station.setGuardMode(): ");
            if (!this.p2p_session || !this.p2p_session.isConnected) {
                this.log.debug(`Station.setGuardMode(): P2P connection to station ${this.getSerial()} not present, establish it.`);
                yield this.connect();
            }
            if (this.p2p_session) {
                if (this.p2p_session.isConnected()) {
                    try {
                        this.log.debug(`Station.setGuardMode(): P2P connection to station ${this.getSerial()} present, send command mode: ${mode}.`);
                        yield this.p2p_session.sendCommandWithInt(types_2.CommandType.CMD_SET_ARMING, mode);
                    }
                    finally {
                        // Close connection
                        this.close();
                    }
                }
            }
        });
    }
}
exports.Station = Station;
