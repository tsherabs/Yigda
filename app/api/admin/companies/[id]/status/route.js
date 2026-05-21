import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { jsonError, requireOfficialType } from "@/lib/sessions";

export const runtime = "nodejs";

export async function PATCH(request, { params }) {
  try {
    requireOfficialType(request, ["admin"]);
    const { id } = await params;
    const { status } = await request.json();
    if (!["active", "suspended"].includes(status)) {
      return NextResponse.json({ error: "Invalid company status." }, { status: 400 });
    }
    const { rows } = await query(
      "update companies set status=$1 where id=$2 returning id, name, status",
      [status, id]
    );
    return NextResponse.json({ company: rows[0] });
  } catch (error) {
    return jsonError(error, "Failed to update company.");
  }
}
