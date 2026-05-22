import path from "node:path";
import { NextResponse } from "next/server";
import unzipper from "unzipper";
import { assertOrgCanIssue, issueDocumentForOrg } from "@/lib/document-issue";
import { jsonError, requireOfficialType } from "@/lib/sessions";

export const runtime = "nodejs";

function isIgnoredZipEntry(filePath) {
  const normalized = String(filePath || "").replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  const filename = parts.at(-1) || "";
  return parts.includes("__MACOSX") || filename.startsWith("._") || filename === ".DS_Store";
}

export async function POST(request) {
  try {
    const session = requireOfficialType(request, ["org"]);
    const form = await request.formData();
    const documentType = String(form.get("document_type") || form.get("documentType") || "").trim();
    const issueDate = String(form.get("issue_date") || form.get("issueDate") || "").trim() || new Date().toISOString().slice(0, 10);
    const zip = form.get("zip");

    if (!documentType || !zip || typeof zip.arrayBuffer !== "function") {
      return NextResponse.json({ error: "Document type, issue date, and ZIP file are required." }, { status: 400 });
    }

    await assertOrgCanIssue(session.id, documentType);

    const archive = await unzipper.Open.buffer(Buffer.from(await zip.arrayBuffer()));
    const results = { success: [], errors: [] };

    for (const file of archive.files) {
      if (file.type !== "File") continue;
      if (isIgnoredZipEntry(file.path)) continue;

      const filename = path.basename(file.path);
      if (!filename.toLowerCase().endsWith(".pdf")) {
        results.errors.push({ file: filename, reason: "Only PDF files are processed." });
        continue;
      }

      const cid = filename.replace(/\.pdf$/i, "");
      if (!/^\d{11}$/.test(cid)) {
        results.errors.push({ file: filename, reason: "Filename must be an 11-digit CID, for example 11001234567.pdf." });
        continue;
      }

      try {
        const document = await issueDocumentForOrg({
          session,
          cid,
          documentType,
          issueDate,
          fileBuffer: await file.buffer()
        });
        results.success.push({
          cid,
          id: document.id,
          docHash: document.doc_hash
        });
      } catch (error) {
        results.errors.push({
          file: filename,
          reason: error instanceof Error ? error.message : "Failed to issue document."
        });
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    return jsonError(error, "Bulk issue failed.");
  }
}
