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
var tools_exports = {};
__export(tools_exports, {
  isArray: () => isArray,
  isObject: () => isObject,
  translateText: () => translateText
});
module.exports = __toCommonJS(tools_exports);
var import_got = __toESM(require("got"));
function isObject(it) {
  return Object.prototype.toString.call(it) === "[object Object]";
}
function isArray(it) {
  if (Array.isArray != null)
    return Array.isArray(it);
  return Object.prototype.toString.call(it) === "[object Array]";
}
async function translateText(text, targetLang, yandexApiKey) {
  if (targetLang === "en") {
    return text;
  } else if (!text) {
    return "";
  }
  if (yandexApiKey) {
    return translateYandex(text, targetLang, yandexApiKey);
  } else {
    return translateGoogle(text, targetLang);
  }
}
async function translateYandex(text, targetLang, apiKey) {
  var _a;
  if (targetLang === "zh-cn") {
    targetLang = "zh";
  }
  try {
    const url = `https://translate.yandex.net/api/v1.5/tr.json/translate?key=${apiKey}&text=${encodeURIComponent(text)}&lang=en-${targetLang}`;
    const response = await (0, import_got.default)({ url, timeout: 15e3 });
    if (isArray((_a = response.body) == null ? void 0 : _a.text)) {
      return response.body.text[0];
    }
    throw new Error("Invalid response for translate request");
  } catch (e) {
    throw new Error(`Could not translate to "${targetLang}": ${e}`);
  }
}
async function translateGoogle(text, targetLang) {
  var _a;
  try {
    const url = `http://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}&ie=UTF-8&oe=UTF-8`;
    const response = await (0, import_got.default)({ url, timeout: 15e3 });
    if (isArray(response.body)) {
      return response.body[0][0][0];
    }
    throw new Error("Invalid response for translate request");
  } catch (e) {
    if (((_a = e.response) == null ? void 0 : _a.status) === 429) {
      throw new Error(
        `Could not translate to "${targetLang}": Rate-limited by Google Translate`
      );
    } else {
      throw new Error(`Could not translate to "${targetLang}": ${e}`);
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  isArray,
  isObject,
  translateText
});
//# sourceMappingURL=tools.js.map
