import { NextResponse } from "next/server";
import { hashPDF, verifyDocumentHash } from "@/lib/blockchain";
import { consumeVerification, getActiveSubscription } from "@/lib/subscriptions";
import { query } from "@/lib/db";
import { jsonError, requireOfficialType } from "@/lib/sessions";

export const runtime = "nodejs";

async function audit(action, entityId, session, request, meta) {
  await query(
    `
      insert into audit_logs (action, entity_id, performed_by, ip_address, meta)
      values ($1, $2, $3, $4, $5)
    `,
    [
      action,
      entityId,
      session.id,
      request.headers.get("x-forwarded-for") || "local",
      JSON.stringify(meta || {})
    ]
  );
}

export async function POST(request) {
  try {
    const session = requireOfficialType(request, ["company"]);
    const subscription = await getActiveSubscription(session.id);
    if (!subscription) {
      return NextResponse.json({ error: "Active subscription required.", action: "subscribe" }, { status: 403 });
    }

    const form = await request.formData();
    const pdf = form.get("pdf");
    if (!pdf || typeof pdf.arrayBuffer !== "function") {
      return NextResponse.json({ error: "PDF file is required." }, { status: 400 });
    }
    if (pdf.type && pdf.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are allowed." }, { status: 400 });
    }

    const buffer = Buffer.from(await pdf.arrayBuffer());
    const docHash = hashPDF(buffer);
    const chainResult = await verifyDocumentHash(docHash);
    const docs = await query(
      `
        select d.*, o.name as org_name
        from documents d
        left join organizations o on o.id = d.org_id
        where d.doc_hash=$1
      `,
      [docHash]
    );
    const doc = docs.rows[0];
    const exists = chainResult ? chainResult.exists : Boolean(doc);
    const revoked = chainResult ? chainResult.revoked : doc?.status === "revoked";

    await consumeVerification(subscription.id);
    await audit("verification", docHash, session, request, {
      result: !exists ? "not_verified" : revoked ? "revoked" : "verified",
      blockchainConfigured: Boolean(chainResult)
    });

    if (!exists) {
      return NextResponse.json({
        status: "NOT_VERIFIED",
        message: "This document was not issued by any registered organization on Yigda."
      });
    }

    if (revoked) {
      return NextResponse.json({
        status: "REVOKED",
        docHash,
        reason: doc?.revoke_reason || chainResult?.revokeReason || "Document revoked.",
        revokedAt: doc?.revoked_at || null
      });
    }

    return NextResponse.json({
      status: "VERIFIED",
      issuedBy: doc?.org_name || chainResult?.orgId,
      recipient: doc?.cid || chainResult?.cid,
      documentType: doc?.document_type || "Official Document",
      issuedOn: doc?.issue_date || null,
      blockchainProof: {
        txHash: doc?.tx_hash || null,
        network: chainResult ? "Ethereum Sepolia Testnet" : "Database fallback until Sepolia is configured"
      }
    });
  } catch (error) {
    return jsonError(error, "Verification failed.");
  }
}
