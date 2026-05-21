import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCitizenSession, jsonError } from "@/lib/sessions";
import { fetchCloudinaryPDF } from "@/lib/storage";

export const runtime = "nodejs";

function filenameFor(document) {
  const safeType = String(document.document_type || "document")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return `${safeType || "document"}-${document.id}.pdf`;
}

export async function GET(request, { params }) {
  try {
    const citizen = getCitizenSession(request);
    const { id } = await params;
    const { rows } = await query("select * from documents where id=$1 and cid=$2", [id, citizen.cid]);
    if (!rows.length) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    const document = rows[0];
    const buffer = await fetchCloudinaryPDF(document.cloudinary_url);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(buffer.length),
        "Content-Disposition": `attachment; filename="${filenameFor(document)}"`
      }
    });
  } catch (error) {
    return jsonError(error, "Download failed.");
  }
}
