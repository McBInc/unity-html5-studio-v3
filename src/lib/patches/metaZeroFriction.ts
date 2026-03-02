// src/lib/patches/metaZeroFriction.ts
import JSZip from "jszip";
import path from "node:path";

type PatchResult = {
  v: 1;
  ok: boolean;
  reason?: string;
  injectedOverlay: boolean;
  overlayPath?: string;
  indexHtmlPath?: string;
};

function pickBestIndexHtml(paths: string[]): string | null {
  const candidates = paths
    .filter((p) => p.toLowerCase().endsWith("/index.html") || p.toLowerCase() === "index.html")
    // prefer shallower paths (WebGL/index.html is ok; super deep ones less likely)
    .sort((a, b) => a.split("/").length - b.split("/").length);

  return candidates[0] ?? null;
}

function injectScriptIntoHtml(html: string, scriptSrc: string): { html: string; injected: boolean } {
  const tag = `<script src="${scriptSrc}"></script>`;

  // already present?
  if (html.includes(tag) || html.includes(scriptSrc)) return { html, injected: false };

  const lower = html.toLowerCase();
  const bodyCloseIdx = lower.lastIndexOf("</body>");
  if (bodyCloseIdx >= 0) {
    const out = html.slice(0, bodyCloseIdx) + `\n  ${tag}\n` + html.slice(bodyCloseIdx);
    return { html: out, injected: true };
  }

  // fallback: append at end
  return { html: html + `\n${tag}\n`, injected: true };
}

/**
 * Applies the diagnostic HUD overlay (BASIC tier) into the same folder as the chosen index.html.
 * - Writes diagnostic-overlay.js next to index.html
 * - Injects <script src="diagnostic-overlay.js"></script> into that index.html
 */
export async function applyDiagnosticOverlayPatch(
  zipBuffer: Buffer,
  overlayJs: string,
  tier: string
): Promise<{ patchedZip: Buffer; patch: PatchResult }> {
  const patch: PatchResult = { v: 1, ok: false, injectedOverlay: false };

  if (String(tier || "").toUpperCase() !== "BASIC") {
    patch.ok = true;
    patch.reason = "Not BASIC tier";
    return { patchedZip: zipBuffer, patch };
  }

  const zip = await JSZip.loadAsync(zipBuffer);

  const allPaths = Object.keys(zip.files);
  const indexPath = pickBestIndexHtml(allPaths);

  if (!indexPath) {
    patch.reason = "No index.html found anywhere in ZIP";
    return { patchedZip: zipBuffer, patch };
  }

  const indexFile = zip.file(indexPath);
  if (!indexFile) {
    patch.reason = "index.html entry not readable";
    return { patchedZip: zipBuffer, patch };
  }

  const indexDir = path.posix.dirname(indexPath);
  const overlayPath = indexDir === "." ? "diagnostic-overlay.js" : `${indexDir}/diagnostic-overlay.js`;

  // Write overlay file next to index.html
  zip.file(overlayPath, overlayJs);

  // Inject script tag into index.html
  const indexHtml = await indexFile.async("string");
  const injected = injectScriptIntoHtml(indexHtml, "diagnostic-overlay.js");
  zip.file(indexPath, injected.html);

  patch.ok = true;
  patch.injectedOverlay = injected.injected;
  patch.overlayPath = overlayPath;
  patch.indexHtmlPath = indexPath;

  const out = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return { patchedZip: out, patch };
}