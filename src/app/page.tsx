"use client";

import React, { useMemo, useState, useEffect } from "react";
import JSZip from "jszip";
import { generateFixPack, type ScanResponse } from "@/lib/fixpack/generateFixPack";

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resp, setResp] = useState<ScanResponse | null>(null);

  // polish: confirmation that scan was saved
  const [savedBuildId, setSavedBuildId] = useState<string | null>(null);

  // Temporary identity until Auth is added
  const EMAIL_KEY = "unity_html5_email_v1";
  const [userEmail, setUserEmail] = useState<string>("");

  // Optional: project name until you have Projects UI
  const PROJECT_KEY = "unity_html5_project_name_v1";
  const [projectName, setProjectName] = useState<string>("Untitled Game");

  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem(EMAIL_KEY) || "";
      const savedProject = localStorage.getItem(PROJECT_KEY) || "Untitled Game";
      setUserEmail(savedEmail);
      setProjectName(savedProject);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(EMAIL_KEY, userEmail || "");
    } catch {
      // ignore
    }
  }, [userEmail]);

  useEffect(() => {
    try {
      localStorage.setItem(PROJECT_KEY, projectName || "Untitled Game");
    } catch {
      // ignore
    }
  }, [projectName]);

  // Usage-based free fix packs (3 free ZIP downloads, stored locally for now)
  const FREE_FIXPACKS = 3;
  const FIXPACK_KEY = "unity_html5_free_fixpacks_used_v1";
  const usedFixpacks =
    typeof window !== "undefined"
      ? Number(window.localStorage.getItem(FIXPACK_KEY) || "0")
      : 0;
  const remainingFixpacks = Math.max(0, FREE_FIXPACKS - usedFixpacks);

  const humanMem = useMemo(() => {
    if (!resp?.memory_settings_detected_bytes?.length) return null;
    return resp.memory_settings_detected_bytes
      .map((b) => `${Math.round(b / 1024 / 1024)} MB`)
      .join(", ");
  }, [resp]);

  async function persistScan(scan: ScanResponse) {
    const email = (userEmail || "").trim();
    if (!email || !email.includes("@")) {
      throw new Error("Please enter the email you used at checkout so we can save your build history.");
    }

    const res = await fetch("/api/scanbuild", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        projectName: projectName || "Untitled Game",
        scan,
        buildSizeMB: file ? Math.round(file.size / 1024 / 1024) : undefined,
        source: "client",
      }),
    });

    const payload = await res.json().catch(() => null);

    if (!res.ok || !payload?.success) {
      throw new Error(payload?.error || "Failed to save scan");
    }

    if (payload?.buildId) {
      setSavedBuildId(payload.buildId);
    }
  }

  async function runScan() {
    if (!file) return;

    setBusy(true);
    setErr(null);
    setResp(null);
    setSavedBuildId(null);

    try {
      // ---- CLIENT-SIDE SCAN (cheap, fast) ----
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
            ...text.matchAll(
              /(TOTAL_MEMORY|totalMemory|memory)\s*[:=]\s*(\d{7,12})/g
            ),
          ];
          for (const m of matches) {
            const n = Number(m[2]);
            if (
              Number.isFinite(n) &&
              n > 32 * 1024 * 1024 &&
              n < 8 * 1024 * 1024 * 1024
            ) {
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

      const hasData = entries.some((e) =>
        hasSuffix(e.name, [".data", ".data.br", ".data.gz"])
      );
      const hasWasm = entries.some((e) =>
        hasSuffix(e.name, [".wasm", ".wasm.br", ".wasm.gz"])
      );
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
          check: "Brotli assets detected (.br). Your host must send Content-Encoding: br for those files.",
          severity: "high",
        });
      }
      if (gzip_present) {
        hosting_checks.push({
          check: "Gzip assets detected (.gz). Your host must send Content-Encoding: gzip for those files.",
          severity: "medium",
        });
      }

      hosting_checks.push({
        check: "Ensure .wasm is served with MIME type: application/wasm",
        severity: "high",
      });

      hosting_checks.push({
        check: "Set long cache headers for immutable build files (Build/*.data, *.wasm, *.js) to improve load speed.",
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

      // Show results immediately
      setResp(scan);

      // ---- PERSIST TO DB (polish + history) ----
      await persistScan(scan);
    } catch (e: any) {
      setErr(e?.message || "Scan failed");
    } finally {
      setBusy(false);
    }
  }

  function getBrand() {
    return {
      productName: "Unity → HTML5 Studio",
      website: typeof window !== "undefined" ? window.location.origin : "",
    };
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

    if (remainingFixpacks <= 0) {
      setErr("You’ve used all free Fix Pack ZIP downloads in this browser. (Copy/paste and individual files are still available.)");
      return;
    }

    const brand = getBrand();
    const pack = generateFixPack(resp, brand);

    const zip = new JSZip();
    const folder = zip.folder("webgl-fix-pack");
    if (!folder) throw new Error("Could not create zip folder");

    folder.file("vercel.json", pack.vercelJson);
    folder.file("_headers", pack.netlifyHeaders);
    folder.file("nginx.conf", pack.nginxConf);
    folder.file(".htaccess", pack.htaccess);
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

    const nextUsed = usedFixpacks + 1;
    window.localStorage.setItem(FIXPACK_KEY, String(nextUsed));
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
  }

  const fixPack = useMemo(() => {
    if (!resp) return null;
    return generateFixPack(resp, getBrand());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resp]);

  return (
    <div>
      <h1 style={{ fontSize: 34, margin: "8px 0 8px" }}>
        Stop WebGL hosting failures — instantly
      </h1>

      <p style={{ opacity: 0.8, lineHeight: 1.5, maxWidth: 760 }}>
        Upload a <b>Unity WebGL build ZIP</b>. We verify compression (Brotli/Gzip),
        file sizes, loader hints (memory), and hosting requirements (headers + MIME).
      </p>

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginTop: 16,
          flexWrap: "wrap",
        }}
      >
        <input
          type="email"
          placeholder="Email used at checkout (to save history)"
          value={userEmail}
          onChange={(e) => setUserEmail(e.target.value)}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            minWidth: 280,
          }}
        />

        <input
          type="text"
          placeholder="Game name (optional)"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            minWidth: 220,
          }}
        />

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
            cursor: busy ? "not-allowed" : "pointer",
            fontWeight: 900,
          }}
        >
          {busy ? "Scanning…" : "Run Quick Scan"}
        </button>

        <span style={{ fontSize: 12, opacity: 0.75 }}>
          Fix Pack ZIP free downloads remaining (this browser): <b>{remainingFixpacks}</b>
        </span>

        {err && <span style={{ color: "crimson" }}>{err}</span>}
      </div>

      {/* ✅ Polish: show "Saved ✓" after successful persist */}
      {savedBuildId && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: "#fafafa",
            maxWidth: 760,
          }}
        >
          <div style={{ fontWeight: 900 }}>✅ Saved to History</div>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
            Build ID: <span style={{ fontFamily: "monospace" }}>{savedBuildId}</span>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <a
              href="/history"
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #111",
                background: "#111",
                color: "#fff",
                fontWeight: 900,
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              View in History →
            </a>

            <span style={{ fontSize: 12, opacity: 0.75, alignSelf: "center" }}>
              (Uses the same email until sign-in is added.)
            </span>
          </div>
        </div>
      )}

      {resp && (
        <div
          style={{
            marginTop: 24,
            padding: 16,
            border: "1px solid #eee",
            borderRadius: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 16 }}>Scan Result</div>
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
                <b style={{ textTransform: "uppercase", fontSize: 11, opacity: 0.75 }}>
                  {c.severity}
                </b>{" "}
                {c.check}
              </li>
            ))}
          </ul>

          {fixPack && (
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid #eee" }}>
              <h3 style={{ marginTop: 0 }}>Fix Pack</h3>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  onClick={downloadFixPackZip}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid #111",
                    background: "#111",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  📦 Download Fix Pack ZIP
                </button>

                <button onClick={() => downloadTextFile("vercel.json", fixPack.vercelJson)} style={ghostBtn}>
                  Download vercel.json
                </button>
                <button onClick={() => downloadTextFile("_headers", fixPack.netlifyHeaders)} style={ghostBtn}>
                  Download _headers
                </button>
                <button onClick={() => downloadTextFile("nginx.conf", fixPack.nginxConf)} style={ghostBtn}>
                  Download nginx.conf
                </button>
                <button onClick={() => downloadTextFile(".htaccess", fixPack.htaccess)} style={ghostBtn}>
                  Download .htaccess
                </button>
              </div>

              <div style={{ marginTop: 14 }}>
                <ConfigBlock title="Vercel (vercel.json)" content={fixPack.vercelJson} onCopy={() => copyToClipboard(fixPack.vercelJson)} />
                <ConfigBlock title="Netlify (_headers)" content={fixPack.netlifyHeaders} onCopy={() => copyToClipboard(fixPack.netlifyHeaders)} />
                <ConfigBlock title="Nginx (nginx.conf snippet)" content={fixPack.nginxConf} onCopy={() => copyToClipboard(fixPack.nginxConf)} />
                <ConfigBlock title="Apache (.htaccess)" content={fixPack.htaccess} onCopy={() => copyToClipboard(fixPack.htaccess)} />
                <ConfigBlock title="README.md" content={fixPack.readme} onCopy={() => copyToClipboard(fixPack.readme)} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ConfigBlock({
  title,
  content,
  onCopy,
}: {
  title: string;
  content: string;
  onCopy: () => void;
}) {
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
