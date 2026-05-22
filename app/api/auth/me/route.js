import { NextResponse } from "next/server";
import { maybeCitizenSession, maybeOfficialSession } from "@/lib/sessions";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request) {
  const official = maybeOfficialSession(request);
  if (official) {
    let current = null;
    if (official.type === "org" || official.type === "company") {
      const table = official.type === "org" ? "organizations" : "companies";
      const { rows } = await query(`select name, logo_url from ${table} where id=$1`, [official.id]);
      current = rows[0] || null;
    }
    return NextResponse.json({
      user: {
        id: official.id,
        name: current?.name || official.name,
        type: official.type,
        logoUrl: current?.logo_url || official.logoUrl || null
      }
    });
  }

  const citizen = maybeCitizenSession(request);
  if (citizen) {
    return NextResponse.json({
      user: {
        id: citizen.id,
        cid: citizen.cid,
        name: citizen.name,
        type: "citizen"
      }
    });
  }

  return NextResponse.json({ user: null });
}
