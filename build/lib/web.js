"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
var import_path = __toESM(require("path"));
var import_fs = __toESM(require("fs"));
var utils = __toESM(require("@iobroker/adapter-core"));
class ProxyEufySecurity {
  app;
  config;
  namespace;
  constructor(server, webSettings, adapter, instanceSettings, app) {
    this.app = app;
    this.config = instanceSettings ? instanceSettings.native : {};
    this.namespace = instanceSettings ? instanceSettings._id.substring("system.adapter.".length) : "eufy-security";
    this.config.route = this.config.route || this.namespace + "/";
    this.config.port = parseInt(this.config.port, 10) || 80;
    if (this.config.route[0] === "/") {
      this.config.route = this.config.route.substr(1);
    }
    const root_path = import_path.default.join(utils.getAbsoluteDefaultDataDir(), this.namespace);
    import("mime").then(({ default: mime }) => {
      this.app.use("/" + this.config.route, (req, res) => {
        const fileName = import_path.default.join(root_path, req.url.substring(1));
        const normalized_filename = import_path.default.resolve(fileName);
        if (normalized_filename.startsWith(root_path)) {
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
          if (import_fs.default.existsSync(normalized_filename)) {
            const stat = import_fs.default.statSync(normalized_filename);
            if (!stat.isDirectory()) {
              let data;
              try {
                data = import_fs.default.readFileSync(normalized_filename);
              } catch (e) {
                res.status(500).send(`[eufy-security] Cannot read file: ${e}`);
                return;
              }
              res.contentType(mime.getType(import_path.default.extname(normalized_filename).substring(1)) || "html");
              res.status(200).send(data);
            }
          } else {
            res.status(404).send('[eufy-security] File "' + normalized_filename + '" not found.');
          }
        } else {
          res.status(403).send('[eufy-security] Access to file "' + normalized_filename + '" denied.');
        }
      });
    });
  }
}
module.exports = ProxyEufySecurity;
//# sourceMappingURL=web.js.map
