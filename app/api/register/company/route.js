import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/crypto";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const password = String(body.password || "");
    const country = String(body.country || "").trim() || null;

    if (!name || password.length < 8) {
      return NextResponse.json({ error: "Company name and an 8 character password are required." }, { status: 400 });
    }

    const { rows } = await query(
      `
        insert into companies (name, country, password_hash, status)
        values ($1, $2, $3, 'active')
        returning id, name, country, status
      `,
      [name, country, hashPassword(password)]
    );
    return NextResponse.json({ company: rows[0] }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Company registration failed.";
    const status = message.includes("duplicate") || message.includes("unique") ? 409 : 500;
    return NextResponse.json({ error: status === 409 ? "A company with that name already exists." : message }, { status });
  }
}
