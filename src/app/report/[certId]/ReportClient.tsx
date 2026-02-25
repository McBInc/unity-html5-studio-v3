"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

export type ReportPayload =
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
  | { ok: false; error: string };

type MePayload = { ok: true; email: string } | { error: string };

function scoreBand(score: number) {
  if (score >= 90) return { label: "Certified: Ready", note: "Low risk of hosting-related failures." };
  if (score >= 75) return { label: "Certified: Deployable", note: "Should work — edge cases may remain." };
  if (score >= 50) return { label: "Conditional", note: "Likely to fail unless hosting is configured correctly." };
  if (score >= 25) return { label: "High Risk", note: "Very likely to fail online unless corrected." };
  return { label: "Fail", note: "Critical WebGL components or assumptions are missing." };
}

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

export default function ReportClient({ certId, initial }: { certId: string; initial: ReportPayload }) {
  const { status } = useSession();

  const [data, setData] = useState<ReportPayload>(initial);
  const [me, setMe] = useState<MePayload | null>(null);

  // Admin panel state
  const [liveUrlInput, setLiveUrlInput] = useState(() => ("ok" in initial && initial.ok ? safeString(initial.liveUrl) : ""));
  const [issuing, setIssuing] = useState(false);
  const [issueMsg, setIssueMsg] = useState<string | null>(null);

  async function loadMe() {
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      const json = (await res.json()) as MePayload;
      setMe(json);
    } catch {
      // ignore
    }
  }

  async function refreshReport() {
    const res = await fetch(`/api/report/${encodeURIComponent(certId)}`, { cache: "no-store" });
    const json = (await res.json()) as ReportPayload;
    setData(json);
    if ("ok" in json && json.ok) setLiveUrlInput(safeString(json.liveUrl));
  }

  useEffect(() => {
    if (status === "authenticated") void loadMe();
    else setMe(null);
  }, [status]);

  const score = useMemo(() => ("ok" in data && data.ok ? data.quickScore : 0), [data]);
  const band = useMemo(() => scoreBand(score), [score]);

  const reportStatus = useMemo(() => ("ok" in data && data.ok ? safeString(data.reportStatus || "draft") : ""), [data]);
  const liveUrl = useMemo(() => ("ok" in data && data.ok ? safeString(data.liveUrl || "") : ""), [data]);

  const isAdmin = useMemo(() => {
    const email = me && "ok" in me && (me as any).ok ? String((me as any).email || "").toLowerCase() : "";
    return !!email; // server endpoint still enforces true admin via ADMIN_EMAIL
  }, [me]);

  async function issueCertificate() {
    setIssueMsg(null);
    const liveUrlTrim = liveUrlInput.trim();
    if (!liveUrlTrim) return setIssueMsg("Please paste a Live URL first.");

    setIssuing(true);
    try {
      const res = await fetch("/api/admin/set-live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ certId, liveUrl: liveUrlTrim }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setIssueMsg(json?.error || json?.message || `Issue failed (${res.status})`);
        return;
      }

      setIssueMsg("✅ Certificate issued.");
      await refreshReport();
    } catch (e: any) {
      setIssueMsg(e?.message || "Issue failed");
    } finally {
      setIssuing(false);
    }
  }

  if (!("ok" in data) || !data.ok) {
    return (
      <div style={{ padding: 20, maxWidth: 980, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>Certification Report</h1>
        <div style={{ marginTop: 12, padding: 14, border: "1px solid #eee", borderRadius: 12, background: "#fff" }}>
          <div style={{ fontWeight: 900, color: "crimson" }}>Report unavailable</div>
          <div style={{ marginTop: 6, opacity: 0.85 }}>{(data as any)?.error || "Unknown error"}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 980, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
        <div>
          <h1 style={{ fontSize: 28, margin: 0 }}>Certification Report</h1>
          <div style={{ marginTop: 6, opacity: 0.75 }}>
            Project: <b>{data.projectName}</b>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "monospace", fontSize: 12, opacity: 0.7 }}>CERT ID</div>
          <div style={{ fontFamily: "monospace", fontWeight: 900 }}>{data.certId}</div>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 16, borderRadius: 14, border: "1px solid #eee", background: "#fafafa" }}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Certificate Status</div>
        <div style={{ fontSize: 18, fontWeight: 900 }}>
          {reportStatus.toUpperCase()} — {band.label}
        </div>
        <div style={{ marginTop: 6, opacity: 0.85 }}>{band.note}</div>
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
          Scanned: {fmtDate(data.scannedAt)} • Build ID: <span style={{ fontFamily: "monospace" }}>{data.buildId}</span>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 16, borderRadius: 14, border: "1px solid #eee", background: "#fff" }}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>Certified Deployment</div>
        {liveUrl ? (
          <div style={{ opacity: 0.9 }}>
            Live URL:{" "}
            <a href={liveUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 900 }}>
              {liveUrl}
            </a>
          </div>
        ) : (
          <div style={{ opacity: 0.75 }}>Live URL: Pending (not issued yet)</div>
        )}
        <div style={{ marginTop: 10, opacity: 0.8 }}>Issued at: {fmtDate((data as any).certifiedAt)}</div>
      </div>

      {isAdmin && (
        <div style={{ marginTop: 16, padding: 16, borderRadius: 14, border: "1px solid #111", background: "#fff" }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Admin — Issue Certificate</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input
              value={liveUrlInput}
              onChange={(e) => setLiveUrlInput(e.target.value)}
              placeholder="Paste the certified deployment Live URL (https://...)"
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
  );
}