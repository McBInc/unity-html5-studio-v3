import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

type Plan = "indie" | "launch";

function getPriceId(plan: Plan): { priceId: string; mode: "subscription" | "payment" } {
  if (plan === "indie") {
    const priceId = process.env.STRIPE_PRICE_PRO_MONTHLY;
    if (!priceId) throw new Error("Missing env var: STRIPE_PRICE_PRO_MONTHLY");
    return { priceId, mode: "subscription" };
  }

  // launch
  const priceId = process.env.STRIPE_PRICE_LAUNCH_PASS;
  if (!priceId) throw new Error("Missing env var: STRIPE_PRICE_LAUNCH_PASS");
  return { priceId, mode: "payment" };
}

export async function POST(req: Request) {
  try {
    // 1) Read request body
    const body = await req.json().catch(() => ({}));
    const planRaw = String(body?.plan ?? "").toLowerCase();

    const plan: Plan = planRaw === "launch" ? "launch" : "indie";

    // 2) Pick price + mode
    const { priceId, mode } = getPriceId(plan);

    // 3) Validate the priceId against Stripe (this will throw if it doesn't exist)
    const price = await stripe.prices.retrieve(priceId);

    console.log("[checkout] plan:", plan);
    console.log("[checkout] using priceId:", priceId);
    console.log("[checkout] price ok:", {
      id: price.id,
      active: price.active,
      type: price.type,
      currency: price.currency,
      unit_amount: price.unit_amount,
      recurring: price.recurring?.interval ?? null,
    });

    // 4) Create checkout session
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL;
    if (!siteUrl) throw new Error("Missing env var: NEXT_PUBLIC_SITE_URL (or SITE_URL)");

    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/launch?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/pricing?canceled=1`,
      // optional metadata (helpful later for entitlement)
      metadata: { plan },
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err: any) {
    console.error("[checkout] error:", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "Checkout failed" },
      { status: 400 }
    );
  }
}

