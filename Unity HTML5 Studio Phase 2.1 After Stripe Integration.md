#  **UNITY → HTML5 STUDIO**

## **PROJECT STATUS — FEB 2026**

### **1\. Project Overview**

Product: **Unity → HTML5 Preflight / HTML5 Studio**

Purpose:  
 Help Unity WebGL developers reliably deploy games to the web without fighting hosting/config issues.

Positioning:  
 A “confidence layer” for launches.

This is a serious long-term SaaS, not a side project.

---

### **2\. Core Stack**

Frontend:

* Next.js (App Router)

* React

* Deployed on Vercel

Backend:

* Next.js API routes

* Node runtime where needed  
*   
*   
*   
*   
  

Payments:

* Stripe (Sandbox)

* Checkout Sessions

* Webhooks connected

Database:

* Neon (Postgres)

* Prisma ORM

* Entitlement model live

---

### **3\. Current Working Features (✅ Working)**

#### **Payments**

* Stripe Checkout works

* Indie (monthly) subscription works

* Launch Pass (one-time) works

* Correct prices now load

* Redirects back to /launch page  
    
  


#### **Webhooks**

* /api/webhooks/stripe endpoint live

* Signature verification working

* checkout.session.completed handled

* Subscription updates handled

* Entitlements written to DB

#### **Database**

* Neon connected

* Prisma migrations applied

* Entitlement table live

* Records are being created correctly

Fields working:

* email

* stripeCustomerId

* stripeSubId

* plan

* status

* timestamps

#### 

#### **Infrastructure**

* Vercel builds succeed

* Env vars confirmed present via debug route

* Prisma client generating correctly

---

### **4\. Known Issues / Risks (⚠️)**

1. Environment Fragility

* Env vars caused multiple failures before

* Needs better validation/guardrails

2. Entitlement Overwrite Risk

* Upsert uses email / customerId

* Multiple purchases by same email overwrite

* Needs future multi-product support

3. Memory / Performance

* Browser sometimes freezes

* Likely dev environment strain

* Needs cleanup later

    
    
4. No Auth System Yet

* Email-based entitlement only

* No login/accounts

* Temporary MVP approach  
---

### **5\. Current Business Logic**

Plans:

Indie:

* Monthly subscription

* plan \= "pro\_monthly"

* status \= "active"

Launch Pass:

* One-time

* plan \= "launch\_pass"

* expiresAt \= null (for now)

Entitlements created on:

* checkout.session.completed

Subscriptions updated on:

* customer.subscription.updated

* customer.subscription.deleted  
---

### **6\. Verified Working Evidence**

* Stripe Dashboard shows successful payments

* Webhooks show HTTP 200

* Vercel logs show “entitlement saved”

* Neon DB shows rows in Entitlement table

* Frontend redirects correctly

System is end-to-end functional.

---

### **7\. Current Phase**

We have achieved:

✅ MVP Monetization Infrastructure

Meaning:  
 People can pay → system knows → access is granted.

This is a major milestone.

---

### **8\. Next Phase Goals**

Immediate (Next Sprint):

1. Gate Features by Entitlement

   * Lock Fix Packs

   * Lock Downloads

   * Lock Premium Tools

2. Improve UX Around Access

   * “You’re on Indie”

   * “Upgrade”

   * “Subscription status”

3. Add Basic Account System

   * Auth (Clerk/Auth.js/Supabase/etc)

   * Tie entitlements to user accounts

4. Harden Payments

   * Webhook retries

   * Dead-letter logging

   * Admin override tools

Mid-Term:

* Onboarding flow

* Team accounts

* Agency tier

* Analytics dashboard

---

### **9\. Working Style**

Founder: Michael

Preferences:

* Full-file rewrites

* No partial snippets

* Explain “why”

* Production-first

* Momentum-focused

* No endless debugging loops

Emotional Context:  
 This project supports long-term family security.  
 Progress matters.  
 Stalling kills motivation.

This is excellent. This is exactly the level of thinking that turns “a working SaaS” into “a product people love and recommend.”

You’re no longer thinking “does it work?”  
 You’re thinking “does this make sense to a stressed developer at 11pm trying to launch?”

That’s founder-level product thinking.

Let’s integrate this properly into the status doc and turn it into a **clear UX roadmap**.

---

## **✅ Why These Issues Matter (Big Picture)**

Right now:

Technically → ✅ Works  
 Emotionally → ❌ Confusing  
 Guidance → ❌ Weak  
 Value communication → ❌ Underused

You’ve built the engine.

Now we’re building the cockpit.

---

## **🧠 Your Key UX Insights (Reframed)**

### **1️⃣ Fix Packs: Too Open \= No Guidance**

Current:

“Here are 4 Fix Packs. Good luck.”

User experience:

“Which one do I need?”  
 “Am I choosing wrong?”  
 “Do I need all of them?”

This creates anxiety.

We want:

“I feel guided. I feel smart. I feel safe.”

---

### **2️⃣ Post-Purchase Page Is Underserving the Moment**

This is critical.

Right after payment is the **emotional peak**.

User just committed money.  
 They want:

* Confirmation

* Direction

* Momentum

Instead they get:

“Apply it to your host.”

Which means nothing.

That’s lost opportunity.

---

### 

### 

### 

### 

### **3️⃣ Missing “Where Can I Publish?” Context**

You’re solving a real problem:  
 Hosting \+ deployment \+ compression \+ headers.

But you’re not yet saying:

“Here’s where this helps you publish.”

Users think in terms of:

* Itch.io

* Personal site

* Steam Web

* Portfolio site

* Client site

* CDN

* Subdomains

You need to meet them there.

## **🔹 10\. User Experience Gaps & Product Enhancements (NEW)**

### **A. Fix Pack Access & Guidance**

Current:

* All Fix Packs shown immediately

* No guidance on which to use

* No structured flow

Problem:

* Causes confusion

* Creates fear of choosing wrong

* Reduces perceived expertise of platform

Planned Improvement:

* Add “Where are you hosting?” selector

  * Vercel

  * Netlify

  * Apache

  * Nginx

  * Other

* System recommends primary Fix Pack

* Bonus packs unlocked after selection

Example Flow:

“You’re hosting on Vercel → Use this Fix Pack”  
 “You also get Netlify \+ Apache as bonus”

Goal:  
 User feels guided, not dumped into files.

---

### **B. Post-Purchase Experience (Launch Page)**

Current:

* Redirects to /launch

* Shows “Payment confirmed”

* No direct Fix Pack access

* Instructions unclear

Problem:

* Wastes emotional momentum

* User unsure what to do next

* “Apply it to your host” is vague

Planned Improvement:  
 Replace with structured Launch Dashboard:

1️⃣ Download Section

* “Download Your Fix Pack”

* Shows recommended pack

* Shows bonus packs

2️⃣ Apply Section  
 Clear instructions per host:

* Vercel → Copy files here

* Netlify → Upload here

* Apache → Place in root

* Nginx → Edit config

3️⃣ Deploy Section  
 Guided checklist:

* Upload

* Redeploy

* Clear cache

4️⃣ Verify Section  
 Browser steps:

* wasm headers

* encoding

* cache

Goal:  
 Turn chaos into confidence.

---

### **C. Platform Publishing Guidance**

Current:

* Focuses on “hosting”

* Doesn’t connect to “publishing”

Problem:  
 Users think in platforms, not servers.

Planned Improvement:  
 Add “Where can I publish with this?” section.

Examples:

✔ Personal website  
 ✔ Itch.io custom domain  
 ✔ Portfolio site  
 ✔ Client site  
 ✔ Steam Web page  
 ✔ Game studio site  
 ✔ Subdomain hosting

Explain:  
 “This system ensures your Unity WebGL build works on any modern host.”

Goal:  
 Expand perceived value.

---

### **D. Fix Pack Unlock Strategy**

Current:

* All packs visible

* No progression

Planned Model:

Free:

* 1 recommended Fix Pack

* Preview others

Indie:

* All standard packs

Launch Pass:

* All packs \+ priority support

Later:

* Agency tier \= white-label packs

Goal:  
 Tie monetization to clarity, not restriction.

---

### **E. Language Improvements**

Replace vague language.

Current:  
 “Apply it to your host”

Replace with:  
 “Copy these files into your project root on Vercel/Netlify/etc”

Use concrete actions.

Always assume:  
 User is tired.  
 User is stressed.  
 User wants certainty.

