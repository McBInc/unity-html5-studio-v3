"use client";

import React, { useMemo, useState, useEffect } from "react";
import JSZip from "jszip";
import { generateFixPack, type ScanResponse } from "@/lib/fixpack/generateFixPack";

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resp, setResp] = useState<ScanResponse | null>(null);

  // Temporary identity until Auth.js is added
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

  async function runScan() {
    if (!file) return;

    setBusy(true);
    setErr(null);
    setResp(null);

    try {
      // Until Auth.js is live, we require an email to persist builds
      if (!userEmail || !userEmail.includes("@")) {
        setErr("Please enter the email you used at checkout so we can save your build history.");
        setBusy(false);
        return;
      }

      const fd = new FormData();
      fd.append("zip", file);
      fd.append("email", userEmail);
      fd.append("projectName", projectName || "Untitled Game");

      const res = await fetch("/api/scanbuild", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Scan failed");
      }

      const data = await res.json();

      // Expected shape from server route:
      // { success, projectId, buildId, buildNumber, scan }
      if (!data?.scan) {
        throw new Error("Scan response missing 'scan' payload");
      }

      setResp(data.scan as ScanResponse);
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
      setErr(
        "You’ve used all free Fix Pack ZIP downloads in this browser. (Copy/paste and individual files are still available.)"
      );
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

    // consume one free credit
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
        <br />
        <span style={{ fontSize: 12, opacity: 0.75 }}>
          Your ZIP is uploaded to our server for scanning so we can save your build history.
          (We’ll add sign-in soon so this is seamless.)
        </span>
      </p>

      <JourneySection />

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
          }}
        >
          {busy ? "Scanning…" : "Run Quick Scan"}
        </button>

        <span style={{ fontSize: 12, opacity: 0.75 }}>
          Fix Pack ZIP free downloads remaining (this browser): <b>{remainingFixpacks}</b>
        </span>

        {err && <span style={{ color: "crimson" }}>{err}</span>}
      </div>

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
                <b style={{ textTransform: "uppercase", fontSize: 11, opacity: 0.75 }}>
                  {c.severity}
                </b>{" "}
                {c.check}
              </li>
            ))}
          </ul>

          {/* 👑 Launch CTA */}
          <PostScanLaunchCTA />

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
                  }}
                >
                  📦 Download Fix Pack ZIP
                </button>

                <button
                  onClick={() => downloadTextFile("vercel.json", fixPack.vercelJson)}
                  style={ghostBtn}
                >
                  Download vercel.json
                </button>
                <button
                  onClick={() => downloadTextFile("_headers", fixPack.netlifyHeaders)}
                  style={ghostBtn}
                >
                  Download _headers
                </button>
                <button
                  onClick={() => downloadTextFile("nginx.conf", fixPack.nginxConf)}
                  style={ghostBtn}
                >
                  Download nginx.conf
                </button>
                <button
                  onClick={() => downloadTextFile(".htaccess", fixPack.htaccess)}
                  style={ghostBtn}
                >
                  Download .htaccess
                </button>
              </div>

              <div style={{ marginTop: 14 }}>
                <ConfigBlock
                  title="Vercel (vercel.json)"
                  content={fixPack.vercelJson}
                  onCopy={() => copyToClipboard(fixPack.vercelJson)}
                />
                <ConfigBlock
                  title="Netlify (_headers)"
                  content={fixPack.netlifyHeaders}
                  onCopy={() => copyToClipboard(fixPack.netlifyHeaders)}
                />
                <ConfigBlock
                  title="Nginx (nginx.conf snippet)"
                  content={fixPack.nginxConf}
                  onCopy={() => copyToClipboard(fixPack.nginxConf)}
                />
                <ConfigBlock
                  title="Apache (.htaccess)"
                  content={fixPack.htaccess}
                  onCopy={() => copyToClipboard(fixPack.htaccess)}
                />
                <ConfigBlock
                  title="README.md"
                  content={fixPack.readme}
                  onCopy={() => copyToClipboard(fixPack.readme)}
                />
              </div>
            </div>
          )}

          {/* ✅ Step 1: Verify Your Headers */}
          <div
            style={{
              marginTop: 20,
              padding: 16,
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "#fafafa",
            }}
          >
            <h3 style={{ marginBottom: 8, fontWeight: 700 }}>
              ✅ Step 1: Verify Your Headers (Recommended)
            </h3>

            <p style={{ fontSize: 14, lineHeight: 1.6, maxWidth: 760 }}>
              After deploying with the Fix Pack, confirm your server is sending the correct
              headers. This prevents most Unity WebGL loading errors.
            </p>

            <ol style={{ marginTop: 10, paddingLeft: 20, lineHeight: 1.7 }}>
              <li>Open your deployed game in <b>Chrome</b></li>
              <li>Press <b>F12</b> to open DevTools</li>
              <li>Go to the <b>Network</b> tab</li>
              <li>Reload the page</li>
              <li>
                Click the file ending in <b>.wasm.br</b>, <b>.wasm.gz</b>, or <b>.wasm</b>
              </li>
              <li>Open <b>Headers → Response Headers</b></li>
            </ol>

            <div
              style={{
                marginTop: 12,
                padding: 12,
                background: "#111",
                color: "#fff",
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 6 }}>You should see:</div>
              <div>content-encoding: <b>br</b></div>
              <div>content-type: <b>application/wasm</b></div>
              <div>vary: <b>Accept-Encoding</b></div>
            </div>

            <p style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
              If these headers are wrong, Unity often fails with a black screen or “Unexpected token” errors.
              For <b>.br</b>/<b>.gz</b> files, missing <b>Content-Encoding</b> means the browser can’t decode the file.
              Re-check the generated config for your host and redeploy.
            </p>
          </div>

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
                      <td style={td}>{(f.size_bytes / 1024 / 1024).toFixed(2)} MB</td>
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
        <span style={{ fontWeight: 700 }}>{title}</span>
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
      <div style={{ fontWeight: 800, fontSize: 18 }}>{value}</div>
    </div>
  );
}

function JourneySection() {
  return (
    <div style={{ marginTop: 18, padding: 16, border: "1px solid #eee", borderRadius: 14 }}>
      <h2 style={{ marginTop: 0, marginBottom: 8 }}>From First Build to Real Launch — We’ve Got You</h2>
      <p style={{ opacity: 0.85, lineHeight: 1.6, maxWidth: 820, marginTop: 0 }}>
        Every successful Unity game goes through multiple deployments before it works perfectly online —
        testing, fixing, optimizing, launching, and updating. Unity → HTML5 Studio becomes your deployment system for every release.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginTop: 12 }}>
        <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 800 }}>1) Test your build</div>
          <div style={{ opacity: 0.85, marginTop: 6, lineHeight: 1.5 }}>
            Upload your WebGL export and instantly see if it’s web-ready.
          </div>
        </div>

        <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 800 }}>2) Fix hosting issues</div>
          <div style={{ opacity: 0.85, marginTop: 6, lineHeight: 1.5 }}>
            Get the right config for Vercel, Netlify, Apache, Nginx, and more.
          </div>
        </div>

        <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 800 }}>3) Launch with confidence</div>
          <div style={{ opacity: 0.85, marginTop: 6, lineHeight: 1.5 }}>
            Deploy knowing your game will load correctly for real players.
          </div>
        </div>

        <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 800 }}>4) Grow & update safely</div>
          <div style={{ opacity: 0.85, marginTop: 6, lineHeight: 1.5 }}>
            Use the same workflow for every update — no re-learning, no guessing.
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>
        One system. Every release. <b>The Deployment Launch Kings.</b>
      </div>
    </div>
  );
}

function PostScanLaunchCTA(props: { proPriceText?: string; onGoPro?: () => void }) {
  const proPriceText = props.proPriceText || "$19/month — cancel anytime";

  // Read entitlement from localStorage (set on /success)
  const ent =
    typeof window !== "undefined"
      ? (() => {
          try {
            return JSON.parse(localStorage.getItem("unity_html5_entitlement_v1") || "null") as
              | null
              | { plan?: string; gameName?: string; verifiedAt?: string };
          } catch {
            return null;
          }
        })()
      : null;

  const plan = ent?.plan || "";
  const isPaid = plan === "pro_monthly" || plan === "launch_pass";

  const planLabel =
    plan === "pro_monthly"
      ? "Pro (Subscription)"
      : plan === "launch_pass"
      ? "Launch Pass (Per Game)"
      : null;

  function goToPricing() {
    window.location.href = "/pricing";
  }

  function goToLaunch() {
    window.location.href = "/launch";
  }

  return (
    <div
      style={{
        marginTop: 18,
        padding: 16,
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        background: "#fafafa",
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: 8 }}>👑 Your launch starts here</h3>

      <p style={{ marginTop: 0, opacity: 0.9, lineHeight: 1.6, maxWidth: 820 }}>
        You’ve put real time and heart into this game — late nights, breakthroughs,
        frustration, and wins. Now it becomes an asset: a live, shareable game on the web.
      </p>

      <div
        style={{
          marginTop: 10,
          padding: 12,
          borderRadius: 12,
          border: "1px solid #eee",
          background: "#fff",
        }}
      >
        <div style={{ fontWeight: 800 }}>{isPaid ? "You’re protected for launch" : "Protect your launch"}</div>

        <div style={{ marginTop: 6, opacity: 0.9, lineHeight: 1.6 }}>
          {isPaid ? (
            <>
              Your deployment tools are unlocked. Follow the launch checklist to deploy and
              verify headers so your WebGL build loads cleanly for players.
            </>
          ) : (
            <>
              Most Unity WebGL “it works locally” failures come from hosting configuration.
              Pick the plan that matches your stage: Pro for ongoing iteration, or a Launch Pass
              if you’re close to going live.
            </>
          )}
        </div>

        <ul style={{ marginTop: 10, marginBottom: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>Verified hosting configs (Vercel, Netlify, Apache, Nginx, + more)</li>
          <li>{isPaid ? "Unlimited" : "Unlock"} Deployment Kit downloads (Fix Packs)</li>
          <li>Step-by-step deployment guidance + verification checklist</li>
          <li>Fewer “it worked yesterday” support headaches</li>
        </ul>

        {planLabel && (
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
            ✅ Plan detected: <b>{planLabel}</b>
            {ent?.gameName ? <> — <span style={{ opacity: 0.8 }}>{ent.gameName}</span></> : null}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          marginTop: 12,
        }}
      >
        {isPaid ? (
          <button
            onClick={goToLaunch}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            ✅ You’re covered — go to Launch checklist
          </button>
        ) : (
          <button
            onClick={props.onGoPro ? props.onGoPro : goToPricing}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            🚀 Choose plan & unlock ({proPriceText} or Launch Pass)
          </button>
        )}

        <a href="/pricing" style={ghostBtn}>See pricing</a>
        <a href="/launch" style={ghostBtn}>Launch guide</a>
      </div>

      {!isPaid && (
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
          Not ready? You can continue with the limited free path (manual copy/paste + trial ZIP downloads).
        </div>
      )}
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

const th: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #eee",
  padding: "8px 6px",
  fontSize: 12,
  opacity: 0.8,
};
const td: React.CSSProperties = {
  borderBottom: "1px solid #f3f3f3",
  padding: "8px 6px",
  fontSize: 12,
};
