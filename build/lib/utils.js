"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var utils_exports = {};
__export(utils_exports, {
  changeRole: () => changeRole,
  convertCamelCaseToSnakeCase: () => convertCamelCaseToSnakeCase,
  deleteStates: () => deleteStates,
  getDataFilePath: () => getDataFilePath,
  getImageAsHTML: () => getImageAsHTML,
  getVideoClipLength: () => getVideoClipLength,
  handleUpdate: () => handleUpdate,
  isEmpty: () => isEmpty,
  lowestUnusedNumber: () => lowestUnusedNumber,
  moveFiles: () => moveFiles,
  removeFiles: () => removeFiles,
  removeLastChar: () => removeLastChar,
  setStateAsync: () => setStateAsync,
  setStateChangedAsync: () => setStateChangedAsync,
  sleep: () => sleep
});
module.exports = __toCommonJS(utils_exports);
var import_eufy_security_client = require("eufy-security-client");
var import_path = __toESM(require("path"));
var import_fs_extra = __toESM(require("fs-extra"));
var utils = __toESM(require("@iobroker/adapter-core"));
const setStateChangedAsync = async function(adapter, id, value) {
  return await adapter.setStateChangedAsync(id, value === void 0 || value === null ? null : { val: value, ack: true }).catch();
};
const isEmpty = function(str) {
  if (str) {
    if (str.length > 0)
      return false;
    return true;
  }
  return true;
};
const getImageAsHTML = function(data, mime = "image/jpg") {
  if (data && data.length > 0)
    return `<img src="data:${mime};base64,${data.toString("base64")}" style="width: auto ;height: 100%;" />`;
  return "";
};
const getDataFilePath = function(adapter, stationSerial, folderName, fileName) {
  const dir_path = import_path.default.join(utils.getAbsoluteInstanceDataDir(adapter), stationSerial, folderName);
  if (!import_fs_extra.default.existsSync(dir_path)) {
    import_fs_extra.default.mkdirSync(dir_path, { mode: 509, recursive: true });
  }
  return import_path.default.join(dir_path, fileName);
};
const setStateAsync = async function(adapter, state_id, common_name, value, role = "text", type = "string") {
  await adapter.setObjectNotExistsAsync(state_id, {
    type: "state",
    common: {
      name: common_name,
      type,
      role,
      read: true,
      write: false
    },
    native: {}
  });
  await adapter.setStateAsync(state_id, { val: value, ack: true });
};
const removeFiles = function(adapter, stationSerial, folderName, device_sn) {
  return new Promise((resolve, reject) => {
    try {
      const dir_path = import_path.default.join(utils.getAbsoluteInstanceDataDir(adapter), stationSerial, folderName);
      if (import_fs_extra.default.existsSync(dir_path)) {
        const files = import_fs_extra.default.readdirSync(dir_path).filter((fn) => fn.startsWith(device_sn));
        try {
          files.map((filename) => import_fs_extra.default.removeSync(import_path.default.join(dir_path, filename)));
        } catch (error) {
        }
      }
      resolve();
    } catch (error) {
      reject(error);
    }
  });
};
const moveFiles = function(adapter, stationSerial, device_sn, srcFolderName, dstFolderName) {
  return new Promise((resolve, reject) => {
    try {
      const dirSrcPath = import_path.default.join(utils.getAbsoluteInstanceDataDir(adapter), stationSerial, srcFolderName);
      const dirDstPath = import_path.default.join(utils.getAbsoluteInstanceDataDir(adapter), stationSerial, dstFolderName);
      if (!import_fs_extra.default.existsSync(dirDstPath)) {
        import_fs_extra.default.mkdirSync(dirDstPath, { mode: 509, recursive: true });
      }
      if (import_fs_extra.default.existsSync(dirSrcPath)) {
        const files = import_fs_extra.default.readdirSync(dirSrcPath).filter((fn) => fn.startsWith(device_sn));
        try {
          files.map((filename) => import_fs_extra.default.moveSync(import_path.default.join(dirSrcPath, filename), import_path.default.join(dirDstPath, filename)));
        } catch (error) {
        }
      }
      resolve();
    } catch (error) {
      reject(error);
    }
  });
};
const lowestUnusedNumber = function(sequence, startingFrom) {
  const arr = sequence.slice(0);
  arr.sort((a, b) => a - b);
  return arr.reduce((lowest, num, i) => {
    const seqIndex = i + startingFrom;
    return num !== seqIndex && seqIndex < lowest ? seqIndex : lowest;
  }, arr.length + startingFrom);
};
const sleep = async (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};
const getVideoClipLength = (device) => {
  let length = 60;
  const workingMode = device.getRawProperty(import_eufy_security_client.CommandType.CMD_SET_PIR_POWERMODE);
  if (workingMode !== void 0) {
    switch (workingMode) {
      case "0":
        if (device.isCamera2Product() || device.isIndoorCamera() || device.isSoloCameras())
          length = 20;
        else if (device.isBatteryDoorbell() || device.isBatteryDoorbell2())
          length = 30;
        break;
      case "1":
        break;
      case "2":
        const customValue = device.getRawProperty(import_eufy_security_client.CommandType.CMD_DEV_RECORD_TIMEOUT);
        if (customValue !== void 0) {
          try {
            length = Number.parseInt(customValue);
          } catch (error) {
          }
        }
        break;
      case "3":
        break;
    }
  }
  return length;
};
const removeLastChar = function(text, char) {
  const strArr = [...text];
  strArr.splice(text.lastIndexOf(char), 1);
  return strArr.join("");
};
const changeRole = async function(adapter, log, state, role) {
  try {
    const states = await adapter.getStatesAsync(`*.${state}`);
    if (states)
      Object.keys(states).forEach(async (id) => {
        await adapter.extendObjectAsync(id, {
          type: "state",
          common: {
            role
          }
        }, {}).catch();
      });
  } catch (error) {
    log.error(`state: ${state} role: ${role} - Error:`, error);
  }
};
const deleteStates = async function(adapter, property) {
  const states = await adapter.getStatesAsync(`*.${property}`);
  if (states)
    Object.keys(states).forEach(async (id) => {
      await adapter.delObjectAsync(id).catch();
    });
};
const handleUpdate = async function(adapter, log, old_version) {
  if (old_version <= 0.61) {
    try {
      const all = await adapter.getStatesAsync("T*");
      if (all) {
        Object.keys(all).forEach(async (id) => {
          await adapter.delObjectAsync(id, { recursive: false }).catch();
        });
      }
      const channels = await adapter.getChannelsOfAsync();
      if (channels) {
        Object.values(channels).forEach(async (channel) => {
          if (channel.common.name !== "info") {
            await adapter.delObjectAsync(channel._id, { recursive: false }).catch();
          }
        });
      }
      const devices = await adapter.getDevicesAsync();
      if (devices) {
        Object.values(devices).forEach(async (device) => {
          await adapter.delObjectAsync(device._id, { recursive: false }).catch();
        });
      }
    } catch (error) {
      log.error("Version 0.6.1: Error:", error);
    }
  }
  if (old_version <= 0.74) {
    try {
      await adapter.setObjectAsync("verify_code", {
        type: "state",
        common: {
          name: "2FA verification code",
          type: "string",
          role: "state",
          read: true,
          write: true
        },
        native: {}
      });
    } catch (error) {
      log.error("Version 0.7.4: Error:", error);
    }
  }
  if (old_version <= 1) {
    for (const state of ["last_event_pic_url", "last_event_pic_html", "last_event_video_url"]) {
      try {
        await deleteStates(adapter, state);
      } catch (error) {
        log.error(`Version 1.0.0 - ${state}: Error:`, error);
      }
    }
  }
};
const convertCamelCaseToSnakeCase = function(value) {
  return value.replace(/[A-Z]/g, (letter, index) => {
    return index == 0 ? letter.toLowerCase() : "_" + letter.toLowerCase();
  });
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  changeRole,
  convertCamelCaseToSnakeCase,
  deleteStates,
  getDataFilePath,
  getImageAsHTML,
  getVideoClipLength,
  handleUpdate,
  isEmpty,
  lowestUnusedNumber,
  moveFiles,
  removeFiles,
  removeLastChar,
  setStateAsync,
  setStateChangedAsync,
  sleep
});
//# sourceMappingURL=utils.js.map
