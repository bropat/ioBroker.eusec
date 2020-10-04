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
exports.EufySecurity = void 0;
const events_1 = require("events");
const api_1 = require("./http/api");
const device_1 = require("./http/device");
const types_1 = require("./http/types");
const station_1 = require("./http/station");
const utils_1 = require("./utils");
class EufySecurity extends events_1.EventEmitter {
    constructor(adapter) {
        super();
        this.stations = {};
        this.cameras = {};
        this.camera_max_livestream_seconds = 30;
        this.camera_livestream_timeout = {};
        this.adapter = adapter;
        this.username = this.adapter.config.username;
        this.password = this.adapter.config.password;
        this.camera_max_livestream_seconds = this.adapter.config.maxLivestreamDuration;
        this.log = this.adapter.log;
        this.api = new api_1.API(this.username, this.password, this.log, this);
        this.api.on("hubs", this.handleHubs);
        this.api.on("devices", this.handleDevices);
    }
    addStation(station) {
        //if (!Object.keys(this.stations).includes(station.getSerial()))
        this.stations[station.getSerial()] = station;
        //throw new Error(`Station with this serial ${station.getSerial()} exists already and couldn't be added again!`);
    }
    updateStation(hub) {
        if (Object.keys(this.stations).includes(hub.station_sn))
            this.stations[hub.station_sn].update(hub);
        else
            this.addStation(new station_1.Station(this.api, hub));
    }
    addCamera(camera) {
        //if (!Object.keys(this.cameras).includes(camera.getSerial()))
        this.cameras[camera.getSerial()] = camera;
        //throw new Error(`Camera device with this serial ${camera.getSerial()} exists already and couldn't be added again!`);
    }
    updateCamera(camera) {
        if (Object.keys(this.cameras).includes(camera.device_sn))
            this.cameras[camera.device_sn].update(camera);
        else
            this.addCamera(new device_1.Camera(this.api, camera));
    }
    getStations() {
        return this.stations;
    }
    getStation(station_sn) {
        if (Object.keys(this.stations).includes(station_sn))
            return this.stations[station_sn];
        throw new Error(`No station with this serial number: ${station_sn}!`);
    }
    getCameras() {
        return this.cameras;
    }
    getCamera(camera_sn) {
        if (Object.keys(this.cameras).includes(camera_sn))
            return this.cameras[camera_sn];
        throw new Error(`No camera device with this serial number: ${camera_sn}!`);
    }
    getApi() {
        return this.api;
    }
    getAdapter() {
        return this.adapter;
    }
    getLog() {
        return this.log;
    }
    startCameraStream(camera_sn) {
        return __awaiter(this, void 0, void 0, function* () {
            if (Object.keys(this.cameras).includes(camera_sn)) {
                const camera = this.cameras[camera_sn];
                const url = camera.startStream();
                this.camera_livestream_timeout[camera_sn] = setTimeout(() => { this.stopCameraStreamCallback(camera, this.adapter); }, this.camera_max_livestream_seconds * 1000);
                return url;
            }
            throw new Error(`No camera device with this serial number: ${camera_sn}!`);
        });
    }
    stopCameraStreamCallback(camera, adapter) {
        return __awaiter(this, void 0, void 0, function* () {
            camera.stopStream();
            yield adapter.delStateAsync(utils_1.getCameraStateID(camera, 2, types_1.CameraStateID.LIVESTREAM));
        });
    }
    stopCameraStream(camera_sn) {
        return __awaiter(this, void 0, void 0, function* () {
            if (Object.keys(this.cameras).includes(camera_sn)) {
                const camera = this.cameras[camera_sn];
                if (this.camera_livestream_timeout[camera_sn]) {
                    clearTimeout(this.camera_livestream_timeout[camera_sn]);
                    delete this.camera_livestream_timeout[camera_sn];
                }
                yield this.stopCameraStreamCallback(camera, this.adapter);
            }
            else {
                throw new Error(`No camera device with this serial number: ${camera_sn}!`);
            }
        });
    }
    connectToStation(station_sn) {
        return __awaiter(this, void 0, void 0, function* () {
            if (Object.keys(this.stations).includes(station_sn))
                this.stations[station_sn].connect();
            else
                throw new Error(`No station with this serial number: ${station_sn}!`);
        });
    }
    /*public async disconnectFromStation(station_sn: string): Promise<void> {
        if (Object.keys(this.stations).includes(station_sn))
            //TODO: Finish disconnectFromStation implementation
            this.stations[station_sn];
        else
            throw new Error(`No station with this serial number: ${station_sn}!`);
    }*/
    handleHubs(hubs, eufy) {
        const log = eufy.getLog();
        log.debug(`EufySecurity.handleHubs(): hubs: ${Object.keys(hubs).length}`);
        const stations_sns = Object.keys(eufy.getStations());
        for (const hub of Object.values(hubs)) {
            if (stations_sns.includes(hub.station_sn)) {
                eufy.updateStation(hub);
            }
            else {
                eufy.addStation(new station_1.Station(eufy.getApi(), hub));
            }
        }
        const stations = eufy.getStations();
        log.debug(`EufySecurity.handleHubs(): stations: ${Object.keys(stations).length}`);
        if (Object.keys(stations).length > 0)
            eufy.emit("stations", stations, eufy.getAdapter());
    }
    handleDevices(devices, eufy) {
        const log = eufy.getLog();
        log.debug(`EufySecurity.handleDevices(): devices: ${Object.keys(devices).length}`);
        const cameras_sns = Object.keys(eufy.getCameras());
        for (const device of Object.values(devices)) {
            if (device_1.Device.isCamera(device)) {
                if (cameras_sns.includes(device.device_sn)) {
                    eufy.updateCamera(device);
                }
                else {
                    eufy.addCamera(new device_1.Camera(eufy.getApi(), device));
                }
            }
        }
        const cameras = eufy.getCameras();
        log.debug(`EufySecurity.handleDevices(): cameras: ${Object.keys(cameras).length}`);
        if (Object.keys(cameras).length > 0)
            eufy.emit("cameras", cameras, eufy.getAdapter());
    }
    refreshData() {
        this.api.updateDeviceInfo();
    }
    close() {
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
    setCameraMaxLivestreamDuration(seconds) {
        this.camera_max_livestream_seconds = seconds;
    }
    getCameraMaxLivestreamDuration() {
        return this.camera_max_livestream_seconds;
    }
}
exports.EufySecurity = EufySecurity;
