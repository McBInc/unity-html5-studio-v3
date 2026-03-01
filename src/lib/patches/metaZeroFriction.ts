// src/lib/patches/metaZeroFriction.ts
import JSZip from "jszip";

export type PatchTier = "BASIC" | "PRO" | "ENTERPRISE";
export type PatchResult = {
  ok: boolean;
  reason?: string;
  indexHtmlPath?: string;
  injectedOverlay: boolean;
  overlayPath?: string;
};

function findBestIndexHtmlPath(zip: JSZip): string | null {
  const allFiles = Object.keys(zip.files).filter((p) => !zip.files[p].dir);
  const candidates = allFiles.filter((p) => p.toLowerCase().endsWith("index.html"));
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.split("/").length - b.split("/").length);
  return candidates[0];
}

function scriptAlreadyPresent(html: string, fileName: string) {
  const re = new RegExp(`<script[^>]+src=["']${fileName.replace(".", "\\.")}["'][^>]*>\\s*</script>`, "i");
  return re.test(html);
}

function injectIntoHead(html: string, scriptTag: string) {
  const headOpen = html.match(/<head[^>]*>/i);
  if (headOpen && headOpen.index !== undefined) {
    const insertAt = headOpen.index + headOpen[0].length;
    return html.slice(0, insertAt) + "\n" + scriptTag + "\n" + html.slice(insertAt);
  }
  const firstScriptIdx = html.search(/<script/i);
  if (firstScriptIdx >= 0) {
    return html.slice(0, firstScriptIdx) + scriptTag + "\n" + html.slice(firstScriptIdx);
  }
  return scriptTag + "\n" + html;
}

/**
 * BASIC tier: inject diagnostic-overlay.js next to index.html and add <script> tag into <head>.
 */
export async function applyDiagnosticOverlayPatch(
  zipBuffer: Buffer,
  overlayJsContent: string,
  tier: PatchTier
): Promise<{ patchedZip: Buffer; patch: PatchResult }> {
  // Only BASIC (per your intelligence row); you can expand later.
  if (tier !== "BASIC") {
    return {
      patchedZip: zipBuffer,
      patch: { ok: true, injectedOverlay: false, reason: `Tier ${tier} has no Diagnostic HUD patch` },
    };
  }

  const zip = await JSZip.loadAsync(zipBuffer);
  const indexHtmlPath = findBestIndexHtmlPath(zip);

  if (!indexHtmlPath) {
    return {
      patchedZip: zipBuffer,
      patch: { ok: false, reason: "index.html not found", injectedOverlay: false },
    };
  }

  const indexFile = zip.file(indexHtmlPath);
  if (!indexFile) {
    return {
      patchedZip: zipBuffer,
      patch: { ok: false, reason: "index.html entry missing", injectedOverlay: false },
    };
  }

  let html = await indexFile.async("string");

  const dir = indexHtmlPath.includes("/") ? indexHtmlPath.slice(0, indexHtmlPath.lastIndexOf("/") + 1) : "";
  const overlayFileName = "diagnostic-overlay.js";
  const overlayPath = `${dir}${overlayFileName}`;

  // Write overlay script next to index.html
  zip.file(overlayPath, overlayJsContent);

  // Inject script tag (ensure it runs early; after universal-init is OK too)
  const already = scriptAlreadyPresent(html, overlayFileName);
  if (!already) {
    const tag = `<script src="${overlayFileName}"></script>`;
    html = injectIntoHead(html, tag);
    zip.file(indexHtmlPath, html);
  }

  const patchedZip = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  return {
    patchedZip,
    patch: { ok: true, indexHtmlPath, injectedOverlay: true, overlayPath },
  };
}