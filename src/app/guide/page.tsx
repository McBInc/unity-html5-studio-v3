// src/app/guide/page.tsx
import Link from 'next/link';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-semibold tracking-tight text-slate-900">{children}</h2>;
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
          {n}
        </div>
        <div className="w-full">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="mt-2 text-sm leading-6 text-slate-700">{children}</div>
        </div>
      </div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{children}</div>;
}

function Warn({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{children}</div>;
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[13px] text-slate-800">{children}</code>;
}

export default function GuidePage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="mb-8">
        <div className="text-sm text-slate-500">Build Guide</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Unity → WebGL build steps (click-by-click)</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          This is the exact Unity editor workflow to produce a WebGL build you can zip and upload to the Preflight scan. Follow the steps in order — most
          WebGL deployment failures come from <span className="font-semibold">a few specific settings</span>.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/preflight"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Run Preflight Scan
          </Link>
          <Link
            href="/portfolio"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          >
            View portfolio
          </Link>
        </div>
      </div>

      {/* Part 0: Prereqs */}
      <section className="mb-10">
        <SectionTitle>Before you start</SectionTitle>
        <div className="mt-4 grid gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">What you need</div>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              <li>• Unity project opens and runs in the Editor (Play mode)</li>
              <li>• Enough disk space for a WebGL build output folder</li>
              <li>• If prompted: install WebGL Build Support module for your Unity version</li>
            </ul>
            <Tip>
              If you get stuck at any step, don’t guess. Take a screenshot of the Unity window and the Console panel — those two screenshots usually reveal
              the blocker instantly.
            </Tip>
          </div>
        </div>
      </section>

      {/* Part 1: Install WebGL support */}
      <section className="mb-10">
        <SectionTitle>Step-by-step: Create a WebGL build</SectionTitle>

        <div className="mt-4 grid gap-3">
          <Step n={1} title="Confirm WebGL Build Support is installed">
            <div>
              In Unity Hub:
              <ul className="mt-2 space-y-1">
                <li>
                  • Go to <span className="font-semibold">Installs</span> → find your Unity version → click the{' '}
                  <span className="font-semibold">⋯</span> menu → <span className="font-semibold">Add modules</span>
                </li>
                <li>
                  • Ensure <span className="font-semibold">WebGL Build Support</span> is checked → install
                </li>
              </ul>
              <Tip>
                If WebGL isn’t installed, Unity won’t switch the build target and you’ll burn an hour wondering why settings won’t “stick”.
              </Tip>
            </div>
          </Step>

          <Step n={2} title="Open Build Settings and switch platform to WebGL">
            <div>
              In Unity Editor:
              <ul className="mt-2 space-y-1">
                <li>
                  • Click <Code>File → Build Settings…</Code>
                </li>
                <li>
                  • In the Platform list, select <span className="font-semibold">WebGL</span>
                </li>
                <li>
                  • Click <span className="font-semibold">Switch Platform</span> (wait for the reimport to finish)
                </li>
              </ul>
              <Warn>
                Don’t continue until “Switch Platform” completes. Half-built imports are a common cause of “it builds but doesn’t load”.
              </Warn>
            </div>
          </Step>

          <Step n={3} title="Add your scene(s) to ‘Scenes In Build’">
            <div>
              In <Code>File → Build Settings…</Code>:
              <ul className="mt-2 space-y-1">
                <li>• Make sure your main scene is listed in “Scenes In Build”</li>
                <li>
                  • If it’s missing: open the scene, then click <span className="font-semibold">Add Open Scenes</span>
                </li>
                <li>• Ensure the checkbox next to your main scene is ticked</li>
              </ul>
              <Tip>
                If the wrong scene is first in the list, your build can “load” but show the wrong content (looks like a black screen or stuck loader).
              </Tip>
            </div>
          </Step>

          <Step n={4} title="Open Player Settings (WebGL tab) and set the critical options">
            <div>
              From <Code>File → Build Settings…</Code> click <span className="font-semibold">Player Settings…</span>
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">A) WebGL → Publishing Settings</div>
                <ul className="mt-2 space-y-1">
                  <li>
                    • <span className="font-semibold">Compression Format</span>:
                    <ul className="ml-5 mt-1 list-disc space-y-1">
                      <li>
                        If you control hosting (Netlify/Cloudflare/Vercel): use <span className="font-semibold">Brotli</span> or{' '}
                        <span className="font-semibold">Gzip</span> (smaller downloads, faster load)
                      </li>
                      <li>
                        If you are unsure / want safest: start with <span className="font-semibold">Disabled</span> (bigger files, fewer hosting pitfalls)
                      </li>
                    </ul>
                  </li>
                  <li>
                    • <span className="font-semibold">Decompression Fallback</span>: turn <span className="font-semibold">ON</span>
                  </li>
                </ul>

                <Warn>
                  Most “works locally but fails online” issues come from compression + missing server headers. If you use Brotli/Gzip, your host must serve
                  the correct <span className="font-semibold">Content-Encoding</span> and <span className="font-semibold">Content-Type</span>.
                </Warn>
              </div>

              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">B) WebGL → Other Settings</div>
                <ul className="mt-2 space-y-1">
                  <li>
                    • <span className="font-semibold">Color Space</span>: keep default unless you know you need Linear (affects visuals, not deployment)
                  </li>
                  <li>
                    • <span className="font-semibold">Scripting Backend</span>: typically <span className="font-semibold">IL2CPP</span> for WebGL
                  </li>
                </ul>
              </div>

              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">C) (Optional) WebGL → Memory</div>
                <ul className="mt-2 space-y-1">
                  <li>
                    • If your game crashes on load: increase <span className="font-semibold">Memory Size</span> gradually
                  </li>
                  <li>• If you only need a portfolio demo: keep the build small and simple first</li>
                </ul>
              </div>
            </div>
          </Step>

          <Step n={5} title="Build the project">
            <div>
              Go back to <Code>File → Build Settings…</Code>:
              <ul className="mt-2 space-y-1">
                <li>• Confirm Platform = WebGL</li>
                <li>
                  • Click <span className="font-semibold">Build</span> (not “Build And Run”)
                </li>
                <li>
                  • Choose an empty folder like <Code>Builds/MyGame-WebGL</Code>
                </li>
                <li>• Wait for build completion</li>
              </ul>
              <Tip>
                Use “Build” first so you can inspect the output folder and zip it cleanly. “Build And Run” can hide what actually got produced.
              </Tip>
            </div>
          </Step>

          <Step n={6} title="Zip the build output correctly (this part matters)">
            <div>
              In your file explorer, open the build output folder. You should see files like:
              <ul className="mt-2 space-y-1">
                <li>
                  • <Code>index.html</Code>
                </li>
                <li>
                  • <Code>Build/</Code>
                </li>
                <li>
                  • <Code>TemplateData/</Code>
                </li>
              </ul>

              <Warn>
                Your ZIP must contain <span className="font-semibold">index.html at the root</span>. If you zip the parent folder incorrectly, you end up
                with <Code>MyGame-WebGL/index.html</Code> inside the ZIP and deployment often fails.
              </Warn>

              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">Correct ZIP structure</div>
                <div className="mt-2 text-sm text-slate-700">
                  ✅ ZIP root contains <Code>index.html</Code>, <Code>Build/</Code>, <Code>TemplateData/</Code>
                  <br />
                  ❌ ZIP root contains a single folder <Code>MyGame-WebGL/</Code> and everything is inside it
                </div>
              </div>

              <Tip>
                Name the zip <span className="font-semibold">WebGL.zip</span> and upload it to Preflight.
              </Tip>
            </div>
          </Step>
        </div>
      </section>

      {/* Part 2: Most common problems */}
      <section className="mb-10">
        <SectionTitle>Common WebGL build problems (and what to do)</SectionTitle>

        <div className="mt-4 grid gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">Problem: Build completes, but loading hangs or black screens</div>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              <li>• First test locally by opening a local server (Unity builds don’t like file://)</li>
              <li>• Then deploy and check browser console + network tab</li>
              <li>• If you enabled Brotli/Gzip: hosting MUST serve correct headers (this is the #1 issue)</li>
            </ul>
            <Tip>
              For “portfolio builds”, the safest approach is: Compression = <span className="font-semibold">Disabled</span> for your first working demo. Once
              it’s live, enable compression later.
            </Tip>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">Problem: Missing dependencies / errors after switching to WebGL</div>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              <li>• Some packages/plugins are not WebGL compatible (native DLLs are common offenders)</li>
              <li>• Check Unity Console errors right after switching platform</li>
              <li>• Try a clean import or remove/disable incompatible plugins for the demo build</li>
            </ul>
            <Warn>
              If a demo asset uses native plugins, it can run fine on Windows/macOS builds but fail instantly on WebGL. That’s not your fault — it’s the
              asset’s compatibility.
            </Warn>
          </div>
        </div>
      </section>

      {/* Part 3: What to upload */}
      <section>
        <SectionTitle>What to upload to HTML5 Studio</SectionTitle>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <ul className="space-y-2 text-sm text-slate-700">
            <li>
              • Upload <span className="font-semibold">WebGL.zip</span> where the ZIP root contains <Code>index.html</Code>
            </li>
            <li>• Run the scan</li>
            <li>• If you want a verified outcome: request a quote and tell me your target host/platform</li>
          </ul>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/preflight"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Go to Preflight
            </Link>
            <Link
              href="/portfolio"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              Portfolio
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
