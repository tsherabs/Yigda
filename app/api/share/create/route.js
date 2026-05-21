import { NextResponse } from "next/server";
import { appOrigin } from "@/lib/stripe";
import { query } from "@/lib/db";
import { getCitizenSession, jsonError } from "@/lib/sessions";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const citizen = getCitizenSession(request);
    const { documentIds, document_ids, expiresInDays, expires_in_days } = await request.json();
    const ids = Array.isArray(documentIds) ? documentIds : Array.isArray(document_ids) ? document_ids : [];
    const expiryDays = Math.min(Math.max(Number(expiresInDays || expires_in_days || 30), 1), 90);
    if (!ids.length) return NextResponse.json({ error: "Select at least one document." }, { status: 400 });

    const owned = await query(
      "select id from documents where id = any($1::uuid[]) and cid=$2 and status='active'",
      [ids, citizen.cid]
    );
    if (owned.rows.length !== ids.length) {
      return NextResponse.json({ error: "One or more documents are not active or do not belong to you." }, { status: 403 });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);
    const { rows } = await query(
      "insert into shareable_links (token, cid, document_ids, expires_at) values (gen_random_uuid(), $1, $2, $3) returning token, expires_at",
      [citizen.cid, ids, expiresAt]
    );

    return NextResponse.json({
      link: `${appOrigin(request)}/share/${rows[0].token}`,
      token: rows[0].token,
      expiresAt: rows[0].expires_at
    });
  } catch (error) {
    return jsonError(error, "Failed to create share link.");
  }
}
