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
exports.API = void 0;
const axios_1 = require("axios");
const events_1 = require("events");
class API extends events_1.EventEmitter {
    constructor(username, password, log, eufy) {
        super();
        this.api_base = "https://mysecurity.eufylife.com/api/v1";
        this.username = null;
        this.password = null;
        this.token = null;
        this.token_expiration = null;
        this.devices = {};
        this.hubs = {};
        this.eufy = eufy;
        this.username = username;
        this.password = password;
        this.log = log;
        //axios.defaults.baseURL = this.api_base;
    }
    authenticate() {
        return __awaiter(this, void 0, void 0, function* () {
            //Authenticate and get an access token
            try {
                const response = yield this.request("post", "passport/login", {
                    email: this.username,
                    password: this.password
                });
                this.log.debug("Response: " + JSON.stringify(response.data));
                if (response.status == 200) {
                    const result = response.data;
                    if (result.code == 0) {
                        const dataresult = result.data;
                        this.token = dataresult.auth_token;
                        this.token_expiration = new Date(dataresult.token_expires_at * 1000);
                        axios_1.default.defaults.headers.common["X-Auth-Token"] = this.token;
                        if (dataresult.domain) {
                            if ("https://" + dataresult.domain + "/v1" != this.api_base) {
                                this.api_base = "https://" + dataresult.domain + "/v1";
                                axios_1.default.defaults.baseURL = this.api_base;
                                this.log.info("Switching to another API_BASE: " + this.api_base + " and get new token.");
                                this.token = null;
                                this.token_expiration = null;
                                axios_1.default.defaults.headers.common["X-Auth-Token"] = null;
                                return "renew";
                            }
                        }
                        this.log.debug("token: " + this.token);
                        this.log.debug("token_expiration: " + this.token_expiration);
                        return "ok";
                    }
                    else
                        this.log.error("Response code not ok (code: " + result.code + " msg: " + result.msg + ")");
                }
                else {
                    this.token = null;
                    this.token_expiration = null;
                    axios_1.default.defaults.headers.common["X-Auth-Token"] = null;
                    this.log.error("Status return code not 200 (status: " + response.status + " text: " + response.statusText);
                }
            }
            catch (error) {
                this.log.error(error);
            }
            return "error";
        });
    }
    updateDeviceInfo() {
        return __awaiter(this, void 0, void 0, function* () {
            //Get the latest device info
            //Get Stations
            try {
                const response = yield this.request("post", "app/get_hub_list");
                this.log.debug("updateDeviceInfo(): stations - Response: " + JSON.stringify(response.data));
                if (response.status == 200) {
                    const result = response.data;
                    if (result.code == 0) {
                        const dataresult = result.data;
                        dataresult.forEach(element => {
                            this.log.debug("updateDeviceInfo(): stations - element: " + JSON.stringify(element));
                            this.log.debug("updateDeviceInfo(): stations - device_type: " + element.device_type);
                            if (element.device_type == 0) {
                                // Station
                                this.hubs[element.station_sn] = element;
                            }
                        });
                        if (Object.keys(this.hubs).length > 0)
                            this.emit("hubs", this.hubs, this.eufy);
                    }
                    else
                        this.log.error("Response code not ok (code: " + result.code + " msg: " + result.msg + ")");
                }
                else {
                    this.log.error("Status return code not 200 (status: " + response.status + " text: " + response.statusText);
                }
            }
            catch (error) {
                this.log.error(error);
            }
            //Get Devices
            try {
                const response = yield this.request("post", "app/get_devs_list");
                this.log.debug("updateDeviceInfo(): cameras - Response: " + JSON.stringify(response.data));
                if (response.status == 200) {
                    const result = response.data;
                    if (result.code == 0) {
                        const dataresult = result.data;
                        dataresult.forEach(element => {
                            this.devices[element.device_sn] = element;
                        });
                        if (Object.keys(this.devices).length > 0)
                            this.emit("devices", this.devices, this.eufy);
                    }
                    else
                        this.log.error("Response code not ok (code: " + result.code + " msg: " + result.msg + ")");
                }
                else {
                    this.log.error("Status return code not 200 (status: " + response.status + " text: " + response.statusText);
                }
            }
            catch (error) {
                this.log.error(error);
            }
        });
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    request(method, endpoint, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.token && endpoint != "passport/login") {
                //No token get one
                switch (yield this.authenticate()) {
                    case "renew":
                        this.log.debug("renew token");
                        yield this.authenticate();
                        break;
                    case "error":
                        this.log.debug("token error");
                        break;
                    default: break;
                }
            }
            if (this.token_expiration && (new Date()).getTime() >= this.token_expiration.getTime()) {
                this.log.info("Access token expired; fetching a new one");
                this.token = null;
                this.token_expiration = null;
                //get new token
                yield this.authenticate();
            }
            this.log.debug("request(): method: " + method + " endpoint: " + endpoint + " baseUrl: " + this.api_base + " token: " + this.token);
            return yield axios_1.default({
                method: method,
                url: endpoint,
                data: data,
                baseURL: this.api_base
            });
        });
    }
    getLog() {
        return this.log;
    }
    getDevices() {
        return this.devices;
    }
    getHubs() {
        return this.hubs;
    }
}
exports.API = API;
