// src/app/layout.tsx
import React from "react";
import Providers from "./providers";
import HeaderAuth from "./header-auth";

export const metadata = {
  title: "Unity → HTML5 Preflight",
  description: "Quick scan + deterministic verification for Unity WebGL/HTML5 deployment.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", margin: 0 }}>
        <Providers>
          <div style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
            <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>Unity → HTML5 Preflight</div>
                <div style={{ opacity: 0.75, fontSize: 13 }}>Quick Scan • Build Verifier • Roadmap-ready JSON</div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <a href="/docs" style={{ textDecoration: "none", fontSize: 14 }}>
                  Docs
                </a>
                <HeaderAuth />
              </div>
            </header>

            <main style={{ marginTop: 24 }}>{children}</main>

            <footer style={{ marginTop: 48, paddingTop: 16, borderTop: "1px solid #eee", fontSize: 12, opacity: 0.7 }}>
              This scaffold performs analysis/verification only. Conversion steps remain user-controlled.
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
