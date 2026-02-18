// src/app/layout.tsx
import React from "react";
import Providers from "./providers";
import "./globals.css";

export const metadata = {
  title: "Unity → HTML5 Studio",
  description: "Quick scan + deterministic verification for Unity WebGL/HTML5 deployment.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-neutral-900">
        <Providers>
          <div className="mx-auto max-w-6xl px-6 py-6">
            <header className="flex items-center justify-between gap-4">
              <div>
                <div className="font-extrabold text-lg">Unity → HTML5 Studio</div>
                <div className="text-xs text-neutral-600">
                  Quick Scan • Fix Packs • Launch Readiness
                </div>
              </div>
            </header>

            <main className="mt-6">{children}</main>

            <footer className="mt-12 border-t pt-4 text-xs text-neutral-500">
              Built for safe, repeatable WebGL hosting verification and deployment guidance.
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
