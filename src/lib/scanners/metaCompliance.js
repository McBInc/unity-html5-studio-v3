import fs from "fs/promises";
import path from "path";
export async function auditMetaCompliance(tmpRoot, buildDir, projectRoot) {
    const result = {
        platform: "FACEBOOK",
        auditDate: new Date().toISOString(),
        score: 100,
        criticalFailures: [],
        monetizationReadiness: {
            cmpEligible: false,
            missingBridge: "MetaMonetization.jslib",
        },
        checks: {
            sdk_v8: false,
            zero_perm: false,
        },
    };
    try {
        // 1. Check index.html for fbinstant SDK
        const indexHtmlPath = path.join(projectRoot, "index.html");
        try {
            const indexContent = await fs.readFile(indexHtmlPath, "utf-8");
            if (indexContent.includes("fbinstant.8.0.js")) {
                result.checks.sdk_v8 = true;
            }
            else {
                result.criticalFailures.push({
                    id: "SDK_VERSION",
                    description: "Detected outdated SDK. Meta mandate requires v8.0.",
                    sunsetRisk: "TERMINAL (Immediate Rejection)",
                });
                result.score -= 40;
            }
            if (indexContent.includes(".api(\"/me\")") || indexContent.includes("user_friends")) {
                result.criticalFailures.push({
                    id: "PII_LEAK",
                    description: "Legacy Facebook PII calls (names/friends) detected in index.html.",
                    sunsetRisk: "HIGH (September 30 Sunset)",
                });
                result.score -= 40;
            }
        }
        catch (e) {
            // index.html not found
        }
        // 2. Check JS files in Build/ for PII leaks
        try {
            const buildEntries = await fs.readdir(buildDir);
            for (const name of buildEntries) {
                if (name.endsWith(".js") || name.endsWith(".wasm") || name.endsWith(".data")) {
                    const content = await fs.readFile(path.join(buildDir, name), "utf-8");
                    if (content.includes(".api(\"/me\")") || content.includes("user_friends")) {
                        const hasLeak = result.criticalFailures.some(f => f.id === "PII_LEAK");
                        if (!hasLeak) {
                            result.criticalFailures.push({
                                id: "PII_LEAK",
                                description: `Legacy Facebook PII calls (names/friends) detected in binaries (${name}).`,
                                sunsetRisk: "HIGH (September 30 Sunset)",
                            });
                            result.score -= 40;
                        }
                    }
                }
            }
        }
        catch (e) {
            // Ignore
        }
        // 3. Check fbapp-config.json
        const configPath = path.join(projectRoot, "fbapp-config.json");
        try {
            const configObj = JSON.parse(await fs.readFile(configPath, "utf-8"));
            if (configObj.connection_experience === "network_enabled_zero_permissions" || configObj.connection_experience === "zero_permissions") {
                result.checks.zero_perm = true;
            }
            else {
                result.criticalFailures.push({
                    id: "CONNECTION_MODE",
                    description: "fbapp-config.json does not use zero_permissions.",
                    sunsetRisk: "HIGH (September 30 Sunset)",
                });
                result.score -= 20;
            }
        }
        catch (e) {
            // config missing
            result.criticalFailures.push({
                id: "CONNECTION_MODE",
                description: "fbapp-config.json missing, cannot verify zero_permissions.",
                sunsetRisk: "HIGH (September 30 Sunset)",
            });
            result.score -= 20;
        }
        // Ensure score doesn't go below 0
        if (result.score < 0)
            result.score = 0;
    }
    catch (error) {
        console.error("Meta compliance audit error:", error);
    }
    return result;
}
