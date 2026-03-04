import fs from "fs/promises";
import path from "path";
import { scanWebglBuildZip } from "./src/lib/scanners/scanWebglBuildZip";

async function runMegaTest() {
    const zipFiles = [
        "Dragon_Crashers_WebGL.zip",
        "Karting_MicrogameWebGL.zip",
        "WebGL_Build.zip",
        "boomers-global-quest_netlify_repo-ready.zip"
    ];

    // Notice we now include TELEGRAM at the end!
    const platforms: ("META" | "DISCORD" | "YOUTUBE_PLAYABLES" | "TIKTOK" | "LINKEDIN_GAMES" | "TELEGRAM")[] = [
        "META",
        "DISCORD",
        "YOUTUBE_PLAYABLES",
        "TIKTOK",
        "LINKEDIN_GAMES",
        "TELEGRAM"
    ];

    const allResults: Record<string, Record<string, any>> = {};

    for (const zipName of zipFiles) {
        console.log(`\n\n==========================================`);
        console.log(`TESTING ZIP: ${zipName}`);
        console.log(`==========================================`);

        allResults[zipName] = {};

        try {
            const zipPath = path.join(process.cwd(), zipName);
            const zipBuffer = await fs.readFile(zipPath);

            for (const platform of platforms) {
                console.log(`[ RUNNING SCANNER FOR: ${platform} ]`);
                try {
                    const report = await scanWebglBuildZip(zipBuffer, platform);
                    allResults[zipName][platform] = report;
                } catch (e: any) {
                    allResults[zipName][platform] = { error: e.toString() };
                    console.error(`  -> Error scanning ${platform}:`, e.message);
                }
            }
        } catch (e: any) {
            console.error(`Failed to read ZIP ${zipName}:`, e.message);
            allResults[zipName] = { file_error: e.toString() };
        }
    }

    const outPath = path.join(process.cwd(), "mega-test-out.json");
    await fs.writeFile(outPath, JSON.stringify(allResults, null, 2));
    console.log(`\n\n[SUCCESS] Wrote full multi-platform Telegram-integrated results to ${outPath}\n`);
}

runMegaTest().catch(console.error);
