import { NextResponse } from "next/server";
import { transaction } from "@/lib/db";
import { jsonError, requireOfficialType } from "@/lib/sessions";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  try {
    requireOfficialType(request, ["admin"]);
    const { id } = await params;
    const body = await request.json();
    const documentTypes = body.documentTypes || body.permitted_document_types || [];
    if (!Array.isArray(documentTypes) || documentTypes.length === 0) {
      return NextResponse.json({ error: "Select at least one document type." }, { status: 400 });
    }

    await transaction(async (client) => {
      await client.query(
        "update organizations set status='approved', approved_at=now() where id=$1",
        [id]
      );
      await client.query("delete from org_permissions where org_id=$1", [id]);
      for (const type of documentTypes) {
        await client.query(
          "insert into org_permissions (org_id, document_type) values ($1, $2) on conflict do nothing",
          [id, String(type)]
        );
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "Approval failed.");
  }
}
