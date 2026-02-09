import Stripe from "stripe";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Use a stable Stripe API version (your "2026-01-28.clover" will cause pain)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

function getBaseUrl() {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`.replace(/\/$/, "");

  return "http://localhost:3000";
}

type Plan = "pro_monthly" | "launch_pass";

function isValidPlan(p: any): p is Plan {
  return p === "pro_monthly" || p === "launch_pass";
}

export async function POST(req: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const plan = body?.plan;

    if (!isValidPlan(plan)) {
      return NextResponse.json({ error: "Missing or invalid plan" }, { status: 400 });
    }

    const baseUrl = getBaseUrl();

    const priceId =
      plan === "pro_monthly"
        ? process.env.STRIPE_PRICE_PRO_MONTHLY
        : process.env.STRIPE_PRICE_LAUNCH_PASS;

    if (!priceId) {
      return NextResponse.json(
        { error: `Missing Stripe price env var for plan: ${plan}` },
        { status: 500 }
      );
    }

    // ✅ CRITICAL FIX:
    // Do NOT trust "plan" to decide subscription vs payment.
    // Instead, ask Stripe what the price actually is.
    const price = await stripe.prices.retrieve(priceId);

    const mode: Stripe.Checkout.SessionCreateParams.Mode = price.recurring
      ? "subscription"
      : "payment";

    // Safety: If someone wired the wrong price into the wrong env var,
    // return a helpful error instead of a confusing Stripe message.
    if (plan === "pro_monthly" && !price.recurring) {
      return NextResponse.json(
        {
          error:
            "STRIPE_PRICE_PRO_MONTHLY must be a recurring (subscription) price in Stripe. You currently have a one-time price connected.",
        },
        { status: 500 }
      );
    }

    if (plan === "launch_pass" && price.recurring) {
      return NextResponse.json(
        {
          error:
            "STRIPE_PRICE_LAUNCH_PASS must be a one-time price in Stripe. You currently have a recurring price connected.",
        },
        { status: 500 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/launch?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing?canceled=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Checkout failed" }, { status: 500 });
  }
}
