// src/app/api/patch/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

import JSZip from "jszip";
import fs from "node:fs/promises";
import path from "node:path";

import { injectUniversalInitIntoZip } from "@/lib/patchers/injectUniversalInit";
import { applyDiagnosticOverlayPatch, applyMetaPatch } from "@/lib/patches/metaZeroFriction";
import { applyDiscordBasicPatch, applyDiscordProducerPatch } from "@/lib/patches/discordPatcher";
import { applyYoutubePatch } from "@/lib/patches/youtubePatcher";
import { applyTiktokPatch } from "@/lib/patches/tiktokPatcher";
import { applyLinkedinPatch } from "@/lib/patches/linkedinPatcher";
import { applyTelegramPatch } from "@/lib/patches/telegramPatcher";

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
    const f = zip.file(p);
    if (!f) continue;
    const data = await f.async("nodebuffer");
    out.file(rel, data);
  }

  const outZip = await out.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

  return {
    outZip,
    usedBaseDir: chosenBase.replace(/\/$/, ""),
    reason: `Detected Unity base dir "${chosenBase}" and re-rooted ZIP for hosting.`,
  };
}

async function readRepoScript(relPath: string): Promise<string> {
  // Vercel-safe absolute path to repo file (during runtime)
  const abs = path.join(process.cwd(), relPath);
  return await fs.readFile(abs, "utf8");
}

export async function POST(req: NextRequest) {
  try {
    // --- AUTH ---
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

    // --- Load injection scripts from repo (Vercel-safe paths) ---
    const universalInitJs = await readRepoScript("src/lib/scripts/universal-init.js");
    const overlayJs = await readRepoScript("src/lib/scripts/diagnostic-overlay.js");
    const platformTarget = String(form.get("platformTarget") || "").toUpperCase();

    // --- Patch universal init ---
    const uni = await injectUniversalInitIntoZip(normalized.outZip, universalInitJs);

    // --- Patch HUD overlay (BASIC includes overlay) ---
    const ov = await applyDiagnosticOverlayPatch(uni.outZip ?? normalized.outZip, overlayJs, tier);

    let finalZip = ov.outZip ?? uni.outZip ?? normalized.outZip;

    // --- Meta Patch ---
    let metaOk = false;
    let discordOk = false;
    let youtubeOk = false;
    let tiktokOk = false;
    let linkedinOk = false;
    let telegramOk = false;

    if (platformTarget === "META") {
      const fbInitJs = await readRepoScript("src/lib/scripts/fb-init-v8.js");
      const metaMonetizationJslib = await readRepoScript("src/assets/Plugins/WebGL/MetaMonetization.jslib");
      const metaPatch = await applyMetaPatch(finalZip, fbInitJs, metaMonetizationJslib);
      finalZip = metaPatch.patchedZip;
      metaOk = metaPatch.patch.ok;
    } else if (platformTarget === "DISCORD") {
      if (tier === "BASIC") {
        const hudJs = await readRepoScript("src/lib/scripts/discord-hud.js");
        const patchRes = await applyDiscordBasicPatch(finalZip, hudJs);
        finalZip = patchRes.patchedZip;
        discordOk = patchRes.patch.ok;
      } else {
        const initJs = await readRepoScript("src/lib/scripts/discord-init-2026.js");
        const commJs = await readRepoScript("src/assets/Plugins/WebGL/DiscordCommerce.jslib");
        const patchRes = await applyDiscordProducerPatch(finalZip, initJs, commJs);
        finalZip = patchRes.patchedZip;
        discordOk = patchRes.patch.ok;
      }
    } else if (platformTarget === "YOUTUBE_PLAYABLES") {
      const initJs = await readRepoScript("src/lib/scripts/youtube-init.js");
      const wrapperJslib = await readRepoScript("src/assets/Plugins/WebGL/YTGameWrapper.jslib");
      const patchRes = await applyYoutubePatch(finalZip, initJs, wrapperJslib);
      finalZip = patchRes.patchedZip;
      youtubeOk = patchRes.patch.ok;
    } else if (platformTarget === "TIKTOK") {
      const bridgeJs = await readRepoScript("src/lib/scripts/tiktokBridge.js");
      const patchRes = await applyTiktokPatch(finalZip, bridgeJs);
      finalZip = patchRes.patchedZip;
      tiktokOk = patchRes.patch.ok;
    } else if (platformTarget === "LINKEDIN_GAMES") {
      const initJs = await readRepoScript("src/lib/scripts/linkedin-init.js");
      const patchRes = await applyLinkedinPatch(finalZip, initJs);
      finalZip = patchRes.patchedZip;
      linkedinOk = patchRes.patch.ok;
    } else if (platformTarget === "TELEGRAM") {
      const initJs = await readRepoScript("src/lib/scripts/telegram-init.js");
      const patchRes = await applyTelegramPatch(finalZip, initJs);
      finalZip = patchRes.patchedZip;
      telegramOk = patchRes.patch.ok;
    }

    const patchedZip = finalZip;

    const fileName = `${certId}-${tier.toLowerCase()}-patched.zip`;

    // Keep debug headers TINY (avoid header size limits)
    const debugSummary = {
      normalizeBase: normalized.usedBaseDir,
      universalOk: !!uni?.result?.ok,
      overlayOk: !!ov?.patch?.ok,
      metaOk,
      discordOk,
      youtubeOk,
      tiktokOk,
      linkedinOk,
    };

    const body = new Uint8Array(patchedZip);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
        "Content-Length": String(body.byteLength),
        "X-H5S-Patch": JSON.stringify(debugSummary),
      },
    });

  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Patch failed" }, { status: 500 });
  }
}
