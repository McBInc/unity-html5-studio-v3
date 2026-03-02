// src/app/api/patch/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

import JSZip from "jszip";
import fs from "node:fs/promises";

import { injectUniversalInitIntoZip } from "@/lib/patchers/injectUniversalInit";
import { applyDiagnosticOverlayPatch } from "@/lib/patches/metaZeroFriction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Tier = "BASIC" | "PRO";

async function normalizeUnityZipForHosting(zipBuffer: Buffer): Promise<{
  outZip: Buffer;
  usedBaseDir: string | null;
  reason: string;
}> {
  const zip = await JSZip.loadAsync(zipBuffer);
  const files = Object.keys(zip.files).filter((p) => !zip.files[p].dir);

  const indexPaths = files.filter((p) => p.toLowerCase().endsWith("index.html"));
  let chosenBase: string | null = null;

  for (const idx of indexPaths) {
    const base = idx.slice(0, -("index.html".length)); // keep trailing slash
    const buildPrefix = `${base}Build/`;
    const hasBuild = files.some((p) => p.startsWith(buildPrefix));
    if (hasBuild) {
      chosenBase = base;
      break;
    }
  }

  if (!chosenBase) {
    return {
      outZip: zipBuffer,
      usedBaseDir: null,
      reason: "Could not detect Unity base directory; leaving ZIP structure unchanged.",
    };
  }

  const out = new JSZip();
  for (const p of files) {
    if (!p.startsWith(chosenBase)) continue;
    const rel = p.slice(chosenBase.length);
    if (!rel) continue;
    const data = await zip.file(p)!.async("nodebuffer");
    out.file(rel, data);
  }

  const outZip = await out.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

  return {
    outZip,
    usedBaseDir: chosenBase.replace(/\/$/, ""),
    reason: `Detected Unity base dir "${chosenBase}" and re-rooted ZIP for hosting.`,
  };
}

export async function POST(req: NextRequest) {
  try {
    // --- AUTH (keep consistent with rest of app) ---
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    // --- INPUT must be multipart ---
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("multipart/form-data")) {
      return NextResponse.json({ ok: false, error: "Expected multipart/form-data" }, { status: 415 });
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ ok: false, error: "Missing ZIP file (field: file)" }, { status: 400 });
    }

    const certId = typeof form.get("certId") === "string" ? String(form.get("certId")).trim() : "patched";
    const tierRaw = String(form.get("tier") || "BASIC").toUpperCase();
    const tier: Tier = tierRaw === "PRO" ? "PRO" : "BASIC";

    const zipBuffer = Buffer.from(await file.arrayBuffer());

    // --- Normalize zip (re-root) ---
    const normalized = await normalizeUnityZipForHosting(zipBuffer);

    // --- Load injection scripts from repo ---
    const universalInitJs = await fs.readFile("src/lib/scripts/universal-init.js", "utf8");
    const overlayJs = await fs.readFile("src/lib/scripts/diagnostic-overlay.js", "utf8");

    // --- Patch universal init ---
    const uni = await injectUniversalInitIntoZip(normalized.outZip, universalInitJs);

    // --- Patch HUD overlay (BASIC includes overlay) ---
    const ov = await applyDiagnosticOverlayPatch(uni.outZip ?? normalized.outZip, overlayJs, tier);

    const patchedZip = ov.outZip ?? uni.outZip ?? normalized.outZip;

    const fileName = `${certId}-${tier.toLowerCase()}-patched.zip`;

    return new NextResponse(new Uint8Array(patchedZip), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
        // Debug header you can inspect in DevTools → Network → Response Headers
        "X-Patch-Result": JSON.stringify({
          ok: true,
          certId,
          tier,
          normalize: { usedBaseDir: normalized.usedBaseDir, reason: normalized.reason },
          universalInit: uni?.result ?? null,
          overlay: ov?.patch ?? null,
        }),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Patch failed" }, { status: 500 });
  }
}