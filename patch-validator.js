import fs from "fs/promises";
import path from "path";
import { applyMetaPatch } from "./src/lib/patches/metaPatcher.ts";
import { applyDiscordBasicPatch } from "./src/lib/patches/discordPatcher.ts";
import { applyTiktokPatch } from "./src/lib/patches/tiktokPatcher.ts";
import { applyLinkedinPatch } from "./src/lib/patches/linkedinPatcher.ts";
import { applyTelegramPatch } from "./src/lib/patches/telegramPatcher.ts";
import { scanWebglBuildZip } from "./src/lib/scanners/scanWebglBuildZip.ts";
async function readAssets() {
    const read = async (p) => await fs.readFile(path.join(process.cwd(), p), "utf-8");
    return {
        fbInit: await read("src/lib/scripts/fb-init-v8.js"),
        metaJslib: await read("src/assets/Plugins/WebGL/MetaMonetization.jslib"),
        discordHud: await read("src/lib/scripts/discord-hud.js"),
        discordInit: await read("src/lib/scripts/discord-init-2026.js"),
        tiktokBridge: await read("src/lib/scripts/tiktok-bridge.js"),
        linkedinBridge: await read("src/lib/scripts/linkedin-bridge.js"),
        telegramBridge: await read("src/lib/scripts/telegram-init.js")
    };
}
async function runPatchValidator() {
    const zipName = "boomers-global-quest_netlify_repo-ready.zip";
    const zipPath = path.join(process.cwd(), zipName);
    console.log(`\n======================================================`);
    console.log(`🧪 AUTO-VALIDATION SUITE: ${zipName}`);
    console.log(`======================================================\n`);
    const assets = await readAssets();
    const platforms = ["META", "DISCORD", "TIKTOK", "LINKEDIN_GAMES", "TELEGRAM"];
    for (const platform of platforms) {
        console.log(`--- [ ${platform} ] ---`);
        // 1. Scan the RAW ZIP
        const rawZipBuffer = await fs.readFile(zipPath);
        const initialScan = await scanWebglBuildZip(rawZipBuffer, platform);
        let initialScore = initialScan?.[platform.toLowerCase().replace('_games', '')]?.score ?? "ERR";
        console.log(`Initial Score (Raw ZIP): \x1b[31m${initialScore}\x1b[0m`);
        // 2. Patch the ZIP
        let patchedBuffer = rawZipBuffer;
        try {
            if (platform === "META") {
                const res = await applyMetaPatch(rawZipBuffer, assets.fbInit, assets.metaJslib);
                patchedBuffer = res.patchedZip;
            }
            else if (platform === "DISCORD") {
                const res = await applyDiscordBasicPatch(rawZipBuffer, assets.discordHud);
                patchedBuffer = res.patchedZip;
            }
            else if (platform === "TIKTOK") {
                const res = await applyTiktokPatch(rawZipBuffer, assets.tiktokBridge);
                patchedBuffer = res.patchedZip;
            }
            else if (platform === "LINKEDIN_GAMES") {
                const res = await applyLinkedinPatch(rawZipBuffer, assets.linkedinBridge);
                patchedBuffer = res.patchedZip;
            }
            else if (platform === "TELEGRAM") {
                const res = await applyTelegramPatch(rawZipBuffer, assets.telegramBridge);
                patchedBuffer = res.patchedZip;
            }
            // Save the patched zip for the user to use in LIVE testing
            const outName = `PATCHED_${platform}_${zipName}`;
            await fs.writeFile(path.join(process.cwd(), outName), patchedBuffer);
            console.log(`Saved Patched Archive: ${outName}`);
            // 3. Scan the PATCHED ZIP
            const finalScan = await scanWebglBuildZip(patchedBuffer, platform);
            let finalScore = finalScan?.[platform.toLowerCase().replace('_games', '')]?.score ?? "ERR";
            const color = finalScore === 100 ? "\x1b[32m" : "\x1b[31m";
            console.log(`Final Patched Score:  ${color}${finalScore}\x1b[0m\n`);
        }
        catch (e) {
            console.error(`Patch/Scan Error for ${platform}:`, e.message);
        }
    }
}
runPatchValidator().catch(console.error);
