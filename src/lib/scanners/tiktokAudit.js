import fs from "fs/promises";
import path from "path";
export async function auditTiktokCompliance(tmpRoot, buildDir, projectRoot) {
    const result = {
        platform: "TIKTOK",
        auditDate: new Date().toISOString(),
        score: 100,
        criticalFailures: [],
        checks: {
            touch_action_locked: false,
        },
    };
    try {
        let hasTouchConfig = false;
        // Scan index.html and CSS files for touch-action: none
        const scanForTouchLogic = async (dirPath) => {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    // only go into TemplateData or immediate subdirs to save time
                    if (entry.name === "TemplateData" || dirPath === projectRoot) {
                        await scanForTouchLogic(fullPath);
                    }
                }
                else {
                    if (entry.name.endsWith(".html") || entry.name.endsWith(".css") || entry.name.endsWith(".js")) {
                        const text = await fs.readFile(fullPath, "utf-8");
                        if (text.includes("touch-action: none") || text.includes("touch-action:none") || text.includes('touchAction = "none"')) {
                            hasTouchConfig = true;
                        }
                    }
                }
            }
        };
        await scanForTouchLogic(projectRoot);
        if (hasTouchConfig) {
            result.checks.touch_action_locked = true;
        }
        else {
            result.checks.touch_action_locked = false;
            result.criticalFailures.push({
                id: "TT_TOUCH_LAG",
                description: "No 'touch-action: none' CSS rule detected on the Canvas. Swiping will cause the game to exit / lag.",
                sunsetRisk: "HIGH (UX Rejection)",
            });
            result.score -= 50;
        }
        if (result.score < 0)
            result.score = 0;
    }
    catch (error) {
        console.error("TikTok compliance audit error:", error);
    }
    return result;
}
