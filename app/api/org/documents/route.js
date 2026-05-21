import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { jsonError, requireOfficialType } from "@/lib/sessions";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const session = requireOfficialType(request, ["org"]);
    const { rows } = await query(
      `
        select *
        from documents
        where org_id = $1
        order by created_at desc
      `,
      [session.id]
    );
    return NextResponse.json({ documents: rows });
  } catch (error) {
    return jsonError(error, "Failed to load issued documents.");
  }
}
