// src/lib/patchers/injectUniversalInit.ts
import JSZip from "jszip";

type InjectResult = {
  ok: boolean;
  reason?: string;
  wroteUniversalInit: boolean;
  injectedIntoIndexHtml: boolean;
  indexHtmlPath?: string;
};

/**
 * Injects universal-init.js into the same directory as index.html,
 * and injects <script src="universal-init.js"></script> into <head>
 * BEFORE Unity loader scripts execute.
 *
 * Handles builds that are either:
 *  - zip root contains index.html
 *  - OR zip root contains a single top-level folder that contains index.html
 */
export async function injectUniversalInitIntoZip(
  zipBuffer: Buffer,
  universalInitContent: string
): Promise<{ patchedZip: Buffer; result: InjectResult }> {
  const zip = await JSZip.loadAsync(zipBuffer);

  // Find index.html (prefer root-level first)
  const allFiles = Object.keys(zip.files).filter((p) => !zip.files[p].dir);
  const indexCandidates = allFiles.filter((p) =>
    p.toLowerCase().endsWith("index.html")
  );

  if (indexCandidates.length === 0) {
    return {
      patchedZip: zipBuffer,
      result: {
        ok: false,
        reason: "index.html not found in ZIP",
        wroteUniversalInit: false,
        injectedIntoIndexHtml: false,
      },
    };
  }

  // Prefer shortest path (root index.html beats nested)
  indexCandidates.sort((a, b) => a.split("/").length - b.split("/").length);
  const indexHtmlPath = indexCandidates[0];

  const indexFile = zip.file(indexHtmlPath);
  if (!indexFile) {
    return {
      patchedZip: zipBuffer,
      result: {
        ok: false,
        reason: "index.html file entry missing",
        wroteUniversalInit: false,
        injectedIntoIndexHtml: false,
      },
    };
  }

  let indexHtml = await indexFile.async("string");

  // If already injected, no-op on HTML injection
  const alreadyInjected =
    /<script[^>]+src=["']universal-init\.js["'][^>]*>\s*<\/script>/i.test(
      indexHtml
    );

  // Determine directory containing index.html
  const dir =
    indexHtmlPath.includes("/") ? indexHtmlPath.slice(0, indexHtmlPath.lastIndexOf("/") + 1) : "";

  // Always write/overwrite universal-init.js in that directory
  zip.file(`${dir}universal-init.js`, universalInitContent);

  let injectedIntoIndexHtml = false;

  if (!alreadyInjected) {
    const scriptTag = `<script src="universal-init.js"></script>\n`;

    // Best insertion: right after <head ...>
    const headOpenMatch = indexHtml.match(/<head[^>]*>/i);
    if (headOpenMatch && headOpenMatch.index !== undefined) {
      const insertAt = headOpenMatch.index + headOpenMatch[0].length;
      indexHtml =
        indexHtml.slice(0, insertAt) +
        "\n" +
        scriptTag +
        indexHtml.slice(insertAt);
      injectedIntoIndexHtml = true;
    } else {
      // Fallback: insert before first Unity loader script if head missing
      const firstScriptIdx = indexHtml.search(/<script/i);
      if (firstScriptIdx >= 0) {
        indexHtml =
          indexHtml.slice(0, firstScriptIdx) +
          scriptTag +
          indexHtml.slice(firstScriptIdx);
        injectedIntoIndexHtml = true;
      } else {
        // Last resort: prepend
        indexHtml = scriptTag + indexHtml;
        injectedIntoIndexHtml = true;
      }
    }

    // Write back updated index.html
    zip.file(indexHtmlPath, indexHtml);
  }

  const patchedZip = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  return {
    patchedZip,
    result: {
      ok: true,
      wroteUniversalInit: true,
      injectedIntoIndexHtml: injectedIntoIndexHtml || alreadyInjected,
      indexHtmlPath,
    },
  };
}