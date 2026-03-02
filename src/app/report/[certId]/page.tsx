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
  | { ok: false; error: string; hint?: any };

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

export default function ReportClient({
  certId,
  initial,
}: {
  certId: string;
  initial: ReportPayload;
}) {
  const { status } = useSession();

  const [data, setData] = useState<ReportPayload>(initial);
  const [raw, setRaw] = useState<any>(null);

  const [me, setMe] = useState<MePayload | null>(null);

  // Admin issue cert
  const [liveUrlInput, setLiveUrlInput] = useState(
    "ok" in initial && initial.ok ? safeString(initial.liveUrl) : ""
  );
  const [issuing, setIssuing] = useState(false);
  const [issueMsg, setIssueMsg] = useState<string | null>(null);

  // Patch/download
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [patching, setPatching] = useState(false);
  const [patchMsg, setPatchMsg] = useState<string | null>(null);

  async function loadMe() {
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      const json = (await res.json()) as MePayload;
      setMe(json);
    } catch {}
  }

  async function refreshReport() {
    if (!certId) return;

    const res = await fetch(`/api/report/${encodeURIComponent(certId)}`, {
      cache: "no-store",
    });

    const json = await res.json().catch(() => ({ ok: false, error: "Bad JSON" }));
    setRaw(json);
    setData(json as ReportPayload);

    if (json?.ok) setLiveUrlInput(safeString(json.liveUrl));
  }

  useEffect(() => {
    // Always refresh once on mount so SSR issues don’t matter
    void refreshReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certId]);

  useEffect(() => {
    if (status === "authenticated") void loadMe();
    else setMe(null);
  }, [status]);

  const isAdmin = useMemo(() => {
    const email =
      me && "ok" in me && (me as any).ok ? String((me as any).email || "").toLowerCase() : "";
    return !!email; // server still enforces ADMIN_EMAIL
  }, [me]);

  async function issueCertificate() {
    setIssueMsg(null);

    const liveUrlTrim = liveUrlInput.trim();
    if (!certId) return setIssueMsg("Internal error: missing certId");
    if (!liveUrlTrim) return setIssueMsg("Paste a Live URL first.");

    setIssuing(true);
    try {
      const res = await fetch("/api/admin/set-live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ certId, liveUrl: liveUrlTrim }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setIssueMsg(json?.error || `Issue failed (${res.status})`);
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

  async function generatePatchedZip() {
    setPatchMsg(null);
    if (!zipFile) return setPatchMsg("Choose a WebGL ZIP first.");

    setPatching(true);
    try {
      const form = new FormData();
      form.append("file", zipFile);
      form.append("certId", certId);
      form.append("tier", "BASIC"); // for now

      const res = await fetch("/api/patch", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        setPatchMsg(errJson?.error || `Patch failed (${res.status})`);
        return;
      }

      const blob = await res.blob();
      const dlName = `${certId || "patched"}-patched.zip`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = dlName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setPatchMsg("✅ Patched ZIP downloaded. Upload it to Netlify, then paste Live URL above.");
    } catch (e: any) {
      setPatchMsg(e?.message || "Patch failed");
    } finally {
      setPatching(false);
    }
  }

  const headerCert = certId || ("ok" in data && data.ok ? data.certId : "") || "(missing)";

  return (
    <div style={{ padding: 20, maxWidth: 980, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <div>
          <h1 style={{ fontSize: 32, margin: 0 }}>WebGL Certification Report</h1>
          <div style={{ marginTop: 6, opacity: 0.75 }}>
            Project: <b>{"ok" in data && data.ok ? data.projectName : "—"}</b>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "monospace", fontSize: 12, opacity: 0.7 }}>CERT ID</div>
          <div style={{ fontFamily: "monospace", fontWeight: 900 }}>{headerCert}</div>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 16, borderRadius: 14, border: "1px solid #eee", background: "#fafafa" }}>
        <div style={{ fontWeight: 900 }}>Status</div>

        {"ok" in data && data.ok ? (
          <>
            <div style={{ marginTop: 8 }}>
              Report: <b>{safeString(data.reportStatus || "draft")}</b>
            </div>
            <div style={{ marginTop: 6 }}>
              Quick Score: <b>{data.quickScore}</b>
            </div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
              Scanned: {fmtDate(data.scannedAt)} • Build ID:{" "}
              <span style={{ fontFamily: "monospace" }}>{data.buildId}</span>
            </div>
          </>
        ) : (
          <div style={{ marginTop: 8, color: "crimson" }}>
            Error: {(data as any)?.error || "Report not loaded"}
          </div>
        )}

        <button
          onClick={() => refreshReport()}
          style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "#fff" }}
          type="button"
        >
          Reload Report
        </button>
      </div>

      {/* PATCH / DOWNLOAD */}
      <div style={{ marginTop: 16, padding: 16, borderRadius: 14, border: "1px solid #eee", background: "#fff" }}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>1) Generate Patched ZIP (for Netlify upload)</div>
        <div style={{ opacity: 0.8, fontSize: 13 }}>
          Upload the original WebGL ZIP here. We’ll inject <b>universal-init</b> + <b>diagnostic overlay</b>, then you download the patched ZIP.
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            onChange={(e) => setZipFile(e.target.files?.[0] || null)}
          />
          <button
            onClick={generatePatchedZip}
            disabled={patching}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111",
              background: patching ? "#ddd" : "#111",
              color: "#fff",
              cursor: patching ? "not-allowed" : "pointer",
              fontWeight: 900,
            }}
            type="button"
          >
            {patching ? "Patching…" : "Download Patched ZIP"}
          </button>
        </div>

        {patchMsg && <div style={{ marginTop: 10, opacity: 0.9 }}>{patchMsg}</div>}
      </div>

      {/* DEPLOY */}
      <div style={{ marginTop: 16, padding: 16, borderRadius: 14, border: "1px solid #eee", background: "#fff" }}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>2) Deploy + Issue Certificate</div>

        {"ok" in data && data.ok && data.liveUrl ? (
          <div style={{ opacity: 0.9 }}>
            Live URL:{" "}
            <a href={data.liveUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 900 }}>
              {data.liveUrl}
            </a>
          </div>
        ) : (
          <div style={{ opacity: 0.75 }}>Live URL: Pending</div>
        )}

        <div style={{ marginTop: 10, opacity: 0.8 }}>Issued at: {fmtDate(("ok" in data && data.ok ? data.certifiedAt : null) as any)}</div>

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

      {/* DEBUG */}
      <div style={{ marginTop: 16, padding: 16, borderRadius: 14, border: "1px solid #eee", background: "#0b0b0b", color: "#7CFC00" }}>
        <div style={{ fontFamily: "monospace", fontWeight: 900, marginBottom: 8 }}>Debug: /api/report payload</div>
        <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(raw, null, 2)}</pre>
      </div>
    </div>
  );
}