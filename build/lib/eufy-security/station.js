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
const protocol_1 = require("./p2p/protocol");
class Station {
    constructor(api, hub) {
        this.dsk_key = "";
        this.dsk_expiration = null;
        this.api = api;
        this.hub = hub;
        this.log = api.getLog();
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
    getParameters() {
        const parameters = {};
        this.hub.params.forEach(param => {
            const param_type = types_1.ParamType[param.param_type];
            parameters[param_type] = parameter_1.Parameter.readValue(param.param_type, param.param_value);
        });
        return parameters;
    }
    getDSKKeys() {
        return __awaiter(this, void 0, void 0, function* () {
            // Start the camera stream and return the RTSP URL.
            try {
                const response = yield this.api.request("post", "app/equipment/get_dsk_keys", {
                    station_sns: [this.getSerial()]
                });
                this.log.debug("connect(): Response: " + JSON.stringify(response.data));
                if (response.status == 200) {
                    const result = response.data;
                    if (result.code == 0) {
                        const dataresult = result.data;
                        dataresult.dsk_keys.forEach(key => {
                            if (key.station_sn == this.getSerial()) {
                                this.dsk_key = key.dsk_key;
                                this.dsk_expiration = new Date(key.expiration * 1000);
                            }
                        });
                        this.log.debug("dsk_keys: " + dataresult.dsk_keys);
                    }
                    else
                        this.log.error("connect(): Response code not ok (code: " + result.code + " msg: " + result.msg + ")");
                }
                else {
                    this.log.error("connect(): Status return code not 200 (status: " + response.status + " text: " + response.statusText);
                }
            }
            catch (error) {
                this.log.error(error);
            }
        });
    }
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.dsk_key == "" || (this.dsk_expiration && (new Date()).getTime() >= this.dsk_expiration.getTime()))
                yield this.getDSKKeys();
            const proto = new protocol_1.DiscoveryP2PClientProtocol(this.log);
            proto.setDSKKey(this.dsk_key);
            proto.setP2PDid(this.hub.p2p_did);
            const addrs = yield proto.lookup();
            //TODO: Finish implementation
            this.log.debug("connect(): addrs.length: " + addrs.length);
            addrs.forEach(addr => {
                this.log.debug("connect(): host: " + addr.host + " port: " + addr.port);
            });
        });
    }
}
exports.Station = Station;
