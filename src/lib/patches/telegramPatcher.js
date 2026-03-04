import JSZip from "jszip";
/**
 * Patches a Unity WebGL Build ZIP to satisfy TELEGRAM compliance.
 *
 * Injections:
 * 1. `<script src="https://telegram.org/js/telegram-web-app.js"></script>` into <head>
 * 2. `telegram-init.js` into <head>
 */
export async function applyTelegramPatch(rawZipBuffer, bridgeScriptContent) {
    const zip = new JSZip();
    await zip.loadAsync(rawZipBuffer);
    const indexEntry = zip.file(/index\.html/i)[0];
    if (!indexEntry) {
        return {
            patchedZip: rawZipBuffer,
            patch: { ok: false, message: "Could not find index.html in the ZIP" },
        };
    }
    let htmlContent = await indexEntry.async("string");
    // 1. Inject Telegram SDK if missing
    const TG_SDK_URL = "https://telegram.org/js/telegram-web-app.js";
    if (!htmlContent.includes(TG_SDK_URL)) {
        htmlContent = htmlContent.replace(/<\/head>/i, `  \n    <!-- HTML5STUDIO TELEGRAM SDK -->\n    <script src="${TG_SDK_URL}"></script>\n  </head>`);
    }
    // 2. Inject telegram-init.js (Viewport Expansion & Link patching)
    // 3. Inject critical CSS Locks so Unity ignores Desktop framing constraints
    htmlContent = htmlContent.replace(/<\/head>/i, `  \n    <!-- HTML5STUDIO TELEGRAM BRIDGE -->\n    <style>\n      /* Force Unity WebGL Canvas into full native sheet width/height without scrollbars */\n      html, body { width: 100vw; height: 100vh; padding: 0; margin: 0; overflow: hidden; background-color: #000; }\n      #unity-container, #unity-canvas { width: 100vw !important; height: 100vh !important; }\n    </style>\n    <script>\n      ${bridgeScriptContent}\n    </script>\n  </head>`);
    zip.file(indexEntry.name, htmlContent);
    const outBuffer = await zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
        compressionOptions: { level: 9 },
    });
    return {
        patchedZip: outBuffer,
        patch: { ok: true, message: "Successfully injected Telegram SDK + Viewport Expander." },
    };
}
