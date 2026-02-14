"use client";

import React, { useEffect, useMemo, useState } from "react";

type ApiOk = {
  success: true;
  build: {
    id: string;
    scannedAt: string;
    quickScore: number;
    brotliPresent: boolean;
    gzipPresent: boolean;
    scanResult: any;
    project?: { id: string; name: string } | null;
    launchProfile?: any;
    fixPacks?: any[];
  };
};

type ApiErr = { success: false; error: string; debug?: any };

export default function BuildDetailsPage() {
  // ✅ Read buildId from the URL path (most reliable in client components)
  const [buildId, setBuildId] = useState<string>("");

  useEffect(() => {
    try {
      const path = window.location.pathname; // e.g. /build/<id>
      const parts = path.split("/").filter(Boolean);
      const id = parts.length >= 2 && parts[0] === "build" ? parts[1] : "";
      setBuildId(id);
    } catch {
      setBuildId("");
    }
  }, []);

  const EMAIL_KEY = "unity_html5_email_v1";

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ApiOk | null>(null);

  // Auto-fill from localStorage
  useEffect(() => {
    try {
      const saved = (localStorage.getItem(EMAIL_KEY) || "").trim();
      if (saved) setEmail(saved);
    } catch {
      // ignore
    }
  }, []);

  // Persist edits
  useEffect(() => {
    try {
      localStorage.setItem(EMAIL_KEY, email || "");
    } catch {
      // ignore
    }
  }, [email]);

  const apiUrl = useMemo(() => {
    const e = (email || "").trim().toLowerCase();
    if (!buildId) return "";
    return `/api/build/${encodeURIComponent(buildId)}?email=${encodeURIComponent(e)}`;
  }, [buildId, email]);

  async function load() {
    const e = (email || "").trim().toLowerCase();
    setErr(null);
    setData(null);

    if (!buildId) {
      setErr("Missing build id in URL.");
      return;
    }

    if (!e || !e.includes("@")) {
      setErr("Please enter the email you used at checkout.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(apiUrl, { method: "GET" });
      const text = await res.text();

      let json: ApiOk | ApiErr | null = null;
      try {
        json = text ? (JSON.parse(text) as any) : null;
      } catch {
        // not JSON
      }

      if (!res.ok) {
        if (json && "error" in json) throw new Error(json.error);
        throw new Error(
          `Request failed (${res.status}). URL: ${apiUrl}\nResponse: ${text?.slice(0, 200) || "(empty)"}`
        );
      }

      if (!json || !("success" in json) || json.success !== true) {
        throw new Error("Unexpected response from server.");
      }

      setData(json as ApiOk);
    } catch (e: any) {
      setErr(e?.message || "Failed to load build");
    } finally {
      setBusy(false);
    }
  }

  // Auto-load when buildId becomes available and email is present
  useEffect(() => {
    const e = (email || "").trim().toLowerCase();
    if (buildId && e && e.includes("@")) {
      load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }
  }, [buildId]);

  function goHistory() {
    window.location.href = "/history";
  }

  function goScan() {
    window.location.href = "/";
  }

  return (
    <div style={{ padding: 18, maxWidth: 980, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: "8px 0" }}>Build / <span style={{ opacity: 0.55 }}>Details</span></h1>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Build ID: {buildId || "(loading…)"}</div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={goHistory} style={btnGhost}>← Back to History</button>
          <button onClick={goScan} style={btnGhost}>Run new scan</button>
        </div>
      </div>

      <div style={{ marginTop: 18, padding: 14, border: "1px solid #eee", borderRadius: 12 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="email"
            value={email}
            placeholder="Email used at checkout"
            onChange={(e) => setEmail(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              minWidth: 300,
            }}
          />
          <button onClick={load} disabled={busy} style={btnPrimary}>
            {busy ? "Loading…" : "Reload"}
          </button>

          <div style={{ fontSize: 12, opacity: 0.65 }}>
            API:{" "}
            <code style={{ fontSize: 11 }}>
              {apiUrl || "(waiting for build id/email)"}
            </code>
          </div>
        </div>

        {err && <div style={{ marginTop: 10, color: "crimson", whiteSpace: "pre-wrap" }}>{err}</div>}
      </div>

      {data?.build && (
        <div style={{ marginTop: 18, padding: 14, border: "1px solid #eee", borderRadius: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 800 }}>
              {data.build.project?.name || "Untitled Game"}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Scanned: {new Date(data.build.scannedAt).toLocaleString()}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
            <Kpi label="Score" value={`${data.build.quickScore}/100`} />
            <Kpi label="Brotli" value={data.build.brotliPresent ? "Yes" : "No"} />
            <Kpi label="Gzip" value={data.build.gzipPresent ? "Yes" : "No"} />
            <Kpi label="Fix Packs" value={`${data.build.fixPacks?.length || 0}`} />
          </div>

          <details style={{ marginTop: 14 }}>
            <summary style={{ cursor: "pointer" }}>View raw scan JSON</summary>
            <pre style={preStyle}>{JSON.stringify(data.build.scanResult, null, 2)}</pre>
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

const btnPrimary: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 800,
};

const btnGhost: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "#fff",
  cursor: "pointer",
  fontSize: 13,
};

const preStyle: React.CSSProperties = {
  marginTop: 10,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  background: "#fafafa",
  borderRadius: 10,
  padding: 12,
  fontSize: 12,
  overflowX: "auto",
};
