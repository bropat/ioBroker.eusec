import axios, { AxiosResponse, Method } from "axios";
import { ResultResponse, FullDeviceResponse, HubResponse, LoginResultResponse } from "./models"
import { EventEmitter } from "events";
import { ApiInterface, FullDevices, Hubs } from "./interfaces";
import { EufySecurity } from "../eufy-security";

export class API extends EventEmitter implements ApiInterface {

    private api_base = "https://mysecurity.eufylife.com/api/v1";
    //private api_base = "https://security-app-eu.eufylife.com/v1";

    private eufy: EufySecurity;

    private username: string|null = null;
    private password: string|null = null;

    private token: string|null = null;
    private token_expiration: Date|null = null;

    private log: ioBroker.Logger;

    private devices: FullDevices = {};
    private hubs: Hubs = {};

    constructor(username: string, password: string, log: ioBroker.Logger, eufy: EufySecurity) {
        super();

        this.eufy = eufy;
        this.username = username;
        this.password = password;
        this.log = log;

        //axios.defaults.baseURL = this.api_base;
    }

    public async authenticate(): Promise<string> {
        //Authenticate and get an access token
        try {
            const response = await this.request("post", "passport/login", {
                email: this.username,
                password: this.password
            });
            this.log.debug("Response: " + JSON.stringify(response.data));

            if (response.status == 200) {
                const result: ResultResponse = response.data;
                if (result.code == 0) {
                    const dataresult: LoginResultResponse = result.data;

                    this.token = dataresult.auth_token
                    this.token_expiration = new Date(dataresult.token_expires_at * 1000);
                    axios.defaults.headers.common["X-Auth-Token"] = this.token;

                    if (dataresult.domain) {
                        if ("https://" + dataresult.domain + "/v1" != this.api_base) {
                            this.api_base = "https://" + dataresult.domain + "/v1";
                            axios.defaults.baseURL = this.api_base;
                            this.log.info(`Switching to another API_BASE (${this.api_base}) and get new token.`);
                            this.token = null;
                            this.token_expiration = null;
                            axios.defaults.headers.common["X-Auth-Token"] = null;
                            return "renew";
                        }
                    }

                    this.log.debug(`API.authenticate(): token: ${this.token}`);
                    this.log.debug(`API.authenticate(): token_expiration: ${this.token_expiration}`);
                    return "ok";
                } else
                    this.log.error(`API.authenticate(): Response code not ok (code: ${result.code} msg: ${result.msg})`);
            } else {
                this.token = null;
                this.token_expiration = null;
                axios.defaults.headers.common["X-Auth-Token"] = null;
                this.log.error(`API.authenticate(): Status return code not 200 (status: ${response.status} text: ${response.statusText}`);
            }
        } catch (error) {
            this.log.error(`API.authenticate(): error: ${error}`);
        }
        return "error";
    }

    public async updateDeviceInfo(): Promise<void> {
        //Get the latest device info

        //Get Stations
        try {
            const response = await this.request("post", "app/get_hub_list");
            this.log.debug(`API.updateDeviceInfo(): stations - Response: ${JSON.stringify(response.data)}`);

            if (response.status == 200) {
                const result: ResultResponse = response.data;
                if (result.code == 0) {
                    const dataresult: Array<HubResponse> = result.data;
                    dataresult.forEach(element => {
                        this.log.debug(`API.updateDeviceInfo(): stations - element: ${JSON.stringify(element)}`);
                        this.log.debug(`API.updateDeviceInfo(): stations - device_type: ${element.device_type}`);
                        if (element.device_type == 0) {
                            // Station
                            this.hubs[element.station_sn] = element;
                        }
                    });

                    if (Object.keys(this.hubs).length > 0)
                        this.emit("hubs", this.hubs, this.eufy);
                } else
                    this.log.error(`API.updateDeviceInfo(): Response code not ok (code: ${result.code} msg: ${result.msg})`);
            } else {
                this.log.error(`API.updateDeviceInfo(): Status return code not 200 (status: ${response.status} text: ${response.statusText}`);
            }
        } catch (error) {
            this.log.error(`API.updateDeviceInfo(): error: ${error}`);
        }

        //Get Devices
        try {
            const response = await this.request("post", "app/get_devs_list");
            this.log.debug(`API.updateDeviceInfo(): cameras - Response: ${JSON.stringify(response.data)}`);

            if (response.status == 200) {
                const result: ResultResponse = response.data;
                if (result.code == 0) {
                    const dataresult: Array<FullDeviceResponse> = result.data;
                    dataresult.forEach(element => {
                        this.devices[element.device_sn] = element;
                    });

                    if (Object.keys(this.devices).length > 0)
                        this.emit("devices", this.devices, this.eufy);
                } else
                    this.log.error(`API.updateDeviceInfo(): Response code not ok (code: ${result.code} msg: ${result.msg})`);
            } else {
                this.log.error(`API.updateDeviceInfo(): Status return code not 200 (status: ${response.status} text: ${response.statusText}`);
            }
        } catch (error) {
            this.log.error(`API.updateDeviceInfo(): error: ${error}`);
        }
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public async request(method: Method, endpoint: string, data?: any): Promise<AxiosResponse<any>> {

        if (!this.token && endpoint != "passport/login") {
            //No token get one
            switch (await this.authenticate()) {
                case "renew":
                    this.log.debug("API.request(): renew token");
                    await this.authenticate();
                    break;
                case "error":
                    this.log.debug("API.request(): token error");
                    break;
                default: break;
            }
        }
        if (this.token_expiration && (new Date()).getTime() >= this.token_expiration.getTime()) {
            this.log.info("Access token expired; fetching a new one")
            this.token = null
            this.token_expiration = null
            //get new token
            await this.authenticate()
        }

        this.log.debug(`API.request(): method: ${method} endpoint: ${endpoint} baseUrl: ${this.api_base} token: ${this.token}`);
        return await axios({
            method: method,
            url: endpoint,
            data: data,
            baseURL: this.api_base
        })
    }

    public getLog(): ioBroker.Logger {
        return this.log;
    }

    public getDevices(): FullDevices {
        return this.devices;
    }

    public getHubs(): Hubs {
        return this.hubs;
    }

}