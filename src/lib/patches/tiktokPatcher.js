import JSZip from "jszip";
export async function applyTiktokPatch(zipBuffer, bridgeJs) {
    const result = { ok: false, injectedBridge: false };
    try {
        const zip = await JSZip.loadAsync(zipBuffer);
        const files = Object.keys(zip.files).filter((p) => !zip.files[p].dir);
        const indexPaths = files.filter((p) => p.toLowerCase().endsWith("index.html"));
        if (indexPaths.length === 0) {
            throw new Error("No index.html found. Cannot apply TikTok patch.");
        }
        // Inject touch-action logic into index.html
        for (const idx of indexPaths) {
            const idxFile = zip.file(idx);
            if (!idxFile)
                continue;
            let html = await idxFile.async("string");
            const scriptTag = `\n    <!-- HTML5STUDIO TikTok Bridge -->\n    <script>\n      ${bridgeJs.replace(/\$/g, '$$$$')}\n    </script>\n`;
            if (!html.includes("HTML5STUDIO TikTok Bridge")) {
                html = html.replace("</head>", `${scriptTag}</head>`);
                result.injectedBridge = true;
            }
            zip.file(idx, html);
        }
        const patchedZip = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
        result.ok = true;
        return { patchedZip, patch: result };
    }
    catch (err) {
        console.error("applyTiktokPatch err:", err);
        return { patchedZip: zipBuffer, patch: result };
    }
}
