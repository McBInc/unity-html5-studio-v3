import fs from "fs/promises";
import path from "path";

export interface LinkedinComplianceResult {
    platform: "LINKEDIN";
    auditDate: string;
    score: number;
    criticalFailures: {
        id: string;
        description: string;
        sunsetRisk: string;
    }[];
    checks: {
        zero_pii_ok: boolean;
    };
}

export async function auditLinkedinCompliance(
    tmpRoot: string,
    buildDir: string,
    projectRoot: string
): Promise<LinkedinComplianceResult> {
    const result: LinkedinComplianceResult = {
        platform: "LINKEDIN",
        auditDate: new Date().toISOString(),
        score: 100,
        criticalFailures: [],
        checks: {
            zero_pii_ok: true,
        },
    };

    try {
        let trackersFound = 0;
        const knownTrackers = [
            "linkedin_data_partner_id",
            "fbq('track'",
            "google-analytics.com/analytics.js",
            "googletagmanager.com/gtag",
            "hotjar.com"
        ];

        // Scan index.html and JS files for known trackers
        const scanForTrackers = async (dirPath: string) => {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);

                if (entry.isDirectory()) {
                    if (entry.name === "TemplateData" || entry.name === "Build" || dirPath === projectRoot) {
                        await scanForTrackers(fullPath);
                    }
                } else {
                    if (entry.name.endsWith(".html") || entry.name.endsWith(".js")) {
                        const text = await fs.readFile(fullPath, "utf-8");
                        for (const tracker of knownTrackers) {
                            if (text.includes(tracker)) {
                                trackersFound++;
                                result.checks.zero_pii_ok = false;

                                // Break after first find of this specific tracker in this file to avoid massive spam
                                break;
                            }
                        }
                    }
                }
            }
        };

        await scanForTrackers(projectRoot);

        if (!result.checks.zero_pii_ok) {
            result.criticalFailures.push({
                id: "LI_PII_VIOLATION",
                description: `Detected ${trackersFound} unconsented tracking pixels or analytics tags. LinkedIn Enterprise requires Zero-PII builds.`,
                sunsetRisk: "TERMINAL (B2B Compliance Rejection)",
            });
            result.score -= 50;
        }

        if (result.score < 0) result.score = 0;

    } catch (error) {
        console.error("LinkedIn compliance audit error:", error);
    }

    return result;
}
