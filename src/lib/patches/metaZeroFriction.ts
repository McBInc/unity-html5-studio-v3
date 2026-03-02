import JSZip from "jszip";

export type PatchResult = {
  ok: boolean;
  reason?: string;
  wroteOverlay?: boolean;
  injectedIntoIndexHtml?: boolean;
};

export async function applyDiagnosticOverlayPatch(
  zipBuffer: Buffer,
  overlayJs: string,
  tier: string
): Promise<{
  outZip: Buffer;
  patchedZip: Buffer;
  patch: PatchResult;
}> {
  const patch: PatchResult = {
    ok: false,
    wroteOverlay: false,
    injectedIntoIndexHtml: false,
  };

  // If not BASIC tier, do nothing but return original zip safely
  if (tier !== "BASIC") {
    patch.ok = true;
    patch.reason = "Not BASIC tier";

    return {
      outZip: zipBuffer,
      patchedZip: zipBuffer,
      patch,
    };
  }

  const zip = await JSZip.loadAsync(zipBuffer);

  // Find index.html anywhere in zip
  const indexPath = Object.keys(zip.files).find((p) =>
    p.toLowerCase().endsWith("index.html")
  );

  if (!indexPath) {
    patch.reason = "No index.html found";
    return {
      outZip: zipBuffer,
      patchedZip: zipBuffer,
      patch,
    };
  }

  // Write overlay script
  zip.file("diagnostic-overlay.js", overlayJs);
  patch.wroteOverlay = true;

  const indexFile = zip.file(indexPath);
  if (!indexFile) {
    patch.reason = "index.html file missing";
    return {
      outZip: zipBuffer,
      patchedZip: zipBuffer,
      patch,
    };
  }

  let html = await indexFile.async("string");

  // Avoid duplicate injection
  if (!html.includes("diagnostic-overlay.js")) {
    html = html.replace(
      "</body>",
      `<script src="diagnostic-overlay.js"></script>\n</body>`
    );

    zip.file(indexPath, html);
    patch.injectedIntoIndexHtml = true;
  }

  const patchedZip = Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));

  patch.ok = true;

  return {
    outZip: patchedZip,
    patchedZip,
    patch,
  };
}