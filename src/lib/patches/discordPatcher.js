import JSZip from "jszip";
export async function applyDiscordBasicPatch(zipBuffer, hudOverlayJs) {
    const result = { ok: false, injectedHud: false };
    try {
        const zip = await JSZip.loadAsync(zipBuffer);
        const files = Object.keys(zip.files).filter((p) => !zip.files[p].dir);
        const indexPaths = files.filter((p) => p.toLowerCase().endsWith("index.html"));
        if (indexPaths.length === 0) {
            throw new Error("No index.html found. Cannot apply Discord basic patch.");
        }
        for (const idx of indexPaths) {
            const idxFile = zip.file(idx);
            if (!idxFile)
                continue;
            let html = await idxFile.async("string");
            const hudScriptTag = `\n    <!-- HTML5STUDIO Discord HUD Patch -->\n    <script>\n      ${hudOverlayJs.replace(/\$/g, '$$$$')}\n    </script>\n`;
            if (!html.includes("h5s-discord-overlay")) {
                html = html.replace("</head>", `${hudScriptTag}</head>`);
                result.injectedHud = true;
            }
            zip.file(idx, html);
        }
        const patchedZip = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
        result.ok = true;
        return { patchedZip, patch: result };
    }
    catch (err) {
        console.error("applyDiscordBasicPatch err:", err);
        return { patchedZip: zipBuffer, patch: result };
    }
}
export async function applyDiscordProducerPatch(zipBuffer, init2026Js, commerceJslib) {
    const result = { ok: false, injectedInit: false, wroteCommerce: false };
    try {
        const zip = await JSZip.loadAsync(zipBuffer);
        const files = Object.keys(zip.files).filter((p) => !zip.files[p].dir);
        const indexPaths = files.filter((p) => p.toLowerCase().endsWith("index.html"));
        if (indexPaths.length === 0) {
            throw new Error("No index.html found. Cannot apply Discord producer patch.");
        }
        // 1. Inject Handshake Recovery into index.html
        for (const idx of indexPaths) {
            const idxFile = zip.file(idx);
            if (!idxFile)
                continue;
            let html = await idxFile.async("string");
            const initScriptTag = `\n    <!-- HTML5STUDIO Discord Handshake Recovery v1.8 -->\n    <script>\n      ${init2026Js.replace(/\$/g, '$$$$')}\n    </script>\n`;
            if (!html.includes("HTML5STUDIO Discord Handshake Recovery")) {
                html = html.replace("</head>", `${initScriptTag}</head>`);
                result.injectedInit = true;
            }
            zip.file(idx, html);
        }
        // 2. Inject WebGL Commerce Plugin
        let chosenBase = null;
        for (const idx of indexPaths) {
            const base = idx.slice(0, -("index.html".length));
            if (files.some((p) => p.startsWith(`${base}Build/`))) {
                chosenBase = base;
                break;
            }
        }
        if (chosenBase !== null) {
            const pluginPath = `${chosenBase}Assets/Plugins/WebGL/DiscordCommerce.jslib`;
            zip.file(pluginPath, commerceJslib);
            result.wroteCommerce = true;
        }
        const patchedZip = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
        result.ok = true;
        return { patchedZip, patch: result };
    }
    catch (err) {
        console.error("applyDiscordProducerPatch err:", err);
        return { patchedZip: zipBuffer, patch: result };
    }
}
