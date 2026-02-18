// src/app/preflight/page.tsx
"use client";

import React, { useMemo, useState } from "react";
import JSZip from "jszip";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import { generateFixPack, type ScanResponse } from "@/lib/fixpack/generateFixPack";

type HostTarget = "vercel" | "netlify" | "nginx" | "apache" | "generic";

function recommendHost(scan: ScanResponse): { host: HostTarget; reason: string } {
  const br = !!scan.compression?.brotli_present;
  const gz = !!scan.compression?.gzip_present;

  // Simple + honest heuristics (we can refine later with real signals)
  if (br) {
    return {
      host: "netlify",
      reason:
        "Brotli (.br) detected. Netlify (or Nginx) tends to be the quickest path to correct Content-Encoding + headers.",
    };
  }
  if (gz) {
    return {
      host: "vercel",
      reason:
        "Gzip (.gz) detected. Vercel is a good fast default for testing because deploys are simple and repeatable.",
    };
  }
  return {
    host: "generic",
    reason:
      "No pre-compressed assets detected. A generic host is fine for testing—just ensure correct MIME for .wasm + sensible caching.",
  };
}

function quickScoreMeaning(score: number) {
  if (score >= 85) return "Excellent — low risk of common hosting failures.";
  if (score >= 70) return "Good — likely fine, but verify headers + caching.";
  if (score >= 50) return "Medium — hosting pitfalls are likely (MIME/encoding/caching).";
  return "High risk — expect black screens or loader/encoding errors until fixed.";
}

export default function PreflightPage() {
  const { status } = useSession();

  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resp, setResp] = useState<ScanResponse | null>(null);

  const [targetHost, setTargetHost] = useState<HostTarget>("netlify");

  const humanMem = useMemo(() => {
    if (!resp?.memory_settings_detected_bytes?.length) return null;
    return resp.memory_settings_detected_bytes
      .map((b) => `${Math.round(b / 1024 / 1024)} MB`)
      .join(", ");
  }, [resp]);

  const recommendation = useMemo(() => {
  if (!resp || !resp.compression) return null;
  return recommendHost(resp);
}, [resp]);


  const fixPack = useMemo(() => {
    if (!resp) return null;
    return generateFixPack(resp, {
      productName: "Unity → HTML5 Studio",
      website: typeof window !== "undefined" ? window.location.origin : "",
    });
  }, [resp]);

  async function runPreflight() {
    if (!file) return;

    setBusy(true);
    setErr(null);
    setResp(null);

    try {
      const ab = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(ab);

      const entries = Object.values(zip.files).filter((z) => !z.dir);
      const lower = (s: string) => s.toLowerCase();

      const brotli_present = entries.some((e) => lower(e.name).endsWith(".br"));
      const gzip_present = entries.some((e) => lower(e.name).endsWith(".gz"));

      const loaderFiles = entries
        .filter((e) => lower(e.name).endsWith(".js"))
        .filter((e) => lower(e.name).includes("loader"));

      // Memory hints (best effort)
      let memory_settings_detected_bytes: number[] = [];
      for (const lf of loaderFiles.slice(0, 5)) {
        try {
          const text = await zip.file(lf.name)!.async("string");
          const matches = [
            ...text.matchAll(/(TOTAL_MEMORY|totalMemory|memory)\s*[:=]\s*(\d{7,12})/g),
          ];
          for (const m of matches) {
            const n = Number(m[2]);
            if (Number.isFinite(n) && n > 32 * 1024 * 1024 && n < 8 * 1024 * 1024 * 1024) {
              memory_settings_detected_bytes.push(n);
            }
          }
        } catch {
          // ignore
        }
      }
      memory_settings_detected_bytes = Array.from(new Set(memory_settings_detected_bytes)).sort(
        (a, b) => a - b
      );

      const hasSuffix = (name: string, suffixes: string[]) =>
        suffixes.some((s) => lower(name).endsWith(s));

      const hasData = entries.some((e) => hasSuffix(e.name, [".data", ".data.br", ".data.gz"]));
      const hasWasm = entries.some((e) => hasSuffix(e.name, [".wasm", ".wasm.br", ".wasm.gz"]));
      const hasLoader = loaderFiles.length > 0;

      let quick_score = 50;
      if (brotli_present) quick_score += 20;
      if (gzip_present) quick_score += 10;
      if (hasData && hasWasm && hasLoader) quick_score += 15;
      if (!hasWasm) quick_score -= 25;
      if (!hasLoader) quick_score -= 25;
      quick_score = Math.max(0, Math.min(100, quick_score));

      const hosting_checks: { check: string; severity: "info" | "medium" | "high" }[] = [];

      if (brotli_present) {
        hosting_checks.push({
          check:
            "Brotli assets detected (.br). Your host must send Content-Encoding: br for those files.",
          severity: "high",
        });
      }
      if (gzip_present) {
        hosting_checks.push({
          check:
            "Gzip assets detected (.gz). Your host must send Content-Encoding: gzip for those files.",
          severity: "medium",
        });
      }

      hosting_checks.push({
        check: "Ensure .wasm is served with MIME type: application/wasm",
        severity: "high",
      });

      hosting_checks.push({
        check:
          "Set long cache headers for immutable build files (Build/*.data, *.wasm, *.js) to improve load speed.",
        severity: "info",
      });

      const IMPORTANT_SUFFIXES = [
        ".data",
        ".data.br",
        ".data.gz",
        ".wasm",
        ".wasm.br",
        ".wasm.gz",
        ".framework.js",
        ".framework.js.br",
        ".framework.js.gz",
        ".loader.js",
        ".loader.js.br",
        ".loader.js.gz",
        "index.html",
      ];

      const isImportant = (name: string) => {
        const n = lower(name);
        return IMPORTANT_SUFFIXES.some((s) => n.endsWith(s)) || n.includes("build/");
      };

      const targets = [
        ...entries.filter((e) => isImportant(e.name)),
        ...entries.filter((e) => !isImportant(e.name)).slice(0, 25),
      ];
      const uniqTargets = Array.from(new Map(targets.map((t) => [t.name, t])).values());

      const files = await Promise.all(
        uniqTargets.map(async (e) => {
          try {
            const buf = await zip.file(e.name)!.async("arraybuffer");
            return { name: e.name, size_bytes: buf.byteLength, sha256: "local-preflight" };
          } catch {
            return { name: e.name, size_bytes: 0, sha256: "local-preflight" };
          }
        })
      );

      files.sort((a, b) => b.size_bytes - a.size_bytes);

      const scan: ScanResponse = {
        kind: "webgl_build_scan",
        quick_score,
        compression: { brotli_present, gzip_present },
        memory_settings_detected_bytes,
        files,
        hosting_checks,
        scanned_at: new Date().toISOString(),
      };

      setResp(scan);

      // auto-set recommended host selector
      const rec = recommendHost(scan);
      setTargetHost(rec.host);
    } catch (e: any) {
      setErr(e?.message || "Preflight failed");
    } finally {
      setBusy(false);
    }
  }

  function downloadTextFile(filename: string, content: string) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function downloadFixPackZip() {
    if (!fixPack) return;

    // For preflight: allow downloads, but nudge sign-in to save + track usage.
    // (Your gated, counted downloads remain on the main app route.)
    const zip = new JSZip();
    const folder = zip.folder("webgl-fix-pack");
    if (!folder) throw new Error("Could not create zip folder");

    if (targetHost === "vercel") folder.file("vercel.json", fixPack.vercelJson);
    else if (targetHost === "netlify") folder.file("_headers", fixPack.netlifyHeaders);
    else if (targetHost === "nginx") folder.file("nginx.conf", fixPack.nginxConf);
    else if (targetHost === "apache") folder.file(".htaccess", fixPack.htaccess);
    else {
      folder.file("_headers", fixPack.netlifyHeaders);
      folder.file(".htaccess", fixPack.htaccess);
    }

    folder.file("README.md", fixPack.readme);

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "webgl-fix-pack.zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Free WebGL Preflight</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Upload a Unity WebGL ZIP to detect hosting red flags and generate the correct host config.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/landing" className="rounded-xl border px-4 py-2 text-sm font-bold hover:bg-neutral-50">
            ← Back
          </Link>
          <Link href="/" className="rounded-xl border px-4 py-2 text-sm font-bold hover:bg-neutral-50">
            Go to Scan App
          </Link>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".zip"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full max-w-md rounded-xl border p-3 text-sm"
          />

          <button
            onClick={runPreflight}
            disabled={!file || busy}
            className="rounded-xl bg-black px-5 py-3 text-sm font-extrabold text-white disabled:opacity-50"
          >
            {busy ? "Scanning…" : "Run Preflight"}
          </button>

          {err ? <span className="text-sm font-bold text-red-600">{err}</span> : null}
        </div>

        <p className="mt-3 text-xs text-neutral-500">
          Privacy: this preflight runs in your browser. (Use the main Scan App to save history + track deployments.)
        </p>
      </div>

      {resp ? (
        <div className="mt-8 space-y-6">
          <div className="rounded-2xl border bg-white p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div className="text-sm font-extrabold">Results</div>
              <div className="text-xs text-neutral-500">{resp.scanned_at}</div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <Kpi
  title="Quick Score"
  value={`${resp.quick_score}/100`}
  sub={quickScoreMeaning(resp.quick_score)}
/>

<Kpi
  title="Brotli"
  value={resp.compression?.brotli_present ? "Yes" : "No"}
/>

<Kpi
  title="Gzip"
  value={resp.compression?.gzip_present ? "Yes" : "No"}
/>

<Kpi
  title="Memory"
  value={humanMem || "—"}
/>

            </div>

            {recommendation ? (
              <div className="mt-4 rounded-xl border bg-neutral-50 p-4">
                <div className="text-sm font-extrabold">Recommended host: {labelHost(recommendation.host)}</div>
                <div className="mt-1 text-sm text-neutral-700">{recommendation.reason}</div>
              </div>
            ) : null}

            <h3 className="mt-6 text-sm font-extrabold">Hosting checks</h3>
            <ul className="mt-2 space-y-2 text-sm text-neutral-700">
              {resp.hosting_checks?.map((c, i) => (
                <li key={i} className="rounded-xl border bg-white p-3">
                  <span className="mr-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-extrabold">
                    {c.severity.toUpperCase()}
                  </span>
                  {c.check}
                </li>
              ))}
            </ul>
          </div>

          {fixPack ? (
            <div className="rounded-2xl border bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-extrabold">Fix Pack</h3>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-extrabold text-neutral-700">Choose your host</label>
                    <select
                      value={targetHost}
                      onChange={(e) => setTargetHost(e.target.value as HostTarget)}
                      className="rounded-xl border px-3 py-2 text-sm"
                    >
                      <option value="netlify">Netlify</option>
                      <option value="vercel">Vercel</option>
                      <option value="nginx">Nginx</option>
                      <option value="apache">Apache</option>
                      <option value="generic">Generic</option>
                    </select>
                  </div>

                  <button
                    onClick={downloadFixPackZip}
                    className="rounded-xl bg-black px-5 py-3 text-sm font-extrabold text-white"
                  >
                    📦 Download Fix Pack ZIP
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-2">
                <GhostButton onClick={() => downloadTextFile("vercel.json", fixPack.vercelJson)}>
                  Download vercel.json
                </GhostButton>
                <GhostButton onClick={() => downloadTextFile("_headers", fixPack.netlifyHeaders)}>
                  Download _headers
                </GhostButton>
                <GhostButton onClick={() => downloadTextFile("nginx.conf", fixPack.nginxConf)}>
                  Download nginx.conf
                </GhostButton>
                <GhostButton onClick={() => downloadTextFile(".htaccess", fixPack.htaccess)}>
                  Download .htaccess
                </GhostButton>
              </div>

              <div className="mt-6 rounded-xl border bg-neutral-50 p-4">
                {status !== "authenticated" ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-extrabold">Want this saved to your Build History?</div>
                      <div className="text-sm text-neutral-700">
                        Sign in and use the Scan App to store results + track your 3 free deployments.
                      </div>
                    </div>

                    <button
                      onClick={() => signIn(undefined, { callbackUrl: "/" })}
                      className="rounded-xl bg-black px-5 py-3 text-sm font-extrabold text-white"
                    >
                      Sign in →
                    </button>
                  </div>
                ) : (
                  <div className="text-sm text-neutral-700">
                    You’re signed in — use the <Link className="font-extrabold underline" href="/">Scan App</Link> to save history.
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Kpi({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border p-4">
      <div className="text-xs font-extrabold text-neutral-600">{title}</div>
      <div className="mt-1 text-2xl font-extrabold">{value}</div>
      {sub ? <div className="mt-2 text-xs text-neutral-600">{sub}</div> : null}
    </div>
  );
}

function GhostButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-xl border px-4 py-3 text-left text-sm font-bold hover:bg-neutral-50">
      {children}
    </button>
  );
}

function labelHost(h: HostTarget) {
  if (h === "vercel") return "Vercel";
  if (h === "netlify") return "Netlify";
  if (h === "nginx") return "Nginx";
  if (h === "apache") return "Apache";
  return "Generic Web Host";
}
