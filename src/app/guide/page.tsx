"use client";

export default function GuidePage() {
  return (
    <div style={{ padding: 20, maxWidth: 600, margin: "0 auto" }}>

      <h1>Unity WebGL Build Guide</h1>

      <p>
        Follow these steps to ensure your WebGL build deploys correctly.
      </p>

      <Checklist />

    </div>
  );
}

function Checklist() {
  return (
    <div style={{ marginTop: 20 }}>

      <Step
        title="Enable Brotli Compression"
        body="Unity → Player Settings → Publishing Settings → Compression Format → Brotli"
      />

      <Step
        title="Enable Data Caching"
        body="Publishing Settings → Data Caching → Enabled"
      />

      <Step
        title="Ensure wasm present"
        body="Your Build folder must contain .wasm files"
      />

      <Step
        title="Rebuild WebGL"
        body="File → Build Settings → WebGL → Build"
      />

      <Step
        title="Rescan"
        body="Return to Unity → HTML5 Studio and upload new ZIP"
      />

    </div>
  );
}

function Step({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div
      style={{
        marginTop: 16,
        padding: 16,
        border: "1px solid #eee",
        borderRadius: 12,
      }}
    >
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}
