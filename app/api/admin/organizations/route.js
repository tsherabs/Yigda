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
          o.*,
          coalesce(
            array_agg(p.document_type order by p.document_type)
            filter (where p.document_type is not null),
            '{}'
          ) as document_types
        from organizations o
        left join org_permissions p on p.org_id = o.id
        group by o.id
        order by o.created_at desc
      `
    );
    return NextResponse.json({ organizations: rows });
  } catch (error) {
    return jsonError(error, "Failed to load organizations.");
  }
}
