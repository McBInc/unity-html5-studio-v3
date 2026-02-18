// src/app/page.tsx
"use client";

import React, { useMemo, useState, useEffect } from "react";
import JSZip from "jszip";
import { generateFixPack, type ScanResponse } from "@/lib/fixpack/generateFixPack";
import { useSession, signIn } from "next-auth/react";

type MePayload =
  | { ok: true; email: string; fixPackUses: number; remainingFreeUses: number; subscriptionActive: boolean }
  | { error: string };

type HostKey = "vercel" | "netlify" | "nginx" | "apache" | "generic";

function recommendHostFromScan(scan: ScanResponse | null): {
  host: HostKey;
  label: string;
  reason: string;
} {
  if (!scan) {
    return { host: "netlify", label: "Netlify", reason: "Reliable default for first-time online testing." };
  }

  if (scan.compression?.brotli_present) {
    return { host: "netlify", label: "Netlify", reason: "Brotli detected — easiest to apply correct headers quickly." };
  }

  if (scan.compression?.gzip_present) {
    return { host: "vercel", label: "Vercel", reason: "Gzip detected — clean default for quick testing links." };
  }

  return { host: "generic", label: "Generic Web Host", reason: "No compression detected — ensure WASM MIME + caching." };
}

function scoreBand(score: number) {
  if (score >= 90) return { label: "Ready for deployment", message: "Low risk of hosting-related failures." };
  if (score >= 75) return { label: "Deployable", message: "Should work — Fix Pack reduces edge-case failures." };
  if (score >= 50) return { label: "Hosting fixes required", message: "High chance of failure without correct headers/MIME." };
  if (score >= 25) return { label: "High deployment risk", message: "Very likely to fail online unless corrected." };
  return { label: "Deployment will fail", message: "Critical WebGL components or assumptions are missing." };
}

function hostLabel(h: HostKey) {
  if (h === "vercel") return "Vercel";
  if (h === "netlify") return "Netlify";
  if (h === "nginx") return "Nginx";
  if (h === "apache") return "Apache";
  return "Generic Web Host";
}

export default function HomePage() {
  const { status } = useSession();

  const [targetHost, setTargetHost] = useState<HostKey>("netlify");

  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resp, setResp] = useState<ScanResponse | null>(null);
  const [savedBuildId, setSavedBuildId] = useState<string | null>(null);

  const PROJECT_KEY = "unity_html5_project_name_v1";
  const [projectName, setProjectName] = useState<string>("Untitled Game");

  const [me, setMe] = useState<MePayload | null>(null);

  useEffect(() => {
    try {
      const savedProject = localStorage.getItem(PROJECT_KEY) || "Untitled Game";
      setProjectName(savedProject);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PROJECT_KEY, projectName || "Untitled Game");
    } catch {
      // ignore
    }
  }, [projectName]);

  async function refreshMe() {
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      const json = (await res.json()) as MePayload;
      setMe(json);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (status === "authenticated") void refreshMe();
    else setMe(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const remainingDeployments = me && "ok" in me && me.ok ? me.remainingFreeUses : null;
  const isFreeLimitReached = remainingDeployments === 0;

  const humanMem = useMemo(() => {
    if (!resp?.memory_settings_detected_bytes?.length) return null;
    return resp.memory_settings_detected_bytes.map((b) => `${Math.round(b / 1024 / 1024)} MB`).join(", ");
  }, [resp]);

  const recommendation = useMemo(() => recommendHostFromScan(resp), [resp]);

  const scoreInfo = useMemo(() => {
    if (!resp) return null;
    const band = scoreBand(resp.quick_score);
    return { score: resp.quick_score, bandLabel: band.label, bandMessage: band.message };
  }, [resp]);

  async function persistScan(scan: ScanResponse) {
    const res = await fetch("/api/scanbuild", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectName: projectName || "Untitled Game",
        scan,
        buildSizeMB: file ? Math.round(file.size / 1024 / 1024) : undefined,
        source: "client",
      }),
    });

    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload?.success) throw new Error(payload?.error || "Failed to save scan");
    if (payload?.buildId) setSavedBuildId(payload.buildId);
  }

  async function runScan() {
    if (!file) return;

    setBusy(true);
    setErr(null);
    setResp(null);
    setSavedBuildId(null);

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

      let memory_settings_detected_bytes: number[] = [];
      for (const lf of loaderFiles.slice(0, 5)) {
        try {
          const text = await zip.file(lf.name)!.async("string");
          const matches = [...text.matchAll(/(TOTAL_MEMORY|totalMemory|memory)\s*[:=]\s*(\d{7,12})/g)];
          for (const m of matches) {
            const n = Number(m[2]);
            if (Number.isFinite(n) && n > 32 * 1024 * 1024 && n < 8 * 1024 * 1024 * 1024) {
              memory_settings_detected_bytes.push(n);
            }
          }
        } catch {}
      }
      memory_settings_detected_bytes = Array.from(new Set(memory_settings_detected_bytes)).sort((a, b) => a - b);

      const hasSuffix = (name: string, suffixes: string[]) => suffixes.some((s) => lower(name).endsWith(s));
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
      if (brotli_present) hosting_checks.push({ check: "Brotli assets detected (.br). Host must send Content-Encoding: br.", severity: "high" });
      if (gzip_present) hosting_checks.push({ check: "Gzip assets detected (.gz). Host must send Content-Encoding: gzip.", severity: "medium" });
      hosting_checks.push({ check: "Ensure .wasm is served with MIME type: application/wasm", severity: "high" });
      hosting_checks.push({ check: "Set long cache headers for immutable build files to improve load speed.", severity: "info" });

      const IMPORTANT_SUFFIXES = [
        ".data", ".data.br", ".data.gz",
        ".wasm", ".wasm.br", ".wasm.gz",
        ".framework.js", ".framework.js.br", ".framework.js.gz",
        ".loader.js", ".loader.js.br", ".loader.js.gz",
        "index.html",
      ];

      const isImportant = (name: string) => {
        const n = lower(name);
        return IMPORTANT_SUFFIXES.some((s) => n.endsWith(s)) || n.includes("build/");
      };

      const targets = [...entries.filter((e) => isImportant(e.name)), ...entries.filter((e) => !isImportant(e.name)).slice(0, 25)];
      const uniqTargets = Array.from(new Map(targets.map((t) => [t.name, t])).values());

      const files = await Promise.all(
        uniqTargets.map(async (e) => {
          try {
            const buf = await zip.file(e.name)!.async("arraybuffer");
            return { name: e.name, size_bytes: buf.byteLength, sha256: "local-scan" };
          } catch {
            return { name: e.name, size_bytes: 0, sha256: "local-scan" };
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

      // auto-select recommended host
      const rec = recommendHostFromScan(scan);
      setTargetHost(rec.host);

      await persistScan(scan);
    } catch (e: any) {
      setErr(e?.message || "Scan failed");
    } finally {
      setBusy(false);
    }
  }

  function getBrand() {
    return { productName: "Unity → HTML5 Studio", website: typeof window !== "undefined" ? window.location.origin : "" };
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
    if (!resp) return;

    const gate = await fetch("/api/fixpacks/use", { method: "POST" });
    const gateJson = await gate.json().catch(() => null);

    if (!gate.ok) {
      const msg = gateJson?.message || gateJson?.error || "You’ve used all 3 free Fix Pack deployments. Subscribe to continue.";
      setErr(msg);
      await refreshMe();
      return;
    }

    await refreshMe();

    const pack = generateFixPack(resp, getBrand());

    const zip = new JSZip();
    const folder = zip.folder("webgl-fix-pack");
    if (!folder) throw new Error("Could not create zip folder");

    if (targetHost === "vercel") folder.file("vercel.json", pack.vercelJson);
    else if (targetHost === "netlify") folder.file("_headers", pack.netlifyHeaders);
    else if (targetHost === "nginx") folder.file("nginx.conf", pack.nginxConf);
    else if (targetHost === "apache") folder.file(".htaccess", pack.htaccess);
    else {
      folder.file("_headers", pack.netlifyHeaders);
      folder.file(".htaccess", pack.htaccess);
    }

    folder.file("README.md", pack.readme);

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

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
  }

  const fixPack = useMemo(() => (resp ? generateFixPack(resp, getBrand()) : null), [resp]);

  // --- Auth gate ---
  if (status === "loading") {
    return (
      <div>
        <h1 style={{ fontSize: 34, margin: "8px 0 8px" }}>Stop WebGL hosting failures — instantly</h1>
        <p style={{ opacity: 0.8 }}>Checking your session…</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div>
        <h1 style={{ fontSize: 34, margin: "8px 0 8px" }}>Stop WebGL hosting failures — instantly</h1>
        <p style={{ opacity: 0.8, lineHeight: 1.5, maxWidth: 760 }}>
          Sign in to scan builds, save history, and unlock your 3 free Fix Pack deployments.
        </p>
        <button
          onClick={() => signIn(undefined, { callbackUrl: "/" })}
          style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "#fff", cursor: "pointer", fontWeight: 900 }}
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 34, margin: "8px 0 8px" }}>Stop WebGL hosting failures — instantly</h1>
      <p style={{ opacity: 0.8, lineHeight: 1.5, maxWidth: 760 }}>
        Upload a <b>Unity WebGL build ZIP</b>. We score deployment readiness and generate a host-ready Fix Pack.
      </p>

      {/* Step 1: Scan */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 16, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Game name (optional)"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", minWidth: 220 }}
        />

        <input type="file" accept=".zip" onChange={(e) => setFile(e.target.files?.[0] || null)} />

        <button
          onClick={runScan}
          disabled={!file || busy}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #111",
            background: busy ? "#ddd" : "#111",
            color: "#fff",
            cursor: busy ? "not-allowed" : "pointer",
            fontWeight: 900,
          }}
        >
          {busy ? "Scanning…" : "Run Quick Scan"}
        </button>

        <span style={{ fontSize: 12, opacity: 0.75 }}>
          Free Fix Pack deployments remaining: <b>{remainingDeployments == null ? "—" : remainingDeployments}</b>
        </span>

        {err && <span style={{ color: "crimson" }}>{err}</span>}
      </div>

      {/* Saved */}
      {savedBuildId && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid #e5e7eb", background: "#fafafa", maxWidth: 760 }}>
          <div style={{ fontWeight: 900 }}>✅ Saved to History</div>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
            Build ID: <span style={{ fontFamily: "monospace" }}>{savedBuildId}</span>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <a href="/history" style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "#fff", fontWeight: 900, textDecoration: "none" }}>
              View in History →
            </a>
          </div>
        </div>
      )}

      {/* Step 2+3: Summary first, details later */}
      {resp && (
        <div style={{ marginTop: 24, padding: 16, border: "1px solid #eee", borderRadius: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>Results</div>
            <div style={{ fontSize: 13, opacity: 0.7 }}>{resp.scanned_at}</div>
          </div>

          {/* Summary Card */}
          {scoreInfo && (
            <div style={{ marginTop: 12, padding: 14, borderRadius: 12, border: "1px solid #eee", background: "#fafafa" }}>
              <div style={{ fontWeight: 900, fontSize: 14 }}>
                Web Readiness Score: {scoreInfo.score}/100 — {scoreInfo.bandLabel}
              </div>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>{scoreInfo.bandMessage}</div>

              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
                <b>Recommended Host:</b> {recommendation.label} — {recommendation.reason}
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 800, opacity: 0.8 }}>Host for Fix Pack</label>
                  <select
                    value={targetHost}
                    onChange={(e) => setTargetHost(e.target.value as HostKey)}
                    style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
                  >
                    <option value="netlify">Netlify</option>
                    <option value="vercel">Vercel</option>
                    <option value="nginx">Nginx</option>
                    <option value="apache">Apache</option>
                    <option value="generic">Generic Web Host</option>
                  </select>
                </div>

                <button
                  onClick={downloadFixPackZip}
                  style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "#fff", cursor: "pointer", fontWeight: 900 }}
                >
                  📦 Download Fix Pack ZIP
                </button>

                {isFreeLimitReached && (
                  <div style={{ padding: 12, borderRadius: 10, border: "1px solid #eee", background: "#fff" }}>
                    <div style={{ fontWeight: 900 }}>Free limit reached</div>
                    <button
                      onClick={() => (window.location.href = "/pricing")}
                      style={{ marginTop: 6, padding: "8px 12px", borderRadius: 8, border: "1px solid #111", background: "#111", color: "#fff", cursor: "pointer", fontWeight: 800 }}
                    >
                      Upgrade — Unlimited Deployments
                    </button>
                  </div>
                )}

                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  Selected host: <b>{hostLabel(targetHost)}</b>
                </div>
              </div>

              <details style={{ marginTop: 10 }}>
                <summary style={{ cursor: "pointer", fontSize: 13, opacity: 0.9 }}>What does this score mean?</summary>
                <div style={{ fontSize: 13, opacity: 0.9, marginTop: 8, lineHeight: 1.5 }}>
                  This score estimates how likely your Unity WebGL build is to load online without hosting errors, based on:
                  <ul style={{ marginTop: 8 }}>
                    <li><b>Compression readiness</b> (Brotli/Gzip requirements)</li>
                    <li><b>Build completeness</b> (loader + wasm + data presence)</li>
                    <li><b>Common failure points</b> (WASM MIME + caching expectations)</li>
                  </ul>
                </div>
              </details>
            </div>
          )}

          {/* Compact KPIs */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12 }}>
            <Kpi label="Brotli" value={resp.compression?.brotli_present ? "Yes" : "No"} />
            <Kpi label="Gzip" value={resp.compression?.gzip_present ? "Yes" : "No"} />
            <Kpi label="Memory (detected)" value={humanMem || "Not found"} />
          </div>

          {/* Details (collapsed) */}
          <details style={{ marginTop: 16 }}>
            <summary style={{ cursor: "pointer", fontWeight: 900 }}>Hosting checks</summary>
            <ul style={{ marginTop: 10, lineHeight: 1.6 }}>
              {resp.hosting_checks?.map((c, i) => (
                <li key={i}>
                  <b style={{ textTransform: "uppercase", fontSize: 11, opacity: 0.75 }}>{c.severity}</b>{" "}
                  {c.check}
                </li>
              ))}
            </ul>
          </details>

          {/* Config (show ONLY selected host by default) */}
          {fixPack && (
            <details style={{ marginTop: 12 }} open>
              <summary style={{ cursor: "pointer", fontWeight: 900 }}>Fix Pack files for {hostLabel(targetHost)}</summary>

              <div style={{ marginTop: 12 }}>
                {targetHost === "vercel" && (
                  <ConfigBlock title="Vercel (vercel.json)" content={fixPack.vercelJson} onCopy={() => copyToClipboard(fixPack.vercelJson)} />
                )}
                {targetHost === "netlify" && (
                  <ConfigBlock title="Netlify (_headers)" content={fixPack.netlifyHeaders} onCopy={() => copyToClipboard(fixPack.netlifyHeaders)} />
                )}
                {targetHost === "nginx" && (
                  <ConfigBlock title="Nginx (nginx.conf snippet)" content={fixPack.nginxConf} onCopy={() => copyToClipboard(fixPack.nginxConf)} />
                )}
                {targetHost === "apache" && (
                  <ConfigBlock title="Apache (.htaccess)" content={fixPack.htaccess} onCopy={() => copyToClipboard(fixPack.htaccess)} />
                )}
                {targetHost === "generic" && (
                  <>
                    <ConfigBlock title="Generic (_headers)" content={fixPack.netlifyHeaders} onCopy={() => copyToClipboard(fixPack.netlifyHeaders)} />
                    <ConfigBlock title="Generic (.htaccess)" content={fixPack.htaccess} onCopy={() => copyToClipboard(fixPack.htaccess)} />
                  </>
                )}

                <ConfigBlock title="README.md" content={fixPack.readme} onCopy={() => copyToClipboard(fixPack.readme)} />

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                  {targetHost === "vercel" && (
                    <button onClick={() => downloadTextFile("vercel.json", fixPack.vercelJson)} style={ghostBtn}>Download vercel.json</button>
                  )}
                  {targetHost === "netlify" && (
                    <button onClick={() => downloadTextFile("_headers", fixPack.netlifyHeaders)} style={ghostBtn}>Download _headers</button>
                  )}
                  {targetHost === "nginx" && (
                    <button onClick={() => downloadTextFile("nginx.conf", fixPack.nginxConf)} style={ghostBtn}>Download nginx.conf</button>
                  )}
                  {targetHost === "apache" && (
                    <button onClick={() => downloadTextFile(".htaccess", fixPack.htaccess)} style={ghostBtn}>Download .htaccess</button>
                  )}
                </div>

                <details style={{ marginTop: 10 }}>
                  <summary style={{ cursor: "pointer", fontSize: 13, opacity: 0.9 }}>
                    Show configs for other hosts
                  </summary>
                  <div style={{ marginTop: 10 }}>
                    <ConfigBlock title="Vercel (vercel.json)" content={fixPack.vercelJson} onCopy={() => copyToClipboard(fixPack.vercelJson)} />
                    <ConfigBlock title="Netlify (_headers)" content={fixPack.netlifyHeaders} onCopy={() => copyToClipboard(fixPack.netlifyHeaders)} />
                    <ConfigBlock title="Nginx (nginx.conf snippet)" content={fixPack.nginxConf} onCopy={() => copyToClipboard(fixPack.nginxConf)} />
                    <ConfigBlock title="Apache (.htaccess)" content={fixPack.htaccess} onCopy={() => copyToClipboard(fixPack.htaccess)} />
                  </div>
                </details>
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function ConfigBlock({ title, content, onCopy }: { title: string; content: string; onCopy: () => void }) {
  return (
    <details style={{ marginTop: 10, border: "1px solid #eee", borderRadius: 12, padding: 10 }}>
      <summary style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontWeight: 900 }}>{title}</span>
        <button
          onClick={(e) => {
            e.preventDefault();
            onCopy();
          }}
          style={ghostBtn}
        >
          Copy
        </button>
      </summary>
      <pre
        style={{
          marginTop: 10,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          background: "#fafafa",
          borderRadius: 10,
          padding: 12,
          fontSize: 12,
          overflowX: "auto",
        }}
      >
        {content}
      </pre>
    </details>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 12, minWidth: 160 }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <div style={{ fontWeight: 900, fontSize: 18 }}>{value}</div>
    </div>
  );
}

const ghostBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "#fff",
  cursor: "pointer",
  fontSize: 13,
};
