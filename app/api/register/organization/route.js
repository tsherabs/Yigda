import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/crypto";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const password = String(body.password || "");
    const country = String(body.country || "Bhutan").trim() || "Bhutan";
    const type = String(body.type || "Other").trim() || "Other";

    if (!name || password.length < 8) {
      return NextResponse.json({ error: "Organization name and an 8 character password are required." }, { status: 400 });
    }

    const existing = await query("select id, status, password_hash from organizations where lower(name)=lower($1)", [name]);
    if (existing.rows[0]) {
      if (existing.rows[0].password_hash) {
        return NextResponse.json({ error: "An organization with that name already exists." }, { status: 409 });
      }

      const { rows } = await query(
        `
          update organizations
          set type=$2,
              country=$3,
              password_hash=$4
          where id=$1
          returning id, name, status
        `,
        [existing.rows[0].id, type, country, hashPassword(password)]
      );
      return NextResponse.json({ organization: rows[0] }, { status: 200 });
    }

    const { rows } = await query(
      `
        insert into organizations (name, type, country, password_hash, status)
        values ($1, $2, $3, $4, 'pending')
        returning id, name, status
      `,
      [name, type, country, hashPassword(password)]
    );
    return NextResponse.json({ organization: rows[0] }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Organization registration failed.";
    const status = message.includes("duplicate") || message.includes("unique") ? 409 : 500;
    return NextResponse.json({ error: status === 409 ? "An organization with that name already exists." : message }, { status });
  }
}
