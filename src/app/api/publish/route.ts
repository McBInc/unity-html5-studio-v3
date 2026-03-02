// src/app/api/publish/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

import fs from "node:fs/promises";
import path from "node:path";

import JSZip from "jszip";

import { injectUniversalInitIntoZip } from "@/lib/patchers/injectUniversalInit";
import { applyDiagnosticOverlayPatch } from "@/lib/patches/metaZeroFriction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PlatformTarget =
  | "WEB"
  | "MOBILE_WEB"
  | "TELEGRAM"
  | "META"
  | "DISCORD"
  | "TIKTOK"
  | "YOUTUBE_PLAYABLES"
  | "LINKEDIN_GAMES";

type PublishMode = "WE_PUBLISH" | "ASSISTED";

type Action = "request" | "confirm";

function json(ok: boolean, body: any, status = 200) {
  return NextResponse.json({ ok, ...body }, { status });
}

function upper(s: any) {
  return String(s ?? "").trim().toUpperCase();
}

function parsePlatformTarget(raw: any): PlatformTarget {
  const v = upper(raw || "WEB");
  const allowed = new Set<PlatformTarget>([
    "WEB",
    "MOBILE_WEB",
    "TELEGRAM",
    "META",
    "DISCORD",
    "TIKTOK",
    "YOUTUBE_PLAYABLES",
    "LINKEDIN_GAMES",
  ]);
  return allowed.has(v as PlatformTarget) ? (v as PlatformTarget) : "WEB";
}

function parseMode(raw: any): PublishMode {
  const v = upper(raw || "ASSISTED");
  return v === "WE_PUBLISH" ? "WE_PUBLISH" : "ASSISTED";
}

function isValidHttpUrl(u: string) {
  try {
    const url = new URL(u);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Many Unity zips have a top folder like "WebGL/".
 * We deploy with "WebGL/" content at root so Netlify serves /index.html properly.
 *
 * If NETLIFY_BASE_DIR is set (default "WebGL"), and that folder exists in the ZIP,
 * this function returns a new ZIP containing ONLY that folder's contents moved to root.
 * Otherwise returns original ZIP buffer.
 */
async function normalizeUnityZipForHosting(zipBuffer: Buffer): Promise<{
  outZip: Buffer;
  usedBaseDir: string | null;
  reason?: string;
}> {
  const baseDir = (process.env.NETLIFY_BASE_DIR || "WebGL").replace(/^[./]+/, "").replace(/\/+$/, "");
  const zip = await JSZip.loadAsync(zipBuffer);

  const files = Object.keys(zip.files);

  const prefix = `${baseDir}/`;
  const hasBaseDir = files.some((p) => p.startsWith(prefix));

  // If no base folder, assume already rooted correctly
  if (!hasBaseDir) {
    return { outZip: zipBuffer, usedBaseDir: null, reason: `No "${baseDir}/" folder found; deploying ZIP as-is.` };
  }

  // Build a new zip with baseDir/* moved to root
  const out = new JSZip();

  for (const p of files) {
    const entry = zip.files[p];
    if (entry.dir) continue;
    if (!p.startsWith(prefix)) continue;

    const rel = p.slice(prefix.length);
    if (!rel) continue;

    const data = await zip.file(p)!.async("nodebuffer");
    out.file(rel, data);
  }

  const outZip = await out.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

  return { outZip, usedBaseDir: baseDir };
}

/**
 * Deploy a ZIP directly to a Netlify site.
 * Returns the published URL if available.
 */
async function deployZipToNetlify(zipBuffer: Buffer): Promise<{
  deployId: string | null;
  url: string | null;
  deployUrl: string | null;
  logs: any;
}> {
  const token = process.env.NETLIFY_TOKEN;
  const siteId = process.env.NETLIFY_SITE_ID;

  if (!token || !siteId) {
    throw new Error("Missing NETLIFY_TOKEN or NETLIFY_SITE_ID in environment.");
  }

  const res = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/zip",
    },
    body: new Uint8Array(zipBuffer),
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    // leave as raw
  }

  if (!res.ok) {
    throw new Error(`Netlify deploy failed (${res.status}): ${typeof data === "object" ? JSON.stringify(data) : text}`);
  }

  // Netlify commonly returns: id, url, deploy_ssl_url, deploy_url
  const deployId = data?.id ? String(data.id) : null;
  const url = data?.deploy_ssl_url ? String(data.deploy_ssl_url) : data?.url ? String(data.url) : null;
  const deployUrl = data?.deploy_url ? String(data.deploy_url) : null;

  return { deployId, url, deployUrl, logs: data };
}

async function readRepoScript(relPathFromRepoRoot: string) {
  const full = path.join(process.cwd(), relPathFromRepoRoot);
  return fs.readFile(full, "utf8");
}

export async function POST(req: NextRequest) {
  try {
    // ---------- AUTH ----------
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return json(false, { error: "Not authenticated" }, 401);

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return json(false, { error: "User not found" }, 404);

    const ct = (req.headers.get("content-type") || "").toLowerCase();

    // ---------- JSON MODE (ASSISTED) ----------
    // Body: { action: "request"|"confirm", certId, platformTarget, mode:"ASSISTED", liveUrl? }
    if (ct.includes("application/json")) {
      const body = await req.json().catch(() => null);

      const action = (String(body?.action || "request") as Action) || "request";
      const certId = String(body?.certId || "").trim();
      const platformTarget = parsePlatformTarget(body?.platformTarget);
      const mode = parseMode(body?.mode || "ASSISTED"); // JSON is primarily for ASSISTED

      if (!certId) return json(false, { error: "Missing certId" }, 400);

      const build = await prisma.build.findUnique({ where: { certId } });
      if (!build || build.userId !== user.id) return json(false, { error: "Build not found" }, 404);

      // Create or reuse a PublishJob
      const job = await prisma.publishJob.create({
        data: {
          buildId: build.id,
          platformTarget: platformTarget as any,
          mode: mode as any,
          status: "QUEUED" as any,
        },
      });

      if (action === "request") {
        // ASSISTED: we don't deploy anything, we just create a job record + tell user to provide liveUrl
        return json(true, {
          publishJobId: job.id,
          certId,
          platformTarget,
          mode,
          next: {
            action: "confirm",
            required: ["liveUrl"],
          },
          reportUrl: `/report/${certId}`,
        });
      }

      // confirm
      const liveUrl = String(body?.liveUrl || "").trim();
      if (!liveUrl || !isValidHttpUrl(liveUrl)) return json(false, { error: "Invalid or missing liveUrl" }, 400);

      await prisma.publishJob.update({
        where: { id: job.id },
        data: {
          status: "SUCCEEDED" as any,
          finishedAt: new Date(),
          liveUrl,
          provider: "assisted",
          evidence: { v: 1, confirmedBy: user.email, liveUrl },
        },
      });

      await prisma.build.update({
        where: { id: build.id },
        data: {
          liveUrl,
          reportStatus: "deployed",
          publishedAt: new Date(),
          publishStatus: "SUCCEEDED" as any,
          publishEvidence: { v: 1, mode: "ASSISTED", platformTarget, liveUrl },
        } as any,
      });

      return json(true, {
        publishJobId: job.id,
        certId,
        liveUrl,
        reportUrl: `/report/${certId}`,
        status: "SUCCEEDED",
      });
    }

    // ---------- MULTIPART MODE (WE_PUBLISH) ----------
    // FormData:
    // - file: zip
    // - certId: WGL-CERT-...
    // - platformTarget: DISCORD|META|...
    // - mode: WE_PUBLISH
    // - tier: BASIC (optional; fallback to build.tier if present)
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file") as File | null;

      const certId = String(form.get("certId") || "").trim();
      const platformTarget = parsePlatformTarget(form.get("platformTarget"));
      const mode = parseMode(form.get("mode"));

      if (!certId) return json(false, { error: "Missing certId" }, 400);
      if (!file) return json(false, { error: "Missing ZIP file (form field: file)" }, 400);
      if (mode !== "WE_PUBLISH") return json(false, { error: "multipart publish requires mode=WE_PUBLISH" }, 400);

      const build = await prisma.build.findUnique({ where: { certId } });
      if (!build || build.userId !== user.id) return json(false, { error: "Build not found" }, 404);

      // Determine tier (prefer DB if present, else provided tier, else BASIC)
      const tierFromDb = (build as any)?.tier ? String((build as any).tier) : "";
      const tierFromForm = String(form.get("tier") || "");
      const tier = (tierFromDb || tierFromForm || "BASIC").toUpperCase();

      // Create PublishJob
      const job = await prisma.publishJob.create({
        data: {
          buildId: build.id,
          platformTarget: platformTarget as any,
          mode: "WE_PUBLISH" as any,
          status: "RUNNING" as any,
          startedAt: new Date(),
        },
      });

      // Read zip
      const originalZipBuffer = Buffer.from(await file.arrayBuffer());

      // Load repo scripts for injection
      const universalInitJs = await readRepoScript("src/lib/scripts/universal-init.js");
      const overlayJs = await readRepoScript("src/lib/scripts/diagnostic-overlay.js");

      // Patch: universal-init
      const uni = await injectUniversalInitIntoZip(originalZipBuffer, universalInitJs);
      let patched = uni.patchedZip;

      // Patch: overlay (BASIC tier only)
      const overlay = await applyDiagnosticOverlayPatch(patched, overlayJs, tier);
      patched = overlay.patchedZip;

      // Normalize for hosting (move WebGL/* to root if needed)
      const normalized = await normalizeUnityZipForHosting(patched);

      // Deploy to Netlify
      const netlify = await deployZipToNetlify(normalized.outZip);

      const liveUrl = netlify.url || netlify.deployUrl;

      if (!liveUrl) {
        throw new Error("Netlify deploy succeeded but returned no live URL.");
      }

      const evidence = {
        v: 1,
        platformTarget,
        tier,
        injection: {
          universalInit: uni.result,
          overlay: overlay.patch,
        },
        hosting: {
          normalizedBaseDir: normalized.usedBaseDir,
          normalizedReason: normalized.reason,
          netlify: {
            deployId: netlify.deployId,
            url: netlify.url,
            deployUrl: netlify.deployUrl,
          },
        },
      };

      // Update PublishJob + Build
      await prisma.publishJob.update({
        where: { id: job.id },
        data: {
          status: "SUCCEEDED" as any,
          finishedAt: new Date(),
          liveUrl,
          provider: "netlify",
          providerMeta: netlify.logs,
          evidence,
        },
      });

      await prisma.build.update({
        where: { id: build.id },
        data: {
          liveUrl,
          reportStatus: "deployed",
          publishedAt: new Date(),
          publishStatus: "SUCCEEDED" as any,
          publishEvidence: evidence,
          // optionally track platform target on build too (if you have it)
          platformTarget: platformTarget as any,
        } as any,
      });

      return json(true, {
        publishJobId: job.id,
        certId,
        platformTarget,
        liveUrl,
        reportUrl: `/report/${certId}`,
        evidenceSummary: {
          normalizedBaseDir: normalized.usedBaseDir,
          wroteUniversalInit: uni.result?.wroteUniversalInit ?? false,
          injectedUniversalInit: uni.result?.injectedIntoIndexHtml ?? false,
          overlayInjected: overlay.patch?.injectedOverlay ?? false,
          netlifyDeployId: netlify.deployId,
        },
      });
    }

    return json(false, { error: `Unsupported Content-Type: ${ct || "missing"}` }, 415);
  } catch (err: any) {
    console.error("PUBLISH ERROR", err);
    return json(false, { error: err?.message || "Publish failed" }, 500);
  }
}