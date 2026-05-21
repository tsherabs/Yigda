import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { jsonError, requireOfficialType } from "@/lib/sessions";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    requireOfficialType(request, ["admin"]);
    const { rows } = await query(
      `
        select
          c.id,
          c.name,
          c.country,
          c.status,
          c.created_at,
          s.plan,
          s.status as subscription_status,
          s.verifications_limit,
          s.verifications_used,
          s.end_date
        from companies c
        left join subscriptions s on s.company_id = c.id
        order by c.created_at desc
      `
    );
    return NextResponse.json({ companies: rows });
  } catch (error) {
    return jsonError(error, "Failed to load companies.");
  }
}
