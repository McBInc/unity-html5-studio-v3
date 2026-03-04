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

export type MetaPatchResult = {
  ok: boolean;
  reason?: string;
  injectedFbInit?: boolean;
  injectedJslib?: boolean;
};

export async function applyMetaPatch(
  zipBuffer: Buffer,
  fbInitJs: string,
  metaMonetizationJslib: string
): Promise<{
  outZip: Buffer;
  patchedZip: Buffer;
  patch: MetaPatchResult;
}> {
  const patch: MetaPatchResult = {
    ok: false,
    injectedFbInit: false,
    injectedJslib: false,
  };

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

  // 1. Inject fb-init-v8.js
  zip.file("fb-init-v8.js", fbInitJs);

  const indexFile = zip.file(indexPath);
  if (indexFile) {
    let html = await indexFile.async("string");
    // Inject the script into the head
    if (!html.includes("fb-init-v8.js")) {
      html = html.replace(
        "</head>",
        `<script src="fb-init-v8.js"></script>\n</head>`
      );
      zip.file(indexPath, html);
      patch.injectedFbInit = true;
    }
  }

  // 2. Inject MetaMonetization.jslib into the zip for developer reference or platform use
  // We'll place it in an 'extras' or 'Plugins' folder to ensure it's available
  zip.file("Plugins/WebGL/MetaMonetization.jslib", metaMonetizationJslib);
  patch.injectedJslib = true;

  const patchedZip = Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
  patch.ok = true;

  return {
    outZip: patchedZip,
    patchedZip,
    patch,
  };
}