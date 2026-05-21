import { NextResponse } from "next/server";
import { maybeCitizenSession, maybeOfficialSession } from "@/lib/sessions";

export async function GET(request) {
  const official = maybeOfficialSession(request);
  if (official) {
    return NextResponse.json({
      user: {
        id: official.id,
        name: official.name,
        type: official.type
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
