"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ioBrokerLogger = void 0;
class ioBrokerLogger {
    constructor(log) {
        this.log = log;
    }
    _getMessage(message, optionalParams) {
        const msg = message ? message : "";
        if (optionalParams && optionalParams.length > 0) {
            return `${msg} ${JSON.stringify(optionalParams)}`;
        }
        return msg;
    }
    trace(message, ...optionalParams) {
        this.log.silly(this._getMessage(message, optionalParams));
    }
    debug(message, ...optionalParams) {
        this.log.debug(this._getMessage(message, optionalParams));
    }
    info(message, ...optionalParams) {
        this.log.info(this._getMessage(message, optionalParams));
    }
    warn(message, ...optionalParams) {
        this.log.warn(this._getMessage(message, optionalParams));
    }
    error(message, ...optionalParams) {
        this.log.error(this._getMessage(message, optionalParams));
    }
}
exports.ioBrokerLogger = ioBrokerLogger;
