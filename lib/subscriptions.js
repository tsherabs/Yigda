import { query } from "@/lib/db";

export function remainingVerifications(subscription) {
  if (!subscription) return 0;
  if (subscription.verifications_limit === null || subscription.verifications_limit === undefined) return null;
  return Math.max(0, Number(subscription.verifications_limit) - Number(subscription.verifications_used || 0));
}

export async function getActiveSubscription(companyId, options = {}) {
  const requireCredits = options.requireCredits !== false;
  const { rows } = await query(
    `
      select *
      from subscriptions
      where company_id = $1
        and status = 'active'
        and end_date > now()
        ${requireCredits ? "and (verifications_limit is null or verifications_used < verifications_limit)" : ""}
    `,
    [companyId]
  );
  return rows[0] || null;
}

export function hasVerificationCapacity(subscription, count = 1) {
  const remaining = remainingVerifications(subscription);
  return remaining === null || remaining >= Number(count);
}

export async function consumeVerifications(subscriptionId, count = 1) {
  const amount = Math.max(0, Number(count || 0));
  if (!amount) return;
  await query("update subscriptions set verifications_used = coalesce(verifications_used, 0) + $2 where id=$1", [
    subscriptionId,
    amount
  ]);
}

export async function consumeVerification(subscriptionId) {
  await consumeVerifications(subscriptionId, 1);
}
