"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParameterHelper = void 0;
const types_1 = require("./types");
class ParameterHelper {
    static readValue(type, value) {
        if (value) {
            if (type == types_1.ParamType.SNOOZE_MODE || type == types_1.ParamType.CAMERA_MOTION_ZONES) {
                try {
                    return JSON.parse(Buffer.from(value).toString("ascii"));
                }
                catch (error) {
                }
                return "";
            }
        }
        return value;
    }
    static writeValue(type, value) {
        if (value) {
            const result = JSON.stringify(value);
            if (type == types_1.ParamType.SNOOZE_MODE) {
                return Buffer.from(result).toString("base64");
            }
            return result;
        }
        return "";
    }
}
exports.ParameterHelper = ParameterHelper;
