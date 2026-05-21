import { NextResponse } from "next/server";
import { publicPlans } from "@/lib/plans";
import { query } from "@/lib/db";
import { jsonError, requireOfficialType } from "@/lib/sessions";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const session = requireOfficialType(request, ["company"]);
    const { rows } = await query("select * from subscriptions where company_id=$1", [session.id]);
    return NextResponse.json({
      subscription: rows[0] || { status: "inactive" },
      plans: publicPlans()
    });
  } catch (error) {
    return jsonError(error, "Failed to load subscription.");
  }
}
