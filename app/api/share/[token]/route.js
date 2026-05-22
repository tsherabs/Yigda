import { NextResponse } from "next/server";
import { verifyDocumentHash } from "@/lib/blockchain";
import {
  consumeVerifications,
  getActiveSubscription,
  hasVerificationCapacity,
  remainingVerifications
} from "@/lib/subscriptions";
import { query } from "@/lib/db";
import { jsonError, requireOfficialType } from "@/lib/sessions";

export const runtime = "nodejs";

async function loadSharedDocuments(token) {
  const link = await query(
    `
      select * from shareable_links where token=$1 and expires_at > now()
      union all
      select * from share_links where token=$1 and expires_at > now()
      limit 1
    `,
    [token]
  );
  if (!link.rows.length) return null;

  const docs = await query(
    `
      select d.*, o.name as org_name
      from documents d
      left join organizations o on o.id = d.org_id
      where d.id = any($1::uuid[])
      order by d.issue_date desc
    `,
    [link.rows[0].document_ids]
  );

  return { link: link.rows[0], documents: docs.rows };
}

function verificationStatus(document, chainResult) {
  const exists = chainResult ? chainResult.exists : Boolean(document);
  const revoked = chainResult ? chainResult.revoked : document?.status === "revoked";
  if (!exists) return "NOT_VERIFIED";
  if (revoked) return "REVOKED";
  return "VERIFIED";
}

async function verifySharedDocument(document) {
  let chainResult = null;
  let blockchainError = "";
  try {
    chainResult = await verifyDocumentHash(document.doc_hash);
  } catch (error) {
    blockchainError = error instanceof Error ? error.message : "Blockchain verification failed.";
  }

  const status = verificationStatus(document, chainResult);
  return {
    id: document.id,
    cid: document.cid,
    documentType: document.document_type,
    issuedBy: document.org_name || chainResult?.orgId || "Issuing organization",
    issuedOn: document.issue_date,
    docHash: document.doc_hash,
    txHash: document.tx_hash || null,
    status,
    revokedReason: document.revoke_reason || chainResult?.revokeReason || "",
    blockchainProof: {
      checked: Boolean(chainResult),
      network: chainResult ? "Ethereum Sepolia Testnet" : "Database fallback",
      error: blockchainError
    }
  };
}

export async function GET(request, { params }) {
  try {
    const session = requireOfficialType(request, ["company"]);
    const subscription = await getActiveSubscription(session.id, { requireCredits: false });
    if (!subscription) {
      return NextResponse.json({ error: "Active subscription required.", action: "subscribe" }, { status: 403 });
    }

    const { token } = await params;
    const shared = await loadSharedDocuments(token);
    if (!shared) {
      return NextResponse.json({ error: "Share link not found or expired." }, { status: 404 });
    }

    await query(
      `
        insert into audit_logs (action, entity_id, performed_by, ip_address, meta)
        values ('share_link_opened', $1, $2, $3, $4)
      `,
      [
        token,
        session.id,
        request.headers.get("x-forwarded-for") || "local",
        JSON.stringify({ documentCount: shared.documents.length })
      ]
    );

    return NextResponse.json({
      documents: shared.documents,
      verification: {
        requiredCredits: shared.documents.length,
        remainingCredits: remainingVerifications(subscription)
      }
    });
  } catch (error) {
    return jsonError(error, "Failed to open share link.");
  }
}

export async function POST(request, { params }) {
  try {
    const session = requireOfficialType(request, ["company"]);
    const subscription = await getActiveSubscription(session.id, { requireCredits: false });
    if (!subscription) {
      return NextResponse.json({ error: "Active subscription required.", action: "subscribe" }, { status: 403 });
    }

    const { token } = await params;
    const shared = await loadSharedDocuments(token);
    if (!shared) {
      return NextResponse.json({ error: "Share link not found or expired." }, { status: 404 });
    }

    const creditCount = shared.documents.length;
    if (!creditCount) {
      return NextResponse.json({ error: "This share link does not contain any documents." }, { status: 400 });
    }

    if (!hasVerificationCapacity(subscription, creditCount)) {
      return NextResponse.json(
        {
          error: `Not enough verification credits. This share requires ${creditCount} credits.`,
          requiredCredits: creditCount,
          remainingCredits: remainingVerifications(subscription)
        },
        { status: 403 }
      );
    }

    const verifiedDocuments = await Promise.all(shared.documents.map((document) => verifySharedDocument(document)));
    await consumeVerifications(subscription.id, creditCount);

    const remainingCredits = remainingVerifications(subscription);
    await query(
      `
        insert into audit_logs (action, entity_id, performed_by, ip_address, meta)
        values ('share_link_verified', $1, $2, $3, $4)
      `,
      [
        token,
        session.id,
        request.headers.get("x-forwarded-for") || "local",
        JSON.stringify({
          creditsUsed: creditCount,
          statuses: verifiedDocuments.map((document) => ({
            id: document.id,
            docHash: document.docHash,
            status: document.status
          }))
        })
      ]
    );

    return NextResponse.json({
      documents: verifiedDocuments,
      creditsUsed: creditCount,
      remainingCredits: remainingCredits === null ? null : Math.max(0, remainingCredits - creditCount)
    });
  } catch (error) {
    return jsonError(error, "Shared document verification failed.");
  }
}
