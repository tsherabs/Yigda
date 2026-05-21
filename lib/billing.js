import { query } from "@/lib/db";
import { getPlan } from "@/lib/plans";

export async function activateSubscriptionFromCheckoutSession(stripe, checkoutSession) {
  const plan = getPlan(checkoutSession.metadata?.plan);
  const companyId = checkoutSession.metadata?.company_id;
  if (!plan || !companyId) {
    throw new Error("Checkout session is missing Yigda subscription metadata.");
  }

  const stripeSubscriptionId =
    typeof checkoutSession.subscription === "string"
      ? checkoutSession.subscription
      : checkoutSession.subscription?.id || null;

  let endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 1);

  if (stripeSubscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    if (subscription.current_period_end) {
      endDate = new Date(subscription.current_period_end * 1000);
    }
  }

  const { rows } = await query(
    `
      insert into subscriptions
        (company_id, plan, start_date, end_date, verifications_limit, verifications_used, status, payment_status, stripe_subscription_id)
      values ($1, $2, now(), $3, $4, 0, 'active', 'paid', $5)
      on conflict (company_id)
      do update set plan=$2,
                    start_date=now(),
                    end_date=$3,
                    verifications_limit=$4,
                    verifications_used=0,
                    status='active',
                    payment_status='paid',
                    stripe_subscription_id=$5
      returning *
    `,
    [companyId, plan.id, endDate, plan.limit, stripeSubscriptionId]
  );

  return rows[0];
}
