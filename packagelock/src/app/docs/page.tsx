import React from "react";

export default function DocsPage() {
  return (
    <div style={{ maxWidth: 820, lineHeight: 1.6 }}>
      <h1>Docs</h1>
      <p>
        This rebuilt scaffold focuses on a reliable pattern:
        <b> deterministic scans first</b>, then an <b>agent</b> can explain and prioritize.
      </p>

      <h2>What the build scan checks</h2>
      <ul>
        <li>Presence of Brotli/Gzip artifacts (.br/.gz)</li>
        <li>Largest files (data/wasm/framework/loader)</li>
        <li>Loader hints for memory configuration</li>
        <li>Hosting requirements: Content-Encoding for .br, MIME for wasm</li>
      </ul>

      <h2>Next extensions</h2>
      <ul>
        <li>Unity project scan: ProjectSettings + Packages + plugin inventory</li>
        <li>Asset weight scan (top textures/audio/models)</li>
        <li>Export “Fix Pack”: vercel.json / netlify headers / nginx snippets</li>
      </ul>
    </div>
  );
}
