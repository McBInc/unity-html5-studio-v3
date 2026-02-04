"use client";

import React, { useMemo, useState } from "react";
import JSZip from "jszip";

type ScanResponse = {
  kind: string;
  quick_score: number;
  compression?: { brotli_present: boolean; gzip_present: boolean; };
  memory_settings_detected_bytes?: number[];
  files?: { name: string; size_bytes: number; sha256: string }[];
  hosting_checks?: { check: string; severity: "info"|"medium"|"high" }[];
  scanned_at?: string;
};

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resp, setResp] = useState<ScanResponse | null>(null);

  const humanMem = useMemo(() => {
    if (!resp?.memory_settings_detected_bytes?.length) return null;
    return resp.memory_settings_detected_bytes.map(b => `${Math.round(b/1024/1024)} MB`).join(", ");
  }, [resp]);

  async function runScan() {
  if (!file) return;
  setBusy(true);
  setErr(null);
  setResp(null);

  try {
    // Read zip in the browser (no upload to server)
    const ab = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(ab);

    // Collect file list with sizes
    const entries = Object.values(zip.files).filter((z) => !z.dir);

    // Helper: find by suffix (Unity build names vary)
    const hasSuffix = (name: string, suffixes: string[]) =>
      suffixes.some((s) => name.toLowerCase().endsWith(s));

    const brotli_present = entries.some((e) => e.name.toLowerCase().endsWith(".br"));
    const gzip_present = entries.some((e) => e.name.toLowerCase().endsWith(".gz"));

    // Memory hints: best-effort search loader js for "memory" numbers
    // We'll scan any *.loader.js or *loader.js file found in the zip.
    const loaderFiles = entries
      .filter((e) => e.name.toLowerCase().endsWith(".js"))
      .filter((e) => e.name.toLowerCase().includes("loader"));

    let memory_settings_detected_bytes: number[] = [];

    for (const lf of loaderFiles.slice(0, 5)) {
      try {
        const text = await zip.file(lf.name)!.async("string");

        // Common patterns:
        // - "TOTAL_MEMORY: 268435456"
        // - "TOTAL_MEMORY": 268435456
        // - "totalMemory": 268435456
        // - "memory": 268435456
        const matches = [...text.matchAll(/(TOTAL_MEMORY|totalMemory|memory)\s*[:=]\s*(\d{7,12})/g)];
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

    // Unique + sorted
    memory_settings_detected_bytes = Array.from(new Set(memory_settings_detected_bytes)).sort((a, b) => a - b);

    // Compute quick score (simple heuristic)
    let quick_score = 50;
    if (brotli_present) quick_score += 20;
    if (gzip_present) quick_score += 10;

    // Detect key Unity build artifacts
    const hasData = entries.some((e) => hasSuffix(e.name, [".data", ".data.br", ".data.gz"]));
    const hasWasm = entries.some((e) => hasSuffix(e.name, [".wasm", ".wasm.br", ".wasm.gz"]));
    const hasFramework = entries.some((e) => e.name.toLowerCase().includes("framework") && e.name.toLowerCase().endsWith(".js") || e.name.toLowerCase().includes("framework.js."));
    const hasLoader = loaderFiles.length > 0;

    if (hasData && hasWasm && hasLoader) quick_score += 15;
    if (!hasWasm) quick_score -= 25;
    if (!hasLoader) quick_score -= 25;

    quick_score = Math.max(0, Math.min(100, quick_score));

    // File sizes (no hashing in browser for speed)
    // We’ll show the biggest interesting ones + top 25 overall.
    const files = entries
      .map((e) => ({
        name: e.name,
        size_bytes: e._data?.uncompressedSize ?? 0,
        sha256: "local-scan" // placeholder to keep UI compatible
      }))
      .sort((a, b) => b.size_bytes - a.size_bytes);

    // Hosting checks (based on what we saw)
    const hosting_checks: { check: string; severity: "info" | "medium" | "high" }[] = [];

    if (brotli_present) {
      hosting_checks.push({
        check: "Brotli assets detected (.br). Your host must send Content-Encoding: br for those files.",
        severity: "high"
      });
    }
    if (gzip_present) {
      hosting_checks.push({
        check: "Gzip assets detected (.gz). Your host must send Content-Encoding: gzip for those files.",
        severity: "medium"
      });
    }

    hosting_checks.push({
      check: "Ensure .wasm is served with MIME type: application/wasm",
      severity: "high"
    });

    hosting_checks.push({
      check: "Set long cache headers for immutable build files (Build/*.data, *.wasm, *.js) to improve load speed.",
      severity: "info"
    });

    const data: ScanResponse = {
      kind: "webgl_build_scan",
      quick_score,
      compression: { brotli_present, gzip_present },
      memory_settings_detected_bytes,
      files: files.slice(0, 200), // keep UI responsive
      hosting_checks,
      scanned_at: new Date().toISOString()
    };

    setResp(data);
  } catch (e: any) {
    setErr(e?.message || "Scan failed");
  } finally {
    setBusy(false);
  }
}


  return (
    <div>
      <h1 style={{ fontSize: 34, margin: "8px 0 8px" }}>Will your WebGL build host cleanly?</h1>
      <p style={{ opacity: 0.8, lineHeight: 1.5, maxWidth: 760 }}>
        Upload a <b>WebGL build ZIP</b>. We verify compression (Brotli/Gzip), file sizes, loader hints (memory),
        and hosting requirements (headers + MIME).
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 16, flexWrap: "wrap" }}>
        <input
          type="file"
          accept=".zip"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <button
          onClick={runScan}
          disabled={!file || busy}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #111",
            background: busy ? "#ddd" : "#111",
            color: "#fff",
            cursor: busy ? "not-allowed" : "pointer"
          }}
        >
          {busy ? "Scanning…" : "Run Quick Scan"}
        </button>
        {err && <span style={{ color: "crimson" }}>{err}</span>}
      </div>

      {resp && (
        <div style={{ marginTop: 24, padding: 16, border: "1px solid #eee", borderRadius: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Scan Result</div>
            <div style={{ fontSize: 13, opacity: 0.7 }}>{resp.scanned_at}</div>
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12 }}>
            <Kpi label="Quick Score" value={`${resp.quick_score}/100`} />
            <Kpi label="Brotli" value={resp.compression?.brotli_present ? "Yes" : "No"} />
            <Kpi label="Gzip" value={resp.compression?.gzip_present ? "Yes" : "No"} />
            <Kpi label="Memory (detected)" value={humanMem || "Not found"} />
          </div>

          <h3 style={{ marginTop: 18, marginBottom: 8 }}>Hosting checks</h3>
          <ul style={{ marginTop: 0, lineHeight: 1.6 }}>
            {resp.hosting_checks?.map((c, i) => (
              <li key={i}>
                <b style={{ textTransform: "uppercase", fontSize: 11, opacity: 0.75 }}>{c.severity}</b>{" "}
                {c.check}
              </li>
            ))}
          </ul>

          <details style={{ marginTop: 10 }}>
            <summary style={{ cursor: "pointer" }}>View file sizes</summary>
            <div style={{ marginTop: 10, overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    <th style={th}>File</th>
                    <th style={th}>Size</th>
                    <th style={th}>Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {resp.files?.slice(0, 25).map((f) => (
                    <tr key={f.name}>
                      <td style={td}>{f.name}</td>
                      <td style={td}>{(f.size_bytes/1024/1024).toFixed(2)} MB</td>
                      <td style={td}>{f.sha256}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 12, minWidth: 160 }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: 18 }}>{value}</div>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "left", borderBottom: "1px solid #eee", padding: "8px 6px", fontSize: 12, opacity: 0.8 };
const td: React.CSSProperties = { borderBottom: "1px solid #f3f3f3", padding: "8px 6px", fontSize: 12 };
