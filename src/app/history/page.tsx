"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type HistoryBuild = {
  id: string;
  createdAt: string;
  scannedAt: string | null;
  status: string;
  project: { id: string; name: string } | null;
  quickScore: number | null;
  brotliPresent: boolean | null;
  gzipPresent: boolean | null;
  hasLaunchProfile: boolean;
  fixPackCount: number;
  scanResult: any | null;
};

type HistoryResponse = {
  success: boolean;
  user: { id: string; email: string; createdAt: string } | null;
  builds: HistoryBuild[];
  error?: string;
};

export default function HistoryPage() {
  const EMAIL_KEY = "unity_html5_email_v1";

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<HistoryResponse | null>(null);

  // Prevent repeated auto-load loops
  const lastLoadedEmailRef = useRef<string>("");

  const builds = data?.builds || [];
  const hasValidEmail = email.includes("@");

  // Load saved email on first render
  useEffect(() => {
    try {
      const saved = localStorage.getItem(EMAIL_KEY) || "";
      if (saved) setEmail(saved);
    } catch {
      // ignore
    }
  }, []);

  // Persist email as user types
  useEffect(() => {
    try {
      localStorage.setItem(EMAIL_KEY, email || "");
    } catch {
      // ignore
    }
  }, [email]);

  async function loadHistory(forEmail?: string) {
    const targetEmail = (forEmail ?? email).trim();

    setErr(null);

    if (!targetEmail || !targetEmail.includes("@")) {
      setData(null);
      setErr("Enter the email you used at checkout.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/history?email=${encodeURIComponent(targetEmail)}`, {
        method: "GET",
      });

      const json = (await res.json()) as HistoryResponse;

      if (!res.ok || !json.success) {
        throw new Error(json?.error || "Failed to load history");
      }

      setData(json);
      lastLoadedEmailRef.current = targetEmail;
    } catch (e: any) {
      setData(null);
      setErr(e?.message || "Failed to load history");
    } finally {
      setLoading(false);
    }
  }

  // Auto-load whenever we have a valid email that we haven’t loaded yet
  useEffect(() => {
    if (!hasValidEmail) return;
    if (loading) return;

    const normalized = email.trim().toLowerCase();
    if (!normalized) return;

    if (lastLoadedEmailRef.current.toLowerCase() === normalized) return;

    loadHistory(normalized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const summary = useMemo(() => {
    if (!data?.success) return null;

    if (!data.user) {
      return {
        title: "No account found for this email",
        subtitle: "If you just ran a scan, go back and run it again with the same email.",
      };
    }

    return {
      title: data.user.email,
      subtitle: `${builds.length} build(s) found`,
    };
  }, [data, builds.length]);

  const showEmptyState =
    !loading &&
    !err &&
    data?.success &&
    (data.builds?.length ?? 0) === 0;

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ fontSize: 28, margin: "0 0 6px" }}>Build History</h1>
      <p style={{ margin: 0, opacity: 0.8, lineHeight: 1.5 }}>
        Your saved scans — score, compression flags, and the raw scan JSON.
      </p>

      <div
        style={{
          marginTop: 16,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          padding: 12,
          border: "1px solid #eee",
          borderRadius: 14,
          background: "#fafafa",
        }}
      >
        <input
          type="email"
          value={email}
          placeholder="Email used at checkout"
          onChange={(e) => setEmail(e.target.value)}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            minWidth: 280,
          }}
        />

        <button
          onClick={() => loadHistory()}
          disabled={loading || !hasValidEmail}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #111",
            background: loading || !hasValidEmail ? "#ddd" : "#111",
            color: "#fff",
            cursor: loading || !hasValidEmail ? "not-allowed" : "pointer",
            fontWeight: 800,
          }}
          title={!hasValidEmail ? "Enter a valid email to load history" : "Load history"}
        >
          {loading ? "Loading…" : "Load history"}
        </button>

        <a
          href="/"
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#fff",
            textDecoration: "none",
            fontSize: 13,
            color: "#111",
          }}
        >
          ← Back to scan
        </a>

        {err && <span style={{ color: "crimson" }}>{err}</span>}

        {!err && loading && (
          <span style={{ fontSize: 12, opacity: 0.75 }}>Fetching your saved builds…</span>
        )}
      </div>

      {summary && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 900 }}>{summary.title}</div>
          <div style={{ fontSize: 13, opacity: 0.75 }}>{summary.subtitle}</div>
        </div>
      )}

      {/* Friendly empty state */}
      {showEmptyState && (
        <div
          style={{
            marginTop: 18,
            padding: 18,
            borderRadius: 16,
            border: "1px solid #eee",
            background: "#fff",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 900 }}>No saved builds yet</div>
          <p style={{ marginTop: 8, marginBottom: 0, lineHeight: 1.6, opacity: 0.85, maxWidth: 760 }}>
            Run your first scan and we’ll save it automatically so you can return later, repeat the process,
            and keep a record of your deployment journey.
          </p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            <a
              href="/"
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
              ✅ Run a scan now
            </a>

            <button
              onClick={() => loadHistory()}
              disabled={!hasValidEmail || loading}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "#fff",
                cursor: !hasValidEmail || loading ? "not-allowed" : "pointer",
                fontWeight: 800,
              }}
              title={!hasValidEmail ? "Enter a valid email above" : "Try loading again"}
            >
              Try again
            </button>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
            Tip: make sure you use the same email on the scan page — that’s how we link builds until sign-in is added.
          </div>
        </div>
      )}

      {/* Builds list */}
      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {builds.map((b) => (
          <div
            key={b.id}
            style={{
              padding: 14,
              border: "1px solid #eee",
              borderRadius: 14,
              background: "#fff",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>
                  {b.project?.name || "Untitled Game"}
                </div>
                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                  Build ID: <span style={{ fontFamily: "monospace" }}>{b.id}</span>
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 900 }}>
                  Score: {b.quickScore ?? "—"}
                </div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  {new Date(b.createdAt).toLocaleString()}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
              <Badge label="Status" value={b.status} />
              <Badge label="Brotli" value={b.brotliPresent ? "Yes" : "No"} />
              <Badge label="Gzip" value={b.gzipPresent ? "Yes" : "No"} />
              <Badge label="LaunchProfile" value={b.hasLaunchProfile ? "Yes" : "No"} />
              <Badge label="FixPacks" value={String(b.fixPackCount)} />
            </div>

            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: "pointer", fontWeight: 900 }}>
                View scan JSON
              </summary>
              <pre
                style={{
                  marginTop: 10,
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
                {JSON.stringify(b.scanResult, null, 2)}
              </pre>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "8px 10px",
        borderRadius: 999,
        border: "1px solid #eee",
        background: "#fafafa",
        fontSize: 12,
      }}
    >
      <span style={{ opacity: 0.7 }}>{label}:</span>{" "}
      <b>{value}</b>
    </div>
  );
}
