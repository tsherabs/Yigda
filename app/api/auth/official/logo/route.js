import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { query } from "@/lib/db";
import { jsonError, requireOfficialType, setOfficialSession } from "@/lib/sessions";
import { uploadLogo } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const session = requireOfficialType(request, ["org", "company"]);
    const form = await request.formData();
    const logo = form.get("logo");
    if (!logo || typeof logo.arrayBuffer !== "function") {
      return NextResponse.json({ error: "Logo image is required." }, { status: 400 });
    }

    const uploaded = await uploadLogo(Buffer.from(await logo.arrayBuffer()), {
      folder: session.type === "org" ? "organizations" : "companies",
      publicId: randomUUID(),
      contentType: logo.type,
      filename: logo.name
    });

    const table = session.type === "org" ? "organizations" : "companies";
    await query(`update ${table} set logo_url=$1 where id=$2`, [uploaded.secure_url, session.id]);

    const user = {
      id: session.id,
      name: session.name,
      type: session.type,
      logoUrl: uploaded.secure_url
    };
    const response = NextResponse.json({ user, logoUrl: uploaded.secure_url });
    setOfficialSession(response, user);
    return response;
  } catch (error) {
    return jsonError(error, "Logo upload failed.");
  }
}
