import fs from "fs/promises";
import path from "path";

type TelegramComplianceResult = {
    platform: "TELEGRAM";
    auditDate: string;
    score: number;
    criticalFailures: { id: string; description: string; sunsetRisk: string }[];
    monetizationReadiness: {
        cmpEligible: boolean;
        missingBridge: string | null;
    };
    checks: {
        sdk_present: boolean;
        stars_stub: boolean;
    };
};

export async function auditTelegramCompliance(
    tmpRoot: string,
    buildDir: string,
    projectRoot: string
): Promise<TelegramComplianceResult> {
    let score = 100;
    const criticalFailures: TelegramComplianceResult["criticalFailures"] = [];
    let sdk_present = false;
    let stars_stub = false;

    const indexPath = path.join(projectRoot, "index.html");

    try {
        const indexHtml = await fs.readFile(indexPath, "utf-8");

        // 1. Detect Telegram SDK
        if (indexHtml.includes("telegram.org/js/telegram-web-app.js")) {
            sdk_present = true;
        } else {
            score -= 50;
            criticalFailures.push({
                id: "TG_SDK_MISSING",
                description:
                    "Telegram Web App SDK (telegram-web-app.js) is missing. The game cannot communicate with the Telegram client without this.",
                sunsetRisk: "TERMINAL (Immediate Rejection)",
            });
        }
    } catch (e) {
        criticalFailures.push({
            id: "TG_MISSING_INDEX_HTML",
            description: "Could not read index.html to verify Telegram compliance.",
            sunsetRisk: "TERMINAL (Invalid Build)",
        });
        score = 0;
    }

    // 2. Scan Build directory for TelegramPayment bridge references
    try {
        const buildEntries = await fs.readdir(buildDir);
        for (const name of buildEntries) {
            if (name.endsWith(".js") || name.endsWith(".wasm") || name.endsWith(".data") || name.endsWith(".unityweb")) {
                const content = await fs.readFile(path.join(buildDir, name), "utf-8");
                if (content.includes("TelegramPayment") || content.includes("TelegramPayment.jslib")) {
                    stars_stub = true;
                    break;
                }
            }
        }
    } catch (e) {
        // Ignore
    }

    if (!stars_stub) {
        score -= 10;
        criticalFailures.push({
            id: "TMA_STARS_STUB",
            description: "No Stars bridge found. Scan Assets/Plugins for TelegramPayment.jslib",
            sunsetRisk: "WARN (Required for Producer tier revenue via Stars)",
        });
    }

    // Ensure score doesn't go below 0
    score = Math.max(0, score);

    return {
        platform: "TELEGRAM",
        auditDate: new Date().toISOString(),
        score,
        criticalFailures,
        monetizationReadiness: {
            cmpEligible: stars_stub,
            missingBridge: stars_stub ? null : "TelegramPayment.jslib",
        },
        checks: {
            sdk_present,
            stars_stub,
        },
    };
}
