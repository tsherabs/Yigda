import { NextResponse } from "next/server";
import { consumeVerification, getActiveSubscription } from "@/lib/subscriptions";
import { query } from "@/lib/db";
import { jsonError, requireOfficialType } from "@/lib/sessions";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  try {
    const session = requireOfficialType(request, ["company"]);
    const subscription = await getActiveSubscription(session.id);
    if (!subscription) {
      return NextResponse.json({ error: "Active subscription required.", action: "subscribe" }, { status: 403 });
    }

    const { token } = await params;
    const link = await query(
      `
        select * from shareable_links where token=$1 and expires_at > now()
        union all
        select * from share_links where token=$1 and expires_at > now()
        limit 1
      `,
      [token]
    );
    if (!link.rows.length) {
      return NextResponse.json({ error: "Share link not found or expired." }, { status: 404 });
    }

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

    await consumeVerification(subscription.id);
    await query(
      `
        insert into audit_logs (action, entity_id, performed_by, ip_address)
        values ('share_link_access', $1, $2, $3)
      `,
      [token, session.id, request.headers.get("x-forwarded-for") || "local"]
    );

    return NextResponse.json({ documents: docs.rows });
  } catch (error) {
    return jsonError(error, "Failed to open share link.");
  }
}
