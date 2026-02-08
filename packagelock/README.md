# Unity → HTML5 Preflight (v2 scaffold)

This is a rebuilt, streamlined version of the app focused on **deterministic scanning** + an **agent layer**.
It includes:
- **Quick Scan** (upload WebGL build ZIP) → instant feasibility report
- **Build Verifier** (Brotli, file sizes, loader hints) 
- **JSON-first outputs** (ProjectScan schema) ready for an LLM/agent to explain + prioritize

## Run locally
```bash
npm i
npm run dev
```

## What to try
- Go to `/` and upload a WebGL build ZIP.
- The server returns a scan JSON and a human-friendly summary.

## Notes
This scaffold avoids any claims of “automatic conversion”.
It’s a **preflight + roadmap** system that can be extended to parse Unity `ProjectSettings/` and `Packages/`.
