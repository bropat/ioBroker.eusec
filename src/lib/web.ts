import express from "express";
import path from "path";
import fs from "fs";
import * as utils from "@iobroker/adapter-core";

/**
 * ProxyEufySecurity class
 *
 * Reads files from localhost server
 *
 * @class
 * @param {object} server http or https node.js object
 * @param {object} webSettings settings of the web server, like <pre><code>{secure: settings.secure, port: settings.port}</code></pre>
 * @param {object} adapter web adapter object
 * @param {object} instanceSettings instance object with common and native
 * @param {object} app express application
 * @return {object} object instance
 */
class ProxyEufySecurity {

    private app: express.Application;
    private config: any;
    private namespace: any;

    constructor(server: any, webSettings: any, adapter: ioBroker.Adapter, instanceSettings: any, app: express.Application) {
        this.app         = app;
        this.config      = instanceSettings ? instanceSettings.native : {};
        this.namespace   = instanceSettings ? instanceSettings._id.substring("system.adapter.".length) : "eufy-security";
        this.config.route = this.config.route || (this.namespace + "/");
        this.config.port = parseInt(this.config.port, 10) || 80;

        // remove leading slash
        if (this.config.route[0] === "/") {
            this.config.route = this.config.route.substr(1);
        }

        const root_path = path.join(utils.getAbsoluteDefaultDataDir(), this.namespace);
        import("mime").then(({ default: mime }) => {
            this.app.use("/" + this.config.route, (req: express.Request, res: express.Response) => {
                const fileName = path.join(root_path, req.url.substring(1));
                const normalized_filename = path.resolve(fileName);

                if (normalized_filename.startsWith(root_path)) {

                    res.setHeader("Access-Control-Allow-Origin", "*");
                    res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

                    if (fs.existsSync(normalized_filename)) {
                        const stat = fs.statSync(normalized_filename);
                        if (!stat.isDirectory()) {
                            let data;
                            try {
                                data = fs.readFileSync(normalized_filename);
                            } catch (e) {
                                res.status(500).send(`[eufy-security] Cannot read file: ${e}`);
                                return;
                            }
                            res.contentType(mime.getType(path.extname(normalized_filename).substring(1)) || "html");
                            res.status(200).send(data);
                        }
                    } else {
                        res.status(404).send('[eufy-security] File "' + normalized_filename +'" not found.');
                    }
                } else {
                    res.status(403).send('[eufy-security] Access to file "' + normalized_filename +'" denied.');
                }
            });
        });
    }
}

module.exports = ProxyEufySecurity;