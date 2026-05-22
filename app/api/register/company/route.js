import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { hashPassword } from "@/lib/crypto";
import { query } from "@/lib/db";
import { uploadLogo } from "@/lib/storage";

export const runtime = "nodejs";

async function readRegistration(request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return { body: await request.json(), logo: null };
  }

  const form = await request.formData();
  return {
    body: {
      name: form.get("name"),
      password: form.get("password"),
      country: form.get("country")
    },
    logo: form.get("logo")
  };
}

async function uploadOptionalLogo(logo) {
  if (!logo || typeof logo.arrayBuffer !== "function" || !logo.name) return null;
  const uploaded = await uploadLogo(Buffer.from(await logo.arrayBuffer()), {
    folder: "companies",
    publicId: randomUUID(),
    contentType: logo.type,
    filename: logo.name
  });
  return uploaded.secure_url;
}

export async function POST(request) {
  try {
    const { body, logo } = await readRegistration(request);
    const name = String(body.name || "").trim();
    const password = String(body.password || "");
    const country = String(body.country || "").trim() || null;

    if (!name || password.length < 8) {
      return NextResponse.json({ error: "Company name and an 8 character password are required." }, { status: 400 });
    }

    const existing = await query("select id from companies where lower(name)=lower($1)", [name]);
    if (existing.rows[0]) {
      return NextResponse.json({ error: "A company with that name already exists." }, { status: 409 });
    }

    const logoUrl = await uploadOptionalLogo(logo);
    const { rows } = await query(
      `
        insert into companies (name, country, logo_url, password_hash, status)
        values ($1, $2, $3, $4, 'active')
        returning id, name, country, status, logo_url
      `,
      [name, country, logoUrl, hashPassword(password)]
    );
    return NextResponse.json({ company: rows[0] }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Company registration failed.";
    const status = message.includes("duplicate") || message.includes("unique") ? 409 : 500;
    return NextResponse.json({ error: status === 409 ? "A company with that name already exists." : message }, { status });
  }
}
