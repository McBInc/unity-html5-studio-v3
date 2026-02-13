"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type BuildPayload = {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;

  scannedAt: string | null;
  quickScore: number | null;
  brotliPresent: boolean | null;
  gzipPresent: boolean | null;

  scanResult: any | null;

  project: { id: string; name: string } | null;
  launchProfile: any | null;
  fixPacks: Array<{
    id: string;
    createdAt: string;
    hostProvider: string;
    destinationPlatform: string | null;
    version: string;
  }>;
};

export default function BuildDetailsPage({ params }: { params: { id: string } }) {
  const EMAIL_KEY = "unity_html5_email_v1";

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [build, setBuild] = useState<BuildPayload | null>(null);

  // Load saved email (soft auth)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(EMAIL_KEY) || "";
      if (saved) setEmail(saved);
    } catch {
      // ignore
    }
  }, []);

  // Save email when edited
  useEffect(() => {
    try {
      if (email) localStorage.setItem(EMAIL_KEY, email);
    } catch {
      // ignore
    }
  }, [email]);

  async function loadBuild() {
    const e = (email || "").trim().toLowerCase();
    if (!e || !e.includes("@")) {
      setErr("Enter the same email you used on the scan page (until sign-in is added).");
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(`/api/build/${encodeURIComponent(params.id)}?email=${encodeURIComponent(e)}`);
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load build");
      }

      setBuild(json.build as BuildPayload);
    } catch (e: any) {
      setBuild(null);
      setErr(e?.message || "Failed to load build");
    } finally {
      setLoading(false);
    }
  }

  // Auto-load when email is available
  useEffect(() => {
    if (!email || !email.includes("@")) return;
    loadBuild();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, params.id]);

  const scan = build?.scanResult;

  const hostingChecks = useMemo(() => {
    const checks = scan?.hosting_checks;
    return Array.isArray(checks) ? checks : [];
  }, [scan]);

  const keyFacts = useMemo(() => {
    return [
      { label: "Score", value: build?.quickScore != null ? `${build.quickScore}/100` : "—" },
      { label: "Brotli", value: build?.brotliPresent ? "Yes" : "No" },
      { label: "Gzip", value: build?.gzipPresent ? "Yes" : "No" },
      { label: "Status", value: build?.status || "—" },
    ];
  }, [build]);

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 28, margin: 0 }}>
            {build?.project?.name || "Build"}{" "}
            <span style={{ opacity: 0.5, fontWeight: 700 }}>/ Details</span>
          </h1>
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
            Build ID: <span style={{ fontFamily: "monospace" }}>{params.id}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Link href="/history" style={ghostLink}>
            ← Back to History
          </Link>
          <Link href="/" style={ghostLink}>
            Run new scan
          </Link>
        </div>
      </div>

      {/* Email gate (soft auth until real auth exists) */}
      <div
        style={{
          marginTop: 14,
          padding: 12,
          border: "1px solid #eee",
          borderRadius: 14,
          background: "#fafafa",
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <input
          type="email"
          placeholder="Email used at checkout"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            minWidth: 280,
          }}
        />

        <button
          onClick={loadBuild}
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #111",
            background: loading ? "#ddd" : "#111",
            color: "#fff",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 900,
          }}
        >
          {loading ? "Loading…" : "Reload"}
        </button>

        {err && <span style={{ color: "crimson" }}>{err}</span>}
      </div>

      {/* Summary */}
      {build && (
        <>
          <div
            style={{
              marginTop: 16,
              padding: 16,
              border: "1px solid #eee",
              borderRadius: 14,
              background: "#fff",
            }}
          >
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {keyFacts.map((k) => (
                <div key={k.label} style={kpiBox}>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{k.label}</div>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>{k.value}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>
              Created: {new Date(build.createdAt).toLocaleString()} · Updated:{" "}
              {new Date(build.updatedAt).toLocaleString()}
            </div>
          </div>

          {/* Next actions */}
          <div
            style={{
              marginTop: 14,
              padding: 16,
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              background: "#fafafa",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 16 }}>Next steps</div>
            <p style={{ marginTop: 8, marginBottom: 0, opacity: 0.85, lineHeight: 1.6, maxWidth: 820 }}>
              This page becomes the “single source of truth” for this build. Next we’ll add the Launch Wizard
              (host + platform + goal) and then generate the Fix Pack only after the wizard confirms what they need.
            </p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
              <button disabled style={primaryBtnDisabled}>
                🚀 Start Launch Wizard (next)
              </button>

              <button disabled style={ghostBtnDisabled}>
                📦 Generate Fix Pack (wizard-gated next)
              </button>
            </div>

            {build.fixPacks?.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                Fix Packs generated: <b>{build.fixPacks.length}</b>
              </div>
            )}
          </div>

          {/* Hosting checks */}
          <div
            style={{
              marginTop: 14,
              padding: 16,
              border: "1px solid #eee",
              borderRadius: 14,
              background: "#fff",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 16 }}>Hosting checks</div>

            {hostingChecks.length === 0 ? (
              <div style={{ marginTop: 10, opacity: 0.75 }}>
                No hosting checks found in scan JSON.
              </div>
            ) : (
              <ul style={{ marginTop: 10, lineHeight: 1.7 }}>
                {hostingChecks.map((c: any, i: number) => (
                  <li key={i}>
                    <b style={{ textTransform: "uppercase", fontSize: 11, opacity: 0.7 }}>
                      {c.severity || "info"}
                    </b>{" "}
                    {c.check || JSON.stringify(c)}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Raw scan JSON */}
          <details
            style={{
              marginTop: 14,
              padding: 14,
              border: "1px solid #eee",
              borderRadius: 14,
              background: "#fff",
            }}
          >
            <summary style={{ cursor: "pointer", fontWeight: 900 }}>
              View raw scan JSON
            </summary>
            <pre
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 12,
                background: "#fafafa",
                border: "1px solid #eee",
                overflowX: "auto",
                fontSize: 12,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {JSON.stringify(scan, null, 2)}
            </pre>
          </details>
        </>
      )}
    </div>
  );
}

const kpiBox: React.CSSProperties = {
  padding: 12,
  border: "1px solid #eee",
  borderRadius: 12,
  minWidth: 160,
  background: "#fafafa",
};

const ghostLink: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "#fff",
  textDecoration: "none",
  fontSize: 13,
  color: "#111",
};

const primaryBtnDisabled: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #111",
  background: "#ddd",
  color: "#666",
  fontWeight: 900,
  cursor: "not-allowed",
};

const ghostBtnDisabled: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "#fff",
  color: "#888",
  fontWeight: 900,
  cursor: "not-allowed",
};
