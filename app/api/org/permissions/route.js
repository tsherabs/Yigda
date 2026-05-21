import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { jsonError, requireOfficialType } from "@/lib/sessions";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const session = requireOfficialType(request, ["org"]);
    const { rows } = await query(
      `
        select document_type
        from org_permissions
        where org_id = $1
        order by document_type
      `,
      [session.id]
    );
    return NextResponse.json({ documentTypes: rows.map((row) => row.document_type) });
  } catch (error) {
    return jsonError(error, "Failed to load organization permissions.");
  }
}
