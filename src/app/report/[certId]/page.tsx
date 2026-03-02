"use client";

import { useEffect, useMemo, useState } from "react";

type ReportApi =
  | { ok: true; build?: any; data?: any }
  | { ok: false; error?: string }
  | any;

export default function ReportPage({ params }: { params: { certId: string } }) {
  const certId = params.certId;

  const [raw, setRaw] = useState<any>(null);
  const [build, setBuild] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [publishZip, setPublishZip] = useState<File | null>(null);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishResult, setPublishResult] = useState<any>(null);

  const [rescanZip, setRescanZip] = useState<File | null>(null);
  const [rescanBusy, setRescanBusy] = useState(false);
  const [rescanResult, setRescanResult] = useState<any>(null);

  const derived = useMemo(() => {
    const b = build || {};
    return {
      reportStatus: b.reportStatus ?? b.report_status ?? "",
      quickScore: b.quickScore ?? b.quick_score ?? "",
      liveUrl: b.liveUrl ?? b.live_url ?? "",
      scanResult: b.scanResult ?? b.scan_result ?? b.scan ?? null,
      publishEvidence: b.publishEvidence ?? b.publish_evidence ?? null,
      projectName: b.project?.name ?? b.projectName ?? "",
      buildId: b.id ?? "",
    };
  }, [build]);

  async function loadReport() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/report/${certId}`, { method: "GET" });
      const json: ReportApi = await res.json().catch(() => ({}));
      setRaw(json);

      if (!res.ok) {
        throw new Error((json && (json.error || json.message)) || `Failed to load report (${res.status})`);
      }

      // ✅ Support multiple API shapes:
      // { ok:true, build:{...} } OR { ok:true, data:{...} } OR bare build object
      const maybeBuild = (json && (json.build || json.data)) ?? json;

      // If the API includes ok:false, handle it
      if (json && json.ok === false) {
        throw new Error(json.error || "Report API returned ok:false");
      }

      setBuild(maybeBuild);
    } catch (e: any) {
      setErr(e?.message || "Failed to load report");
      setBuild(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certId]);

  async function handlePublish() {
    if (!publishZip) {
      setErr("Please choose a ZIP to publish.");
      return;
    }
    setPublishBusy(true);
    setErr(null);
    setPublishResult(null);

    const fd = new FormData();
    fd.append("file", publishZip);
    fd.append("certId", certId);
    fd.append("platformTarget", "DISCORD");
    fd.append("mode", "WE_PUBLISH");
    fd.append("tier", "BASIC");

    try {
      const res = await fetch("/api/publish", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(json.error || `Publish failed (${res.status})`);

      setPublishResult(json);
      await loadReport(); // refresh liveUrl + evidence on page
    } catch (e: any) {
      setErr(e?.message || "Publish failed");
    } finally {
      setPublishBusy(false);
    }
  }

  async function handleRescan() {
    if (!rescanZip) {
      setErr("Please choose a ZIP to re-scan.");
      return;
    }
    setRescanBusy(true);
    setErr(null);
    setRescanResult(null);

    const fd = new FormData();
    fd.append("file", rescanZip);
    fd.append("projectName", derived.projectName || "Rescan Project");

    try {
      const res = await fetch("/api/scanbuild", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Rescan failed (${res.status})`);

      setRescanResult(json);

      // If rescan creates a NEW certId, jump to its report
      if (json?.certId) {
        window.location.href = `/report/${json.certId}`;
        return;
      }

      // Otherwise refresh current
      await loadReport();
    } catch (e: any) {
      setErr(e?.message || "Rescan failed");
    } finally {
      setRescanBusy(false);
    }
  }

  if (loading) return <div style={{ padding: 40 }}>Loading report…</div>;

  return (
    <div style={{ padding: 40, maxWidth: 980, margin: "0 auto" }}>
      <h1>WebGL Certification Report</h1>
      <div style={{ fontFamily: "monospace", marginTop: 6 }}>{certId}</div>

      {err && (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #f00", color: "#b00" }}>
          <b>Error:</b> {err}
        </div>
      )}

      <hr style={{ margin: "24px 0" }} />

      <section>
        <h3>Status</h3>
        <div><b>Certification:</b> {derived.reportStatus || "(missing)"}</div>
        <div><b>Quick Score:</b> {String(derived.quickScore || "(missing)")}</div>
        {derived.liveUrl ? (
          <div style={{ marginTop: 6 }}>
            <b>Live URL:</b>{" "}
            <a href={derived.liveUrl} target="_blank" rel="noreferrer">
              {derived.liveUrl}
            </a>
          </div>
        ) : (
          <div style={{ marginTop: 6 }}><b>Live URL:</b> (not set)</div>
        )}
      </section>

      <section style={{ marginTop: 28 }}>
        <h3>Scan Results</h3>
        <pre style={{ background: "#111", color: "#0f0", padding: 16, overflow: "auto", maxHeight: 280 }}>
          {JSON.stringify(derived.scanResult ?? "(missing scanResult)", null, 2)}
        </pre>
      </section>

      <section style={{ marginTop: 28 }}>
        <h3>Re-scan (upload ZIP)</h3>
        <input type="file" accept=".zip" onChange={(e) => setRescanZip(e.target.files?.[0] || null)} />
        <button onClick={handleRescan} disabled={rescanBusy} style={{ marginLeft: 10 }}>
          {rescanBusy ? "Re-scanning…" : "Re-run Scan"}
        </button>

        {rescanResult && (
          <pre style={{ marginTop: 12, background: "#111", color: "#0f0", padding: 16, overflow: "auto", maxHeight: 220 }}>
            {JSON.stringify(rescanResult, null, 2)}
          </pre>
        )}
      </section>

      <section style={{ marginTop: 34 }}>
        <h3>Publish Certified Build (Netlify)</h3>
        <input type="file" accept=".zip" onChange={(e) => setPublishZip(e.target.files?.[0] || null)} />
        <button onClick={handlePublish} disabled={publishBusy} style={{ marginLeft: 10 }}>
          {publishBusy ? "Publishing…" : "Publish to Netlify"}
        </button>

        {publishResult && (
          <div style={{ marginTop: 12 }}>
            <div><b>Publish Result:</b></div>
            <pre style={{ background: "#111", color: "#0f0", padding: 16, overflow: "auto", maxHeight: 220 }}>
              {JSON.stringify(publishResult, null, 2)}
            </pre>
            {publishResult?.liveUrl && (
              <div style={{ marginTop: 8 }}>
                <b>Live URL:</b>{" "}
                <a href={publishResult.liveUrl} target="_blank" rel="noreferrer">
                  {publishResult.liveUrl}
                </a>
              </div>
            )}
          </div>
        )}
      </section>

      {derived.publishEvidence && (
        <section style={{ marginTop: 34 }}>
          <h3>Publish Evidence</h3>
          <pre style={{ background: "#111", color: "#0f0", padding: 16, overflow: "auto", maxHeight: 280 }}>
            {JSON.stringify(derived.publishEvidence, null, 2)}
          </pre>
        </section>
      )}

      <section style={{ marginTop: 34 }}>
        <h3>Debug</h3>
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          If fields look missing, this is the raw API response from <code>/api/report/{certId}</code>:
        </div>
        <pre style={{ background: "#111", color: "#0f0", padding: 16, overflow: "auto", maxHeight: 220 }}>
          {JSON.stringify(raw ?? "(no raw)", null, 2)}
        </pre>
      </section>
    </div>
  );
}