"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var log_exports = {};
__export(log_exports, {
  ioBrokerLogger: () => ioBrokerLogger
});
module.exports = __toCommonJS(log_exports);
class ioBrokerLogger {
  log;
  constructor(log) {
    this.log = log;
  }
  _getStack() {
    var _a;
    const _prepareStackTrace = Error.prepareStackTrace;
    Error.prepareStackTrace = (_, stack2) => stack2;
    const stack = (_a = new Error().stack) == null ? void 0 : _a.slice(3);
    Error.prepareStackTrace = _prepareStackTrace;
    return stack;
  }
  _getMessage(message, hideTag = false, optionalParams) {
    const msg = message ? message : "";
    const stack = this._getStack();
    const typeName = stack[0].getTypeName() !== null ? stack[0].getTypeName() : "";
    const functionName = stack[0].getFunctionName() !== null ? `${stack[0].getFunctionName()}` : "";
    let tag = "";
    if (typeName !== "" && !hideTag) {
      tag = `[${typeName}`;
      if (functionName !== "") {
        tag = `${tag}.${functionName}] `;
      } else {
        tag = `${tag}] `;
      }
    }
    if (optionalParams && optionalParams.length > 0) {
      return `${tag}${msg} ${JSON.stringify(optionalParams)}`;
    }
    return `${tag}${msg}`;
  }
  trace(message, ...optionalParams) {
    this.log.silly(this._getMessage(message, false, optionalParams));
  }
  debug(message, ...optionalParams) {
    this.log.debug(this._getMessage(message, false, optionalParams));
  }
  info(message, ...optionalParams) {
    this.log.info(this._getMessage(message, true, optionalParams));
  }
  warn(message, ...optionalParams) {
    this.log.warn(this._getMessage(message, true, optionalParams));
  }
  error(message, ...optionalParams) {
    this.log.error(this._getMessage(message, true, optionalParams));
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ioBrokerLogger
});
//# sourceMappingURL=log.js.map
