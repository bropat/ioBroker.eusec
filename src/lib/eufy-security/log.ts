import { Logger } from "ts-log";

export class ioBrokerLogger implements Logger {

    private readonly log: ioBroker.Logger;

    public constructor(log: ioBroker.Logger) {
        this.log = log;
    }

    private _getMessage(message?: string, optionalParams?: any[]): string {
        const msg = message ? message : "";
        if (optionalParams && optionalParams.length > 0) {
            return `${msg} ${JSON.stringify(optionalParams)}`;
        }
        return msg;
    }

    public trace(message?: string, ...optionalParams: any[]): void {
        this.log.silly(this._getMessage(message, optionalParams));
    }

    public debug(message?: string, ...optionalParams: any[]): void {
        this.log.debug(this._getMessage(message, optionalParams));
    }

    public info(message?: string, ...optionalParams: any[]): void {
        this.log.info(this._getMessage(message, optionalParams));
    }

    public warn(message?: string, ...optionalParams: any[]): void {
        this.log.warn(this._getMessage(message, optionalParams));
    }

    public error(message?: string, ...optionalParams: any[]): void {
        this.log.error(this._getMessage(message, optionalParams));
    }

}