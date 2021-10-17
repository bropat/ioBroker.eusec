"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.translateText = exports.isArray = exports.isObject = void 0;
const axios_1 = __importDefault(require("axios"));
/**
 * Tests whether the given variable is a real object and not an Array
 * @param it The variable to test
 */
function isObject(it) {
    // This is necessary because:
    // typeof null === 'object'
    // typeof [] === 'object'
    // [] instanceof Object === true
    return Object.prototype.toString.call(it) === "[object Object]";
}
exports.isObject = isObject;
/**
 * Tests whether the given variable is really an Array
 * @param it The variable to test
 */
function isArray(it) {
    if (Array.isArray != null)
        return Array.isArray(it);
    return Object.prototype.toString.call(it) === "[object Array]";
}
exports.isArray = isArray;
/**
 * Translates text using the Google Translate API
 * @param text The text to translate
 * @param targetLang The target languate
 * @param yandexApiKey The yandex API key. You can create one for free at https://translate.yandex.com/developers
 */
async function translateText(text, targetLang, yandexApiKey) {
    if (targetLang === "en") {
        return text;
    }
    else if (!text) {
        return "";
    }
    if (yandexApiKey) {
        return translateYandex(text, targetLang, yandexApiKey);
    }
    else {
        return translateGoogle(text, targetLang);
    }
}
exports.translateText = translateText;
/**
 * Translates text with Yandex API
 * @param text The text to translate
 * @param targetLang The target languate
 * @param apiKey The yandex API key. You can create one for free at https://translate.yandex.com/developers
 */
async function translateYandex(text, targetLang, apiKey) {
    var _a;
    if (targetLang === "zh-cn") {
        targetLang = "zh";
    }
    try {
        const url = `https://translate.yandex.net/api/v1.5/tr.json/translate?key=${apiKey}&text=${encodeURIComponent(text)}&lang=en-${targetLang}`;
        const response = await (0, axios_1.default)({ url, timeout: 15000 });
        if (isArray((_a = response.data) === null || _a === void 0 ? void 0 : _a.text)) {
            return response.data.text[0];
        }
        throw new Error("Invalid response for translate request");
    }
    catch (e) {
        throw new Error(`Could not translate to "${targetLang}": ${e}`);
    }
}
/**
 * Translates text with Google API
 * @param text The text to translate
 * @param targetLang The target languate
 */
async function translateGoogle(text, targetLang) {
    var _a;
    try {
        const url = `http://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}&ie=UTF-8&oe=UTF-8`;
        const response = await (0, axios_1.default)({ url, timeout: 15000 });
        if (isArray(response.data)) {
            // we got a valid response
            return response.data[0][0][0];
        }
        throw new Error("Invalid response for translate request");
    }
    catch (e) {
        if (((_a = e.response) === null || _a === void 0 ? void 0 : _a.status) === 429) {
            throw new Error(`Could not translate to "${targetLang}": Rate-limited by Google Translate`);
        }
        else {
            throw new Error(`Could not translate to "${targetLang}": ${e}`);
        }
    }
}
//# sourceMappingURL=tools.js.map