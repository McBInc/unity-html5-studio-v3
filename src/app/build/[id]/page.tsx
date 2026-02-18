// src/app/build/[id]/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSession, signIn } from "next-auth/react";

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

type UsageOk = {
  ok: true;
  fixPackUses: number;
  remainingFreeUses: number;
  subscriptionActive: boolean;
  email: string;
};

export default function BuildDetailsPage() {
  const { status } = useSession();

  // Read buildId from URL path
  const [buildId, setBuildId] = useState<string>("");

  useEffect(() => {
    try {
      const path = window.location.pathname; // /build/<id>
      const parts = path.split("/").filter(Boolean);
      const id = parts.length >= 2 && parts[0] === "build" ? parts[1] : "";
      setBuildId(id);
    } catch {
      setBuildId("");
    }
  }, []);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ApiOk | null>(null);

  const [usage, setUsage] = useState<UsageOk | null>(null);

  const apiUrl = useMemo(() => {
    if (!buildId) return "";
    return `/api/build/${encodeURIComponent(buildId)}`;
  }, [buildId]);

  async function load() {
    setErr(null);
    setData(null);

    if (!buildId) {
      setErr("Missing build id in URL.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(apiUrl, { method: "GET", cache: "no-store" });
      const json = (await res.json()) as ApiOk | ApiErr;

      if (!res.ok) {
        if ("error" in json) throw new Error(json.error);
        throw new Error(`Request failed (${res.status})`);
      }

      if (!("success" in json) || json.success !== true) {
        throw new Error("Unexpected response from server.");
      }

      setData(json as ApiOk);

      // Load usage info (for “3 free deployments” messaging)
      const u = await fetch("/api/me", { cache: "no-store" });
      const uj = (await u.json()) as any;
      if (u.ok && uj?.ok) setUsage(uj as UsageOk);
    } catch (e: any) {
      setErr(e?.message || "Failed to load build");
    } finally {
      setBusy(false);
    }
  }

  // Auto-load when buildId becomes available and user is authenticated
  useEffect(() => {
    if (status === "authenticated" && buildId) {
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, buildId]);

  function goHistory() {
    window.location.href = "/history";
  }

  function goScan() {
    window.location.href = "/";
  }

  if (status === "loading") {
    return (
      <div style={{ padding: 18, maxWidth: 980, margin: "0 auto" }}>
        <h1 style={{ margin: "8px 0" }}>Build / <span style={{ opacity: 0.55 }}>Details</span></h1>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Checking session…</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div style={{ padding: 18, maxWidth: 980, margin: "0 auto" }}>
        <h1 style={{ margin: "8px 0" }}>Build / <span style={{ opacity: 0.55 }}>Details</span></h1>
        <div style={{ marginTop: 12, padding: 14, border: "1px solid #eee", borderRadius: 12 }}>
          <div style={{ fontWeight: 800 }}>Please sign in to view this build.</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
            Builds are private to your account.
          </div>
          <button onClick={() => signIn(undefined, { callbackUrl: `/build/${buildId || ""}` })} style={{ ...btnPrimary, marginTop: 12 }}>
            Sign in
          </button>
        </div>
      </div>
    );
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
          <button onClick={load} disabled={busy} style={btnPrimary}>
            {busy ? "Loading…" : "Reload"}
          </button>

          <div style={{ fontSize: 12, opacity: 0.65 }}>
            API: <code style={{ fontSize: 11 }}>{apiUrl || "(waiting for build id)"}</code>
          </div>

          {usage ? (
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Free Fix Pack deployments remaining: <b>{usage.remainingFreeUses}</b>
              {usage.subscriptionActive ? <> (Pro)</> : null}
            </div>
          ) : null}
        </div>

        {err && <div style={{ marginTop: 10, color: "crimson", whiteSpace: "pre-wrap" }}>{err}</div>}
      </div>

      {data?.build && (
        <div style={{ marginTop: 18, padding: 14, border: "1px solid #eee", borderRadius: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 800 }}>{data.build.project?.name || "Untitled Game"}</div>
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
