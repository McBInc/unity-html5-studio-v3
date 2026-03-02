# Codebase Analysis (Unity HTML5 Studio v3)

## Executive Summary

This repository is a Next.js App Router application that combines:
- WebGL build scanning and report generation,
- authentication and account history,
- Stripe-based monetization,
- Prisma/Postgres persistence,
- host recommendation and fix-pack workflows.

The core product logic is coherent and already production-oriented (cleanup behavior, schema validation, compatibility heuristics). The biggest gaps are around type safety drift, duplicated scan logic between client/server, and a few reliability/security hardening items.

## High-Level Architecture

- **Frontend / UX**: App Router pages under `src/app/**`, with the upload/scan experience centered in `src/app/page.tsx`.
- **API layer**: Route handlers under `src/app/api/**` for scanning, history, checkout, publish, and auth.
- **Domain logic**:
  - scanner + heuristics in `src/lib/scanners/scanWebglBuildZip.ts`,
  - host/platform scoring in `src/lib/launch/*`,
  - fix pack generation in `src/lib/fixpack/generateFixPack.ts`.
- **Persistence**: Prisma models in `prisma/schema.prisma` and runtime client in `src/lib/db.ts`.
- **Auth**: NextAuth with GitHub + Email providers in `src/lib/auth.ts`.

## What Is Working Well

1. **Server-side scanner quality is strong**
   - Uses temp extraction, deterministic file inspection, and always cleans temp dirs (`finally` + `fs.rm`).
   - Performs structural checks (index, TemplateData, Build artifacts) and returns deployability signals.
   - Enforces report shape via Zod parsing before returning.

2. **Product-level recommendation logic is explicit**
   - `scanbuild` route computes host scoring and recommendation from compression and structure heuristics.
   - The response includes both normalized scores and reasoning payloads suitable for UI explainability.

3. **Data model aligns with roadmap**
   - Prisma schema includes users/projects/builds, launch profiles, fix packs, platform targets, and publish jobs.
   - This supports progressive expansion from scan-only into managed publishing.

## Key Risks / Technical Debt

1. **TypeScript health is currently failing**
   - `npx tsc --noEmit` reports implicit `any` errors and a missing `@/generated/prisma` module resolution issue.
   - This can mask regressions and weakens confidence in refactors.

2. **Client and server scanning overlap**
   - `src/app/page.tsx` performs significant ZIP analysis before sending data to `/api/scanbuild`, while the server scanner does similar work.
   - This duplication increases divergence risk (different quick scores / findings for the same input).

3. **Potential auth/email configuration risk**
   - Email provider config comments indicate likely Postmark SMTP credential mismatch; runtime auth reliability may vary by environment.

4. **Operational lint script mismatch**
   - `npm run lint` fails with current Next.js invocation pattern (`next lint` behavior changed in this setup), so the standard static-check entrypoint is broken.

## Recommended Priorities (Short-Term)

1. **Restore static-check pipeline first**
   - Fix Prisma client path generation/import consistency.
   - Resolve current TS implicit `any` errors.
   - Replace/fix lint script so CI can enforce quality gates.

2. **Converge scanning to a single source of truth**
   - Keep authoritative scanning on server (`scanWebglBuildZip`) and reduce client-side scan logic to file prechecks + UX hints.
   - This prevents logic drift and simplifies future scanner improvements.

3. **Harden auth provider config**
   - Validate Email provider credentials and add a short environment validation step at startup.

4. **Improve route-level typing**
   - Replace broad `any` usage in hot paths (`scanbuild` and history route transforms) with local typed DTOs.

## Suggested Medium-Term Refactors

- Create a dedicated `src/lib/domain/scan` module for shared score/host decision logic used by API and UI presentation.
- Add route tests for `/api/scanbuild` content-type branches (json scan/json base64/multipart/octet-stream).
- Add a minimal “golden ZIP fixtures” suite for scanner regression checks.
- Add structured logging wrappers (scan request id, user id, build id) for easier production tracing.

## Validation Commands Run During Analysis

- `npm run lint` (fails: lint command wiring issue in this environment/setup).
- `npx tsc --noEmit` (fails: existing repo TypeScript issues).

