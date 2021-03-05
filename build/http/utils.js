"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAbsoluteFilePath = exports.getTimezoneGMTString = exports.pad = exports.isGreaterMinVersion = void 0;
const types_1 = require("./types");
const isGreaterMinVersion = function (minimal_version, current_version) {
    if (minimal_version === undefined)
        minimal_version = "";
    if (current_version === undefined)
        current_version = "";
    minimal_version = minimal_version.replace(/\D+/g, "");
    current_version = current_version.replace(/\D+/g, "");
    if (minimal_version === "")
        return false;
    if (current_version === "")
        return false;
    let min_version = 0;
    let curr_version = 0;
    try {
        min_version = Number.parseInt(minimal_version);
    }
    catch (error) {
    }
    try {
        curr_version = Number.parseInt(current_version);
    }
    catch (error) {
    }
    if (curr_version === 0 || min_version === 0 || curr_version < min_version) {
        return false;
    }
    return true;
};
exports.isGreaterMinVersion = isGreaterMinVersion;
const pad = function (num) {
    const norm = Math.floor(Math.abs(num));
    return (norm < 10 ? "0" : "") + norm;
};
exports.pad = pad;
const getTimezoneGMTString = function () {
    const tzo = -new Date().getTimezoneOffset();
    const dif = tzo >= 0 ? "+" : "-";
    return `GMT${dif}${exports.pad(tzo / 60)}:${exports.pad(tzo % 60)}`;
};
exports.getTimezoneGMTString = getTimezoneGMTString;
const getAbsoluteFilePath = function (device_type, channel, filename) {
    if (device_type === types_1.DeviceType.FLOODLIGHT) {
        return `/mnt/data/Camera${String(channel).padStart(2, "0")}/${filename}.dat`;
    }
    return `/media/mmcblk0p1/Camera${String(channel).padStart(2, "0")}/${filename}.dat`;
};
exports.getAbsoluteFilePath = getAbsoluteFilePath;
