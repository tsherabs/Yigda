import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { jsonError, maybeCitizenSession, maybeOfficialSession } from "@/lib/sessions";
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
    const { id } = await params;
    const citizen = maybeCitizenSession(request);
    const official = maybeOfficialSession(request);

    let rows = [];
    if (citizen) {
      const result = await query("select * from documents where id=$1 and cid=$2", [id, citizen.cid]);
      rows = result.rows;
    } else if (official?.type === "org") {
      const result = await query("select * from documents where id=$1 and org_id=$2", [id, official.id]);
      rows = result.rows;
    } else {
      return NextResponse.json({ error: "A citizen or issuing organization session is required." }, { status: 401 });
    }

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
