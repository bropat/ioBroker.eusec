import { EventEmitter} from "events";
import { API } from "./http/api";
import { Device, Camera } from "./http/device";
import { ApiInterface, Cameras, FullDevices, Hubs, Stations } from "./http/interfaces";
import { CameraStateID } from "./http/types";


import { Station } from "./http/station";
import { FullDeviceResponse, HubResponse } from "./http/models";
import { getCameraStateID } from "./utils";

export class EufySecurity extends EventEmitter implements ApiInterface {

    private adapter: ioBroker.Adapter;

    private username: string;
    private password: string;

    private log: ioBroker.Logger;

    private api: API;

    private stations: Stations = {};
    private cameras: Cameras = {};

    private camera_max_livestream_seconds = 30;
    private camera_livestream_timeout: {
        [index: string]: NodeJS.Timeout;
    } = {};

    constructor(adapter: ioBroker.Adapter) {
        super();

        this.adapter = adapter;
        this.username = this.adapter.config.username;
        this.password = this.adapter.config.password;
        this.camera_max_livestream_seconds = this.adapter.config.maxLivestreamDuration;
        this.log = this.adapter.log;
        this.api = new API(this.username, this.password, this.log, this);
        this.api.on("hubs", this.handleHubs);
        this.api.on("devices", this.handleDevices);
    }

    public addStation(station: Station): void {
        //if (!Object.keys(this.stations).includes(station.getSerial()))
        this.stations[station.getSerial()] = station;
        //throw new Error(`Station with this serial ${station.getSerial()} exists already and couldn't be added again!`);
    }

    public updateStation(hub: HubResponse): void {
        if (Object.keys(this.stations).includes(hub.station_sn))
            this.stations[hub.station_sn].update(hub);
        else
            this.addStation(new Station(this.api, hub));
    }

    public addCamera(camera: Camera): void {
        //if (!Object.keys(this.cameras).includes(camera.getSerial()))
        this.cameras[camera.getSerial()] = camera;
        //throw new Error(`Camera device with this serial ${camera.getSerial()} exists already and couldn't be added again!`);
    }

    public updateCamera(camera: FullDeviceResponse): void {
        if (Object.keys(this.cameras).includes(camera.device_sn))
            this.cameras[camera.device_sn].update(camera)
        else
            this.addCamera(new Camera(this.api, camera));
    }

    public getStations(): Stations {
        return this.stations;
    }

    public getStation(station_sn: string): Station {
        if (Object.keys(this.stations).includes(station_sn))
            return this.stations[station_sn];
        throw new Error(`No station with this serial number: ${station_sn}!`);
    }

    public getCameras(): Cameras {
        return this.cameras;
    }

    public getCamera(camera_sn: string): Camera {
        if (Object.keys(this.cameras).includes(camera_sn))
            return this.cameras[camera_sn];
        throw new Error(`No camera device with this serial number: ${camera_sn}!`);
    }

    public getApi(): API {
        return this.api;
    }

    public getAdapter(): ioBroker.Adapter {
        return this.adapter;
    }

    public getLog(): ioBroker.Log {
        return this.log;
    }

    public async startCameraStream(camera_sn: string): Promise<string> {
        if (Object.keys(this.cameras).includes(camera_sn)) {
            const camera = this.cameras[camera_sn];
            const url = camera.startStream();
            this.camera_livestream_timeout[camera_sn] = setTimeout(() => { this.stopCameraStreamCallback(camera, this.adapter); }, this.camera_max_livestream_seconds * 1000);
            return url;
        }
        throw new Error(`No camera device with this serial number: ${camera_sn}!`);
    }

    private async stopCameraStreamCallback(camera: Camera, adapter: ioBroker.Adapter): Promise<void> {
        camera.stopStream();
        await adapter.delStateAsync(getCameraStateID(camera, 2, CameraStateID.LIVESTREAM));
    }

    public async stopCameraStream(camera_sn: string): Promise<void> {
        if (Object.keys(this.cameras).includes(camera_sn)) {
            const camera: Camera = this.cameras[camera_sn];
            if (this.camera_livestream_timeout[camera_sn]) {
                clearTimeout(this.camera_livestream_timeout[camera_sn]);
                delete this.camera_livestream_timeout[camera_sn];
            }
            await this.stopCameraStreamCallback(camera, this.adapter);
        } else {
            throw new Error(`No camera device with this serial number: ${camera_sn}!`);
        }
    }

    public async connectToStation(station_sn: string): Promise<void> {
        if (Object.keys(this.stations).includes(station_sn))
            this.stations[station_sn].connect();
        else
            throw new Error(`No station with this serial number: ${station_sn}!`);
    }

    /*public async disconnectFromStation(station_sn: string): Promise<void> {
        if (Object.keys(this.stations).includes(station_sn))
            //TODO: Finish disconnectFromStation implementation
            this.stations[station_sn];
        else
            throw new Error(`No station with this serial number: ${station_sn}!`);
    }*/

    private handleHubs(hubs: Hubs, eufy: EufySecurity): void {
        const log =  eufy.getLog();
        log.debug(`EufySecurity.handleHubs(): hubs: ${Object.keys(hubs).length}`);
        const stations_sns: string[] = Object.keys(eufy.getStations());
        for (const hub of Object.values(hubs)) {
            if (stations_sns.includes(hub.station_sn)) {
                eufy.updateStation(hub);
            } else {
                eufy.addStation(new Station(eufy.getApi(), hub));
            }
        }
        const stations = eufy.getStations()
        log.debug(`EufySecurity.handleHubs(): stations: ${Object.keys(stations).length}`);
        if (Object.keys(stations).length > 0)
            eufy.emit("stations", stations, eufy.getAdapter());
    }

    private handleDevices(devices: FullDevices, eufy: EufySecurity): void {
        const log =  eufy.getLog();
        log.debug(`EufySecurity.handleDevices(): devices: ${Object.keys(devices).length}`);
        const cameras_sns: string[] = Object.keys(eufy.getCameras());
        for (const device of Object.values(devices)) {
            if (Device.isCamera(device)) {
                if (cameras_sns.includes(device.device_sn)) {
                    eufy.updateCamera(device);
                } else {
                    eufy.addCamera(new Camera(eufy.getApi(), device));
                }
            }
        }
        const cameras = eufy.getCameras()
        log.debug(`EufySecurity.handleDevices(): cameras: ${Object.keys(cameras).length}`);
        if (Object.keys(cameras).length > 0)
            eufy.emit("cameras", cameras, eufy.getAdapter());
    }

    public refreshData(): void {
        this.api.updateDeviceInfo();
    }

    public close(): void {

        // if there is a camera with livestream running stop it (incl. timeout)
        for (const camera of Object.values(this.getCameras())) {
            if (camera) {
                if (camera.isStreaming()) {
                    this.stopCameraStream(camera.getSerial());
                }
            }
        }

        Object.values(this.stations).forEach(station => {
            station.close();
        });
        /*Object.values(this.cameras).forEach(camera => {
            camera.close();
        });*/
    }

    public setCameraMaxLivestreamDuration(seconds: number): void {
        this.camera_max_livestream_seconds = seconds;
    }

    public getCameraMaxLivestreamDuration(): number {
        return this.camera_max_livestream_seconds;
    }

    /*public setStationParameter(): void {
        this.getStations()[]
    }*/

}