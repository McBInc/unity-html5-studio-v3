// src/app/build/[id]/launch/wizard-client.tsx
"use client";

import { useMemo, useState } from "react";

type Platform = {
  id: string;
  name: string;
  slug: string;
  notes: string | null;
};

type Host = {
  id: string;
  name: string;
  slug: string;
  notes: string | null;
};

type LaunchProfile = {
  targetPlatformId: string | null;
  targetHostId: string | null;
  monetizationIntent: string | null;
  distributionStrategy: string | null;
  readinessScore: number | null;
  platformFitScore: number | null;
  hostCompatibilityScore: number | null;
  recommendationsJson: any;
} | null;

export default function LaunchWizard({
  buildId,
  platforms,
  hosts,
  existing,
}: {
  buildId: string;
  platforms: Platform[];
  hosts: Host[];
  existing: LaunchProfile;
}) {
  const [targetPlatformId, setTargetPlatformId] = useState<string>(existing?.targetPlatformId ?? "");
  const [targetHostId, setTargetHostId] = useState<string>(existing?.targetHostId ?? "");
  const [monetizationIntent, setMonetizationIntent] = useState<string>(existing?.monetizationIntent ?? "ads");
  const [distributionStrategy, setDistributionStrategy] = useState<string>(existing?.distributionStrategy ?? "single-platform");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<any>(existing?.recommendationsJson?.scores ?? null);
  const [error, setError] = useState<string | null>(null);

  const selectedPlatform = useMemo(
    () => platforms.find((p) => p.id === targetPlatformId) ?? null,
    [platforms, targetPlatformId]
  );
  const selectedHost = useMemo(
    () => hosts.find((h) => h.id === targetHostId) ?? null,
    [hosts, targetHostId]
  );

  async function onSave() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/launch-profile/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buildId,
          targetPlatformId,
          targetHostId,
          monetizationIntent,
          distributionStrategy,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save");

      setResult(data.score);
    } catch (e: any) {
      setError(e.message || "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Step 1 */}
      <div className="rounded-2xl border p-5">
        <h2 className="font-medium mb-3">1) Target Platform</h2>
        <select
          className="w-full border rounded-xl p-3"
          value={targetPlatformId}
          onChange={(e) => setTargetPlatformId(e.target.value)}
        >
          <option value="">Select a platform…</option>
          {platforms.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {selectedPlatform?.notes ? (
          <p className="text-sm text-muted-foreground mt-3">{selectedPlatform.notes}</p>
        ) : null}
      </div>

      {/* Step 2 */}
      <div className="rounded-2xl border p-5">
        <h2 className="font-medium mb-3">2) Hosting Provider</h2>
        <select
          className="w-full border rounded-xl p-3"
          value={targetHostId}
          onChange={(e) => setTargetHostId(e.target.value)}
        >
          <option value="">Select a host…</option>
          {hosts.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>

        {selectedHost?.notes ? (
          <p className="text-sm text-muted-foreground mt-3">{selectedHost.notes}</p>
        ) : null}
      </div>

      {/* Step 3 */}
      <div className="rounded-2xl border p-5">
        <h2 className="font-medium mb-3">3) Intent</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm block mb-2">Monetization</label>
            <select
              className="w-full border rounded-xl p-3"
              value={monetizationIntent}
              onChange={(e) => setMonetizationIntent(e.target.value)}
            >
              <option value="ads">Ads</option>
              <option value="iap">In-app purchases</option>
              <option value="premium">Premium</option>
              <option value="sponsorship">Sponsorship</option>
            </select>
          </div>

          <div>
            <label className="text-sm block mb-2">Distribution</label>
            <select
              className="w-full border rounded-xl p-3"
              value={distributionStrategy}
              onChange={(e) => setDistributionStrategy(e.target.value)}
            >
              <option value="single-platform">Single platform</option>
              <option value="multi-platform">Multi-platform</option>
              <option value="self-hosted">Self-hosted</option>
              <option value="testing">Testing only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={saving || !targetPlatformId || !targetHostId}
          className="rounded-xl px-4 py-2 border bg-black text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save + Score"}
        </button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>

      {/* Results */}
      {result ? (
        <div className="rounded-2xl border p-5">
          <h2 className="font-medium mb-4">Launch Readiness</h2>

          <div className="grid gap-4 md:grid-cols-3">
            <ScoreCard title="Readiness" value={result.readinessScore} />
            <ScoreCard title="Platform Fit" value={result.platformFit.score} />
            <ScoreCard title="Host Compatibility" value={result.hostCompatibility.score} />
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <Breakdown title="Platform deductions" deductions={result.platformFit.deductions} />
            <Breakdown title="Host deductions" deductions={result.hostCompatibility.deductions} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ScoreCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl border p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-3xl font-semibold mt-1">{value}</p>
    </div>
  );
}

function Breakdown({ title, deductions }: { title: string; deductions: any[] }) {
  return (
    <div className="rounded-2xl border p-4">
      <p className="font-medium mb-3">{title}</p>
      {deductions?.length ? (
        <ul className="space-y-2 text-sm">
          {deductions.map((d, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span>{d.reason}</span>
              <span> className="font-medium">-{Math.round(d.penalty)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No deductions. This is a clean fit.</p>
      )}
    </div>
  );
}
