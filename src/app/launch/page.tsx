export default function LaunchPage() {
  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 20 }}>
      <h1>Launch Your Game</h1>

      <p style={{ maxWidth: 700, lineHeight: 1.6 }}>
        You're one step away from putting your game live on the web.
      </p>

      <ol style={{ marginTop: 20, lineHeight: 1.8 }}>
        <li>Download your Fix Pack</li>
        <li>Apply it to your host</li>
        <li>Deploy</li>
        <li>Verify headers</li>
        <li>Share your game</li>
      </ol>

      <p style={{ marginTop: 30, opacity: 0.7 }}>
        Guided launch workflow coming soon.
      </p>
    </div>
  );
}
