import { NextResponse } from "next/server";
import { appOrigin, getStripe } from "@/lib/stripe";
import { getPlan } from "@/lib/plans";
import { jsonError, requireOfficialType } from "@/lib/sessions";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const session = requireOfficialType(request, ["company"]);
    const { plan: planId } = await request.json();
    const plan = getPlan(planId);
    if (!plan) return NextResponse.json({ error: "Invalid plan." }, { status: 400 });

    const stripe = getStripe();
    const priceId = process.env[plan.stripePriceEnv];
    const lineItem = priceId
      ? { price: priceId, quantity: 1 }
      : {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: plan.amount,
            recurring: { interval: plan.interval },
            product_data: { name: `Yigda ${plan.name} verifier plan` }
          }
        };

    const origin = appOrigin(request);
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [lineItem],
      success_url: `${origin}/company?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/company?checkout=cancelled`,
      metadata: {
        company_id: session.id,
        plan: plan.id
      }
    });

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    return jsonError(error, "Failed to create checkout session.");
  }
}
