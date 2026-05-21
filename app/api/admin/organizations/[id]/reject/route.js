import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { jsonError, requireOfficialType } from "@/lib/sessions";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  try {
    requireOfficialType(request, ["admin"]);
    const { id } = await params;
    await query("update organizations set status='rejected', approved_at=null where id=$1", [id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "Rejection failed.");
  }
}
