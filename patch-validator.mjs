var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import fs from "fs/promises";
import path from "path";
import { applyMetaPatch } from "./src/lib/patches/metaPatcher.ts";
import { applyDiscordBasicPatch } from "./src/lib/patches/discordPatcher.ts";
import { applyTiktokPatch } from "./src/lib/patches/tiktokPatcher.ts";
import { applyLinkedinPatch } from "./src/lib/patches/linkedinPatcher.ts";
import { applyTelegramPatch } from "./src/lib/patches/telegramPatcher.ts";
import { scanWebglBuildZip } from "./src/lib/scanners/scanWebglBuildZip.ts";
function readAssets() {
    return __awaiter(this, void 0, void 0, function () {
        var read;
        var _a;
        var _this = this;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    read = function (p) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, fs.readFile(path.join(process.cwd(), p), "utf-8")];
                            case 1: return [2 /*return*/, _a.sent()];
                        }
                    }); }); };
                    _a = {};
                    return [4 /*yield*/, read("src/lib/scripts/fb-init-v8.js")];
                case 1:
                    _a.fbInit = _b.sent();
                    return [4 /*yield*/, read("src/assets/Plugins/WebGL/MetaMonetization.jslib")];
                case 2:
                    _a.metaJslib = _b.sent();
                    return [4 /*yield*/, read("src/lib/scripts/discord-hud.js")];
                case 3:
                    _a.discordHud = _b.sent();
                    return [4 /*yield*/, read("src/lib/scripts/discord-init-2026.js")];
                case 4:
                    _a.discordInit = _b.sent();
                    return [4 /*yield*/, read("src/lib/scripts/tiktok-bridge.js")];
                case 5:
                    _a.tiktokBridge = _b.sent();
                    return [4 /*yield*/, read("src/lib/scripts/linkedin-bridge.js")];
                case 6:
                    _a.linkedinBridge = _b.sent();
                    return [4 /*yield*/, read("src/lib/scripts/telegram-init.js")];
                case 7: return [2 /*return*/, (_a.telegramBridge = _b.sent(),
                        _a)];
            }
        });
    });
}
function runPatchValidator() {
    return __awaiter(this, void 0, void 0, function () {
        var zipName, zipPath, assets, platforms, _i, platforms_1, platform, rawZipBuffer, initialScan, initialScore, patchedBuffer, res, res, res, res, res, outName, finalScan, finalScore, color, e_1;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    zipName = "boomers-global-quest_netlify_repo-ready.zip";
                    zipPath = path.join(process.cwd(), zipName);
                    console.log("\n======================================================");
                    console.log("\uD83E\uDDEA AUTO-VALIDATION SUITE: ".concat(zipName));
                    console.log("======================================================\n");
                    return [4 /*yield*/, readAssets()];
                case 1:
                    assets = _e.sent();
                    platforms = ["META", "DISCORD", "TIKTOK", "LINKEDIN_GAMES", "TELEGRAM"];
                    _i = 0, platforms_1 = platforms;
                    _e.label = 2;
                case 2:
                    if (!(_i < platforms_1.length)) return [3 /*break*/, 20];
                    platform = platforms_1[_i];
                    console.log("--- [ ".concat(platform, " ] ---"));
                    return [4 /*yield*/, fs.readFile(zipPath)];
                case 3:
                    rawZipBuffer = _e.sent();
                    return [4 /*yield*/, scanWebglBuildZip(rawZipBuffer, platform)];
                case 4:
                    initialScan = _e.sent();
                    initialScore = (_b = (_a = initialScan === null || initialScan === void 0 ? void 0 : initialScan[platform.toLowerCase().replace('_games', '')]) === null || _a === void 0 ? void 0 : _a.score) !== null && _b !== void 0 ? _b : "ERR";
                    console.log("Initial Score (Raw ZIP): \u001B[31m".concat(initialScore, "\u001B[0m"));
                    patchedBuffer = rawZipBuffer;
                    _e.label = 5;
                case 5:
                    _e.trys.push([5, 18, , 19]);
                    if (!(platform === "META")) return [3 /*break*/, 7];
                    return [4 /*yield*/, applyMetaPatch(rawZipBuffer, assets.fbInit, assets.metaJslib)];
                case 6:
                    res = _e.sent();
                    patchedBuffer = res.patchedZip;
                    return [3 /*break*/, 15];
                case 7:
                    if (!(platform === "DISCORD")) return [3 /*break*/, 9];
                    return [4 /*yield*/, applyDiscordBasicPatch(rawZipBuffer, assets.discordHud)];
                case 8:
                    res = _e.sent();
                    patchedBuffer = res.patchedZip;
                    return [3 /*break*/, 15];
                case 9:
                    if (!(platform === "TIKTOK")) return [3 /*break*/, 11];
                    return [4 /*yield*/, applyTiktokPatch(rawZipBuffer, assets.tiktokBridge)];
                case 10:
                    res = _e.sent();
                    patchedBuffer = res.patchedZip;
                    return [3 /*break*/, 15];
                case 11:
                    if (!(platform === "LINKEDIN_GAMES")) return [3 /*break*/, 13];
                    return [4 /*yield*/, applyLinkedinPatch(rawZipBuffer, assets.linkedinBridge)];
                case 12:
                    res = _e.sent();
                    patchedBuffer = res.patchedZip;
                    return [3 /*break*/, 15];
                case 13:
                    if (!(platform === "TELEGRAM")) return [3 /*break*/, 15];
                    return [4 /*yield*/, applyTelegramPatch(rawZipBuffer, assets.telegramBridge)];
                case 14:
                    res = _e.sent();
                    patchedBuffer = res.patchedZip;
                    _e.label = 15;
                case 15:
                    outName = "PATCHED_".concat(platform, "_").concat(zipName);
                    return [4 /*yield*/, fs.writeFile(path.join(process.cwd(), outName), patchedBuffer)];
                case 16:
                    _e.sent();
                    console.log("Saved Patched Archive: ".concat(outName));
                    return [4 /*yield*/, scanWebglBuildZip(patchedBuffer, platform)];
                case 17:
                    finalScan = _e.sent();
                    finalScore = (_d = (_c = finalScan === null || finalScan === void 0 ? void 0 : finalScan[platform.toLowerCase().replace('_games', '')]) === null || _c === void 0 ? void 0 : _c.score) !== null && _d !== void 0 ? _d : "ERR";
                    color = finalScore === 100 ? "\x1b[32m" : "\x1b[31m";
                    console.log("Final Patched Score:  ".concat(color).concat(finalScore, "\u001B[0m\n"));
                    return [3 /*break*/, 19];
                case 18:
                    e_1 = _e.sent();
                    console.error("Patch/Scan Error for ".concat(platform, ":"), e_1.message);
                    return [3 /*break*/, 19];
                case 19:
                    _i++;
                    return [3 /*break*/, 2];
                case 20: return [2 /*return*/];
            }
        });
    });
}
runPatchValidator().catch(console.error);
