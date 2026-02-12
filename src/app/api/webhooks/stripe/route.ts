import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// --- Load + validate env vars at startup ---
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

if (!STRIPE_SECRET_KEY) throw new Error("Missing STRIPE_SECRET_KEY env var");
if (!STRIPE_WEBHOOK_SECRET) throw new Error("Missing STRIPE_WEBHOOK_SECRET env var");

const stripe = new Stripe(STRIPE_SECRET_KEY);
const webhookSecret: string = STRIPE_WEBHOOK_SECRET;

function mapStripeSubStatus(status: Stripe.Subscription.Status): "active" | "past_due" | "canceled" {
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due" || status === "unpaid") return "past_due";
  return "canceled";
}

export async function POST(req: Request) {
  console.log("[webhook] received request");

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    console.error("[webhook] missing stripe-signature header");
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let body: string;
  try {
    body = await req.text();
  } catch (err) {
    console.error("[webhook] failed to read body", err);
    return NextResponse.json({ error: "Failed to read request body" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error("[webhook] signature verification failed:", err?.message);
    return NextResponse.json({ error: `Signature error: ${err?.message}` }, { status: 400 });
  }

  console.log("[webhook] verified event:", event.type);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const checkoutSessionId = session.id;

        const email =
          session.customer_details?.email ??
          (typeof session.customer_email === "string" ? session.customer_email : null);

        const customerId = typeof session.customer === "string" ? session.customer : null;

        const subId = typeof session.subscription === "string" ? session.subscription : null;

        const plan = session.metadata?.plan ?? (subId ? "indie" : "launch");

        console.log("[webhook] checkout completed:", {
          checkoutSessionId,
          email,
          customerId,
          subId,
          plan,
        });

        if (!email) {
          // In practice, we really want email for account linking.
          // You *can* fall back to customerId, but that may delay account creation.
          console.warn("[webhook] missing email; cannot link to User. Skipping entitlement create.");
          break;
        }

        // 1) Find-or-create user
        const user = await prisma.user.upsert({
          where: { email },
          update: {},
          create: { email },
        });

        // 2) Idempotent create entitlement for this checkout session
        await prisma.entitlement.upsert({
          where: { checkoutSessionId },
          update: {
            userId: user.id,
            email,
            stripeCustomerId: customerId ?? undefined,
            stripeSubId: subId ?? undefined,
            plan,
            status: "active",
          },
          create: {
            userId: user.id,
            email,
            stripeCustomerId: customerId ?? undefined,
            stripeSubId: subId ?? undefined,
            checkoutSessionId,
            plan,
            status: "active",
          },
        });

        console.log("[webhook] entitlement saved (idempotent by checkoutSessionId)");
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;

        console.log("[webhook] subscription updated:", sub.id, sub.status);

        await prisma.entitlement.updateMany({
          where: { stripeSubId: sub.id },
          data: { status: mapStripeSubStatus(sub.status) },
        });

        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;

        console.log("[webhook] subscription deleted:", sub.id);

        await prisma.entitlement.updateMany({
          where: { stripeSubId: sub.id },
          data: { status: "canceled" },
        });

        break;
      }

      default:
        console.log("[webhook] ignored event:", event.type);
    }
  } catch (err) {
    console.error("[webhook] handler failed:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
