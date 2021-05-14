import { Logger } from "ts-log";

export class ioBrokerLogger implements Logger {

    private readonly log: ioBroker.Logger;

    public constructor(log: ioBroker.Logger) {
        this.log = log;
    }

    private _getStack(): any {
        const _prepareStackTrace = Error.prepareStackTrace;
        Error.prepareStackTrace = (_, stack) => stack;
        const stack = new Error().stack?.slice(3);
        Error.prepareStackTrace = _prepareStackTrace;
        return stack;
    }

    private _getMessage(message?: string, hideTag = false, optionalParams?: any[]): string {
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

    public trace(message?: string, ...optionalParams: any[]): void {
        this.log.silly(this._getMessage(message, false, optionalParams));
    }

    public debug(message?: string, ...optionalParams: any[]): void {
        this.log.debug(this._getMessage(message, false, optionalParams));
    }

    public info(message?: string, ...optionalParams: any[]): void {
        this.log.info(this._getMessage(message, true, optionalParams));
    }

    public warn(message?: string, ...optionalParams: any[]): void {
        this.log.warn(this._getMessage(message, true, optionalParams));
    }

    public error(message?: string, ...optionalParams: any[]): void {
        this.log.error(this._getMessage(message, true, optionalParams));
    }

}