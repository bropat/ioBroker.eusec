/*
 * Created with @iobroker/create-adapter v1.28.0
 */

import * as utils from "@iobroker/adapter-core";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { strict } from "assert";
import * as EufySecurityAPI from "./lib/eufy-security/eufy-security";
import * as Interface from "./lib/eufy-security/interfaces"
import { Cameras, Stations } from "./lib/eufy-security/http/interfaces";
import { CameraStateID, GuardMode, ParamType, StationStateID } from "./lib/eufy-security/http/types";
import { decrypt, getCameraStateID, getStationStateID } from "./lib/eufy-security/utils";

// Augment the adapter.config object with the actual types
// TODO: delete this in the next version
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace ioBroker {
        // eslint-disable-next-line @typescript-eslint/no-empty-interface
        interface AdapterConfig extends Interface.AdapterConfig{
            // Define the shape of your options here (recommended)
            // Or use a catch-all approach
            //[key: string]: any;
        }
    }
}

class EufySecurity extends utils.Adapter {

    private eufy?: EufySecurityAPI.EufySecurity;
    private refreshTimeout?: NodeJS.Timeout;

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            ...options,
            name: "eufy-security",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        // this.on("objectChange", this.onObjectChange.bind(this));
        // this.on("message", this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    private async onReady(): Promise<void> {

        this.getForeignObject("system.config", (err, obj) => {
            if (!this.supportsFeature || !this.supportsFeature("ADAPTER_AUTO_DECRYPT_NATIVE")) {
                if (obj && obj.native && obj.native.secret) {
                    //noinspection JSUnresolvedVariable
                    this.config.password = decrypt(obj.native.secret, this.config.password);
                } else {
                    //noinspection JSUnresolvedVariable
                    this.config.password = decrypt("yx6eWMwGK2AE4k1Yoxt3E5pT", this.config.password);
                }
            }
        });

        this.eufy = new EufySecurityAPI.EufySecurity(this);
        this.eufy.on("stations", this.handleStations);
        this.eufy.on("cameras", this.handleCameras);

        this.refreshData(this);

    }

    private refreshData(adapter: EufySecurity): void {
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
    private onUnload(callback: () => void): void {
        try {
            if (this.refreshTimeout)
                clearTimeout(this.refreshTimeout);

            if (this.eufy)
                this.eufy.close();

            callback();
        } catch (e) {
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
    private async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
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
                    switch(device_state_name) {
                        case CameraStateID.START_STREAM:
                            await this.setStateAsync(`${station_sn}.${device_type}.${device_sn}.${CameraStateID.LIVESTREAM}`, { val: await this.eufy.startCameraStream(device_sn), ack: true });
                            break;

                        case CameraStateID.STOP_STREAM:
                            await this.eufy.stopCameraStream(device_sn);
                            break;
                    }
                }
            } else if (device_type == "station") {
                const station_state_name = values[4];
                if (this.eufy) {
                    switch(station_state_name) {
                        case StationStateID.GUARD_MODE:
                            await this.eufy.getStation(station_sn).setGuardMode(<GuardMode>state.val);
                            await this.setStateAsync(`${station_sn}.${device_type}.${station_state_name}`, {...state, ack: true });
                            break;
                    }
                }
            }
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
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

    private async handleCameras(cameras: Cameras, adapter: ioBroker.Adapter): Promise<void> {

        this.log.debug(`handleCameras(): count: ${Object.keys(cameras).length}`);

        Object.values(cameras).forEach(async camera => {

            await adapter.setObjectNotExistsAsync(getCameraStateID(camera, 0), {
                type: "channel",
                common: {
                    name: "cameras"
                },
                native: {},
            });

            await adapter.setObjectNotExistsAsync(getCameraStateID(camera), {
                type: "device",
                common: {
                    name: camera.getName()
                },
                native: {},
            });

            // Name
            await adapter.setObjectNotExistsAsync(getCameraStateID(camera, 2, CameraStateID.NAME), {
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
            await adapter.setStateAsync(getCameraStateID(camera, 2, CameraStateID.NAME), { val: camera.getName(), ack: true });

            // Model
            await adapter.setObjectNotExistsAsync(getCameraStateID(camera, 2, CameraStateID.MODEL), {
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
            await adapter.setStateAsync(getCameraStateID(camera, 2, CameraStateID.MODEL), { val: camera.getModel(), ack: true });

            // Serial
            await adapter.setObjectNotExistsAsync(getCameraStateID(camera, 2, CameraStateID.SERIAL_NUMBER), {
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
            await adapter.setStateAsync(getCameraStateID(camera, 2, CameraStateID.SERIAL_NUMBER), { val: camera.getSerial(), ack: true });

            // Software version
            await adapter.setObjectNotExistsAsync(getCameraStateID(camera, 2, CameraStateID.SOFTWARE_VERSION), {
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
            await adapter.setStateAsync(getCameraStateID(camera, 2, CameraStateID.SOFTWARE_VERSION), { val: camera.getSoftwareVersion(), ack: true });

            // Hardware version
            await adapter.setObjectNotExistsAsync(getCameraStateID(camera, 2, CameraStateID.HARDWARE_VERSION), {
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
            await adapter.setStateAsync(getCameraStateID(camera, 2, CameraStateID.HARDWARE_VERSION), { val: camera.getHardwareVersion(), ack: true });

            // Mac address
            await adapter.setObjectNotExistsAsync(getCameraStateID(camera, 2, CameraStateID.MAC_ADDRESS), {
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
            await adapter.setStateAsync(getCameraStateID(camera, 2, CameraStateID.MAC_ADDRESS), { val: camera.getMACAddress(), ack: true });

            // Last camera URL
            await adapter.setObjectNotExistsAsync(getCameraStateID(camera, 2, CameraStateID.LAST_CAMERA_URL), {
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
            await adapter.setStateAsync(getCameraStateID(camera, 2, CameraStateID.LAST_CAMERA_URL), { val: camera.getLastCameraImageURL(), ack: true });

            // Start Stream
            await adapter.setObjectNotExistsAsync(getCameraStateID(camera, 2, CameraStateID.START_STREAM), {
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
            await adapter.setObjectNotExistsAsync(getCameraStateID(camera, 2, CameraStateID.STOP_STREAM), {
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
            await adapter.setObjectNotExistsAsync(getCameraStateID(camera, 2, CameraStateID.LIVESTREAM), {
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

        });
    }

    private async handleStations(stations: Stations, adapter: ioBroker.Adapter): Promise<void> {

        this.log.debug(`handleStations(): count: ${Object.keys(stations).length}`);

        Object.values(stations).forEach(async station => {
            adapter.subscribeStates(`${getStationStateID(station, 0)}.*`);

            await adapter.setObjectNotExistsAsync(getStationStateID(station, 0), {
                type: "device",
                common: {
                    name: station.getName()
                },
                native: {},
            });

            await adapter.setObjectNotExistsAsync(getStationStateID(station), {
                type: "channel",
                common: {
                    name: "station"
                },
                native: {},
            });

            // Station info
            // Name
            await adapter.setObjectNotExistsAsync(getStationStateID(station, 2, StationStateID.NAME), {
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
            await adapter.setStateAsync(getStationStateID(station, 2, StationStateID.NAME), { val: station.getName(), ack: true });

            // Model
            await adapter.setObjectNotExistsAsync(getStationStateID(station, 2, StationStateID.MODEL), {
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
            await adapter.setStateAsync(getStationStateID(station, 2, StationStateID.MODEL), { val: station.getModel(), ack: true });

            // Serial
            await adapter.setObjectNotExistsAsync(getStationStateID(station, 2, StationStateID.SERIAL_NUMBER), {
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
            await adapter.setStateAsync(getStationStateID(station, 2, StationStateID.SERIAL_NUMBER), { val: station.getSerial(), ack: true });

            // Software version
            await adapter.setObjectNotExistsAsync(getStationStateID(station, 2, StationStateID.SOFTWARE_VERSION), {
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
            await adapter.setStateAsync(getStationStateID(station, 2, StationStateID.SOFTWARE_VERSION), { val: station.getSoftwareVersion(), ack: true });

            // Hardware version
            await adapter.setObjectNotExistsAsync(getStationStateID(station, 2, StationStateID.HARDWARE_VERSION), {
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
            await adapter.setStateAsync(getStationStateID(station, 2, StationStateID.HARDWARE_VERSION), { val: station.getHardwareVersion(), ack: true });

            // IP Address
            await adapter.setObjectNotExistsAsync(getStationStateID(station, 2, StationStateID.IP_ADDRESS), {
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
            await adapter.setStateAsync(getStationStateID(station, 2, StationStateID.IP_ADDRESS), { val: station.getIPAddress(), ack: true });

            // MAC Address
            await adapter.setObjectNotExistsAsync(getStationStateID(station, 2, StationStateID.MAC_ADDRESS), {
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
            await adapter.setStateAsync(getStationStateID(station, 2, StationStateID.MAC_ADDRESS), { val: station.getMACAddress(), ack: true });

            // Station Paramters
            // Guard Mode
            await adapter.setObjectNotExistsAsync(getStationStateID(station, 2, StationStateID.GUARD_MODE), {
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
            await adapter.setStateAsync(getStationStateID(station, 2, StationStateID.GUARD_MODE), { val: station.getParameter(ParamType.GUARD_MODE), ack: true });

        });
    }

}

if (module.parent) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new EufySecurity(options);
} else {
    // otherwise start the instance directly
    (() => new EufySecurity())();
}