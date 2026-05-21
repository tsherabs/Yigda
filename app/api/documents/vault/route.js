import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCitizenSession, jsonError } from "@/lib/sessions";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const citizen = getCitizenSession(request);
    const { rows } = await query(
      `
        select d.*, o.name as org_name
        from documents d
        left join organizations o on o.id = d.org_id
        where d.cid = $1
        order by d.issue_date desc, d.created_at desc
      `,
      [citizen.cid]
    );
    return NextResponse.json({ documents: rows });
  } catch (error) {
    return jsonError(error, "Failed to load vault.");
  }
}
