import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { activateSubscriptionFromCheckoutSession } from "@/lib/billing";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.text();
    const stripe = getStripe();
    const signature = request.headers.get("stripe-signature");
    let event;

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (webhookSecret && webhookSecret !== "to_be_filled_after_stripe_setup") {
      event = stripe.webhooks.constructEvent(Buffer.from(body), signature, webhookSecret);
    } else {
      event = JSON.parse(body);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      await activateSubscriptionFromCheckoutSession(stripe, session);
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      await query("update subscriptions set payment_status='overdue' where stripe_subscription_id=$1", [
        invoice.subscription
      ]);
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      await query("update subscriptions set status='expired' where stripe_subscription_id=$1", [sub.id]);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook failed." },
      { status: 400 }
    );
  }
}
