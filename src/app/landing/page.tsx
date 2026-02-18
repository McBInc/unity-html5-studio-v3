// src/app/landing/page.tsx
"use client";

import React from "react";
import Link from "next/link";

export default function FreelancerLandingPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-14 pb-10">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <p className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold tracking-wide text-neutral-700">
              Unity WebGL Deployment • Done-for-you hosting + verification
            </p>

            <h1 className="mt-4 text-4xl font-extrabold tracking-tight md:text-5xl">
              Stop WebGL hosting failures.
              <span className="block text-neutral-500">
                I’ll deploy your Unity WebGL build properly — fast.
              </span>
            </h1>

            <p className="mt-4 text-base leading-relaxed text-neutral-700">
              If your WebGL build “works locally” but fails online, I’ll help you get it running
              on a real host with the correct headers, MIME, caching, and compression handling —
              without black screens or streaming compile errors.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/preflight"
                className="rounded-xl bg-black px-5 py-3 text-sm font-extrabold text-white"
              >
                Free Preflight Check →
              </Link>

              <a
                href="#quote"
                className="rounded-xl border px-5 py-3 text-sm font-bold hover:bg-neutral-50"
              >
                Get a deployment quote
              </a>

              <Link
                href="/"
                className="rounded-xl border px-5 py-3 text-sm font-bold hover:bg-neutral-50"
              >
                Go to Scan App
              </Link>
            </div>

            <div className="mt-6 grid gap-3 text-sm text-neutral-700">
              <Bullet>Fixes the most common web-host gotchas (headers, MIME, caching).</Bullet>
              <Bullet>Works with Vercel / Netlify / Nginx / Apache / “generic hosting”.</Bullet>
              <Bullet>Clear, repeatable process you can reuse for future builds.</Bullet>
            </div>
          </div>

          {/* Proof panel */}
          <div className="rounded-2xl border bg-neutral-50 p-6 shadow-sm">
            <h2 className="text-lg font-extrabold">What usually goes wrong</h2>
            <p className="mt-2 text-sm text-neutral-700">
              Devs think they deployed correctly… until:
            </p>

            <ul className="mt-4 space-y-3 text-sm">
              <Pain>Black screen / loader stuck</Pain>
              <Pain>“wasm streaming compile failed”</Pain>
              <Pain>Incorrect <code className="rounded bg-white px-1">Content-Encoding</code> for .br/.gz</Pain>
              <Pain>Cached old files (no cache-busting / wrong headers)</Pain>
              <Pain>Cross-origin / COOP/COEP issues (platform-dependent)</Pain>
            </ul>

            <div className="mt-6 rounded-xl border bg-white p-4">
              <p className="text-sm font-extrabold">Your fastest next step</p>
              <p className="mt-1 text-sm text-neutral-700">
                Run a free preflight scan on your WebGL ZIP. You’ll get:
              </p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-700">
                <li>• Hosting readiness + red flags</li>
                <li>• Recommended host target</li>
                <li>• Fix Pack config for that host</li>
              </ul>
              <Link
                href="/preflight"
                className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-black px-4 py-3 text-sm font-extrabold text-white"
              >
                Start Preflight →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="text-2xl font-extrabold">How the deployment process works</h2>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Step
            n="1"
            title="Preflight scan"
            body="You upload your WebGL build ZIP. I verify compression, MIME, caching, and common host pitfalls."
          />
          <Step
            n="2"
            title="Host configuration"
            body="I generate the correct host config (Vercel / Netlify / Nginx / Apache) and validate it end-to-end."
          />
          <Step
            n="3"
            title="Live verification"
            body="You get a deployed URL plus a checklist to safely repeat the process for future builds."
          />
        </div>
      </section>

      {/* Quote / Lead capture */}
      <section id="quote" className="mx-auto max-w-6xl px-6 pb-16">
        <div className="rounded-2xl border bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-extrabold">Get a deployment quote</h2>
          <p className="mt-2 text-sm text-neutral-700">
            If you already have a WebGL ZIP, start with the free preflight. If you want done-for-you deployment,
            use the form below (or just start preflight and I’ll follow up with next steps).
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Field label="Your email" placeholder="you@domain.com" />
            <Field label="Target host (if known)" placeholder="Vercel / Netlify / Nginx / Apache / Not sure" />
            <Field label="Game name" placeholder="My WebGL Game" />
            <Field label="Where are you publishing?" placeholder="Poki / CrazyGames / Telegram / Just testing" />
          </div>

          <div className="mt-4">
            <label className="text-sm font-bold">What’s happening right now?</label>
            <textarea
              className="mt-2 w-full rounded-xl border p-3 text-sm"
              rows={5}
              placeholder="Tell me what you’re seeing: black screen, wasm streaming compile failed, caching issues, etc."
            />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/preflight"
              className="rounded-xl bg-black px-5 py-3 text-sm font-extrabold text-white"
            >
              Free Preflight Check →
            </Link>
            <button
              type="button"
              className="rounded-xl border px-5 py-3 text-sm font-bold hover:bg-neutral-50"
              onClick={() => alert("Wire this to your lead capture endpoint later (email/CRM).")}
            >
              Submit request
            </button>
          </div>

          <p className="mt-4 text-xs text-neutral-500">
            (We’ll wire this to your CRM/email later. For now, the preflight flow is the cleanest lead capture.)
          </p>
        </div>
      </section>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="mt-[2px] inline-block h-4 w-4 rounded-full border bg-white" />
      <span>{children}</span>
    </div>
  );
}

function Pain({ children }: { children: React.ReactNode }) {
  return (
    <li className="rounded-xl border bg-white p-3 text-neutral-800">
      <span className="font-bold">• </span>
      {children}
    </li>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-black text-sm font-extrabold text-white">
        {n}
      </div>
      <h3 className="mt-4 text-lg font-extrabold">{title}</h3>
      <p className="mt-2 text-sm text-neutral-700">{body}</p>
    </div>
  );
}

function Field({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <div>
      <label className="text-sm font-bold">{label}</label>
      <input className="mt-2 w-full rounded-xl border p-3 text-sm" placeholder={placeholder} />
    </div>
  );
}
