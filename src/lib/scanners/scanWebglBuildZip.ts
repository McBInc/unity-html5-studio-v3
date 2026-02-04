import crypto from "crypto";
import path from "path";
import os from "os";
import fs from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import { z } from "zod";

const execFileAsync = promisify(execFile);

/**
 * Note: To keep this scaffold dependency-light, we use the system `unzip` binary.
 * In production, you might swap this for a JS zip library.
 */
export async function scanWebglBuildZip(zipBuffer: Buffer) {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "webgl-build-"));
  const zipPath = path.join(tmpRoot, "build.zip");
  await fs.writeFile(zipPath, zipBuffer);

  // unzip to tmpRoot/out
  const outDir = path.join(tmpRoot, "out");
  await fs.mkdir(outDir);
  await execFileAsync("unzip", ["-qq", zipPath, "-d", outDir]);

  const buildDir = await findBuildDir(outDir);
  if (!buildDir) throw new Error("Could not locate a Unity WebGL Build folder (missing .data/.wasm).");

  const entries = await fs.readdir(buildDir);
  const files: { name: string; size_bytes: number; sha256: string }[] = [];
  for (const name of entries) {
    const full = path.join(buildDir, name);
    const st = await fs.stat(full);
    if (!st.isFile()) continue;
    const data = await fs.readFile(full);
    files.push({
      name,
      size_bytes: st.size,
      sha256: crypto.createHash("sha256").update(data).digest("hex").slice(0, 16),
    });
  }
  files.sort((a, b) => b.size_bytes - a.size_bytes);

  const brotli = files.some((f) => f.name.endsWith(".br"));
  const gzip = files.some((f) => f.name.endsWith(".gz"));

  const loader = files.find((f) => f.name.toLowerCase().endsWith(".loader.js"));
  const memValues = loader ? await extractMemoryHints(path.join(buildDir, loader.name)) : [];

  const report = {
    kind: "webgl_build_scan",
    scanned_at: new Date().toISOString(),
    build_dir: buildDir,
    quick_score: brotli ? 85 : 60,
    compression: {
      brotli_present: brotli,
      gzip_present: gzip,
      notes: "Detected by .br/.gz artifacts in the Build folder."
    },
    memory_settings_detected_bytes: memValues.slice(0, 6),
    hosting_checks: [
      { check: "Serve .br assets with Content-Encoding: br", severity: brotli ? "high" : "info" as const },
      { check: "Serve .wasm with MIME type application/wasm", severity: "high" as const },
      { check: "Ensure HTTPS + correct cache headers for immutable build assets", severity: "medium" as const }
    ],
    files
  };

  return BuildScanSchema.parse(report);
}

const BuildScanSchema = z.object({
  kind: z.literal("webgl_build_scan"),
  scanned_at: z.string(),
  build_dir: z.string(),
  quick_score: z.number().int().min(0).max(100),
  compression: z.object({
    brotli_present: z.boolean(),
    gzip_present: z.boolean(),
    notes: z.string()
  }),
  memory_settings_detected_bytes: z.array(z.number().int()).optional(),
  hosting_checks: z.array(z.object({
    check: z.string(),
    severity: z.enum(["info","medium","high"])
  })),
  files: z.array(z.object({
    name: z.string(),
    size_bytes: z.number().int(),
    sha256: z.string()
  }))
});

async function findBuildDir(root: string) {
  // Look for folders named "Build" containing wasm/data artifacts
  const stack: string[] = [root];
  while (stack.length) {
    const cur = stack.pop()!;
    const entries = await fs.readdir(cur, { withFileTypes: true });
    const files = entries.filter(e => e.isFile()).map(e => e.name);
    const hasData = files.some(n => n.endsWith(".data") || n.endsWith(".data.br") || n.endsWith(".data.gz"));
    const hasWasm = files.some(n => n.endsWith(".wasm") || n.endsWith(".wasm.br") || n.endsWith(".wasm.gz"));
    if (path.basename(cur).toLowerCase() === "build" && hasData && hasWasm) return cur;
    for (const e of entries) {
      if (e.isDirectory()) stack.push(path.join(cur, e.name));
    }
  }
  return null;
}

async function extractMemoryHints(loaderPath: string) {
  const txt = await fs.readFile(loaderPath, "utf-8");
  const patterns = [
    /TOTAL_MEMORY\s*[:=]\s*(\d+)/g,
    /INITIAL_MEMORY\s*[:=]\s*(\d+)/g,
    /memory\s*[:=]\s*(\d+)/g
  ];
  const found = new Set<number>();
  for (const pat of patterns) {
    let m: RegExpExecArray | null;
    while ((m = pat.exec(txt))) {
      const v = parseInt(m[1], 10);
      if (Number.isFinite(v)) found.add(v);
    }
  }
  return Array.from(found).sort((a, b) => a - b);
}
