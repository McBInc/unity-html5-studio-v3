// src/components/launch/LaunchReadinessPanel.tsx
export default function LaunchReadinessPanel({ launchProfile }: { launchProfile: any }) {
  const scores = launchProfile?.recommendationsJson?.scores ?? null;
  if (!scores) return null;

  return (
    <div className="rounded-2xl border p-5 mt-6">
      <h2 className="font-medium mb-4">Launch Readiness</h2>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Readiness" value={scores.readinessScore} />
        <Card title="Platform Fit" value={scores.platformFit.score} />
        <Card title="Host Compatibility" value={scores.hostCompatibility.score} />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <List title="Platform deductions" items={scores.platformFit.deductions} />
        <List title="Host deductions" items={scores.hostCompatibility.deductions} />
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl border p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-3xl font-semibold mt-1">{value}</p>
    </div>
  );
}

function List({ title, items }: { title: string; items: any[] }) {
  return (
    <div className="rounded-2xl border p-4">
      <p className="font-medium mb-3">{title}</p>
      {items?.length ? (
        <ul className="space-y-2 text-sm">
          {items.map((d, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span>{d.reason}</span>
              <span className="font-medium">-{Math.round(d.penalty)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No deductions.</p>
      )}
    </div>
  );
}
