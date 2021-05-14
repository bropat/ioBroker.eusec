"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ioBrokerLogger = void 0;
class ioBrokerLogger {
    constructor(log) {
        this.log = log;
    }
    _getStack() {
        var _a;
        const _prepareStackTrace = Error.prepareStackTrace;
        Error.prepareStackTrace = (_, stack) => stack;
        const stack = (_a = new Error().stack) === null || _a === void 0 ? void 0 : _a.slice(3);
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
            }
            else {
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
exports.ioBrokerLogger = ioBrokerLogger;
//# sourceMappingURL=log.js.map