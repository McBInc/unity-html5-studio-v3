// src/app/api/preflight-email/route.ts
import { NextResponse } from 'next/server';

type Severity = 'critical' | 'warning' | 'info';
type Finding = {
  id: string;
  severity: Severity;
  title: string;
  description?: string;
  hint?: string;
};

type Verdict = 'ready' | 'issues' | 'likely_fail';

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function verdictLabel(v: Verdict) {
  if (v === 'ready') return '🟢 Ready for deployment';
  if (v === 'issues') return '🟠 Issues detected';
  return '🔴 Deployment likely to fail';
}

function findingColor(sev: Severity) {
  if (sev === 'critical') return '#991b1b';
  if (sev === 'warning') return '#92400e';
  return '#0f172a';
}

export async function POST(req: Request) {
  const token = process.env.POSTMARK_SERVER_TOKEN;
  const from = process.env.POSTMARK_FROM_EMAIL; // e.g. "noreply@yourdomain.com"
  if (!token || !from) {
    return NextResponse.json(
      { ok: false, error: 'Missing POSTMARK_SERVER_TOKEN or POSTMARK_FROM_EMAIL env vars' },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body?.email || !body?.fileName || !body?.verdict || !Array.isArray(body?.findings)) {
    return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
  }

  const email = String(body.email).trim();
  const name = body.name ? String(body.name).trim() : '';
  const fileName = String(body.fileName);
  const verdict = body.verdict as Verdict;
  const findings = body.findings as Finding[];

  const subject = `Preflight Report: ${verdictLabel(verdict)} — ${fileName}`;

  const findingsHtml = findings
    .map((f) => {
      const title = escapeHtml(f.title);
      const desc = f.description ? `<div style="margin-top:4px;color:#334155;">${escapeHtml(f.description)}</div>` : '';
      const hint = f.hint ? `<div style="margin-top:6px;color:#475569;"><b>Tip:</b> ${escapeHtml(f.hint)}</div>` : '';
      const color = findingColor(f.severity);
      return `
        <div style="border:1px solid #e2e8f0;border-radius:14px;padding:14px;margin:10px 0;">
          <div style="display:flex;justify-content:space-between;gap:12px;">
            <div>
              <div style="font-weight:700;color:${color};">${title}</div>
              ${desc}
              ${hint}
            </div>
            <div style="white-space:nowrap;font-size:12px;font-weight:700;color:${color};">${escapeHtml(f.severity.toUpperCase())}</div>
          </div>
        </div>
      `;
    })
    .join('');

  const htmlBody = `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
      <h2 style="margin:0 0 10px;">Your Preflight Report</h2>
      <div style="margin-bottom:10px;color:#334155;">${name ? `Hi ${escapeHtml(name)},` : 'Hi,'} here are your results.</div>

      <div style="display:inline-block;border:1px solid #e2e8f0;border-radius:999px;padding:6px 10px;font-weight:700;">
        ${escapeHtml(verdictLabel(verdict))}
      </div>

      <div style="margin-top:14px;color:#0f172a;"><b>File:</b> ${escapeHtml(fileName)}</div>

      <h3 style="margin:18px 0 8px;">Findings</h3>
      ${findingsHtml || '<div style="color:#334155;">No findings reported.</div>'}

      <div style="margin-top:16px;color:#334155;">
        If you want me to deploy and verify this build online, reply to this email with your target host/platform and deadline.
      </div>
    </div>
  `;

  const textBody = [
    `Preflight Report`,
    ``,
    `Verdict: ${verdictLabel(verdict)}`,
    `File: ${fileName}`,
    ``,
    `Findings:`,
    ...findings.map((f) => {
      const bits = [`- [${f.severity}] ${f.title}`];
      if (f.description) bits.push(`  ${f.description}`);
      if (f.hint) bits.push(`  Tip: ${f.hint}`);
      return bits.join('\n');
    }),
    ``,
    `Reply with your target host/platform + deadline if you want me to deploy and verify it online.`,
  ].join('\n');

  const pmRes = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Postmark-Server-Token': token,
    },
    body: JSON.stringify({
      From: from,
      To: email,
      Subject: subject,
      HtmlBody: htmlBody,
      TextBody: textBody,
      MessageStream: 'outbound', // change if you use a different stream
    }),
  });

  if (!pmRes.ok) {
    const errText = await pmRes.text().catch(() => 'Postmark error');
    return NextResponse.json({ ok: false, error: errText }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
