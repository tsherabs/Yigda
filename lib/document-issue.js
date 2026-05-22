import { randomUUID } from "node:crypto";
import { query } from "@/lib/db";
import { anchorDocumentHash, hashPDF } from "@/lib/blockchain";
import { sendPush } from "@/lib/push";
import { uploadPDF } from "@/lib/storage";

function assertValidPDFBuffer(buffer) {
  const file = Buffer.from(buffer || []);
  if (!file.length) {
    throw new Error("PDF file is empty.");
  }
  if (file.length < 5 || file.subarray(0, 5).toString("utf8") !== "%PDF-") {
    throw new Error("File is not a valid PDF.");
  }
}

export async function assertOrgCanIssue(orgId, documentType) {
  const org = await query("select status, name from organizations where id=$1", [orgId]);
  if (!org.rows[0] || org.rows[0].status !== "approved") {
    throw new Error("Organization is not approved.");
  }

  const permission = await query(
    "select 1 from org_permissions where org_id=$1 and document_type=$2",
    [orgId, documentType]
  );
  if (!permission.rows.length) {
    throw new Error(`Your organization cannot issue ${documentType}.`);
  }

  return org.rows[0];
}

export async function issueDocumentForOrg({ session, cid, documentType, issueDate, fileBuffer }) {
  assertValidPDFBuffer(fileBuffer);
  const org = await assertOrgCanIssue(session.id, documentType);
  const docHash = hashPDF(fileBuffer);
  const docId = randomUUID();
  const uploaded = await uploadPDF(fileBuffer, docId);

  const { rows } = await query(
    `
      insert into documents
        (id, cid, org_id, document_type, issue_date, cloudinary_url, doc_hash, tx_hash, status)
      values ($1, $2, $3, $4, $5, $6, $7, null, 'active')
      returning *
    `,
    [docId, cid, session.id, documentType, issueDate, uploaded.secure_url, docHash]
  );

  await query(
    `
      insert into audit_logs (action, entity_id, performed_by, meta)
      values ('document_issued', $1, $2, $3)
    `,
    [
      docId,
      session.id,
      JSON.stringify({
        cid,
        documentType,
        docHash,
        statement: `Fingerprint ${docHash} was issued to CID ${cid} by organization ${session.name}.`
      })
    ]
  );

  anchorDocumentHash(cid, docHash, session.id)
    .then((txHash) => {
      if (txHash) return query("update documents set tx_hash=$1 where id=$2", [txHash, docId]);
    })
    .catch((error) => console.error("Blockchain anchor failed:", error.message));

  sendPush(cid, "Document Ready", `Your ${documentType} from ${org.name} is ready on Yigda.`).catch(() => {});

  return rows[0];
}
