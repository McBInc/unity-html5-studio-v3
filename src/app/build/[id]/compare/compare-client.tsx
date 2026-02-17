// src/app/build/[id]/compare/compare-client.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Host = {
  id: string;
  name: string;
  slug: string;
  notes: string | null;
};

type Platform = {
  id: string;
  name: string;
  slug: string;
  notes: string | null;
};

type ExistingLaunchProfile = {
  targetHostId: string | null;
  targetPlatformId: string | null;
} | null;

type CompareResult = {
  platform: Platform;
  score: {
    readinessScore: number;
    platformFit: { score: number; deductions: any[] };
    hostCompatibility: { score: number; deductions: any[] };
  };
};

export default function CompareClient({
  buildId,
  hosts,
  platforms,
  existing,
}: {
  buildId: string;
  hosts: Host[];
  platforms: Platform[];
  existing: ExistingLaunchProfile;
}) {
  const [targetHostId, setTargetHostId] = useState<string>(existing?.targetHostId ?? "");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CompareResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedHost = useMemo(
    () => hosts.find((h) => h.id === targetHostId) ?? null,
    [hosts, targetHostId]
  );

  async function runCompare() {
    setError(null);
    setLoading(true);
    setResults(null);
    try {
      const res = await fetch("/api/launch-profile/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buildId, targetHostId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Compare failed");
      setResults(data.results || []);
    } catch (e: any) {
      setError(e.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function applyTarget(platformId: string) {
    setError(null);
    try {
      const res = await fetch("/api/launch-profile/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buildId,
          targetPlatformId: platformId,
          targetHostId,
          monetizationIntent: null,
          distributionStrategy: "single-platform",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Apply target failed");

      // after applying, refresh compare results so UI reflects current scores
      await runCompare();
    } catch (e: any) {
      setError(e.message || "Unknown error");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border p-5">
        <div className="grid gap-4 md:grid-cols-3 items-end">
          <div className="md:col-span-2">
            <label className="text-sm block mb-2">Host</label>
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

          <button
            className="rounded-xl px-4 py-3 border bg-black text-white disabled:opacity-50"
            disabled={!targetHostId || loading}
            onClick={runCompare}
          >
            {loading ? "Comparing…" : "Compare Platforms"}
          </button>
        </div>

        {error ? <p className="text-sm text-red-600 mt-4">{error}</p> : null}
      </div>

      {results ? (
        <div className="rounded-2xl border p-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold">Results</h2>
            <div className="flex items-center gap-3">
              <Link className="rounded-xl px-3 py-2 border" href={`/build/${buildId}`}>
                Back to Build
              </Link>
              <Link className="rounded-xl px-3 py-2 border bg-black text-white" href={`/build/${buildId}/launch`}>
                Launch Wizard
              </Link>
            </div>
          </div>

          <div className="space-y-3">
            {results.map((r) => (
              <ResultRow
                key={r.platform.id}
                r={r}
                isActive={
                  existing?.targetPlatformId === r.platform.id &&
                  existing?.targetHostId === targetHostId
                }
                onApply={() => applyTarget(r.platform.id)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border p-10 text-center">
          <p className="font-medium">No comparison yet</p>
          <p className="text-sm text-muted-foreground mt-2">
            Select a host and run a comparison to rank platforms by Launch Readiness.
          </p>
        </div>
      )}
    </div>
  );
}

function ResultRow({
  r,
  isActive,
  onApply,
}: {
  r: CompareResult;
  isActive: boolean;
  onApply: () => void;
}) {
  return (
    <div className="rounded-2xl border p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{r.platform.name}</span>
          <Badge>Readiness: {r.score.readinessScore}</Badge>
          <Badge>PlatformFit: {r.score.platformFit.score}</Badge>
          <Badge>HostCompat: {r.score.hostCompatibility.score}</Badge>
          {isActive ? <Badge>Active Target</Badge> : null}
        </div>

        {r.platform.notes ? (
          <p className="text-xs text-muted-foreground mt-2">{r.platform.notes}</p>
        ) : null}

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <MiniList title="Platform deductions" items={r.score.platformFit.deductions} />
          <MiniList title="Host deductions" items={r.score.hostCompatibility.deductions} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          className="rounded-xl px-3 py-2 border bg-black text-white disabled:opacity-50"
          onClick={onApply}
          disabled={isActive}
        >
          {isActive ? "Applied" : "Apply Target"}
        </button>
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="text-xs border rounded-full px-2 py-1">{children}</span>;
}

function MiniList({ title, items }: { title: string; items: any[] }) {
  return (
    <div className="rounded-2xl border p-3">
      <p className="text-xs font-medium mb-2">{title}</p>
      {items?.length ? (
        <ul className="space-y-1 text-xs">
          {items.slice(0, 4).map((d, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span className="truncate">{d.reason}</span>
              <span className="font-medium">-{Math.round(d.penalty)}</span>
            </li>
          ))}
          {items.length > 4 ? (
            <li className="text-muted-foreground">…and {items.length - 4} more</li>
          ) : null}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No deductions.</p>
      )}
    </div>
  );
}
