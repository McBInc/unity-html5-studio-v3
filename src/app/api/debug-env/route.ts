import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    hasStripeSecret: !!process.env.STRIPE_SECRET_KEY,
    hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
    hasPriceMonthly: !!process.env.STRIPE_PRICE_PRO_MONTHLY,
    hasPriceLaunch: !!process.env.STRIPE_PRICE_LAUNCH_PASS,
  });
}
