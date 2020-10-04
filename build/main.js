"use strict";
/*
 * Created with @iobroker/create-adapter v1.28.0
 */
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
const utils = require("@iobroker/adapter-core");
const EufySecurityAPI = require("./lib/eufy-security/eufy-security");
const types_1 = require("./lib/eufy-security/http/types");
const utils_1 = require("./lib/eufy-security/utils");
class EufySecurity extends utils.Adapter {
    constructor(options = {}) {
        super(Object.assign(Object.assign({}, options), { name: "eufy-security" }));
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        // this.on("objectChange", this.onObjectChange.bind(this));
        // this.on("message", this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));
    }
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    onReady() {
        return __awaiter(this, void 0, void 0, function* () {
            this.getForeignObject("system.config", (err, obj) => {
                if (!this.supportsFeature || !this.supportsFeature("ADAPTER_AUTO_DECRYPT_NATIVE")) {
                    if (obj && obj.native && obj.native.secret) {
                        //noinspection JSUnresolvedVariable
                        this.config.password = utils_1.decrypt(obj.native.secret, this.config.password);
                    }
                    else {
                        //noinspection JSUnresolvedVariable
                        this.config.password = utils_1.decrypt("yx6eWMwGK2AE4k1Yoxt3E5pT", this.config.password);
                    }
                }
            });
            this.eufy = new EufySecurityAPI.EufySecurity(this);
            this.eufy.on("stations", this.handleStations);
            this.eufy.on("cameras", this.handleCameras);
            this.refreshData(this);
        });
    }
    refreshData(adapter) {
        adapter.log.silly(`refreshData(): pollingInterval: ${adapter.config.pollingInterval}`);
        if (adapter.eufy) {
            adapter.log.info("Refresh data from cloud and schedule next refresh.");
            adapter.eufy.refreshData();
            adapter.refreshTimeout = setTimeout(() => { this.refreshData(adapter); }, adapter.config.pollingInterval * 60 * 1000);
        }
    }
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    onUnload(callback) {
        try {
            if (this.refreshTimeout)
                clearTimeout(this.refreshTimeout);
            if (this.eufy)
                this.eufy.close();
            callback();
        }
        catch (e) {
            callback();
        }
    }
    // If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
    // You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
    // /**
    //  * Is called if a subscribed object changes
    //  */
    // private onObjectChange(id: string, obj: ioBroker.Object | null | undefined): void {
    //     if (obj) {
    //         // The object was changed
    //         this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
    //     } else {
    //         // The object was deleted
    //         this.log.info(`object ${id} deleted`);
    //     }
    // }
    /**
     * Is called if a subscribed state changes
     */
    onStateChange(id, state) {
        return __awaiter(this, void 0, void 0, function* () {
            if (state) {
                // The state was changed
                this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
                // don't do anything if the state is acked
                if (!id || state.ack) {
                    return;
                }
                const values = id.split(".");
                const station_sn = values[2];
                const device_type = values[3];
                if (device_type == "cameras") {
                    const device_sn = values[4];
                    const device_state_name = values[5];
                    if (this.eufy) {
                        switch (device_state_name) {
                            case types_1.CameraStateID.START_STREAM:
                                yield this.setStateAsync(`${station_sn}.${device_type}.${device_sn}.${types_1.CameraStateID.LIVESTREAM}`, { val: yield this.eufy.startCameraStream(device_sn), ack: true });
                                break;
                            case types_1.CameraStateID.STOP_STREAM:
                                yield this.eufy.stopCameraStream(device_sn);
                                break;
                        }
                    }
                }
                else if (device_type == "station") {
                    const station_state_name = values[4];
                    if (this.eufy) {
                        switch (station_state_name) {
                            case types_1.StationStateID.GUARD_MODE:
                                yield this.eufy.getStation(station_sn).setGuardMode(state.val);
                                yield this.setStateAsync(`${station_sn}.${device_type}.${station_state_name}`, Object.assign(Object.assign({}, state), { ack: true }));
                                break;
                        }
                    }
                }
            }
            else {
                // The state was deleted
                this.log.info(`state ${id} deleted`);
            }
        });
    }
    // If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
    // /**
    //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
    //  * Using this method requires "common.message" property to be set to true in io-package.json
    //  */
    // private onMessage(obj: ioBroker.Message): void {
    //     if (typeof obj === "object" && obj.message) {
    //         if (obj.command === "send") {
    //             // e.g. send email or pushover or whatever
    //             this.log.info("send command");
    //             // Send response in callback if required
    //             if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
    //         }
    //     }
    // }
    handleCameras(cameras, adapter) {
        return __awaiter(this, void 0, void 0, function* () {
            this.log.debug(`handleCameras(): count: ${Object.keys(cameras).length}`);
            Object.values(cameras).forEach((camera) => __awaiter(this, void 0, void 0, function* () {
                yield adapter.setObjectNotExistsAsync(utils_1.getCameraStateID(camera, 0), {
                    type: "channel",
                    common: {
                        name: "cameras"
                    },
                    native: {},
                });
                yield adapter.setObjectNotExistsAsync(utils_1.getCameraStateID(camera), {
                    type: "device",
                    common: {
                        name: camera.getName()
                    },
                    native: {},
                });
                // Name
                yield adapter.setObjectNotExistsAsync(utils_1.getCameraStateID(camera, 2, types_1.CameraStateID.NAME), {
                    type: "state",
                    common: {
                        name: "Name",
                        type: "string",
                        role: "text",
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                yield adapter.setStateAsync(utils_1.getCameraStateID(camera, 2, types_1.CameraStateID.NAME), { val: camera.getName(), ack: true });
                // Model
                yield adapter.setObjectNotExistsAsync(utils_1.getCameraStateID(camera, 2, types_1.CameraStateID.MODEL), {
                    type: "state",
                    common: {
                        name: "Model",
                        type: "string",
                        role: "text",
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                yield adapter.setStateAsync(utils_1.getCameraStateID(camera, 2, types_1.CameraStateID.MODEL), { val: camera.getModel(), ack: true });
                // Serial
                yield adapter.setObjectNotExistsAsync(utils_1.getCameraStateID(camera, 2, types_1.CameraStateID.SERIAL_NUMBER), {
                    type: "state",
                    common: {
                        name: "Serial number",
                        type: "string",
                        role: "text",
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                yield adapter.setStateAsync(utils_1.getCameraStateID(camera, 2, types_1.CameraStateID.SERIAL_NUMBER), { val: camera.getSerial(), ack: true });
                // Software version
                yield adapter.setObjectNotExistsAsync(utils_1.getCameraStateID(camera, 2, types_1.CameraStateID.SOFTWARE_VERSION), {
                    type: "state",
                    common: {
                        name: "Software version",
                        type: "string",
                        role: "text",
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                yield adapter.setStateAsync(utils_1.getCameraStateID(camera, 2, types_1.CameraStateID.SOFTWARE_VERSION), { val: camera.getSoftwareVersion(), ack: true });
                // Hardware version
                yield adapter.setObjectNotExistsAsync(utils_1.getCameraStateID(camera, 2, types_1.CameraStateID.HARDWARE_VERSION), {
                    type: "state",
                    common: {
                        name: "Hardware version",
                        type: "string",
                        role: "text",
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                yield adapter.setStateAsync(utils_1.getCameraStateID(camera, 2, types_1.CameraStateID.HARDWARE_VERSION), { val: camera.getHardwareVersion(), ack: true });
                // Mac address
                yield adapter.setObjectNotExistsAsync(utils_1.getCameraStateID(camera, 2, types_1.CameraStateID.MAC_ADDRESS), {
                    type: "state",
                    common: {
                        name: "MAC Address",
                        type: "string",
                        role: "text",
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                yield adapter.setStateAsync(utils_1.getCameraStateID(camera, 2, types_1.CameraStateID.MAC_ADDRESS), { val: camera.getMACAddress(), ack: true });
                // Last camera URL
                yield adapter.setObjectNotExistsAsync(utils_1.getCameraStateID(camera, 2, types_1.CameraStateID.LAST_CAMERA_URL), {
                    type: "state",
                    common: {
                        name: "Last camera URL",
                        type: "string",
                        role: "text.url",
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                yield adapter.setStateAsync(utils_1.getCameraStateID(camera, 2, types_1.CameraStateID.LAST_CAMERA_URL), { val: camera.getLastCameraImageURL(), ack: true });
                // Start Stream
                yield adapter.setObjectNotExistsAsync(utils_1.getCameraStateID(camera, 2, types_1.CameraStateID.START_STREAM), {
                    type: "state",
                    common: {
                        name: "Start stream",
                        type: "boolean",
                        role: "button.start",
                        read: false,
                        write: true,
                    },
                    native: {},
                });
                // Stop Stream
                yield adapter.setObjectNotExistsAsync(utils_1.getCameraStateID(camera, 2, types_1.CameraStateID.STOP_STREAM), {
                    type: "state",
                    common: {
                        name: "Stop stream",
                        type: "boolean",
                        role: "button.stop",
                        read: false,
                        write: true,
                    },
                    native: {},
                });
                // Livestream URL
                yield adapter.setObjectNotExistsAsync(utils_1.getCameraStateID(camera, 2, types_1.CameraStateID.LIVESTREAM), {
                    type: "state",
                    common: {
                        name: "Livestream URL",
                        type: "string",
                        role: "text.url",
                        read: true,
                        write: false,
                    },
                    native: {},
                });
            }));
        });
    }
    handleStations(stations, adapter) {
        return __awaiter(this, void 0, void 0, function* () {
            this.log.debug(`handleStations(): count: ${Object.keys(stations).length}`);
            Object.values(stations).forEach((station) => __awaiter(this, void 0, void 0, function* () {
                adapter.subscribeStates(`${utils_1.getStationStateID(station, 0)}.*`);
                yield adapter.setObjectNotExistsAsync(utils_1.getStationStateID(station, 0), {
                    type: "device",
                    common: {
                        name: station.getName()
                    },
                    native: {},
                });
                yield adapter.setObjectNotExistsAsync(utils_1.getStationStateID(station), {
                    type: "channel",
                    common: {
                        name: "station"
                    },
                    native: {},
                });
                // Station info
                // Name
                yield adapter.setObjectNotExistsAsync(utils_1.getStationStateID(station, 2, types_1.StationStateID.NAME), {
                    type: "state",
                    common: {
                        name: "Name",
                        type: "string",
                        role: "text",
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                yield adapter.setStateAsync(utils_1.getStationStateID(station, 2, types_1.StationStateID.NAME), { val: station.getName(), ack: true });
                // Model
                yield adapter.setObjectNotExistsAsync(utils_1.getStationStateID(station, 2, types_1.StationStateID.MODEL), {
                    type: "state",
                    common: {
                        name: "Model",
                        type: "string",
                        role: "text",
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                yield adapter.setStateAsync(utils_1.getStationStateID(station, 2, types_1.StationStateID.MODEL), { val: station.getModel(), ack: true });
                // Serial
                yield adapter.setObjectNotExistsAsync(utils_1.getStationStateID(station, 2, types_1.StationStateID.SERIAL_NUMBER), {
                    type: "state",
                    common: {
                        name: "Serial number",
                        type: "string",
                        role: "text",
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                yield adapter.setStateAsync(utils_1.getStationStateID(station, 2, types_1.StationStateID.SERIAL_NUMBER), { val: station.getSerial(), ack: true });
                // Software version
                yield adapter.setObjectNotExistsAsync(utils_1.getStationStateID(station, 2, types_1.StationStateID.SOFTWARE_VERSION), {
                    type: "state",
                    common: {
                        name: "Software version",
                        type: "string",
                        role: "text",
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                yield adapter.setStateAsync(utils_1.getStationStateID(station, 2, types_1.StationStateID.SOFTWARE_VERSION), { val: station.getSoftwareVersion(), ack: true });
                // Hardware version
                yield adapter.setObjectNotExistsAsync(utils_1.getStationStateID(station, 2, types_1.StationStateID.HARDWARE_VERSION), {
                    type: "state",
                    common: {
                        name: "Hardware version",
                        type: "string",
                        role: "text",
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                yield adapter.setStateAsync(utils_1.getStationStateID(station, 2, types_1.StationStateID.HARDWARE_VERSION), { val: station.getHardwareVersion(), ack: true });
                // IP Address
                yield adapter.setObjectNotExistsAsync(utils_1.getStationStateID(station, 2, types_1.StationStateID.IP_ADDRESS), {
                    type: "state",
                    common: {
                        name: "IP Address",
                        type: "string",
                        role: "text",
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                yield adapter.setStateAsync(utils_1.getStationStateID(station, 2, types_1.StationStateID.IP_ADDRESS), { val: station.getIPAddress(), ack: true });
                // MAC Address
                yield adapter.setObjectNotExistsAsync(utils_1.getStationStateID(station, 2, types_1.StationStateID.MAC_ADDRESS), {
                    type: "state",
                    common: {
                        name: "MAC Address",
                        type: "string",
                        role: "text",
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                yield adapter.setStateAsync(utils_1.getStationStateID(station, 2, types_1.StationStateID.MAC_ADDRESS), { val: station.getMACAddress(), ack: true });
                // Station Paramters
                // Guard Mode
                yield adapter.setObjectNotExistsAsync(utils_1.getStationStateID(station, 2, types_1.StationStateID.GUARD_MODE), {
                    type: "state",
                    common: {
                        name: "Guard Mode",
                        type: "number",
                        role: "state",
                        read: true,
                        write: true,
                        states: {
                            0: "AWAY",
                            1: "HOME",
                            2: "SCHEDULE",
                            63: "DISARMED"
                        }
                    },
                    native: {},
                });
                yield adapter.setStateAsync(utils_1.getStationStateID(station, 2, types_1.StationStateID.GUARD_MODE), { val: station.getParameter(types_1.ParamType.GUARD_MODE), ack: true });
            }));
        });
    }
}
if (module.parent) {
    // Export the constructor in compact mode
    module.exports = (options) => new EufySecurity(options);
}
else {
    // otherwise start the instance directly
    (() => new EufySecurity())();
}
