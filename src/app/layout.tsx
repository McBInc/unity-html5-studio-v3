// src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Unity → HTML5 Studio",
  description:
    "Verify, prepare, and deploy Unity WebGL builds with confidence. Scan your build, get your readiness score, and deploy without hosting errors.",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>

      <body className="bg-white text-neutral-900">
        <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
            <a href="/" className="text-sm font-extrabold tracking-tight">
              Unity → HTML5 Studio
            </a>

            <nav className="flex items-center gap-3 text-sm">
              <a
                href="/landing"
                className="rounded-lg px-3 py-2 hover:bg-neutral-100"
              >
                Overview
              </a>
              <a
                href="/"
                className="rounded-lg px-3 py-2 hover:bg-neutral-100"
              >
                Scan
              </a>
              <a
                href="/guide"
                className="rounded-lg px-3 py-2 hover:bg-neutral-100"
              >
                Build Guide
              </a>
              <a
                href="/pricing"
                className="rounded-lg bg-black px-3 py-2 font-extrabold text-white"
              >
                Pricing
              </a>
            </nav>
          </div>
        </header>

        <main className="min-h-[80vh]">{children}</main>

        <footer className="border-t py-6 text-center text-xs text-neutral-500">
          Unity → HTML5 Studio provides build verification and deployment guidance.
          Deployment and hosting remain under your control.
        </footer>
      </body>
    </html>
  );
}
