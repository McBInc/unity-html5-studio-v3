# Unity → HTML5 Studio — Project Status

Last Updated: Feb 2026

## Overview

Unity → HTML5 Studio is a WebGL deployment verification and launch platform.

It helps Unity developers:
- Scan WebGL builds
- Detect hosting/compression/MIME issues
- Generate Fix Packs (deployment configs)
- Deploy reliably
- Monetize via subscriptions + launch passes

---

## Current Features (Working)

### 1. Build Scanner
- Upload Unity WebGL ZIP
- Detect:
  - Brotli/Gzip
  - WASM presence
  - Loader files
  - Memory hints
  - Hosting requirements
- Produces structured ScanResponse

### 2. Fix Pack Generator
- Generates:
  - vercel.json
  - _headers (Netlify)
  - nginx.conf
  - .htaccess
  - README.md
- Downloadable as ZIP
- Limited free downloads via localStorage

### 3. Pricing Page
Location: `/pricing`

Plans:
- Indie (subscription, recurring)
- Launch Pass (one-time payment)

Buttons wired to Stripe Checkout via:
`/api/checkout`

### 4. Stripe Integration
- Stripe Checkout working
- Subscription + one-time payment supported
- Redirects to `/launch` after success
- Uses env vars:

  STRIPE_SECRET_KEY  
  STRIPE_PRICE_PRO_MONTHLY  
  STRIPE_PRICE_LAUNCH_PASS  
  NEXT_PUBLIC_SITE_URL

### 5. Launch Page
Location: `/launch`

- Displays success message after payment
- Shows deployment checklist
- Provides verification instructions
- Accepts `?success=1&session_id=...`

---

## Backend

### Checkout Route
Location:
`src/app/api/checkout/route.ts`

Responsibilities:
- Accept plan type
- Map to Stripe Price ID
- Choose mode:
  - subscription → Indie
  - payment → Launch Pass
- Redirect to Stripe Checkout
- Return session URL

---

## Known Issues / TODO

### Short-Term
- Implement Pro entitlement system (unlock limits)
- Store Stripe customer status
- Remove reliance on localStorage
- Add webhook for subscription lifecycle

### Medium-Term
- User accounts
- Project history
- Multiple builds per user
- Download history

### Long-Term
- White-label
- Agency dashboard
- Verification badge
- Unreal / Godot support

---

## Business Positioning

Primary Audience:
- Indie Unity devs
- Small studios
- Freelancers

Core Promise:
"Your WebGL build will go live — reliably."

Revenue Model:
- $19.95/month Indie
- $39.95 Launch Pass
- Agency tier (future)

---

## Current Status

✅ MVP technically functional  
✅ Payments working  
✅ Deployment flow validated  
⚠ Needs entitlement + polish  
⚠ UX copy refinement pending

Project is in “Early Revenue MVP” stage.
