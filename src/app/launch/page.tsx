export default async function LaunchPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string; session_id?: string }>;
}) {
  const sp = await searchParams;
  const success = sp?.success === "1";
  const canceled = sp?.canceled === "1";
  const sessionId = sp?.session_id;

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 20 }}>
      <h1 style={{ marginBottom: 6 }}>Launch Your Game</h1>

      {success && (
        <div
          style={{
            marginTop: 16,
            padding: 14,
            border: "1px solid #86efac",
            background: "#f0fdf4",
            borderRadius: 14,
          }}
        >
          <div style={{ fontWeight: 900 }}>✅ Payment confirmed</div>
          <div style={{ marginTop: 6, opacity: 0.9, lineHeight: 1.6 }}>
            You’re officially in launch mode. Next: apply the Fix Pack to your host and verify headers.
          </div>

          {sessionId && (
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
              Session: <code>{sessionId}</code>
            </div>
          )}
        </div>
      )}

      {canceled && (
        <div
          style={{
            marginTop: 16,
            padding: 14,
            border: "1px solid #fca5a5",
            background: "#fef2f2",
            borderRadius: 14,
            color: "#991b1b",
          }}
        >
          <div style={{ fontWeight: 900 }}>Checkout canceled</div>
          <div style={{ marginTop: 6, opacity: 0.9, lineHeight: 1.6 }}>
            No worries — you can try again anytime from the Pricing page.
          </div>
        </div>
      )}

      <p style={{ maxWidth: 760, lineHeight: 1.6, marginTop: 18, opacity: 0.9 }}>
        Here’s the exact workflow to get your Unity WebGL build live — and avoid the classic “works locally” failures.
      </p>

      <ol style={{ marginTop: 16, lineHeight: 1.9 }}>
        <li>
          <b>Download your Fix Pack</b> (Vercel/Netlify/Apache/Nginx files)
        </li>
        <li>
          <b>Apply it to your host</b> (copy the right config into your project)
        </li>
        <li>
          <b>Deploy</b> (publish the build)
        </li>
        <li>
          <b>Verify headers</b> in Chrome DevTools (wasm MIME + encoding)
        </li>
        <li>
          <b>Share your game</b> — you’re live ✅
        </li>
      </ol>

      <div
        style={{
          marginTop: 18,
          padding: 14,
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          background: "#fafafa",
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 6 }}>✅ Quick verification checklist</div>
        <div style={{ lineHeight: 1.7, fontSize: 14, opacity: 0.9 }}>
          Open Chrome → F12 → Network → reload → click <b>.wasm.br</b> → Headers → Response Headers:
          <div style={{ marginTop: 8, padding: 10, background: "#111", color: "#fff", borderRadius: 10, fontSize: 13 }}>
            <div>content-encoding: <b>br</b></div>
            <div>content-type: <b>application/wasm</b></div>
            <div>vary: <b>Accept-Encoding</b></div>
          </div>
        </div>
      </div>

      <p style={{ marginTop: 22, fontSize: 12, opacity: 0.7 }}>
        Next: we’ll turn this into a guided “Done With You” launch flow (Phase 2).
      </p>
    </div>
  );
}
