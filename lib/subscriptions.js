import { query } from "@/lib/db";

export async function getActiveSubscription(companyId) {
  const { rows } = await query(
    `
      select *
      from subscriptions
      where company_id = $1
        and status = 'active'
        and end_date > now()
        and (verifications_limit is null or verifications_used < verifications_limit)
    `,
    [companyId]
  );
  return rows[0] || null;
}

export async function consumeVerification(subscriptionId) {
  await query("update subscriptions set verifications_used = verifications_used + 1 where id=$1", [subscriptionId]);
}
