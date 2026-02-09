"use client";

import React, { useState } from "react";

export default function PricingPage() {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function startCheckout(plan: "pro_monthly" | "launch_pass", label: string) {
    setBusy(label);
    setErr(null);

    try {
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      if (!r.ok) throw new Error(await r.text());
      const data = (await r.json()) as { url?: string };

      if (!data.url) throw new Error("No checkout URL returned.");
      window.location.href = data.url;
    } catch (e: any) {
      setErr(e?.message || "Checkout failed");
      setBusy(null);
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 16px" }}>
      <h1 style={{ fontSize: 40, margin: "0 0 10px" }}>Pricing</h1>
      <p style={{ opacity: 0.8, lineHeight: 1.6, marginTop: 0 }}>
        Choose the plan that fits your launch journey.
      </p>

      {err && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid #fca5a5",
            background: "#fef2f2",
            borderRadius: 12,
            color: "#991b1b",
          }}
        >
          {err}
        </div>
      )}

      <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
        <PlanCard
          title="Indie"
          price="$19/month"
          subtitle="Unlimited Fix Packs + launch checklist"
          bullets={[
            "Unlimited Deployment Kits (Fix Packs)",
            "Vercel / Netlify / Apache / Nginx configs",
            "Launch verification checklist",
            "More hosts added over time",
          ]}
          ctaLabel={busy === "pro" ? "Redirecting…" : "Start Indie"}
          disabled={busy !== null}
          onClick={() => startCheckout("pro_monthly", "pro")}
        />

        <PlanCard
          title="Launch Pass"
          price="$49 (or your chosen price)"
          subtitle="One focused launch cycle (great if you’re near release)"
          bullets={[
            "Deployment Kit download access",
            "Launch verification checklist",
            "Perfect for “ship it now” moments",
          ]}
          ctaLabel={busy === "pass" ? "Redirecting…" : "Get Launch Pass"}
          disabled={busy !== null}
          onClick={() => startCheckout("launch_pass", "pass")}
        />

        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Agency/Studio tiers coming after Phase 2 (client workflows + verification badge).
        </div>
      </div>
    </div>
  );
}

function PlanCard(props: {
  title: string;
  price: string;
  subtitle: string;
  bullets: string[];
  ctaLabel: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 16, padding: 18, background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{props.title}</div>
          <div style={{ marginTop: 6, opacity: 0.8 }}>{props.subtitle}</div>
        </div>
        <div style={{ fontSize: 20, fontWeight: 900 }}>{props.price}</div>
      </div>

      <ul style={{ marginTop: 12, marginBottom: 12, lineHeight: 1.7, paddingLeft: 18 }}>
        {props.bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>

      <button
        onClick={props.onClick}
        disabled={props.disabled}
        style={{
          padding: "10px 14px",
          borderRadius: 12,
          border: "1px solid #111",
          background: props.disabled ? "#ddd" : "#111",
          color: "#fff",
          cursor: props.disabled ? "not-allowed" : "pointer",
          fontWeight: 700,
        }}
      >
        {props.ctaLabel}
      </button>
    </div>
  );
}


