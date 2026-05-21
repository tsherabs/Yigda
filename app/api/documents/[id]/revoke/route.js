import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { revokeDocumentHash } from "@/lib/blockchain";
import { jsonError, requireOfficialType } from "@/lib/sessions";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  try {
    const session = requireOfficialType(request, ["org"]);
    const { id } = await params;
    const { reason } = await request.json();
    const cleanReason = String(reason || "").trim();
    if (!cleanReason) {
      return NextResponse.json({ error: "Revocation reason is required." }, { status: 400 });
    }

    const existing = await query("select * from documents where id=$1 and org_id=$2", [id, session.id]);
    if (!existing.rows.length) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    await query("update documents set status='revoked', revoke_reason=$1, revoked_at=now() where id=$2", [
      cleanReason,
      id
    ]);

    revokeDocumentHash(existing.rows[0].doc_hash, cleanReason)
      .then((txHash) => {
        if (txHash) return query("update documents set revoke_tx_hash=$1 where id=$2", [txHash, id]);
      })
      .catch((error) => console.error("Blockchain revoke failed:", error.message));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "Revocation failed.");
  }
}
