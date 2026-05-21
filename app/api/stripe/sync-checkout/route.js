import { NextResponse } from "next/server";
import { activateSubscriptionFromCheckoutSession } from "@/lib/billing";
import { getStripe } from "@/lib/stripe";
import { jsonError, requireOfficialType } from "@/lib/sessions";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const officialSession = requireOfficialType(request, ["company"]);
    const { sessionId } = await request.json();
    if (!sessionId) {
      return NextResponse.json({ error: "Stripe checkout session ID is required." }, { status: 400 });
    }

    const stripe = getStripe();
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
    if (checkoutSession.metadata?.company_id !== officialSession.id) {
      return NextResponse.json({ error: "Checkout session does not belong to this company." }, { status: 403 });
    }
    if (checkoutSession.status !== "complete" || checkoutSession.payment_status !== "paid") {
      return NextResponse.json({ error: "Checkout session is not paid yet." }, { status: 409 });
    }

    const subscription = await activateSubscriptionFromCheckoutSession(stripe, checkoutSession);
    return NextResponse.json({ subscription });
  } catch (error) {
    return jsonError(error, "Failed to sync Stripe checkout.");
  }
}
