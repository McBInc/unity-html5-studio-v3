import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// If you later re-enable server-side ZIP scan, uncomment these imports:
// import { scanWebglBuildZip } from "@/lib/scanners/scanWebglBuildZip";

export const runtime = "nodejs";

/**
 * We support TWO request types:
 * 1) JSON body: { email, projectName, scan, ... }
 * 2) multipart/form-data: { zip: File, email, projectName, ... }  (future DFY)
 *
 * Right now you’ll mainly use #1 to avoid 413 payload limits.
 */

// Minimum scan shape we persist (you can expand later)
const ScanSchema = z.object({
  kind: z.literal("webgl_build_scan"),
  quick_score: z.number(),
  compression: z.object({
    brotli_present: z.boolean(),
    gzip_present: z.boolean(),
  }),
  scanned_at: z.string(),
});

// JSON mode body
const JsonBodySchema = z.object({
  email: z.string().email(),
  projectName: z.string().min(1).max(120),
  scan: ScanSchema,

  // Optional: lets you enforce size guidance without uploading ZIP
  buildSizeMB: z.number().min(0).max(50_000).optional(), // up to 50GB
  source: z.enum(["client", "server"]).optional(), // client by default
});

async function upsertUserProject(email: string, projectName: string) {
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });

  const project = await prisma.project.upsert({
    where: {
      userId_name: { userId: user.id, name: projectName },
    },
    update: {},
    create: { userId: user.id, name: projectName },
  });

  return { user, project };
}

async function createBuildAndLaunchProfile(args: {
  userId: string;
  projectId: string;
  scan: z.infer<typeof ScanSchema>;
  buildSizeMB?: number;
  source?: "client" | "server";
}) {
  const { userId, projectId, scan, buildSizeMB, source } = args;

  const build = await prisma.build.create({
    data: {
      userId,
      projectId,
      status: "scanned",

      scannedAt: new Date(scan.scanned_at),
      quickScore: scan.quick_score,
      brotliPresent: scan.compression.brotli_present,
      gzipPresent: scan.compression.gzip_present,

      scanResult: scan,

      // If you later want to store size, add a field to Build model.
      // For now we don’t persist buildSizeMB to keep schema minimal.
    },
  });

  const launchProfile = await prisma.launchProfile.create({
    data: { buildId: build.id },
  });

  return { build, launchProfile };
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";

  // ---------- MODE 1: JSON (Hybrid Now) ----------
  if (contentType.includes("application/json")) {
    try {
      const body = await req.json();
      const parsed = JsonBodySchema.parse(body);

      console.log("[scanbuild] JSON save request", {
        email: parsed.email,
        projectName: parsed.projectName,
        source: parsed.source ?? "client",
        buildSizeMB: parsed.buildSizeMB ?? null,
      });

      const { user, project } = await upsertUserProject(
        parsed.email,
        parsed.projectName
      );

      const { build } = await createBuildAndLaunchProfile({
        userId: user.id,
        projectId: project.id,
        scan: parsed.scan,
        buildSizeMB: parsed.buildSizeMB,
        source: parsed.source ?? "client",
      });

      console.log("[scanbuild] saved build", { buildId: build.id });

      return NextResponse.json({
        success: true,
        mode: "json",
        buildId: build.id,
        projectId: project.id,
      });
    } catch (err: any) {
      console.error("[scanbuild] JSON save failed:", err);
      return NextResponse.json(
        { success: false, error: err?.message || "Failed to save scan" },
        { status: 400 }
      );
    }
  }

  // ---------- MODE 2: multipart/form-data (DFY later) ----------
  // We keep this scaffold for later; it will currently return 415 unless you choose to enable it.
  if (contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      {
        success: false,
        error:
          "ZIP upload scanning is disabled in self-serve mode. Use client-side scan + JSON save.",
      },
      { status: 415 }
    );

    /**
     * If/when you enable server scanning later:
     *
     * const form = await req.formData();
     * const zip = form.get("zip");
     * const email = String(form.get("email") || "");
     * const projectName = String(form.get("projectName") || "Untitled Game");
     * if (!(zip instanceof File)) return NextResponse.json({success:false,error:"Missing zip"}, {status:400});
     *
     * const buf = Buffer.from(await zip.arrayBuffer());
     * const scan = await scanWebglBuildZip(buf); // uses adm-zip internally
     *
     * const { user, project } = await upsertUserProject(email, projectName);
     * const { build } = await createBuildAndLaunchProfile({ userId: user.id, projectId: project.id, scan, source: "server" });
     *
     * return NextResponse.json({ success:true, mode:"zip", buildId: build.id, projectId: project.id, scan });
     */
  }

  // ---------- Unsupported ----------
  return NextResponse.json(
    { success: false, error: "Unsupported Content-Type" },
    { status: 415 }
  );
}
