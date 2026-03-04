import fs from "fs/promises";
import path from "path";

export interface BundleComplianceResult {
    platform: "YOUTUBE_PLAYABLES";
    auditDate: string;
    score: number;
    criticalFailures: {
        id: string;
        description: string;
        sunsetRisk: string;
    }[];
    metrics: {
        initialBundleSizeMiB: number;
        totalBundleSizeMiB: number;
        largestFileMiB: number;
        memoryHeapLimit: number | null;
    };
    checks: {
        max_file_size_ok: boolean;
        initial_bundle_size_ok: boolean;
        max_bundle_size_ok: boolean;
        naming_conventions_ok: boolean;
        sdk_present: boolean;
        heap_limit_ok: boolean;
        absolute_paths_ok: boolean;
    };
}

const MAX_FILE_SIZE_BYTES = 30 * 1024 * 1024; // 30 MiB
const MAX_INITIAL_BUNDLE_SIZE_BYTES = 30 * 1024 * 1024; // 30 MiB
const MAX_BUNDLE_SIZE_BYTES = 250 * 1024 * 1024; // 250 MiB
const ALLOWED_CHARS_REGEX = /^[a-zA-Z0-9.\-_/]+$/;
const MAX_JS_HEAP_MB = 512;

export async function auditYoutubeBundleCompliance(
    tmpRoot: string,
    buildDir: string,
    projectRoot: string
): Promise<BundleComplianceResult> {
    const result: BundleComplianceResult = {
        platform: "YOUTUBE_PLAYABLES",
        auditDate: new Date().toISOString(),
        score: 100,
        criticalFailures: [],
        metrics: {
            initialBundleSizeMiB: 0,
            totalBundleSizeMiB: 0,
            largestFileMiB: 0,
            memoryHeapLimit: null,
        },
        checks: {
            max_file_size_ok: true,
            initial_bundle_size_ok: true,
            max_bundle_size_ok: true,
            naming_conventions_ok: true,
            sdk_present: false,
            heap_limit_ok: true,
            absolute_paths_ok: true,
        },
    };

    try {
        let totalSize = 0;
        let initialSize = 0;
        let largestFile = 0;
        let invalidNamesFound = 0;
        let absolutePathsFound = 0;

        // Scan all output files in buildDir (and nested)
        const scanDir = async (dirPath: string) => {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);

                // Check Name Characters (Unix path relative formatting test usually)
                if (!ALLOWED_CHARS_REGEX.test(entry.name)) {
                    invalidNamesFound++;
                    result.checks.naming_conventions_ok = false;
                }

                if (entry.isDirectory()) {
                    await scanDir(fullPath);
                } else {
                    const stats = await fs.stat(fullPath);
                    totalSize += stats.size;

                    // Heuristic for Unity WebGL initial load files
                    const nameLower = entry.name.toLowerCase();
                    if (nameLower.endsWith(".data") || nameLower.endsWith(".wasm") || nameLower.endsWith(".loader.js") || nameLower.endsWith(".framework.js") || nameLower.endsWith(".data.br") || nameLower.endsWith(".wasm.br") || nameLower.endsWith(".framework.js.br")) {
                        initialSize += stats.size;
                    }

                    if (stats.size > largestFile) largestFile = stats.size;

                    if (stats.size > MAX_FILE_SIZE_BYTES) {
                        result.checks.max_file_size_ok = false;
                    }

                    // Scan .html and .js files for absolute paths handling external assets (naive scan)
                    if (nameLower.endsWith(".html") || nameLower.endsWith(".js")) {
                        const content = await fs.readFile(fullPath, "utf-8");
                        // Look for typical external asset requests, ignoring youtube sdk and w3 schemas
                        const absoluteMatches = content.match(/(src|href)=["'](http:\/\/|https:\/\/)((?!www\.youtube\.com\/iframe_api|www\.youtube\.com\/playables|www\.w3\.org).+?)["']/gi);
                        if (absoluteMatches && absoluteMatches.length > 0) {
                            absolutePathsFound += absoluteMatches.length;
                            result.checks.absolute_paths_ok = false;
                        }
                    }
                }
            }
        };

        await scanDir(buildDir);

        // Also scan index.html at root for absolute paths
        const absoluteIndexHtmlPath = path.join(projectRoot, "index.html");
        try {
            const indexHtmlContent = await fs.readFile(absoluteIndexHtmlPath, "utf-8");
            const indexMatches = indexHtmlContent.match(/(src|href)=["'](http:\/\/|https:\/\/)((?!www\.youtube\.com\/iframe_api|www\.youtube\.com\/playables|www\.w3\.org).+?)["']/gi);
            if (indexMatches && indexMatches.length > 0) {
                absolutePathsFound += indexMatches.length;
                result.checks.absolute_paths_ok = false;
            }
        } catch (e) { }

        result.metrics.totalBundleSizeMiB = Number((totalSize / (1024 * 1024)).toFixed(2));
        result.metrics.initialBundleSizeMiB = Number((initialSize / (1024 * 1024)).toFixed(2));
        result.metrics.largestFileMiB = Number((largestFile / (1024 * 1024)).toFixed(2));

        if (totalSize > MAX_BUNDLE_SIZE_BYTES) {
            result.checks.max_bundle_size_ok = false;
            result.criticalFailures.push({
                id: "YT_TOTAL_SIZE_EXCEEDED",
                description: `Bundle is ${result.metrics.totalBundleSizeMiB} MiB. YouTube max is 250 MiB.`,
                sunsetRisk: "TERMINAL (Upload Rejected)",
            });
            result.score -= 40;
        }

        if (initialSize > MAX_INITIAL_BUNDLE_SIZE_BYTES) {
            result.checks.initial_bundle_size_ok = false;
            result.criticalFailures.push({
                id: "YT_INITIAL_SIZE_EXCEEDED",
                description: `Initial bundle is ${result.metrics.initialBundleSizeMiB} MiB. YouTube max is 30 MiB.`,
                sunsetRisk: "TERMINAL (Upload Rejected)",
            });
            result.score -= 30;
        }

        if (!result.checks.max_file_size_ok) {
            result.criticalFailures.push({
                id: "YT_FILE_SIZE_EXCEEDED",
                description: `A file exceeds 30 MiB constraint (${result.metrics.largestFileMiB} MiB found).`,
                sunsetRisk: "TERMINAL (Upload Rejected)",
            });
            result.score -= 30;
        }

        if (!result.checks.naming_conventions_ok) {
            result.criticalFailures.push({
                id: "YT_INVALID_CHARS",
                description: `Found ${invalidNamesFound} files/folders with characters outside 'a-zA-Z0-9.-_/'`,
                sunsetRisk: "TERMINAL (Upload Rejected)",
            });
            result.score -= 10;
        }

        if (!result.checks.absolute_paths_ok) {
            result.criticalFailures.push({
                id: "YT_ABSOLUTE_PATHS_DETECTED",
                description: `Found ${absolutePathsFound} absolute paths (http:// or https://). YouTube requires relative paths.`,
                sunsetRisk: "TERMINAL (Gameplay Blocked)",
            });
            result.score -= 20;
        }

        // Scan index.html for SDK
        let indexHtmlContent = "";
        const indexHtmlPath = path.join(projectRoot, "index.html");
        try {
            indexHtmlContent = await fs.readFile(indexHtmlPath, "utf-8");

            // Look for the YT Playables SDK
            if (indexHtmlContent.includes("www.youtube.com/playables/sdk")) {
                result.checks.sdk_present = true;
            } else {
                result.criticalFailures.push({
                    id: "YT_SDK_MISSING",
                    description: "YouTube Playables SDK not found in index.html.",
                    sunsetRisk: "TERMINAL (Gameplay blocked)",
                });
                result.score -= 20;
            }
        } catch (e) { /* ignore */ }

        // Scan memory heap configurations looking for TOTAL_MEMORY > 512MB
        try {
            const buildEntries = await fs.readdir(buildDir);
            for (const entry of buildEntries) {
                if (entry.endsWith(".json") || entry.endsWith(".js")) {
                    const text = await fs.readFile(path.join(buildDir, entry), 'utf-8');
                    // Rough heuristic: TOTAL_MEMORY: 1073741824 or MAXIMUM_MEMORY: 1073741824
                    const mm = text.match(/MAXIMUM_MEMORY"?\s*[:=]\s*(\d+)/i);
                    if (mm && mm[1]) {
                        const mb = parseInt(mm[1], 10) / (1024 * 1024);
                        result.metrics.memoryHeapLimit = mb;
                        if (mb > MAX_JS_HEAP_MB) {
                            result.checks.heap_limit_ok = false;
                            result.criticalFailures.push({
                                id: "YT_HEAP_LIMIT_EXCEEDED",
                                description: `Configured heap (${mb.toFixed(0)}MB) exceeds YouTube iOS 512MB limit.`,
                                sunsetRisk: "HIGH (iOS Crashes)",
                            });
                            result.score -= 20;
                        }
                    }
                }
            }
        } catch (e) { }

        if (result.score < 0) result.score = 0;

    } catch (error) {
        console.error("Youtube audit error:", error);
    }

    return result;
}
