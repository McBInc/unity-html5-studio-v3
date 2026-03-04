import JSZip from "jszip";

export async function applyLinkedinPatch(
    zipBuffer: Buffer,
    initJs: string
): Promise<{ patchedZip: Buffer; patch: { ok: boolean; injectedFirewall: boolean } }> {
    const result = { ok: false, injectedFirewall: false };
    try {
        const zip = await JSZip.loadAsync(zipBuffer);
        const files = Object.keys(zip.files).filter((p) => !zip.files[p].dir);
        const indexPaths = files.filter((p) => p.toLowerCase().endsWith("index.html"));

        if (indexPaths.length === 0) {
            throw new Error("No index.html found. Cannot apply LinkedIn patch.");
        }

        // Inject firewall script tag high up in the head to catch analytics
        for (const idx of indexPaths) {
            const idxFile = zip.file(idx);
            if (!idxFile) continue;

            let html = await idxFile.async("string");

            const scriptTag = `\n    <!-- HTML5STUDIO LinkedIn Zero-PII Firewall -->\n    <script>\n      ${initJs.replace(/\$/g, '$$$$')}\n    </script>\n`;
            if (!html.includes("HTML5STUDIO LinkedIn Zero-PII Firewall")) {
                // Insert right after <head> to guarantee it loads before tracking tags
                html = html.replace("<head>", `<head>${scriptTag}`);
                result.injectedFirewall = true;
            }

            zip.file(idx, html);
        }

        const patchedZip = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
        result.ok = true;
        return { patchedZip, patch: result };
    } catch (err: any) {
        console.error("applyLinkedinPatch err:", err);
        return { patchedZip: zipBuffer, patch: result };
    }
}
