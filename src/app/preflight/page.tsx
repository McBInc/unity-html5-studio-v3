// src/app/preflight/page.tsx
'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

type Severity = 'critical' | 'warning' | 'info';

type Finding = {
  id: string;
  severity: Severity;
  title: string;
  description?: string;
  hint?: string;
};

type ScanSummary = {
  findings: Finding[];
  meta?: Record<string, any>;
};

type Verdict = 'ready' | 'issues' | 'likely_fail';

function classNames(...v: Array<string | false | undefined | null>) {
  return v.filter(Boolean).join(' ');
}

function isZipFile(file: File) {
  const nameOk = file.name.toLowerCase().endsWith('.zip');
  const typeOk =
    !file.type ||
    file.type.includes('zip') ||
    file.type === 'application/octet-stream' ||
    file.type === 'application/x-zip-compressed';
  return nameOk && typeOk;
}

function verdictFromFindings(findings: Finding[]): Verdict {
  const critical = findings.some((f) => f.severity === 'critical');
  const warning = findings.some((f) => f.severity === 'warning');
  if (critical) return 'likely_fail';
  if (warning) return 'issues';
  return 'ready';
}

function verdictCopy(v: Verdict) {
  if (v === 'ready') {
    return {
      badge: '🟢 Ready for deployment',
      headline: 'This build looks deployable.',
      sub: 'If you want a guaranteed go-live (no black screens, no MIME surprises), I can deploy it for you.',
    };
  }
  if (v === 'issues') {
    return {
      badge: '🟠 Issues detected',
      headline: 'This build will likely need deployment fixes.',
      sub: 'This is the common “works locally, fails online” scenario. I can deploy it correctly and verify it works.',
    };
  }
  return {
    badge: '🔴 Deployment likely to fail',
    headline: 'High-risk deployment.',
    sub: 'There are critical deployment blockers. I can fix the deployment setup and get it live.',
  };
}

function severityBadge(sev: Severity) {
  if (sev === 'critical') return 'Critical';
  if (sev === 'warning') return 'Warning';
  return 'Info';
}

function severityStyles(sev: Severity) {
  if (sev === 'critical') return 'border-red-300 bg-red-50 text-red-800';
  if (sev === 'warning') return 'border-amber-300 bg-amber-50 text-amber-900';
  return 'border-slate-200 bg-slate-50 text-slate-800';
}

/**
 * Replace this with your real client-side scanner.
 * Requirement: return { findings: Finding[] }.
 */
async function runWebglZipScan(file: File, onProgress?: (pct: number, label?: string) => void): Promise<ScanSummary> {
  onProgress?.(5, 'Reading ZIP…');

  const maxMb = 800;
  if (file.size > maxMb * 1024 * 1024) {
    return {
      findings: [
        {
          id: 'zip-too-large',
          severity: 'critical',
          title: `ZIP is too large (${Math.ceil(file.size / (1024 * 1024))}MB)`,
          description: `This often causes upload or deploy failures on common hosts.`,
          hint: `Try a development build, strip unused assets, or I can deploy/optimize it for your target host.`,
        },
      ],
      meta: { name: file.name, sizeBytes: file.size },
    };
  }

  onProgress?.(35, 'Checking structure…');
  await new Promise((r) => setTimeout(r, 250));

  onProgress?.(75, 'Finalizing…');
  await new Promise((r) => setTimeout(r, 250));

  onProgress?.(100, 'Done');

  return {
    findings: [
      {
        id: 'placeholder',
        severity: 'info',
        title: 'Scan completed',
        description: 'Wire this page to your real scan engine to show true findings (compression, MIME, caching, platform rules, etc).',
      },
    ],
    meta: { name: file.name, sizeBytes: file.size },
  };
}

async function postScanToServer(payload: {
  fileMeta: { name: string; sizeBytes: number };
  summary: ScanSummary;
}) {
  // Best-effort save to your existing endpoint; safe if it fails
  const res = await fetch('/api/scanbuild', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    return { ok: false as const, error: await safeText(res) };
  }

  const data = await res.json().catch(() => ({}));
  return { ok: true as const, data };
}

async function sendReportEmail(payload: {
  email: string;
  name?: string;
  fileName: string;
  verdict: Verdict;
  findings: Finding[];
}) {
  const res = await fetch('/api/preflight-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    return { ok: false as const, error: await safeText(res) };
  }

  const data = await res.json().catch(() => ({}));
  return { ok: true as const, data };
}

async function safeText(res: Response) {
  try {
    return await res.text();
  } catch {
    return 'Unknown error';
  }
}

export default function PreflightPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [dragActive, setDragActive] = useState(false);
  const [zipFile, setZipFile] = useState<File | null>(null);

  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ pct: number; label?: string }>({ pct: 0 });
  const [scanSummary, setScanSummary] = useState<ScanSummary | null>(null);

  const [saveState, setSaveState] = useState<{ status: 'idle' | 'saving' | 'saved' | 'error'; message?: string }>({
    status: 'idle',
  });

  const [quoteOpen, setQuoteOpen] = useState(false);

  // Optional: email report
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [emailState, setEmailState] = useState<{ status: 'idle' | 'sending' | 'sent' | 'error'; message?: string }>({
    status: 'idle',
  });

  const findings = scanSummary?.findings ?? [];
  const verdict = useMemo(() => verdictFromFindings(findings), [findings]);
  const copy = useMemo(() => verdictCopy(verdict), [verdict]);

  const counts = useMemo(() => {
    const c = findings.filter((f) => f.severity === 'critical').length;
    const w = findings.filter((f) => f.severity === 'warning').length;
    const i = findings.filter((f) => f.severity === 'info').length;
    return { c, w, i };
  }, [findings]);

  const emailValid = useMemo(() => {
    const e = email.trim();
    if (!e) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  }, [email]);

  const resetAll = useCallback(() => {
    setZipFile(null);
    setScanning(false);
    setScanProgress({ pct: 0 });
    setScanSummary(null);
    setSaveState({ status: 'idle' });
    setEmailState({ status: 'idle' });
    setEmailTouched(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const onPickFile = useCallback((file: File) => {
    if (!isZipFile(file)) {
      setScanSummary({
        findings: [
          {
            id: 'not-zip',
            severity: 'critical',
            title: 'Please upload a WebGL.zip file',
            description: 'Upload the ZIP output from your Unity WebGL build.',
          },
        ],
        meta: { name: file.name, sizeBytes: file.size },
      });
      setZipFile(null);
      return;
    }

    setZipFile(file);
    setScanSummary(null);
    setSaveState({ status: 'idle' });
    setEmailState({ status: 'idle' });
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      const file = e.dataTransfer.files?.[0];
      if (file) onPickFile(file);
    },
    [onPickFile]
  );

  const startScan = useCallback(async () => {
    if (!zipFile) return;

    setScanning(true);
    setScanProgress({ pct: 0, label: 'Starting…' });
    setScanSummary(null);
    setSaveState({ status: 'idle' });
    setEmailState({ status: 'idle' });

    try {
      const summary = await runWebglZipScan(zipFile, (pct, label) => setScanProgress({ pct, label }));
      setScanSummary(summary);

      // Best-effort save (no auth required for freelance flow)
      setSaveState({ status: 'saving' });
      const saved = await postScanToServer({
        fileMeta: { name: zipFile.name, sizeBytes: zipFile.size },
        summary,
      });

      if (!saved.ok) {
        setSaveState({
          status: 'error',
          message: 'Scan saved locally only (server save failed).',
        });
      } else {
        setSaveState({ status: 'saved' });
      }
    } catch (err: any) {
      setScanSummary({
        findings: [
          {
            id: 'scan-crash',
            severity: 'critical',
            title: 'Scan failed',
            description: err?.message ? String(err.message) : 'Unknown error',
          },
        ],
        meta: { name: zipFile.name, sizeBytes: zipFile.size },
      });
      setSaveState({ status: 'idle' });
    } finally {
      setScanning(false);
    }
  }, [zipFile]);

  const doSendEmail = useCallback(async () => {
    if (!scanSummary || !zipFile) return;
    setEmailTouched(true);
    if (!emailValid) return;

    setEmailState({ status: 'sending' });
    const sent = await sendReportEmail({
      email: email.trim(),
      name: name.trim() || undefined,
      fileName: zipFile.name,
      verdict,
      findings: scanSummary.findings,
    });

    if (!sent.ok) {
      setEmailState({ status: 'error', message: 'Could not send email. (Check server logs / Postmark config.)' });
      return;
    }

    setEmailState({ status: 'sent', message: 'Sent! Check your inbox.' });
  }, [scanSummary, zipFile, emailValid, email, name, verdict]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="mb-8">
        <div className="text-sm text-slate-500">Preflight Scan</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Upload your WebGL.zip</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          I’ll check your build for common deployment blockers and give you a clear verdict. If you want me to deploy it for you, you can request a quote.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragActive(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragActive(false);
            }}
            onDrop={onDrop}
            className={classNames(
              'rounded-2xl border-2 border-dashed p-6 transition',
              dragActive ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white'
            )}
          >
            <div className="flex flex-col items-start gap-3">
              <div className="text-base font-medium text-slate-900">Drop your ZIP here</div>
              <div className="text-sm text-slate-600">
                Or{' '}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="font-medium text-slate-900 underline underline-offset-4"
                >
                  choose a file
                </button>
                .
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onPickFile(file);
                }}
              />

              {zipFile ? (
                <div className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{zipFile.name}</div>
                      <div className="text-xs text-slate-600">{Math.ceil(zipFile.size / (1024 * 1024))} MB</div>
                    </div>
                    <button
                      type="button"
                      onClick={resetAll}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-slate-100"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={startScan}
                      disabled={scanning}
                      className={classNames(
                        'rounded-xl px-4 py-2 text-sm font-semibold',
                        scanning ? 'bg-slate-200 text-slate-500' : 'bg-slate-900 text-white hover:bg-slate-800'
                      )}
                    >
                      {scanning ? 'Scanning…' : 'Run scan'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setQuoteOpen(true)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                    >
                      Request a quote
                    </button>
                  </div>

                  {scanning ? (
                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between text-xs text-slate-600">
                        <span>{scanProgress.label ?? 'Scanning…'}</span>
                        <span>{Math.round(scanProgress.pct)}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full w-[var(--w)] bg-slate-900 transition-all" style={{ ['--w' as any]: `${scanProgress.pct}%` }} />
                      </div>
                    </div>
                  ) : null}

                  {saveState.status === 'saved' ? (
                    <div className="mt-3 text-xs text-slate-600">Saved ✅</div>
                  ) : saveState.status === 'error' ? (
                    <div className="mt-3 text-xs text-amber-800">{saveState.message}</div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-3 text-xs text-slate-500">Upload the ZIP output from your Unity WebGL build.</div>
              )}
            </div>
          </div>
        </section>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-medium text-slate-900">If you want me to deploy it</div>
          <p className="mt-2 text-sm text-slate-700">
            I’ll set the hosting config correctly and verify it runs online (no black screen / MIME / compression surprises).
          </p>

          <div className="mt-5">
            <button
              type="button"
              onClick={() => setQuoteOpen(true)}
              className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Request a deployment quote
            </button>
            <p className="mt-2 text-xs text-slate-600">Fastest path to a verified working launch.</p>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold text-slate-700">What to include</div>
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              <li>• Where you’re deploying (Vercel / Netlify / Cloudflare / Poki / CrazyGames / itch.io)</li>
              <li>• Your deadline</li>
              <li>• Any error you saw (black screen, wasm MIME, compression, rejection)</li>
            </ul>
          </div>
        </aside>
      </div>

      {/* Results */}
      {scanSummary ? (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-900">
                {copy.badge}
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{copy.headline}</h2>
              <p className="mt-2 max-w-3xl text-slate-600">{copy.sub}</p>

              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1">Critical: {counts.c}</span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1">Warnings: {counts.w}</span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1">Info: {counts.i}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:min-w-[260px]">
              <button
                type="button"
                onClick={() => setQuoteOpen(true)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Request a quote
              </button>

              <Link
                href="/landing"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-center text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                Read how it works
              </Link>
            </div>
          </div>

          <div className="mt-6">
            <div className="text-sm font-medium text-slate-900">Findings</div>
            <div className="mt-3 grid gap-3">
              {findings.map((f) => (
                <div key={f.id} className={classNames('rounded-2xl border p-4', severityStyles(f.severity))}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold">{f.title}</div>
                      {f.description ? <div className="mt-1 text-sm opacity-90">{f.description}</div> : null}
                      {f.hint ? <div className="mt-2 text-xs opacity-90">Tip: {f.hint}</div> : null}
                    </div>
                    <div className="shrink-0 rounded-full border border-current/20 px-3 py-1 text-xs font-semibold">
                      {severityBadge(f.severity)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Optional email report */}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">Email me this report (optional)</div>
            <p className="mt-1 text-sm text-slate-700">If you want a copy in your inbox, enter your email and I’ll send it.</p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-slate-700">Name (optional)</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
                  placeholder="Michael"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">Email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setEmailTouched(true)}
                  className={classNames(
                    'mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900 outline-none',
                    emailTouched && !emailValid ? 'border-red-300 focus:border-red-400' : 'border-slate-200 focus:border-slate-400'
                  )}
                  placeholder="you@domain.com"
                  inputMode="email"
                  autoComplete="email"
                />
                {emailTouched && !emailValid ? <div className="mt-1 text-xs text-red-700">Enter a valid email address.</div> : null}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={doSendEmail}
                disabled={!emailValid || emailState.status === 'sending'}
                className={classNames(
                  'rounded-xl px-4 py-2 text-sm font-semibold',
                  !emailValid || emailState.status === 'sending'
                    ? 'bg-slate-200 text-slate-500'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                )}
              >
                {emailState.status === 'sending' ? 'Sending…' : 'Send report'}
              </button>

              {emailState.status === 'sent' ? <span className="text-xs text-slate-700">{emailState.message}</span> : null}
              {emailState.status === 'error' ? <span className="text-xs text-amber-800">{emailState.message}</span> : null}
            </div>
          </div>
        </section>
      ) : null}

      {/* Quote modal */}
      {quoteOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setQuoteOpen(false);
          }}
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-slate-900">Request a deployment quote</div>
                <div className="mt-1 text-sm text-slate-600">Pick the option you’re already using.</div>
              </div>
              <button
                type="button"
                onClick={() => setQuoteOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              {/* Replace with your real Fiverr/Upwork gig links */}
              <a
                href="https://www.fiverr.com/"
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100"
              >
                <div className="text-sm font-semibold text-slate-900">Continue on Fiverr</div>
                <div className="mt-1 text-xs text-slate-600">Use this if you contacted me on Fiverr.</div>
              </a>

              <a
                href="https://www.upwork.com/"
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100"
              >
                <div className="text-sm font-semibold text-slate-900">Continue on Upwork</div>
                <div className="mt-1 text-xs text-slate-600">Use this if you contacted me on Upwork.</div>
              </a>

              {/* Optional direct email */}
              <a
                href="mailto:hello@yourdomain.com?subject=Unity%20WebGL%20Deployment%20Quote"
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100"
              >
                <div className="text-sm font-semibold text-slate-900">Email me</div>
                <div className="mt-1 text-xs text-slate-600">Include host/platform + deadline.</div>
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
