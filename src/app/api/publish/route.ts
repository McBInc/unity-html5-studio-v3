// src/app/api/publish/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

// Your existing injector
import { injectUniversalInitIntoZip } from "@/lib/patchers/injectUniversalInit";

// Your HUD overlay patcher (BASIC tier)
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

function normTarget(v: any): PlatformTarget {
  const raw = String(v ?? "WEB").toUpperCase();
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
  return allowed.has(raw as PlatformTarget) ? (raw as PlatformTarget) : "WEB";
}

function normMode(v: any): PublishMode {
  const raw = String(v ?? "ASSISTED").toUpperCase();
  return raw === "WE_PUBLISH" ? "WE_PUBLISH" : "ASSISTED";
}

function sha256(buf: Buffer) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function loadRepoScript(relPathFromRepoRoot: string): Promise<string> {
  const p = path.join(process.cwd(), relPathFromRepoRoot);
  return fs.readFile(p, "utf8");
}

async function parsePublishRequest(req: NextRequest): Promise<
  | {
      kind: "json";
      action: "request" | "confirm" | "fail";
      certId: string;
      platformTarget: PlatformTarget;
      mode: PublishMode;
      liveUrl?: string;
      provider?: string;
      providerMeta?: any;
      error?: string;
    }
  | {
      kind: "multipart";
      action: "request";
      certId: string;
      platformTarget: PlatformTarget;
      mode: PublishMode;
      provider?: string;
      providerMeta?: any;
      file: File;
    }
> {
  const ct = (req.headers.get("content-type") || "").toLowerCase();

  if (ct.includes("application/json")) {
    const body = await req.json().catch(() => null);
    const action = String(body?.action ?? "request") as any;

    const certId = String(body?.certId ?? "").trim();
    if (!certId) throw new Error("Missing certId");

    return {
      kind: "json",
      action: action === "confirm" || action === "fail" ? action : "request",
      certId,
      platformTarget: normTarget(body?.platformTarget),
      mode: normMode(body?.mode),
      liveUrl: typeof body?.liveUrl === "string" ? body.liveUrl.trim() : undefined,
      provider: typeof body?.provider === "string" ? body.provider.trim() : undefined,
      providerMeta: body?.providerMeta ?? undefined,
      error: typeof body?.error === "string" ? body.error : undefined,
    };
  }

  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();

    const certId = String(form.get("certId") ?? "").trim();
    if (!certId) throw new Error("Missing certId");

    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Missing file (ZIP) in form-data");

    const provider = typeof form.get("provider") === "string" ? String(form.get("provider")).trim() : undefined;
    const providerMetaRaw = typeof form.get("providerMeta") === "string" ? String(form.get("providerMeta")).trim() : "";
    let providerMeta: any = undefined;
    if (providerMetaRaw) {
      try { providerMeta = JSON.parse(providerMetaRaw); } catch { providerMeta = providerMetaRaw; }
    }

    return {
      kind: "multipart",
      action: "request",
      certId,
      platformTarget: normTarget(form.get("platformTarget")),
      mode: normMode(form.get("mode")),
      provider,
      providerMeta,
      file,
    };
  }

  throw new Error(`Unsupported Content-Type for /api/publish: ${ct || "missing"}`);
}

export async function POST(req: NextRequest) {
  try {
    // AUTH
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const email = session.user.email;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    const incoming = await parsePublishRequest(req);

    // Resolve Build by certId (belongs to user)
    const build = await prisma.build.findFirst({
      where: {
        certId: incoming.certId,
        userId: user.id,
      },
      include: {
        project: true,
      },
    });

    if (!build) {
      return NextResponse.json({ ok: false, error: "Build not found for certId" }, { status: 404 });
    }

    // Always persist targeting choice on the Build for reporting
    const platformTarget = incoming.platformTarget;
    const mode = incoming.mode;

    // Create a new PublishJob for audit trail
    const publishJob = await prisma.publishJob.create({
      data: {
        buildId: build.id,
        platformTarget,
        mode,
        provider: (incoming as any).provider ?? null,
        providerMeta: (incoming as any).providerMeta ?? null,
        status: "QUEUED",
      } as any,
    });

    // Action handling for JSON confirm/fail
    if (incoming.kind === "json") {
      if (incoming.action === "confirm") {
        if (!incoming.liveUrl) {
          return NextResponse.json({ ok: false, error: "Missing liveUrl for confirm action" }, { status: 400 });
        }

        // Mark job succeeded + attach liveUrl
        const updatedJob = await prisma.publishJob.update({
          where: { id: publishJob.id },
          data: {
            status: "SUCCEEDED",
            startedAt: new Date(),
            finishedAt: new Date(),
            liveUrl: incoming.liveUrl,
            provider: incoming.provider ?? null,
            providerMeta: incoming.providerMeta ?? null,
          } as any,
        });

        // Update Build liveUrl and publish state
        await prisma.build.update({
          where: { id: build.id },
          data: {
            platformTarget,
            publishStatus: "SUCCEEDED",
            publishedAt: new Date(),
            liveUrl: incoming.liveUrl,
          } as any,
        });

        return NextResponse.json({
          ok: true,
          action: "confirm",
          certId: build.certId,
          publishJobId: updatedJob.id,
          liveUrl: incoming.liveUrl,
          reportUrl: `/report/${build.certId}`,
        });
      }

      if (incoming.action === "fail") {
        const updatedJob = await prisma.publishJob.update({
          where: { id: publishJob.id },
          data: {
            status: "FAILED",
            startedAt: new Date(),
            finishedAt: new Date(),
            error: incoming.error ?? "Publish failed (no details provided)",
          } as any,
        });

        await prisma.build.update({
          where: { id: build.id },
          data: {
            platformTarget,
            publishStatus: "FAILED",
          } as any,
        });

        return NextResponse.json({
          ok: true,
          action: "fail",
          certId: build.certId,
          publishJobId: updatedJob.id,
          reportUrl: `/report/${build.certId}`,
        });
      }

      // Default JSON action=request → ASSISTED job creation
      await prisma.publishJob.update({
        where: { id: publishJob.id },
        data: {
          status: "RUNNING",
          startedAt: new Date(),
          evidence: {
            v: 1,
            note: "ASSISTED publish requested. Provide liveUrl via action=confirm when upload is complete.",
          },
        } as any,
      });

      await prisma.build.update({
        where: { id: build.id },
        data: {
          platformTarget,
          publishStatus: "RUNNING",
        } as any,
      });

      return NextResponse.json({
        ok: true,
        action: "request",
        mode,
        certId: build.certId,
        publishJobId: publishJob.id,
        next: {
          hint: "When upload is completed in the target platform, POST /api/publish with { action:'confirm', certId, platformTarget, mode, liveUrl }",
        },
        reportUrl: `/report/${build.certId}`,
      });
    }

    // Multipart request: WE_PUBLISH flow with ZIP present (but still no ZIP returned)
    const file = incoming.file;
    const zipBuffer = Buffer.from(await file.arrayBuffer());

    // Mark running
    await prisma.publishJob.update({
      where: { id: publishJob.id },
      data: { status: "RUNNING", startedAt: new Date() } as any,
    });

    await prisma.build.update({
      where: { id: build.id },
      data: { platformTarget, publishStatus: "RUNNING" } as any,
    });

    // Load scripts from repo (source of truth)
    const universalInit = await loadRepoScript("src/lib/scripts/universal-init.js");

    // 1) Inject universal-init.js (always for publish builds)
    const uni = await injectUniversalInitIntoZip(zipBuffer, universalInit);

    // 2) Apply HUD overlay if BASIC tier
    let patchedZip = uni.patchedZip;
    let overlayPatch: any = { ok: true, injectedOverlay: false, reason: "Not BASIC tier" };

    if ((build.tier || "BASIC").toUpperCase() === "BASIC") {
      const overlayJs = await loadRepoScript("src/lib/scripts/diagnostic-overlay.js");
      const overlayRes = await applyDiagnosticOverlayPatch(patchedZip, overlayJs, "BASIC");
      patchedZip = overlayRes.patchedZip;
      overlayPatch = overlayRes.patch;
    }

    // Evidence bundle (strongly recommended)
    const evidence = {
      v: 1,
      platformTarget,
      tier: build.tier,
      input: {
        originalName: file.name,
        bytes: zipBuffer.length,
        sha256: sha256(zipBuffer),
      },
      patched: {
        bytes: patchedZip.length,
        sha256: sha256(patchedZip),
        universalInit: uni.result,
        diagnosticOverlay: overlayPatch,
      },
      note:
        "This route does not return a ZIP. Host/upload the patched artifact and confirm with action=confirm + liveUrl.",
    };

    // Persist evidence
    await prisma.publishJob.update({
      where: { id: publishJob.id },
      data: {
        evidence,
        provider: incoming.provider ?? null,
        providerMeta: incoming.providerMeta ?? null,
      } as any,
    });

    await prisma.build.update({
      where: { id: build.id },
      data: {
        platformTarget,
        publishEvidence: evidence,
      } as any,
    });

    // We are NOT returning the zip; we return instructions + job id + report link.
    return NextResponse.json({
      ok: true,
      mode,
      certId: build.certId,
      publishJobId: publishJob.id,
      reportUrl: `/report/${build.certId}`,
      next: {
        hint:
          "Upload the patched build to the target platform/host (or publish it). Then POST /api/publish with action=confirm and liveUrl to finalize the certified live link.",
        confirmPayloadExample: {
          action: "confirm",
          certId: build.certId,
          platformTarget,
          mode,
          liveUrl: "https://your-live-link.example",
          provider: incoming.provider ?? "client_dashboard",
        },
      },
      // Helpful for debugging without sending files
      evidenceSummary: {
        inputSha256: evidence.input.sha256,
        patchedSha256: evidence.patched.sha256,
        universalInitOk: !!evidence.patched.universalInit?.ok,
        overlayInjected: !!evidence.patched.diagnosticOverlay?.injectedOverlay,
      },
    });
  } catch (err: any) {
    const msg = err?.message || "Publish failed";
    console.error("PUBLISH ERROR", err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}