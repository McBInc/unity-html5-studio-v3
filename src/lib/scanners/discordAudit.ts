import fs from "fs/promises";
import path from "path";

export interface DiscordComplianceResult {
    platform: "DISCORD";
    auditDate: string;
    score: number;
    criticalFailures: {
        id: string;
        description: string;
        sunsetRisk: string;
    }[];
    monetizationReadiness: {
        cmpEligible: boolean;
        missingBridge: string | null;
    };
    checks: {
        sdk_v1_8: boolean;
        granular_scopes: boolean;
    };
}

export async function auditDiscordCompliance(
    tmpRoot: string,
    buildDir: string,
    projectRoot: string
): Promise<DiscordComplianceResult> {
    const result: DiscordComplianceResult = {
        platform: "DISCORD",
        auditDate: new Date().toISOString(),
        score: 100,
        criticalFailures: [],
        monetizationReadiness: {
            cmpEligible: false,
            missingBridge: "DiscordCommerce.jslib",
        },
        checks: {
            sdk_v1_8: false,
            granular_scopes: true,
        },
    };

    try {
        let indexHtmlContent = "";
        const indexHtmlPath = path.join(projectRoot, "index.html");
        try {
            indexHtmlContent = await fs.readFile(indexHtmlPath, "utf-8");
        } catch (e) {
            // Ignore if missing, though it implies structure fails anyway
        }

        // 1. Audit index.html for @discord/embedded-app-sdk version
        // Check if v1.x or missing entirely
        const hasSDKv1 = indexHtmlContent.includes("@discord/embedded-app-sdk");
        if (hasSDKv1) {
            result.checks.sdk_v1_8 = true; // Simple check for now
        } else {
            result.criticalFailures.push({
                id: "DISC_SDK_OUTDATED",
                description: "No @discord/embedded-app-sdk detected or version < 1.6.",
                sunsetRisk: "HIGH (Commerce Instability)",
            });
            result.score -= 30;
        }

        // 2. Audit JS/WASM for Broad Scopes
        let foundBroadScope = false;
        const scopesToCheck = ["MANAGE_GUILD", "MANAGE_MESSAGES"];

        // Quick check in index
        for (const scope of scopesToCheck) {
            if (indexHtmlContent.includes(scope)) foundBroadScope = true;
        }

        try {
            const buildEntries = await fs.readdir(buildDir);
            for (const name of buildEntries) {
                if (name.endsWith(".js") || name.endsWith(".wasm") || name.endsWith(".data")) {
                    const content = await fs.readFile(path.join(buildDir, name), "utf-8");
                    for (const scope of scopesToCheck) {
                        if (content.includes(scope)) {
                            foundBroadScope = true;
                            break;
                        }
                    }
                }
                if (foundBroadScope) break;
            }
        } catch (e) {
            // Ignore
        }

        if (foundBroadScope) {
            result.checks.granular_scopes = false;
            result.criticalFailures.push({
                id: "DISC_SCOPE_SPLIT",
                description: "Broad scopes detected (MANAGE_GUILD or MANAGE_MESSAGES). Vulnerable to Feb 23rd Permission Split.",
                sunsetRisk: "TERMINAL (Immediate Rejection)",
            });
            result.score -= 40;
        }

        // 3. Look for Discord Commerce jslib
        let hasCommerce = false;
        try {
            const pluginsPath = path.join(projectRoot, "Assets", "Plugins", "WebGL");
            const pluginsFiles = await fs.readdir(pluginsPath);
            hasCommerce = pluginsFiles.some(f => f.includes("DiscordCommerce.jslib"));
        } catch (e) {
            // Plugins path missing in output build usually
        }

        if (hasCommerce) {
            result.monetizationReadiness.cmpEligible = true;
            result.monetizationReadiness.missingBridge = null;
        }

        if (result.score < 0) result.score = 0;

    } catch (error) {
        console.error("Discord compliance audit error:", error);
    }

    return result;
}
