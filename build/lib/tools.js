"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.translateText = exports.isArray = exports.isObject = void 0;
const axios_1 = require("axios");
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
function translateText(text, targetLang, yandexApiKey) {
    return __awaiter(this, void 0, void 0, function* () {
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
    });
}
exports.translateText = translateText;
/**
 * Translates text with Yandex API
 * @param text The text to translate
 * @param targetLang The target languate
 * @param apiKey The yandex API key. You can create one for free at https://translate.yandex.com/developers
 */
function translateYandex(text, targetLang, apiKey) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        if (targetLang === "zh-cn") {
            targetLang = "zh";
        }
        try {
            const url = `https://translate.yandex.net/api/v1.5/tr.json/translate?key=${apiKey}&text=${encodeURIComponent(text)}&lang=en-${targetLang}`;
            const response = yield axios_1.default({ url, timeout: 15000 });
            if (isArray((_a = response.data) === null || _a === void 0 ? void 0 : _a.text)) {
                return response.data.text[0];
            }
            throw new Error("Invalid response for translate request");
        }
        catch (e) {
            throw new Error(`Could not translate to "${targetLang}": ${e}`);
        }
    });
}
/**
 * Translates text with Google API
 * @param text The text to translate
 * @param targetLang The target languate
 */
function translateGoogle(text, targetLang) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const url = `http://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}&ie=UTF-8&oe=UTF-8`;
            const response = yield axios_1.default({ url, timeout: 15000 });
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
    });
}
