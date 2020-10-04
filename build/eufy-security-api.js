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
exports.EufySecurityAPI = void 0;
const axios_1 = require("axios");
class EufySecurityAPI {
    //private cameras: Camera[] = [];
    //private stations: Station[] = [];
    constructor(username, password, log) {
        this.api_base = "https://mysecurity.eufylife.com/api/v1";
        this.username = "";
        this.password = "";
        this.token = "";
        this.username = username;
        this.password = password;
        this.log = log;
        axios_1.default.defaults.baseURL = this.api_base;
    }
    authenticate() {
        return __awaiter(this, void 0, void 0, function* () {
            //Authenticate and get an access token
            try {
                const response = yield axios_1.default.post("passport/login", {
                    email: this.username,
                    password: this.password
                });
                this.log.debug("Response: " + JSON.stringify(response.data));
                if (response.status == 200) {
                    if (response.data["code"] == 0) {
                        this.token = response.data["data"]["auth_token"];
                        this.token_expiration = new Date(response.data["data"]["token_expires_at"] * 1000);
                        axios_1.default.defaults.headers.common["x-auth-token"] = this.token;
                        if (response.data["data"]["domain"]) {
                            this.api_base = "https://" + response.data["domain"] + "/v1";
                            this.log.info("Switching to another API_BASE: " + this.api_base);
                        }
                        this.log.debug("token: " + this.token);
                        this.log.debug("token_expiration: " + this.token_expiration);
                    }
                    else
                        this.log.error("Response code not ok (code: " + response.data["code"] + " msg: " + response.data["msg"] + ")");
                }
                else {
                    this.token = "";
                    this.token_expiration = null;
                    axios_1.default.defaults.headers.common["x-auth-token"] = null;
                    this.log.error("Status return code not 200: " + response.status);
                }
            }
            catch (error) {
                this.log.error(error);
            }
        });
    }
}
exports.EufySecurityAPI = EufySecurityAPI;
