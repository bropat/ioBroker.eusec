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
exports.PushRegisterService = void 0;
const axios_1 = __importDefault(require("axios"));
const qs_1 = __importDefault(require("qs"));
const utils_1 = require("./utils");
class PushRegisterService {
    constructor(log) {
        this.APP_PACKAGE = "com.oceanwing.battery.cam";
        this.APP_ID = "1:348804314802:android:440a6773b3620da7";
        this.APP_SENDER_ID = "348804314802";
        this.APP_CERT_SHA1 = "F051262F9F99B638F3C76DE349830638555B4A0A";
        this.FCM_PROJECT_ID = "batterycam-3250a";
        this.GOOGLE_API_KEY = "AIzaSyCSz1uxGrHXsEktm7O3_wv-uLGpC9BvXR8";
        this.AUTH_VERSION = "FIS_v2";
        this.log = log;
    }
    buildExpiresAt(expiresIn) {
        if (expiresIn.endsWith("ms")) {
            return new Date().getTime() + Number.parseInt(expiresIn.substring(0, expiresIn.length - 2));
        }
        else if (expiresIn.endsWith("s")) {
            return new Date().getTime() + Number.parseInt(expiresIn.substring(0, expiresIn.length - 1)) * 1000;
        }
        throw new Error(`Unknown expiresIn-format: ${expiresIn}`);
    }
    registerFid(fid) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = `https://firebaseinstallations.googleapis.com/v1/projects/${this.FCM_PROJECT_ID}/installations`;
            try {
                const response = yield yield axios_1.default({
                    method: "post",
                    url: url,
                    data: {
                        fid: fid,
                        appId: `${this.APP_ID}`,
                        authVersion: `${this.AUTH_VERSION}`,
                        sdkVersion: "a:16.3.1",
                    },
                    headers: {
                        "X-Android-Package": `${this.APP_PACKAGE}`,
                        "X-Android-Cert": `${this.APP_CERT_SHA1}`,
                        "x-goog-api-key": `${this.GOOGLE_API_KEY}`,
                    },
                    responseType: "json",
                    validateStatus: function (status) {
                        return status < 500; // Resolve only if the status code is less than 500
                    }
                }).catch(error => {
                    this.log.error(`PushRegisterService.registerFid(): error: ${JSON.stringify(error)}`);
                    return error;
                });
                if (response.status == 200) {
                    const result = response.data;
                    return Object.assign(Object.assign({}, result), { authToken: Object.assign(Object.assign({}, result.authToken), { expiresAt: this.buildExpiresAt(result.authToken.expiresIn) }) });
                }
                else {
                    this.log.error(`PushRegisterService.registerFid(): Status return code not 200 (status: ${response.status} text: ${response.statusText} data: ${response.data}`);
                    throw new Error(`FID registration failed with error: ${response.statusText}`);
                }
            }
            catch (error) {
                this.log.error(`PushRegisterService.registerFid(): error: ${error}`);
                throw new Error(`FID registration failed with error: ${error}`);
            }
        });
    }
    renewFidToken(fid, refreshToken) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = `https://firebaseinstallations.googleapis.com/v1/projects/${this.FCM_PROJECT_ID}/installations/${fid}/authTokens:generate`;
            try {
                const response = yield yield axios_1.default({
                    method: "post",
                    url: url,
                    data: {
                        fid: fid,
                        appId: `${this.APP_ID}`,
                        authVersion: `${this.AUTH_VERSION}`,
                        sdkVersion: "a:16.3.1",
                    },
                    headers: {
                        "X-Android-Package": `${this.APP_PACKAGE}`,
                        "X-Android-Cert": `${this.APP_CERT_SHA1}`,
                        "x-goog-api-key": `${this.GOOGLE_API_KEY}`,
                        Authorization: `${this.AUTH_VERSION} ${refreshToken}`
                    },
                    responseType: "json",
                    validateStatus: function (status) {
                        return status < 500; // Resolve only if the status code is less than 500
                    }
                }).catch(error => {
                    this.log.error(`PushRegisterService.renewFidToken(): error: ${JSON.stringify(error)}`);
                    return error;
                });
                if (response.status == 200) {
                    const result = response.data;
                    return Object.assign(Object.assign({}, result), { expiresAt: this.buildExpiresAt(result.expiresIn) });
                }
                else {
                    this.log.error(`PushRegisterService.renewFidToken(): Status return code not 200 (status: ${response.status} text: ${response.statusText}`);
                    throw new Error(`FID Token renewal failed with error: ${response.statusText}`);
                }
            }
            catch (error) {
                this.log.error(`PushRegisterService.renewFidToken(): error: ${error}`);
                throw new Error(`FID Token renewal failed with error: ${error}`);
            }
        });
    }
    createPushCredentials() {
        return __awaiter(this, void 0, void 0, function* () {
            const generatedFid = utils_1.generateFid();
            const registerFidResponse = yield this.registerFid(generatedFid);
            const checkinResponse = yield this.executeCheckin();
            //TODO: On exception handle it and maybe retry later
            const registerGcmResponse = yield this.registerGcm(registerFidResponse, checkinResponse);
            return {
                fidResponse: registerFidResponse,
                checkinResponse: checkinResponse,
                gcmResponse: registerGcmResponse,
            };
        });
    }
    renewPushCredentials(credentials) {
        return __awaiter(this, void 0, void 0, function* () {
            credentials.fidResponse.authToken = yield this.renewFidToken(credentials.fidResponse.fid, credentials.fidResponse.refreshToken);
            const checkinResponse = yield this.executeCheckin();
            //TODO: On exception handle it and maybe retry later
            const registerGcmResponse = yield this.registerGcm(credentials.fidResponse, checkinResponse);
            return {
                fidResponse: credentials.fidResponse,
                checkinResponse: checkinResponse,
                gcmResponse: registerGcmResponse,
            };
        });
    }
    loginPushCredentials(credentials) {
        return __awaiter(this, void 0, void 0, function* () {
            const checkinResponse = yield this.executeCheckin();
            //TODO: On exception handle it and maybe retry later
            const registerGcmResponse = yield this.registerGcm(credentials.fidResponse, checkinResponse);
            return {
                fidResponse: credentials.fidResponse,
                checkinResponse: checkinResponse,
                gcmResponse: registerGcmResponse,
            };
        });
    }
    executeCheckin() {
        return __awaiter(this, void 0, void 0, function* () {
            const url = "https://android.clients.google.com/checkin";
            try {
                const buffer = yield utils_1.buildCheckinRequest();
                const response = yield yield axios_1.default({
                    method: "post",
                    url: url,
                    data: Buffer.from(buffer),
                    headers: {
                        "Content-Type": "application/x-protobuf",
                    },
                    responseType: "arraybuffer",
                    validateStatus: function (status) {
                        return status < 500; // Resolve only if the status code is less than 500
                    }
                }).catch(error => {
                    this.log.error(`PushRegisterService.executeCheckin(): error: ${JSON.stringify(error)}`);
                    return error;
                });
                if (response.status == 200) {
                    return yield utils_1.parseCheckinResponse(response.data);
                }
                else {
                    this.log.error(`PushRegisterService.executeCheckin(): Status return code not 200 (status: ${response.status} text: ${response.statusText}`);
                    throw new Error(`Google checkin failed with error: ${response.statusText}`);
                }
            }
            catch (error) {
                this.log.error(`PushRegisterService.executeCheckin(): error: ${error}`);
                throw new Error(`Google checkin failed with error: ${error}`);
            }
        });
    }
    registerGcm(fidInstallationResponse, checkinResponse) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = "https://android.clients.google.com/c2dm/register3";
            const androidId = checkinResponse.androidId;
            const fid = fidInstallationResponse.fid;
            const securityToken = checkinResponse.securityToken;
            const retry = 5;
            try {
                for (let retry_count = 1; retry_count <= retry; retry_count++) {
                    const response = yield yield axios_1.default({
                        method: "post",
                        url: url,
                        data: qs_1.default.stringify({
                            "X-subtype": `${this.APP_SENDER_ID}`,
                            sender: `${this.APP_SENDER_ID}`,
                            "X-app_ver": "741",
                            "X-osv": "25",
                            "X-cliv": "fiid-20.2.0",
                            "X-gmsv": "201216023",
                            "X-appid": `${fid}`,
                            "X-scope": "*",
                            "X-Goog-Firebase-Installations-Auth": `${fidInstallationResponse.authToken.token}`,
                            "X-gmp_app_id": `${this.APP_ID}`,
                            "X-Firebase-Client": "fire-abt/17.1.1+fire-installations/16.3.1+fire-android/+fire-analytics/17.4.2+fire-iid/20.2.0+fire-rc/17.0.0+fire-fcm/20.2.0+fire-cls/17.0.0+fire-cls-ndk/17.0.0+fire-core/19.3.0",
                            "X-firebase-app-name-hash": "R1dAH9Ui7M-ynoznwBdw01tLxhI",
                            "X-Firebase-Client-Log-Type": "1",
                            "X-app_ver_name": "v2.2.2_741",
                            app: `${this.APP_PACKAGE}`,
                            device: `${androidId}`,
                            app_ver: "741",
                            info: "g3EMJXXElLwaQEb1aBJ6XhxiHjPTUxc",
                            gcm_ver: "201216023",
                            plat: "0",
                            cert: `${this.APP_CERT_SHA1}`,
                            target_ver: "28",
                        }),
                        headers: {
                            Authorization: `AidLogin ${androidId}:${securityToken}`,
                            app: `${this.APP_PACKAGE}`,
                            gcm_ver: "201216023",
                            "User-Agent": "Android-GCM/1.5 (OnePlus5 NMF26X)",
                            "content-type": "application/x-www-form-urlencoded",
                        },
                        validateStatus: function (status) {
                            return status < 500; // Resolve only if the status code is less than 500
                        }
                    }).catch(error => {
                        this.log.error(`PushRegisterService.registerGcm(): error: ${JSON.stringify(error)}`);
                        return error;
                    });
                    if (response.status == 200) {
                        const result = response.data.split("=");
                        if (result[0] == "Error") {
                            this.log.debug(`PushRegisterService.registerGcm(): retry: ${retry} retry_count: ${retry_count}`);
                            if (retry_count == retry)
                                throw new Error(`GCM-Register Error: ${result[1]}`);
                        }
                        else {
                            return {
                                token: result[1]
                            };
                        }
                    }
                    else {
                        this.log.error(`PushRegisterService.registerGcm(): Status return code not 200 (status: ${response.status} text: ${response.statusText}`);
                        throw new Error(`Google register to GCM failed with error: ${response.statusText}`);
                    }
                    yield utils_1.sleep(10000 * retry_count);
                }
                throw new Error(`GCM-Register Error: Undefined!`);
            }
            catch (error) {
                this.log.error(`PushRegisterService.registerGcm(): error: ${error}`);
                throw new Error(`Google register to GCM failed with error: ${error}`);
            }
        });
    }
}
exports.PushRegisterService = PushRegisterService;
