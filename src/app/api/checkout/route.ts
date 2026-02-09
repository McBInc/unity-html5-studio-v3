import Stripe from "stripe";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2026-01-28.clover",
});

function getBaseUrl() {
  // prefer NEXT_PUBLIC_SITE_URL if set
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");

  // fallback for Vercel
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`.replace(/\/$/, "");

  // last resort (local)
  return "http://localhost:3000";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const plan = body?.plan as string | undefined;

    if (!process.env.STRIPE_SECRET_KEY) {
      return new NextResponse("Missing STRIPE_SECRET_KEY", { status: 500 });
    }

    let priceId = "";
    if (plan === "pro_monthly") priceId = process.env.STRIPE_PRICE_PRO_MONTHLY || "";
    if (plan === "launch_pass") priceId = process.env.STRIPE_PRICE_LAUNCH_PASS || "";

    if (!priceId) {
      return new NextResponse("Missing or unknown plan/price mapping", { status: 400 });
    }

    const baseUrl = getBaseUrl();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/launch?success=1`,
      cancel_url: `${baseUrl}/pricing?canceled=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    return new NextResponse(e?.message || "Checkout failed", { status: 500 });
  }
}


