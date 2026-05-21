import { NextResponse } from "next/server";
import { issueDocumentForOrg } from "@/lib/document-issue";
import { jsonError, requireOfficialType } from "@/lib/sessions";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const session = requireOfficialType(request, ["org"]);
    const form = await request.formData();
    const cid = String(form.get("cid") || "").trim();
    const documentType = String(form.get("document_type") || form.get("documentType") || "").trim();
    const issueDate = String(form.get("issue_date") || form.get("issueDate") || "").trim() || new Date().toISOString().slice(0, 10);
    const pdf = form.get("pdf");

    if (!cid || !documentType || !pdf || typeof pdf.arrayBuffer !== "function") {
      return NextResponse.json({ error: "CID, document type, issue date, and PDF are required." }, { status: 400 });
    }
    if (pdf.type && pdf.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are allowed." }, { status: 400 });
    }

    const buffer = Buffer.from(await pdf.arrayBuffer());
    const document = await issueDocumentForOrg({
      session,
      cid,
      documentType,
      issueDate,
      fileBuffer: buffer
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    return jsonError(error, "Failed to issue document.");
  }
}
