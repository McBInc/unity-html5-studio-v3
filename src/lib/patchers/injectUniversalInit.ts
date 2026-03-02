// src/lib/patchers/injectUniversalInit.ts
import JSZip from "jszip";
import path from "node:path";

export type UniversalInitPatchReport = {
  v: 1;
  ok: boolean;
  reason?: string;
  wroteUniversalInit: boolean;
  injectedIntoIndexHtml: boolean;
  universalInitPath?: string;
  indexHtmlPath?: string;
};

function pickBestIndexHtml(paths: string[]): string | null {
  const candidates = paths
    .filter((p) => p.toLowerCase().endsWith("/index.html") || p.toLowerCase() === "index.html")
    // prefer shallower first (e.g. index.html, WebGL/index.html)
    .sort((a, b) => a.split("/").length - b.split("/").length);

  return candidates[0] ?? null;
}

function injectScriptTag(html: string, src: string): { html: string; injected: boolean } {
  const tag = `<script src="${src}"></script>`;

  // already present?
  if (html.includes(tag) || html.includes(`src="${src}"`) || html.includes(src)) {
    return { html, injected: false };
  }

  const lower = html.toLowerCase();
  const idx = lower.lastIndexOf("</body>");
  if (idx >= 0) {
    return {
      html: html.slice(0, idx) + `\n  ${tag}\n` + html.slice(idx),
      injected: true,
    };
  }

  // fallback
  return { html: html + `\n${tag}\n`, injected: true };
}

/**
 * Writes universal-init.js next to index.html and injects a script tag.
 * Works for Unity builds where index.html might be nested (e.g. WebGL/index.html).
 */
export async function injectUniversalInitIntoZip(
  zipBuffer: Buffer,
  universalInitJs: string
): Promise<{ patchedZip: Buffer; result: UniversalInitPatchReport }> {
  const result: UniversalInitPatchReport = {
    v: 1,
    ok: false,
    wroteUniversalInit: false,
    injectedIntoIndexHtml: false,
  };

  const zip = await JSZip.loadAsync(zipBuffer);
  const allPaths = Object.keys(zip.files);

  const indexPath = pickBestIndexHtml(allPaths);
  if (!indexPath) {
    result.reason = "No index.html found anywhere in ZIP";
    return { patchedZip: zipBuffer, result };
  }

  const indexFile = zip.file(indexPath);
  if (!indexFile) {
    result.reason = "index.html entry not readable";
    return { patchedZip: zipBuffer, result };
  }

  // Determine where to write universal-init.js (same folder as index.html)
  const indexDir = path.posix.dirname(indexPath);
  const universalPath = indexDir === "." ? "universal-init.js" : `${indexDir}/universal-init.js`;

  // Write/overwrite universal-init.js
  zip.file(universalPath, universalInitJs);
  result.wroteUniversalInit = true;
  result.universalInitPath = universalPath;

  // Inject script tag into index.html (use relative src in same folder)
  const indexHtml = await indexFile.async("string");
  const injected = injectScriptTag(indexHtml, "universal-init.js");
  zip.file(indexPath, injected.html);
  result.injectedIntoIndexHtml = injected.injected;
  result.indexHtmlPath = indexPath;

  result.ok = true;

  const out = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return { patchedZip: out, result };
}