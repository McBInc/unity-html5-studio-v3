"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

type ReportPayload =
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

type MePayload =
  | { ok: true; email: string; fixPackUses?: number; remainingFreeUses?: number; subscriptionActive?: boolean }
  | { error: string };

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

export default function ReportPage(props: any) {
  // Bulletproof param handling (case + cache-safe)
  const certId =
    props?.params?.certId ||
    props?.params?.certid ||
    props?.params?.CertId ||
    props?.params?.certID ||
    props?.params?.CERTID ||
    "";

  const { status } = useSession();

  const [data, setData] = useState<ReportPayload | null>(null);
  const [me, setMe] = useState<MePayload | null>(null);
  const [loading, setLoading] = useState(true);

  // Admin panel state
  const [liveUrlInput, setLiveUrlInput] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [issueMsg, setIssueMsg] = useState<string | null>(null);

  const PUBLIC_ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "").toLowerCase();

  async function loadReport() {
    setLoading(true);
    try {
      const res = await fetch(`/api/report/${encodeURIComponent(certId)}`, { cache: "no-store" });
      const json = (await res.json()) as ReportPayload;
      setData(json);

      // If report already has a liveUrl, prefill the input
      if ("ok" in json && json.ok) {
        const existing = safeString(json.liveUrl || "");
        setLiveUrlInput(existing);
      }
    } catch (e: any) {
      setData({ ok: false, error: e?.message || "Failed to load report" });
    } finally {
      setLoading(false);
    }
  }

  async function loadMe() {
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      const json = (await res.json()) as MePayload;
      setMe(json);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!certId) {
      setData({ ok: false, error: "Missing certId in URL" });
      setLoading(false);
      return;
    }
    void loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certId]);

  useEffect(() => {
    if (status === "authenticated") void loadMe();
    else setMe(null);
  }, [status]);

  const isAdmin = useMemo(() => {
    const email = me && "ok" in me && (me as any).ok ? String((me as any).email || "").toLowerCase() : "";
    if (!email) return false;

    // If NEXT_PUBLIC_ADMIN_EMAIL is set, gate panel by it.
    if (PUBLIC_ADMIN_EMAIL) return email === PUBLIC_ADMIN_EMAIL;

    // If not set, still allow showing the panel to any authed user,
    // but the server endpoint will enforce true admin access.
    return status === "authenticated";
  }, [me, PUBLIC_ADMIN_EMAIL, status]);

  const score = useMemo(() => {
    if (!data || !("ok" in data) || !data.ok) return 0;
    return Number.isFinite(data.quickScore) ? data.quickScore : 0;
  }, [data]);

  const band = useMemo(() => scoreBand(score), [score]);

  const reportStatus = useMemo(() => {
    if (!data || !("ok" in data) || !data.ok) return null;
    return safeString((data as any).reportStatus || "");
  }, [data]);

  const liveUrl = useMemo(() => {
    if (!data || !("ok" in data) || !data.ok) return "";
    return safeString((data as any).liveUrl || "");
  }, [data]);

  const recommendedHost = useMemo(() => {
    if (!data || !("ok" in data) || !data.ok) return null;
    const lp = data.launchProfile;
    const host = lp?.hostProvider || lp?.host_provider || null;
    const score = lp?.hostCompatibilityScore ?? lp?.host_compatibility_score ?? null;
    return host ? { host: String(host), score: typeof score === "number" ? score : null } : null;
  }, [data]);

  const checks = useMemo(() => {
    if (!data || !("ok" in data) || !data.ok) return [];
    const hc = data.scan?.hosting_checks;
    if (Array.isArray(hc)) return hc.slice(0, 12);
    return [];
  }, [data]);

  async function issueCertificate() {
    setIssueMsg(null);

    const liveUrlTrim = liveUrlInput.trim();
    if (!liveUrlTrim) {
      setIssueMsg("Please paste a Live URL first.");
      return;
    }

    setIssuing(true);
    try {
      const res = await fetch("/api/admin/set-live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ certId, liveUrl: liveUrlTrim }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = json?.error || json?.message || `Issue failed (${res.status})`;
        setIssueMsg(msg);
        return;
      }

      setIssueMsg("✅ Certificate issued. Refreshing report…");
      await loadReport();
      setIssueMsg("✅ Certificate issued.");
    } catch (e: any) {
      setIssueMsg(e?.message || "Issue failed");
    } finally {
      setIssuing(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 20, maxWidth: 980, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>Certification Report</h1>
        <p style={{ opacity: 0.75 }}>Loading report…</p>
      </div>
    );
  }

  if (!data || !("ok" in data) || !data.ok) {
    return (
      <div style={{ padding: 20, maxWidth: 980, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>Certification Report</h1>
        <div style={{ marginTop: 12, padding: 14, border: "1px solid #eee", borderRadius: 12, background: "#fff" }}>
          <div style={{ fontWeight: 900, color: "crimson" }}>Report unavailable</div>
          <div style={{ marginTop: 6, opacity: 0.85 }}>{(data as any)?.error || "Unknown error"}</div>
          <div style={{ marginTop: 12 }}>
            <a href="/" style={btnLink}>
              Back to Scan →
            </a>
          </div>
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

      {/* HERO */}
      <div style={{ marginTop: 16, padding: 16, borderRadius: 14, border: "1px solid #eee", background: "#fafafa" }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ minWidth: 260 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Certificate Status</div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>
              {reportStatus ? reportStatus.toUpperCase() : "DRAFT"} — {band.label}
            </div>
            <div style={{ marginTop: 6, opacity: 0.85 }}>{band.note}</div>
          </div>

          <div style={kpiCard}>
            <div style={kpiLabel}>Readiness Score</div>
            <div style={kpiValue}>{score}/100</div>
          </div>

          <div style={kpiCard}>
            <div style={kpiLabel}>Brotli</div>
            <div style={kpiValue}>{data.brotliPresent ? "Yes" : "No"}</div>
          </div>

          <div style={kpiCard}>
            <div style={kpiLabel}>Gzip</div>
            <div style={kpiValue}>{data.gzipPresent ? "Yes" : "No"}</div>
          </div>

          <div style={{ marginLeft: "auto", display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href="/history" style={btnLink}>
              View History →
            </a>
            <a href="/" style={btnLink}>
              New Scan →
            </a>
          </div>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
          Scanned: {fmtDate(data.scannedAt)} • Build ID: <span style={{ fontFamily: "monospace" }}>{data.buildId}</span>
        </div>
      </div>

      {/* LIVE URL SECTION */}
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

        <div style={{ marginTop: 10, opacity: 0.8 }}>
          Issued at: {"certifiedAt" in data ? fmtDate((data as any).certifiedAt) : "—"}
        </div>
      </div>

      {/* RECOMMENDED HOST */}
      <div style={{ marginTop: 16, padding: 16, borderRadius: 14, border: "1px solid #eee", background: "#fff" }}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>Recommended Host</div>
        {recommendedHost ? (
          <div style={{ opacity: 0.9 }}>
            <b style={{ textTransform: "capitalize" }}>{recommendedHost.host.replace(/_/g, " ")}</b>
            {typeof recommendedHost.score === "number" ? (
              <span style={{ opacity: 0.7 }}> • Compatibility score: {Math.round(recommendedHost.score)}/100</span>
            ) : null}
          </div>
        ) : (
          <div style={{ opacity: 0.75 }}>No host recommendation available yet.</div>
        )}
      </div>

      {/* HOSTING CHECKS */}
      <div style={{ marginTop: 16, padding: 16, borderRadius: 14, border: "1px solid #eee", background: "#fff" }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Hosting Checks</div>
        {checks.length ? (
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
            {checks.map((c: any, i: number) => (
              <li key={i}>
                <b style={{ textTransform: "uppercase", fontSize: 11, opacity: 0.7 }}>{c?.severity || "info"}</b>{" "}
                <span>{c?.check || String(c)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ opacity: 0.75 }}>No checks found in scan result.</div>
        )}
      </div>

      {/* ADMIN PANEL */}
      {isAdmin && (
        <div style={{ marginTop: 16, padding: 16, borderRadius: 14, border: "1px solid #111", background: "#fff" }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Admin — Issue Certificate</div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input
              value={liveUrlInput}
              onChange={(e) => setLiveUrlInput(e.target.value)}
              placeholder="Paste the certified deployment Live URL (https://...)"
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                minWidth: 360,
                flex: 1,
              }}
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

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
            This will set <b>Build.liveUrl</b>, set <b>reportStatus</b> to <b>issued</b>, and timestamp <b>certifiedAt</b>.
          </div>
        </div>
      )}

      {/* RAW SCAN */}
      <details style={{ marginTop: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 900 }}>Raw Scan JSON</summary>
        <pre
          style={{
            marginTop: 10,
            padding: 12,
            border: "1px solid #eee",
            borderRadius: 12,
            background: "#fafafa",
            overflowX: "auto",
            fontSize: 12,
          }}
        >
          {JSON.stringify((data as any).scan, null, 2)}
        </pre>
      </details>
    </div>
  );
}

const btnLink: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  fontWeight: 900,
  textDecoration: "none",
};

const kpiCard: React.CSSProperties = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid #eee",
  minWidth: 140,
  background: "#fff",
};

const kpiLabel: React.CSSProperties = { fontSize: 12, opacity: 0.7 };
const kpiValue: React.CSSProperties = { fontWeight: 900, fontSize: 18 };