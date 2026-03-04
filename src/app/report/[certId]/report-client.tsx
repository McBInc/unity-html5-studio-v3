"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

type BuildShape = {
  id: string;
  certId: string | null;
  reportStatus: string;
  scannedAt: string | Date | null;
  quickScore: number | null;
  brotliPresent: boolean | null;
  gzipPresent: boolean | null;
  scanResult: any;
  liveUrl: string | null;
  clipUrl?: string | null;
  certifiedAt?: string | Date | null;
  project?: { id: string; name: string } | null;
  launchProfile?: any | null;
};

type ApiWrapped =
  | { ok: true; build: BuildShape }
  | { ok: false; error: string; hint?: any };

type ApiFlat =
  | {
      ok: true;
      certId: string;
      buildId: string;
      projectName: string;
      scannedAt: string | Date | null;
      quickScore: number;
      brotliPresent: boolean;
      gzipPresent: boolean;
      scan: any;
      launchProfile: any;
      reportStatus?: string | null;
      certifiedAt?: string | Date | null;
      liveUrl?: string | null;
      clipUrl?: string | null;
    }
  | { ok: false; error: string; hint?: any };

type AnyReport = ApiWrapped | ApiFlat;

type MePayload = { ok: true; email: string } | { error: string };

function fmtDate(d: any) {
  try {
    const dt = typeof d === "string" ? new Date(d) : d instanceof Date ? d : null;
    if (!dt) return "—";
    return dt.toLocaleString();
  } catch {
    return "—";
  }
}

function safeString(v: any) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function normalize(report: AnyReport, certIdFromUrl: string) {
  if (!report || typeof report !== "object") {
    return { ok: false as const, error: "Bad report payload" };
  }
  if ("ok" in report && report.ok === false) return report;

  // Wrapped shape: { ok: true, build: {...} }
  if ("build" in report && (report as any).build) {
    const b = (report as any).build as BuildShape;
    return {
      ok: true as const,
      certId: b.certId || certIdFromUrl || "",
      buildId: b.id,
      projectName: b.project?.name || "Untitled Project",
      scannedAt: b.scannedAt ?? null,
      quickScore: Number.isFinite(b.quickScore as any) ? Number(b.quickScore) : 0,
      brotliPresent: !!b.brotliPresent,
      gzipPresent: !!b.gzipPresent,
      scan: b.scanResult ?? null,
      launchProfile: b.launchProfile ?? null,
      reportStatus: b.reportStatus ?? "draft",
      certifiedAt: (b as any).certifiedAt ?? null,
      liveUrl: b.liveUrl ?? null,
      clipUrl: (b as any).clipUrl ?? null,
      _raw: report,
    };
  }

  // Flat shape (older / alternate)
  const r = report as any;
  return {
    ok: true as const,
    certId: r.certId || certIdFromUrl || "",
    buildId: r.buildId || "",
    projectName: r.projectName || "Untitled Project",
    scannedAt: r.scannedAt ?? null,
    quickScore: Number.isFinite(r.quickScore) ? Number(r.quickScore) : 0,
    brotliPresent: !!r.brotliPresent,
    gzipPresent: !!r.gzipPresent,
    scan: r.scan ?? null,
    launchProfile: r.launchProfile ?? null,
    reportStatus: r.reportStatus ?? "draft",
    certifiedAt: r.certifiedAt ?? null,
    liveUrl: r.liveUrl ?? null,
    clipUrl: r.clipUrl ?? null,
    _raw: report,
  };
}

export default function ReportClient({
  certId,
  initial,
}: {
  certId: string;
  initial: AnyReport;
}) {
  const { status } = useSession();

  const [raw, setRaw] = useState<any>(initial);
  const [me, setMe] = useState<MePayload | null>(null);

  const n = useMemo(() => normalize(raw as AnyReport, certId), [raw, certId]);

  // Admin issue cert
  const [liveUrlInput, setLiveUrlInput] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [issueMsg, setIssueMsg] = useState<string | null>(null);

  // Patch/download (now redirects to /, no ZIP upload here)
  const [patchMsg, setPatchMsg] = useState<string | null>(null);

  async function loadMe() {
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      setMe((await res.json()) as MePayload);
    } catch {}
  }

  async function refreshReport() {
    if (!certId) return;
    const res = await fetch(`/api/report/${encodeURIComponent(certId)}`, { cache: "no-store" });
    const json = await res.json().catch(() => ({ ok: false, error: "Bad JSON" }));
    setRaw(json);
  }

  useEffect(() => {
    // Always refresh once on mount to avoid SSR quirks
    void refreshReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certId]);

  useEffect(() => {
    if (status === "authenticated") void loadMe();
    else setMe(null);
  }, [status]);

  useEffect(() => {
    if (n.ok) setLiveUrlInput(safeString(n.liveUrl));
  }, [n.ok, (n as any).liveUrl]);

  const isAdmin = useMemo(() => {
    const email = me && "ok" in me && (me as any).ok ? String((me as any).email || "").toLowerCase() : "";
    return !!email; // server still enforces admin
  }, [me]);

  async function issueCertificate() {
    setIssueMsg(null);
    const liveUrlTrim = liveUrlInput.trim();
    const cert = n.ok ? n.certId : certId;

    if (!cert) return setIssueMsg("Internal error: missing certId");
    if (!liveUrlTrim) return setIssueMsg("Paste a Live URL first.");

    setIssuing(true);
    try {
      const res = await fetch("/api/admin/set-live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ certId: cert, liveUrl: liveUrlTrim }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) return setIssueMsg(json?.error || `Issue failed (${res.status})`);

      setIssueMsg("✅ Certificate issued.");
      await refreshReport();
    } catch (e: any) {
      setIssueMsg(e?.message || "Issue failed");
    } finally {
      setIssuing(false);
    }
  }

  function goDownloadFixPack() {
    const id = (n.ok ? n.certId : certId) || "";
    // We route back to / and let the user generate the ZIP locally (no /api/patch upload).
    // Pass certId so the homepage can show "continue from this cert" later if you add that.
    const url = id ? `/?certId=${encodeURIComponent(id)}` : "/";
    window.location.href = url;
  }

  const headerCert = n.ok ? n.certId : certId || "(missing)";

  return (
    <div style={{ padding: 20, maxWidth: 980, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 32, margin: 0 }}>WebGL Certification Report</h1>
          <div style={{ marginTop: 6, opacity: 0.75 }}>
            Project: <b>{n.ok ? n.projectName : "—"}</b>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "monospace", fontSize: 12, opacity: 0.7 }}>CERT ID</div>
          <div style={{ fontFamily: "monospace", fontWeight: 900 }}>{headerCert}</div>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 16, borderRadius: 14, border: "1px solid #eee", background: "#fafafa" }}>
        <div style={{ fontWeight: 900 }}>Status</div>

        {n.ok ? (
          <>
            <div style={{ marginTop: 8 }}>
              Report: <b>{safeString(n.reportStatus || "draft")}</b>
            </div>
            <div style={{ marginTop: 6 }}>
              Quick Score: <b>{n.quickScore}</b> • Brotli: <b>{String(n.brotliPresent)}</b>
            </div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
              Scanned: {fmtDate(n.scannedAt)} • Build ID:{" "}
              <span style={{ fontFamily: "monospace" }}>{n.buildId}</span>
            </div>
          </>
        ) : (
          <div style={{ marginTop: 8, color: "crimson" }}>Error: {safeString((n as any).error || "Report not loaded")}</div>
        )}

        <button
          onClick={() => refreshReport()}
          style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "#fff" }}
          type="button"
        >
          Reload Report
        </button>
      </div>

      <div style={{ marginTop: 16, padding: 16, borderRadius: 14, border: "1px solid #eee", background: "#fff" }}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>1) Download FixPack ZIP (Repo-Ready)</div>
        <div style={{ opacity: 0.8, fontSize: 13 }}>
          We removed the second ZIP upload here because large WebGL ZIPs can trigger <b>413</b> on hosted patch endpoints.
          Download the FixPack from the home page (it is generated locally in your browser).
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={goDownloadFixPack}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 900,
            }}
            type="button"
          >
            Go to Download FixPack →
          </button>
        </div>

        {patchMsg && <div style={{ marginTop: 10, opacity: 0.9 }}>{patchMsg}</div>}
      </div>

      <div style={{ marginTop: 16, padding: 16, borderRadius: 14, border: "1px solid #eee", background: "#fff" }}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>2) Deploy + Issue Certificate</div>

        {n.ok && n.liveUrl ? (
          <div style={{ opacity: 0.9 }}>
            Live URL:{" "}
            <a href={n.liveUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 900 }}>
              {n.liveUrl}
            </a>
          </div>
        ) : (
          <div style={{ opacity: 0.75 }}>Live URL: Pending</div>
        )}

        <div style={{ marginTop: 10, opacity: 0.8 }}>Issued at: {fmtDate(n.ok ? n.certifiedAt : null)}</div>

        {isAdmin && (
          <div style={{ marginTop: 14, padding: 14, borderRadius: 12, border: "1px solid #111" }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Admin — Issue Certificate</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <input
                value={liveUrlInput}
                onChange={(e) => setLiveUrlInput(e.target.value)}
                placeholder="Paste the Netlify Live URL (https://...)"
                style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", minWidth: 360, flex: 1 }}
              />
              <button
                onClick={issueCertificate}
                disabled={issuing}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #111",
                  background: issuing ? "#ddd" : "#111",
                  color: "#fff",
                  cursor: issuing ? "not-allowed" : "pointer",
                  fontWeight: 900,
                }}
                type="button"
              >
                {issuing ? "Issuing…" : "Issue Certificate"}
              </button>
            </div>
            {issueMsg && <div style={{ marginTop: 10, opacity: 0.9 }}>{issueMsg}</div>}
          </div>
        )}
      </div>

      <div style={{ marginTop: 16, padding: 16, borderRadius: 14, border: "1px solid #eee", background: "#0b0b0b", color: "#7CFC00" }}>
        <div style={{ fontFamily: "monospace", fontWeight: 900, marginBottom: 8 }}>Debug: raw /api/report response</div>
        <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(raw, null, 2)}</pre>
      </div>
    </div>
  );
}