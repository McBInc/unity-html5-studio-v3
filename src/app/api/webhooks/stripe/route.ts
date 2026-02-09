import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs"; // important for Stripe + raw body

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // If this causes a TS error, remove apiVersion
  apiVersion: "2025-01-27.acacia",
});

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      const email =
        session.customer_details?.email ??
        (typeof session.customer_email === "string" ? session.customer_email : null) ??
        (session.metadata?.email ?? null);

      const customerId = typeof session.customer === "string" ? session.customer : null;
      const subId = typeof session.subscription === "string" ? session.subscription : null;

      // If you set metadata.plan in checkout, this will be present; otherwise infer:
      const plan = session.metadata?.plan ?? (subId ? "indie" : "launch");

      const expiresAt =
        plan === "launch" ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null;

      // Use email as primary key for now (no-auth MVP)
      if (!email && !customerId) break;

      await prisma.entitlement.upsert({
        where: email ? { email } : { stripeCustomerId: customerId! },
        update: {
          email: email ?? undefined,
          stripeCustomerId: customerId ?? undefined,
          stripeSubId: subId ?? undefined,
          plan,
          status: "active",
          expiresAt: expiresAt ?? undefined,
        },
        create: {
          email: email ?? undefined,
          stripeCustomerId: customerId ?? undefined,
          stripeSubId: subId ?? undefined,
          plan,
          status: "active",
          expiresAt: expiresAt ?? undefined,
        },
      });

      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;

      const status =
        sub.status === "active"
          ? "active"
          : sub.status === "past_due"
          ? "past_due"
          : "canceled";

      await prisma.entitlement.updateMany({
        where: { stripeSubId: sub.id },
        data: { status },
      });

      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;

      await prisma.entitlement.updateMany({
        where: { stripeSubId: sub.id },
        data: { status: "canceled" },
      });

      break;
    }
  }

  return NextResponse.json({ received: true });
}
