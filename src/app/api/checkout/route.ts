import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error("Missing env var: STRIPE_SECRET_KEY");
}

const stripe = new Stripe(stripeSecretKey);

type CheckoutPlan = "pro_monthly" | "launch_pass";

function getSiteUrl(req: Request) {
  // Prefer explicit env var, but fall back to the request origin (useful on preview URLs)
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL;

  if (envUrl) return envUrl.replace(/\/$/, "");

  const origin = req.headers.get("origin");
  if (origin) return origin.replace(/\/$/, "");

  throw new Error("Missing site URL. Set NEXT_PUBLIC_SITE_URL in Vercel.");
}

function mapPlan(plan: CheckoutPlan) {
  if (plan === "pro_monthly") {
    const priceId = process.env.STRIPE_PRICE_PRO_MONTHLY;
    if (!priceId) throw new Error("Missing env var: STRIPE_PRICE_PRO_MONTHLY");
    return { mode: "subscription" as const, priceId };
  }

  // launch_pass
  const priceId = process.env.STRIPE_PRICE_LAUNCH_PASS;
  if (!priceId) throw new Error("Missing env var: STRIPE_PRICE_LAUNCH_PASS");
  return { mode: "payment" as const, priceId };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const planRaw = String(body?.plan ?? "").toLowerCase().trim();

    if (planRaw !== "pro_monthly" && planRaw !== "launch_pass") {
      return NextResponse.json(
        { error: `Invalid plan: '${planRaw}'. Expected 'pro_monthly' or 'launch_pass'.` },
        { status: 400 }
      );
    }

    const plan = planRaw as CheckoutPlan;
    const { mode, priceId } = mapPlan(plan);

    // Validate the price exists in this Stripe account (gives definitive errors)
    const price = await stripe.prices.retrieve(priceId);

    console.log("[checkout] plan:", plan);
    console.log("[checkout] mode:", mode);
    console.log("[checkout] using priceId:", priceId);
    console.log("[checkout] price ok:", {
      id: price.id,
      active: price.active,
      type: price.type,
      currency: price.currency,
      unit_amount: price.unit_amount,
      recurring: price.recurring?.interval ?? null,
    });

    const siteUrl = getSiteUrl(req);

    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/launch?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/pricing?canceled=1`,
      metadata: { plan },
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err: any) {
    const message = err?.message || String(err);
    console.error("[checkout] error:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
