import fs from 'fs';
import path from 'path';

async function verifyAPI() {
    const zipName = "boomers-global-quest_netlify_repo-ready.zip";
    const zipPath = path.join(process.cwd(), zipName);
    const platforms = ["META", "DISCORD", "TIKTOK", "LINKEDIN_GAMES", "TELEGRAM"];

    console.log(`\n======================================================`);
    console.log(`🧪 AUTO-VALIDATION SUITE: ${zipName}`);
    console.log(`======================================================\n`);

    const rawBuffer = fs.readFileSync(zipPath);
    let allPass = true;

    for (const platform of platforms) {
        console.log(`--- [ ${platform} ] ---`);

        // Form Data exactly like the UI
        const formData = new FormData();
        formData.append("platformTarget", platform);
        formData.append("tier", "STANDARD");
        formData.append("uploadMode", "RAW");
        formData.append("file", new Blob([rawBuffer]), zipName);

        console.log("  -> POST /api/patch (Simulating Certification click...)");
        try {
            // Next.js Dev Server must be running on :3000
            const res = await fetch("http://localhost:3000/api/patch", {
                method: "POST",
                body: formData
            });

            if (!res.ok) {
                const errorText = await res.text();
                console.log(`  -> \x1b[31mPatch Failed: HTTP ${res.status}\x1b[0m\n     ${errorText}`);
                allPass = false;
                continue;
            }

            const patchedArrayBuffer = await res.arrayBuffer();
            const patchedBuffer = Buffer.from(patchedArrayBuffer);

            const outName = `PATCHED_${platform}_${zipName}`;
            fs.writeFileSync(path.join(process.cwd(), outName), patchedBuffer);
            console.log(`  -> Saved: \x1b[32m${outName}\x1b[0m`);

            // To verify 100/100, we simply form-post the patched zip back into /api/upload
            const scanData = new FormData();
            scanData.append("buildZip", new Blob([patchedBuffer]), outName);

            console.log("  -> POST /api/upload (Simulating Scanner Audit...)");
            const scanRes = await fetch("http://localhost:3000/api/upload", {
                method: "POST",
                body: scanData
            });

            const scanResult = await scanRes.json();

            let finalScore = "ERR";
            if (scanResult && scanResult.scanResult) {
                const map = platform.toLowerCase().replace('_games', '');
                finalScore = scanResult.scanResult[map]?.score ?? "ERR";
            }

            const color = finalScore === 100 ? "\x1b[32m" : "\x1b[31m";
            console.log(`  -> Final Patched Score:  ${color}${finalScore}\x1b[0m\n`);

            if (finalScore !== 100) allPass = false;

        } catch (e) {
            console.error(`  -> \x1b[31mError during network request:\x1b[0m`, e.message);
            allPass = false;
        }
    }

    if (allPass) console.log("\n\x1b[32m✅ ALL PLATFORM PATCHES VERIFIED 100/100\x1b[0m");
    else console.log("\n\x1b[31m❌ SOME PATCHES FAILED VERIFICATION\x1b[0m");
}

verifyAPI().catch(console.error);
