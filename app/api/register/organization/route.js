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
      country: form.get("country"),
      type: form.get("type")
    },
    logo: form.get("logo")
  };
}

async function uploadOptionalLogo(logo) {
  if (!logo || typeof logo.arrayBuffer !== "function" || !logo.name) return null;
  const uploaded = await uploadLogo(Buffer.from(await logo.arrayBuffer()), {
    folder: "organizations",
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

      const logoUrl = await uploadOptionalLogo(logo);
      const { rows } = await query(
        `
          update organizations
          set type=$2,
              country=$3,
              password_hash=$4,
              logo_url=coalesce($5, logo_url)
          where id=$1
          returning id, name, status, logo_url
        `,
        [existing.rows[0].id, type, country, hashPassword(password), logoUrl]
      );
      return NextResponse.json({ organization: rows[0] }, { status: 200 });
    }

    const logoUrl = await uploadOptionalLogo(logo);
    const { rows } = await query(
      `
        insert into organizations (name, type, country, logo_url, password_hash, status)
        values ($1, $2, $3, $4, $5, 'pending')
        returning id, name, status, logo_url
      `,
      [name, type, country, logoUrl, hashPassword(password)]
    );
    return NextResponse.json({ organization: rows[0] }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Organization registration failed.";
    const status = message.includes("duplicate") || message.includes("unique") ? 409 : 500;
    return NextResponse.json({ error: status === 409 ? "An organization with that name already exists." : message }, { status });
  }
}
