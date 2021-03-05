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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HTTPApi = void 0;
const axios_1 = __importDefault(require("axios"));
const tiny_typed_emitter_1 = require("tiny-typed-emitter");
const ts_log_1 = require("ts-log");
const i18n_iso_countries_1 = require("i18n-iso-countries");
const i18n_iso_languages_1 = require("@cospired/i18n-iso-languages");
const types_1 = require("./types");
const parameter_1 = require("./parameter");
const utils_1 = require("./utils");
class HTTPApi extends tiny_typed_emitter_1.TypedEmitter {
    constructor(username, password, log = ts_log_1.dummyLogger) {
        super();
        this.api_base = "https://mysecurity.eufylife.com/api/v1";
        this.username = null;
        this.password = null;
        this.token = null;
        this.token_expiration = null;
        this.trusted_token_expiration = new Date(2100, 12, 31, 23, 59, 59, 0);
        this.devices = {};
        this.hubs = {};
        this.headers = {
            app_version: "v2.5.0_833",
            os_type: "android",
            os_version: "30",
            phone_model: "ONEPLUS A3003",
            //phone_model: "ioBroker",
            country: "DE",
            language: "en",
            openudid: "5e4621b0152c0d00",
            uid: "",
            net_type: "wifi",
            mnc: "02",
            mcc: "262",
            sn: "75814221ee75",
            Model_type: "PHONE",
            timezone: "GMT+01:00"
        };
        this.username = username;
        this.password = password;
        this.log = log;
        this.headers.timezone = utils_1.getTimezoneGMTString();
    }
    invalidateToken() {
        this.token = null;
        this.token_expiration = null;
        axios_1.default.defaults.headers.common["X-Auth-Token"] = null;
    }
    setPhoneModel(model) {
        this.headers.phone_model = model.toUpperCase();
    }
    getPhoneModel() {
        return this.headers.phone_model;
    }
    setCountry(country) {
        if (i18n_iso_countries_1.isValid(country) && country.length === 2)
            this.headers.country = country;
        else
            throw new Error("Invalid ISO 3166-1 Alpha-2 country code");
    }
    getCountry() {
        return this.headers.country;
    }
    setLanguage(language) {
        if (i18n_iso_languages_1.isValid(language) && language.length === 2)
            this.headers.language = language;
        else
            throw new Error("Invalid ISO 639 language code");
    }
    getLanguage() {
        return this.headers.language;
    }
    authenticate() {
        return __awaiter(this, void 0, void 0, function* () {
            //Authenticate and get an access token
            this.log.debug(`${this.constructor.name}.authenticate(): token: ${this.token} token_expiration: ${this.token_expiration}`);
            if (!this.token || this.token_expiration && (new Date()).getTime() >= this.token_expiration.getTime()) {
                try {
                    const response = yield this.request("post", "passport/login", {
                        email: this.username,
                        password: this.password
                    }, this.headers).catch(error => {
                        this.log.error(`${this.constructor.name}.authenticate(): error: ${JSON.stringify(error)}`);
                        return error;
                    });
                    this.log.debug(`${this.constructor.name}.authenticate(): Response:  ${JSON.stringify(response.data)}`);
                    if (response.status == 200) {
                        const result = response.data;
                        if (result.code == types_1.ResponseErrorCode.CODE_WHATEVER_ERROR) {
                            const dataresult = result.data;
                            this.token = dataresult.auth_token;
                            this.token_expiration = new Date(dataresult.token_expires_at * 1000);
                            axios_1.default.defaults.headers.common["X-Auth-Token"] = this.token;
                            if (dataresult.domain) {
                                if ("https://" + dataresult.domain + "/v1" != this.api_base) {
                                    this.api_base = "https://" + dataresult.domain + "/v1";
                                    axios_1.default.defaults.baseURL = this.api_base;
                                    this.log.info(`Switching to another API_BASE (${this.api_base}) and get new token.`);
                                    this.token = null;
                                    this.token_expiration = null;
                                    axios_1.default.defaults.headers.common["X-Auth-Token"] = null;
                                    return types_1.AuthResult.RENEW;
                                }
                            }
                            this.log.debug(`${this.constructor.name}.authenticate(): token: ${this.token}`);
                            this.log.debug(`${this.constructor.name}.authenticate(): token_expiration: ${this.token_expiration}`);
                            this.emit("connect");
                            return types_1.AuthResult.OK;
                        }
                        else if (result.code == types_1.ResponseErrorCode.CODE_NEED_VERIFY_CODE) {
                            this.log.debug(`${this.constructor.name}.authenticate(): Send verification code...`);
                            const dataresult = result.data;
                            this.token = dataresult.auth_token;
                            this.token_expiration = new Date(dataresult.token_expires_at * 1000);
                            axios_1.default.defaults.headers.common["X-Auth-Token"] = this.token;
                            this.log.debug(`${this.constructor.name}.authenticate(): token: ${this.token}`);
                            this.log.debug(`${this.constructor.name}.authenticate(): token_expiration: ${this.token_expiration}`);
                            yield this.sendVerifyCode(types_1.VerfyCodeTypes.TYPE_EMAIL);
                            return types_1.AuthResult.SEND_VERIFY_CODE;
                        }
                        else {
                            this.log.error(`${this.constructor.name}.authenticate(): Response code not ok (code: ${result.code} msg: ${result.msg})`);
                        }
                    }
                    else {
                        this.log.error(`${this.constructor.name}.authenticate(): Status return code not 200 (status: ${response.status} text: ${response.statusText}`);
                    }
                }
                catch (error) {
                    this.log.error(`${this.constructor.name}.authenticate(): error: ${error}`);
                }
                return types_1.AuthResult.ERROR;
            }
            return types_1.AuthResult.OK;
        });
    }
    sendVerifyCode(type) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!type)
                    type = types_1.VerfyCodeTypes.TYPE_EMAIL;
                const response = yield this.request("post", "sms/send/verify_code", {
                    message_type: type
                }, this.headers).catch(error => {
                    this.log.error(`${this.constructor.name}.sendVerifyCode(): error: ${JSON.stringify(error)}`);
                    return error;
                });
                if (response.status == 200) {
                    const result = response.data;
                    if (result.code == types_1.ResponseErrorCode.CODE_WHATEVER_ERROR) {
                        this.log.info(`Requested verification code for 2FA`);
                        return true;
                    }
                    else {
                        this.log.error(`${this.constructor.name}.sendVerifyCode(): Response code not ok (code: ${result.code} msg: ${result.msg})`);
                    }
                }
                else {
                    this.log.error(`${this.constructor.name}.sendVerifyCode(): Status return code not 200 (status: ${response.status} text: ${response.statusText}`);
                }
            }
            catch (error) {
                this.log.error(`${this.constructor.name}.sendVerifyCode(): error: ${error}`);
            }
            return false;
        });
    }
    listTrustDevice() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.request("get", "app/trust_device/list", undefined, this.headers).catch(error => {
                    this.log.error(`${this.constructor.name}.listTrustDevice(): error: ${JSON.stringify(error)}`);
                    return error;
                });
                this.log.debug(`${this.constructor.name}.listTrustDevice(): Response:  ${JSON.stringify(response.data)}`);
                if (response.status == 200) {
                    const result = response.data;
                    if (result.code == types_1.ResponseErrorCode.CODE_WHATEVER_ERROR) {
                        if (result.data && result.data.list) {
                            return result.data.list;
                        }
                    }
                    else {
                        this.log.error(`${this.constructor.name}.listTrustDevice(): Response code not ok (code: ${result.code} msg: ${result.msg})`);
                    }
                }
                else {
                    this.log.error(`${this.constructor.name}.listTrustDevice(): Status return code not 200 (status: ${response.status} text: ${response.statusText}`);
                }
            }
            catch (error) {
                this.log.error(`${this.constructor.name}.listTrustDevice(): error: ${error}`);
            }
            return [];
        });
    }
    addTrustDevice(verify_code) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.request("post", "passport/login", {
                    verify_code: `${verify_code}`,
                    transaction: `${new Date().getTime()}`
                }, this.headers).catch(error => {
                    this.log.error(`${this.constructor.name}.listTrustDevice(): error: ${JSON.stringify(error)}`);
                    return error;
                });
                this.log.debug(`${this.constructor.name}.addTrustDevice(): Response:  ${JSON.stringify(response.data)}`);
                if (response.status == 200) {
                    const result = response.data;
                    if (result.code == types_1.ResponseErrorCode.CODE_WHATEVER_ERROR) {
                        const response2 = yield this.request("post", "app/trust_device/add", {
                            verify_code: `${verify_code}`,
                            transaction: `${new Date().getTime()}`
                        }, this.headers);
                        this.log.debug(`${this.constructor.name}.addTrustDevice(): Response2:  ${JSON.stringify(response.data)}`);
                        if (response2.status == 200) {
                            const result = response2.data;
                            if (result.code == types_1.ResponseErrorCode.CODE_WHATEVER_ERROR) {
                                this.log.info(`2FA authentication successfully done. Device trusted.`);
                                const trusted_devices = yield this.listTrustDevice();
                                trusted_devices.forEach((trusted_device) => {
                                    if (trusted_device.is_current_device === 1) {
                                        this.token_expiration = this.trusted_token_expiration;
                                        this.log.debug(`${this.constructor.name}.addTrustDevice(): This device is trusted. Token expiration extended to: ${this.token_expiration})`);
                                    }
                                });
                                return true;
                            }
                            else {
                                this.log.error(`${this.constructor.name}.addTrustDevice(): Response code not ok (code: ${result.code} msg: ${result.msg})`);
                            }
                        }
                        else if (response2.status == 401) {
                            this.invalidateToken();
                            this.log.error(`${this.constructor.name}.addTrustDevice(): Status return code 401, invalidate token (status: ${response.status} text: ${response.statusText}`);
                        }
                        else {
                            this.log.error(`${this.constructor.name}.addTrustDevice(): Status return code not 200 (status: ${response2.status} text: ${response2.statusText}`);
                        }
                    }
                    else {
                        this.log.error(`${this.constructor.name}.addTrustDevice(): Response code not ok (code: ${result.code} msg: ${result.msg})`);
                    }
                }
                else {
                    this.log.error(`${this.constructor.name}.addTrustDevice(): Status return code not 200 (status: ${response.status} text: ${response.statusText}`);
                }
            }
            catch (error) {
                this.log.error(`${this.constructor.name}.addTrustDevice(): error: ${error}`);
            }
            return false;
        });
    }
    updateDeviceInfo() {
        return __awaiter(this, void 0, void 0, function* () {
            //Get the latest device info
            //Get Stations
            try {
                const response = yield this.request("post", "app/get_hub_list").catch(error => {
                    this.log.error(`${this.constructor.name}.updateDeviceInfo(): stations - error: ${JSON.stringify(error)}`);
                    return error;
                });
                this.log.debug(`${this.constructor.name}.updateDeviceInfo(): stations - Response: ${JSON.stringify(response.data)}`);
                if (response.status == 200) {
                    const result = response.data;
                    if (result.code == 0) {
                        const dataresult = result.data;
                        if (dataresult) {
                            dataresult.forEach(element => {
                                this.log.debug(`${this.constructor.name}.updateDeviceInfo(): stations - element: ${JSON.stringify(element)}`);
                                this.log.debug(`${this.constructor.name}.updateDeviceInfo(): stations - device_type: ${element.device_type}`);
                                this.hubs[element.station_sn] = element;
                            });
                        }
                        else {
                            this.log.info("No stations found.");
                        }
                        if (Object.keys(this.hubs).length > 0)
                            this.emit("hubs", this.hubs);
                    }
                    else
                        this.log.error(`${this.constructor.name}.updateDeviceInfo(): Response code not ok (code: ${result.code} msg: ${result.msg})`);
                }
                else {
                    this.log.error(`${this.constructor.name}.updateDeviceInfo(): Status return code not 200 (status: ${response.status} text: ${response.statusText}`);
                }
            }
            catch (error) {
                this.log.error(`${this.constructor.name}.updateDeviceInfo(): error: ${error}`);
            }
            //Get Devices
            try {
                const response = yield this.request("post", "app/get_devs_list").catch(error => {
                    this.log.error(`${this.constructor.name}.updateDeviceInfo(): devices - error: ${JSON.stringify(error)}`);
                    return error;
                });
                this.log.debug(`${this.constructor.name}.updateDeviceInfo(): devices - Response: ${JSON.stringify(response.data)}`);
                if (response.status == 200) {
                    const result = response.data;
                    if (result.code == 0) {
                        const dataresult = result.data;
                        if (dataresult) {
                            dataresult.forEach(element => {
                                this.devices[element.device_sn] = element;
                            });
                        }
                        else {
                            this.log.info("No devices found.");
                        }
                        if (Object.keys(this.devices).length > 0)
                            this.emit("devices", this.devices);
                    }
                    else
                        this.log.error(`${this.constructor.name}.updateDeviceInfo(): Response code not ok (code: ${result.code} msg: ${result.msg})`);
                }
                else {
                    this.log.error(`${this.constructor.name}.updateDeviceInfo(): Status return code not 200 (status: ${response.status} text: ${response.statusText}`);
                }
            }
            catch (error) {
                this.log.error(`${this.constructor.name}.updateDeviceInfo(): error: ${error}`);
            }
        });
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    request(method, endpoint, data, headers) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.token && endpoint != "passport/login") {
                //No token get one
                switch (yield this.authenticate()) {
                    case types_1.AuthResult.RENEW:
                        this.log.debug(`${this.constructor.name}.request(): renew token - method: ${method} endpoint: ${endpoint}`);
                        yield this.authenticate();
                        break;
                    case types_1.AuthResult.ERROR:
                        this.log.debug(`${this.constructor.name}.request(): token error - method: ${method} endpoint: ${endpoint}`);
                        break;
                    default: break;
                }
            }
            if (this.token_expiration && (new Date()).getTime() >= this.token_expiration.getTime()) {
                this.log.info("Access token expired; fetching a new one");
                this.invalidateToken();
                if (endpoint != "passport/login")
                    //get new token
                    yield this.authenticate();
            }
            this.log.debug(`${this.constructor.name}.request(): method: ${method} endpoint: ${endpoint} baseUrl: ${this.api_base} token: ${this.token} data: ${JSON.stringify(data)} headers: ${JSON.stringify(this.headers)}`);
            const response = yield axios_1.default({
                method: method,
                url: endpoint,
                data: data,
                headers: headers,
                baseURL: this.api_base,
                validateStatus: function (status) {
                    return status < 500; // Resolve only if the status code is less than 500
                }
            });
            if (response.status == 401) {
                this.invalidateToken();
                this.log.error(`${this.constructor.name}.request(): Status return code 401, invalidate token (status: ${response.status} text: ${response.statusText}`);
                this.emit("close");
            }
            return response;
        });
    }
    checkPushToken() {
        return __awaiter(this, void 0, void 0, function* () {
            //Check push notification token
            try {
                const response = yield this.request("post", "/app/review/app_push_check", {
                    app_type: "eufySecurity",
                    transaction: `${new Date().getTime()}`
                }, this.headers).catch(error => {
                    this.log.error(`${this.constructor.name}.checkPushToken(): error: ${JSON.stringify(error)}`);
                    return error;
                });
                this.log.debug(`${this.constructor.name}.checkPushToken(): Response: ${JSON.stringify(response.data)}`);
                if (response.status == 200) {
                    const result = response.data;
                    if (result.code == 0) {
                        this.log.debug(`${this.constructor.name}.checkPushToken(): OK`);
                        return true;
                    }
                    else
                        this.log.error(`${this.constructor.name}.checkPushToken(): Response code not ok (code: ${result.code} msg: ${result.msg})`);
                }
                else if (response.status == 401) {
                    this.invalidateToken();
                    this.log.error(`${this.constructor.name}.checkPushToken(): Status return code 401, invalidate token (status: ${response.status} text: ${response.statusText}`);
                }
                else {
                    this.log.error(`${this.constructor.name}.checkPushToken(): Status return code not 200 (status: ${response.status} text: ${response.statusText}`);
                }
            }
            catch (error) {
                this.log.error(`${this.constructor.name}.checkPushToken(): error: ${error}`);
            }
            return false;
        });
    }
    registerPushToken(token) {
        return __awaiter(this, void 0, void 0, function* () {
            //Register push notification token
            try {
                const response = yield this.request("post", "/apppush/register_push_token", {
                    is_notification_enable: true,
                    token: token,
                    transaction: `${new Date().getTime().toString()}`
                }, this.headers).catch(error => {
                    this.log.error(`${this.constructor.name}.registerPushToken(): error: ${JSON.stringify(error)}`);
                    return error;
                });
                this.log.debug(`${this.constructor.name}.registerPushToken(): Response: ${JSON.stringify(response.data)}`);
                if (response.status == 200) {
                    const result = response.data;
                    if (result.code == 0) {
                        this.log.debug(`${this.constructor.name}.registerPushToken(): OK`);
                        return true;
                    }
                    else
                        this.log.error(`${this.constructor.name}.registerPushToken(): Response code not ok (code: ${result.code} msg: ${result.msg})`);
                }
                else if (response.status == 401) {
                    this.invalidateToken();
                    this.log.error(`${this.constructor.name}.registerPushToken(): Status return code 401, invalidate token (status: ${response.status} text: ${response.statusText}`);
                }
                else {
                    this.log.error(`${this.constructor.name}.registerPushToken(): Status return code not 200 (status: ${response.status} text: ${response.statusText}`);
                }
            }
            catch (error) {
                this.log.error(`${this.constructor.name}.registerPushToken(): error: ${error}`);
            }
            return false;
        });
    }
    setParameters(station_sn, device_sn, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const tmp_params = [];
            params.forEach(param => {
                tmp_params.push({ param_type: param.param_type, param_value: parameter_1.ParameterHelper.writeValue(param.param_type, param.param_value) });
            });
            try {
                const response = yield this.request("post", "app/upload_devs_params", {
                    device_sn: device_sn,
                    station_sn: station_sn,
                    params: tmp_params
                }).catch(error => {
                    this.log.error(`${this.constructor.name}.setParameters(): error: ${JSON.stringify(error)}`);
                    return error;
                });
                this.log.debug(`${this.constructor.name}.setParameters(): station_sn: ${station_sn} device_sn: ${device_sn} params: ${JSON.stringify(tmp_params)} Response: ${JSON.stringify(response.data)}`);
                if (response.status == 200) {
                    const result = response.data;
                    if (result.code == 0) {
                        const dataresult = result.data;
                        this.log.debug(`${this.constructor.name}.setParameters(): New Parameters set. response: ${JSON.stringify(dataresult)}`);
                        return true;
                    }
                    else
                        this.log.error(`${this.constructor.name}.setParameters(): Response code not ok (code: ${result.code} msg: ${result.msg})`);
                }
                else {
                    this.log.error(`${this.constructor.name}.setParameters(): Status return code not 200 (status: ${response.status} text: ${response.statusText}`);
                }
            }
            catch (error) {
                this.log.error(`${this.constructor.name}.setParameters(): error: ${error}`);
            }
            return false;
        });
    }
    getCiphers(cipher_ids, user_id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.request("post", "app/cipher/get_ciphers", {
                    cipher_ids: cipher_ids,
                    user_id: user_id,
                    transaction: `${new Date().getTime().toString()}`
                }, this.headers).catch(error => {
                    this.log.error(`${this.constructor.name}.getCiphers(): error: ${JSON.stringify(error)}`);
                    return error;
                });
                this.log.debug(`${this.constructor.name}.getCiphers(): Response:  ${JSON.stringify(response.data)}`);
                if (response.status == 200) {
                    const result = response.data;
                    if (result.code == types_1.ResponseErrorCode.CODE_WHATEVER_ERROR) {
                        if (result.data) {
                            const ciphers = {};
                            result.data.forEach((cipher) => {
                                ciphers[cipher.cipher_id] = cipher;
                            });
                            return ciphers;
                        }
                    }
                    else {
                        this.log.error(`${this.constructor.name}.getCiphers(): Response code not ok (code: ${result.code} msg: ${result.msg})`);
                    }
                }
                else {
                    this.log.error(`${this.constructor.name}.getCiphers(): Status return code not 200 (status: ${response.status} text: ${response.statusText}`);
                }
            }
            catch (error) {
                this.log.error(`${this.constructor.name}.getCiphers(): error: ${error}`);
            }
            return {};
        });
    }
    getVoices(device_sn) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.request("get", `voice/response/lists/${device_sn}`, null, this.headers).catch(error => {
                    this.log.error(`${this.constructor.name}.getVoices(): error: ${JSON.stringify(error)}`);
                    return error;
                });
                this.log.debug(`${this.constructor.name}.getVoices(): Response:  ${JSON.stringify(response.data)}`);
                if (response.status == 200) {
                    const result = response.data;
                    if (result.code == types_1.ResponseErrorCode.CODE_WHATEVER_ERROR) {
                        if (result.data) {
                            const voices = {};
                            result.data.forEach((voice) => {
                                voices[voice.voice_id] = voice;
                            });
                            return voices;
                        }
                    }
                    else {
                        this.log.error(`${this.constructor.name}.getVoices(): Response code not ok (code: ${result.code} msg: ${result.msg})`);
                    }
                }
                else {
                    this.log.error(`${this.constructor.name}.getVoices(): Status return code not 200 (status: ${response.status} text: ${response.statusText}`);
                }
            }
            catch (error) {
                this.log.error(`${this.constructor.name}.getVoices(): error: ${error}`);
            }
            return {};
        });
    }
    getCipher(cipher_id, user_id) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield this.getCiphers([cipher_id], user_id))[cipher_id];
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
    getToken() {
        return this.token;
    }
    getTokenExpiration() {
        return this.token_expiration;
    }
    getTrustedTokenExpiration() {
        return this.trusted_token_expiration;
    }
    setToken(token) {
        this.token = token;
        axios_1.default.defaults.headers.common["X-Auth-Token"] = token;
    }
    setTokenExpiration(token_expiration) {
        this.token_expiration = token_expiration;
    }
    getAPIBase() {
        return this.api_base;
    }
    setAPIBase(api_base) {
        this.api_base = api_base;
    }
    setOpenUDID(openudid) {
        this.headers.openudid = openudid;
    }
    setSerialNumber(serialnumber) {
        this.headers.sn = serialnumber;
    }
}
exports.HTTPApi = HTTPApi;
