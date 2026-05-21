import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { setOfficialSession } from "@/lib/sessions";
import { verifyPassword } from "@/lib/crypto";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const username = String(body.username || body.name || "").trim();
    const password = String(body.password || "");
    if (!username || !password) {
      return NextResponse.json({ error: "Username/name and password are required." }, { status: 400 });
    }

    const admin = await query("select * from admins where lower(username)=lower($1)", [username]);
    if (admin.rows[0] && verifyPassword(password, admin.rows[0].password_hash)) {
      const user = {
        id: admin.rows[0].id,
        name: admin.rows[0].username,
        type: "admin"
      };
      const response = NextResponse.json({ user, redirectTo: "/admin" });
      setOfficialSession(response, user);
      return response;
    }

    const org = await query("select * from organizations where lower(name)=lower($1)", [username]);
    if (org.rows[0]) {
      if (org.rows[0].status !== "approved") {
        return NextResponse.json({ error: "Organization is waiting for admin approval." }, { status: 403 });
      }
      if (!org.rows[0].password_hash) {
        return NextResponse.json(
          { error: "Organization has no password set. Register the organization again to set its password." },
          { status: 403 }
        );
      }
      if (verifyPassword(password, org.rows[0].password_hash)) {
        const user = {
          id: org.rows[0].id,
          name: org.rows[0].name,
          type: "org"
        };
        const response = NextResponse.json({ user, redirectTo: "/org" });
        setOfficialSession(response, user);
        return response;
      }
    }

    const company = await query("select * from companies where lower(name)=lower($1)", [username]);
    if (company.rows[0]) {
      if (company.rows[0].status !== "active") {
        return NextResponse.json({ error: "Company account is suspended." }, { status: 403 });
      }
      if (verifyPassword(password, company.rows[0].password_hash)) {
        const user = {
          id: company.rows[0].id,
          name: company.rows[0].name,
          type: "company"
        };
        const response = NextResponse.json({ user, redirectTo: "/company" });
        setOfficialSession(response, user);
        return response;
      }
    }

    return NextResponse.json({ error: "Invalid username/name or password." }, { status: 401 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Login failed." },
      { status: 500 }
    );
  }
}
