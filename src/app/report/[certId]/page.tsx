"use client";

import { useEffect, useState } from "react";

interface ReportPageProps {
  params: { certId: string };
}

export default function ReportPage({ params }: ReportPageProps) {
  const { certId } = params;

  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // -----------------------
  // Fetch report data
  // -----------------------
  async function loadReport() {
    setLoading(true);
    try {
      const res = await fetch(`/api/report/${certId}`);
      const json = await res.json();
      setReport(json);
    } catch (err: any) {
      setError("Failed to load report.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport();
  }, [certId]);

  // -----------------------
  // Publish handler
  // -----------------------
  async function handlePublish() {
    if (!file) {
      setError("Please upload a ZIP file.");
      return;
    }

    setPublishing(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("certId", certId);
    formData.append("platformTarget", "DISCORD");
    formData.append("mode", "WE_PUBLISH");
    formData.append("tier", "BASIC");

    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Publish failed");
      }

      await loadReport();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPublishing(false);
    }
  }

  // -----------------------
  // Re-scan handler
  // -----------------------
  async function handleRescan() {
    setError(null);
    try {
      const res = await fetch("/api/scanbuild", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: report?.project?.name,
          scan: report?.scanResult,
        }),
      });

      if (!res.ok) {
        throw new Error("Rescan failed");
      }

      await loadReport();
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (loading) return <div style={{ padding: 40 }}>Loading report...</div>;

  if (!report) return <div style={{ padding: 40 }}>Report not found.</div>;

  return (
    <div style={{ padding: 40, maxWidth: 1000, margin: "0 auto" }}>
      <h1>WebGL Certification Report</h1>
      <h2>{certId}</h2>

      <hr />

      {/* ------------------ Status Section ------------------ */}
      <section style={{ marginTop: 30 }}>
        <h3>Status</h3>
        <p>
          <strong>Certification:</strong> {report.reportStatus}
        </p>
        <p>
          <strong>Quick Score:</strong> {report.quickScore}
        </p>
        {report.liveUrl && (
          <p>
            <strong>Live URL:</strong>{" "}
            <a href={report.liveUrl} target="_blank">
              {report.liveUrl}
            </a>
          </p>
        )}
      </section>

      {/* ------------------ Scan Results ------------------ */}
      <section style={{ marginTop: 40 }}>
        <h3>Scan Results</h3>
        <pre
          style={{
            background: "#111",
            color: "#0f0",
            padding: 20,
            overflow: "auto",
            maxHeight: 300,
          }}
        >
          {JSON.stringify(report.scanResult, null, 2)}
        </pre>

        <button onClick={handleRescan}>Re-run Scan</button>
      </section>

      {/* ------------------ Publish Section ------------------ */}
      <section style={{ marginTop: 50 }}>
        <h3>Publish Certified Build</h3>

        <input
          type="file"
          accept=".zip"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />

        <button
          onClick={handlePublish}
          disabled={publishing}
          style={{ marginLeft: 10 }}
        >
          {publishing ? "Publishing..." : "Publish to Netlify"}
        </button>
      </section>

      {error && (
        <div style={{ color: "red", marginTop: 20 }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* ------------------ Publish Evidence ------------------ */}
      {report.publishEvidence && (
        <section style={{ marginTop: 50 }}>
          <h3>Publish Evidence</h3>
          <pre
            style={{
              background: "#111",
              color: "#0f0",
              padding: 20,
              overflow: "auto",
              maxHeight: 300,
            }}
          >
            {JSON.stringify(report.publishEvidence, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}