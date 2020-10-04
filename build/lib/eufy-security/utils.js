"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStationStateID = exports.getCameraStateID = exports.decrypt = void 0;
exports.decrypt = (key, value) => {
    let result = "";
    for (let i = 0; i < value.length; ++i) {
        result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
    }
    return result;
};
exports.getCameraStateID = (camera, level = 1, state) => {
    if (camera) {
        switch (level) {
            case 0:
                return `${camera.getStationSerial()}.cameras`;
            case 1:
                return `${camera.getStationSerial()}.cameras.${camera.getSerial()}`;
            default:
                if (state)
                    return `${camera.getStationSerial()}.cameras.${camera.getSerial()}.${state}`;
                throw new Error("No state value passed.");
        }
    }
    throw new Error("No Camera object passed to generate state id.");
};
exports.getStationStateID = (station, level = 1, state) => {
    if (station) {
        switch (level) {
            case 0:
                return `${station.getSerial()}`;
            case 1:
                return `${station.getSerial()}.station`;
            default:
                if (state)
                    return `${station.getSerial()}.station.${state}`;
                throw new Error("No state value passed.");
        }
    }
    throw new Error("No Station object passed to generate state id.");
};
