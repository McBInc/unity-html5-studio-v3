import JSZip from "jszip";

export async function applyYoutubePatch(
    zipBuffer: Buffer,
    initJs: string,
    wrapperJslib: string
): Promise<{ patchedZip: Buffer; patch: { ok: boolean; injectedInit: boolean; wroteWrapper: boolean } }> {
    const result = { ok: false, injectedInit: false, wroteWrapper: false };
    try {
        const zip = await JSZip.loadAsync(zipBuffer);
        const files = Object.keys(zip.files).filter((p) => !zip.files[p].dir);
        const indexPaths = files.filter((p) => p.toLowerCase().endsWith("index.html"));

        if (indexPaths.length === 0) {
            throw new Error("No index.html found. Cannot apply YouTube patch.");
        }

        // 1. Inject Handshake Recovery / Pause-Resume Hook into index.html
        for (const idx of indexPaths) {
            const idxFile = zip.file(idx);
            if (!idxFile) continue;

            let html = await idxFile.async("string");

            const initScriptTag = `\n    <!-- HTML5STUDIO YouTube Playables SDK Init -->\n    <script src="//www.youtube.com/iframe_api"></script>\n    <script>\n      ${initJs.replace(/\$/g, '$$$$')}\n    </script>\n`;
            if (!html.includes("HTML5STUDIO YouTube Playables SDK")) {
                html = html.replace("</head>", `${initScriptTag}</head>`);
                result.injectedInit = true;
            }

            zip.file(idx, html);
        }

        // 2. Inject WebGL YTGameWrapper Plugin
        let chosenBase: string | null = null;
        for (const idx of indexPaths) {
            const base = idx.slice(0, -("index.html".length));
            if (files.some((p) => p.startsWith(`${base}Build/`))) {
                chosenBase = base;
                break;
            }
        }

        if (chosenBase !== null) {
            const pluginPath = `${chosenBase}Assets/Plugins/WebGL/YTGameWrapper.jslib`;
            zip.file(pluginPath, wrapperJslib);
            result.wroteWrapper = true;
        }

        const patchedZip = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
        result.ok = true;
        return { patchedZip, patch: result };
    } catch (err: any) {
        console.error("applyYoutubePatch err:", err);
        return { patchedZip: zipBuffer, patch: result };
    }
}
