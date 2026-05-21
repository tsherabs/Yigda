import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getNDIProofResult } from "@/lib/ndi";
import { setCitizenSession } from "@/lib/sessions";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const { threadId } = await request.json();
    const cleanThreadId = String(threadId || "").trim();
    if (!cleanThreadId) {
      return NextResponse.json({ error: "Proof request thread ID is required." }, { status: 400 });
    }

    const claims = await getNDIProofResult(cleanThreadId);
    const { rows } = await query(
      `
        insert into users (cid, role)
        values ($1, 'user')
        on conflict (cid)
        do update set role = coalesce(users.role, 'user')
        returning id, cid, role
      `,
      [claims.cid]
    );

    const response = NextResponse.json({
      user: {
        id: rows[0].id,
        cid: rows[0].cid,
        fullName: claims.fullName || "",
        type: "citizen"
      },
      redirectTo: "/vault",
      mode: process.env.NDI_MODE || "mock"
    });
    setCitizenSession(response, {
      id: rows[0].id,
      cid: rows[0].cid,
      full_name: claims.fullName || ""
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "NDI proof result failed.";
    const status = message.includes("timeout") || message.includes("not received") ? 425 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
