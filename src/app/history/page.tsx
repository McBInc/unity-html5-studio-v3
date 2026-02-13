"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type BuildRow = {
  id: string;
  createdAt: string;
  quickScore: number;
  brotliPresent: boolean;
  gzipPresent: boolean;
  project: {
    name: string;
  };
};

export default function HistoryPage() {
  const EMAIL_KEY = "unity_html5_email_v1";

  const [email, setEmail] = useState("");
  const [builds, setBuilds] = useState<BuildRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);

  /* Load saved email on mount */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(EMAIL_KEY) || "";
      if (saved) {
        setEmail(saved);
        loadHistory(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  async function loadHistory(targetEmail?: string) {
    const queryEmail = targetEmail || email;

    if (!queryEmail || !queryEmail.includes("@")) {
      setError("Please enter a valid email.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/history?email=${encodeURIComponent(queryEmail)}`
      );

      if (!res.ok) {
        throw new Error("Failed to load history");
      }

      const data = await res.json();

      setBuilds(data.builds || []);
      setLoadedOnce(true);

      try {
        localStorage.setItem(EMAIL_KEY, queryEmail);
      } catch {
        // ignore
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load history");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>Build History</h1>

      <p style={{ opacity: 0.8, marginBottom: 20 }}>
        Your saved WebGL scans and launch readiness.
      </p>

      {/* Email Input */}
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <input
          type="email"
          placeholder="Email used at checkout"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #ddd",
            minWidth: 260,
          }}
        />

        <button
          onClick={() => loadHistory()}
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 600,
          }}
        >
          {loading ? "Loading…" : "Load history"}
        </button>

        <Link href="/" style={{ fontSize: 13, opacity: 0.8 }}>
          ← Run new scan
        </Link>
      </div>

      {error && (
        <div style={{ color: "crimson", marginBottom: 16 }}>{error}</div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ padding: 20, opacity: 0.7 }}>Loading builds…</div>
      )}

      {/* Empty State */}
      {!loading && loadedOnce && builds.length === 0 && (
        <div
          style={{
            marginTop: 40,
            padding: 24,
            border: "1px dashed #ddd",
            borderRadius: 12,
            textAlign: "center",
            background: "#fafafa",
          }}
        >
          <h3 style={{ marginBottom: 8 }}>No builds yet</h3>

          <p style={{ opacity: 0.8, marginBottom: 16 }}>
            You haven’t scanned any WebGL builds with this email.
          </p>

          <Link
            href="/"
            style={{
              display: "inline-block",
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            🚀 Run your first scan
          </Link>
        </div>
      )}

      {/* Builds List */}
      {!loading && builds.length > 0 && (
        <div style={{ marginTop: 20 }}>
          {builds.map((b) => (
            <div
              key={b.id}
              style={{
                padding: 16,
                border: "1px solid #eee",
                borderRadius: 12,
                marginBottom: 12,
                background: "#fff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {b.project?.name || "Untitled Project"}
                  </div>

                  <div style={{ fontSize: 13, opacity: 0.7 }}>
                    {new Date(b.createdAt).toLocaleString()}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700 }}>
                    Score: {b.quickScore}/100
                  </div>

                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    {b.brotliPresent ? "Brotli" : "No Brotli"} ·{" "}
                    {b.gzipPresent ? "Gzip" : "No Gzip"}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <Link
                  href={`/build/${b.id}`}
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    textDecoration: "underline",
                  }}
                >
                  View build →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
