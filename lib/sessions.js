import { NextResponse } from "next/server";
import { createSignedToken, verifySignedToken } from "@/lib/crypto";

export const officialSessionCookie = "official_session";
export const citizenSessionCookie = "citizen_session";

function parseCookie(header, name) {
  const parts = String(header || "")
    .split(";")
    .map((part) => part.trim());
  const match = parts.find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

function cookieValue(request, name) {
  return request.cookies?.get?.(name)?.value || parseCookie(request.headers.get("cookie"), name);
}

function useSecureCookies() {
  const origin = process.env.BASE_URL || process.env.APP_URL || process.env.FRONTEND_URL || "";
  return origin.startsWith("https://");
}

export function getOfficialSession(request) {
  const payload = verifySignedToken(cookieValue(request, officialSessionCookie));
  if (payload.kind !== "official" || !payload.id || !payload.type) {
    throw new Error("Official session is invalid.");
  }
  return payload;
}

export function getCitizenSession(request) {
  const payload = verifySignedToken(cookieValue(request, citizenSessionCookie));
  if (payload.kind !== "citizen" || !payload.cid) {
    throw new Error("Citizen session is invalid.");
  }
  return payload;
}

export function maybeOfficialSession(request) {
  try {
    return getOfficialSession(request);
  } catch {
    return null;
  }
}

export function maybeCitizenSession(request) {
  try {
    return getCitizenSession(request);
  } catch {
    return null;
  }
}

export function requireOfficialType(request, types) {
  const session = getOfficialSession(request);
  if (!types.includes(session.type)) {
    throw new Error("You do not have permission to perform this action.");
  }
  return session;
}

export function jsonError(error, fallback = "Request failed.", status = 500) {
  const message = error instanceof Error ? error.message : fallback;
  const authStatus = message.includes("permission") ? 403 : 401;
  const resolvedStatus = message.includes("session") ? authStatus : status;
  return NextResponse.json({ error: message || fallback }, { status: resolvedStatus });
}

export function setOfficialSession(response, user) {
  response.cookies.set({
    name: officialSessionCookie,
    value: createSignedToken(
      {
        kind: "official",
        id: user.id,
        name: user.name,
        type: user.type
      },
      Number(process.env.OFFICIAL_SESSION_TTL_SECONDS || 8 * 60 * 60)
    ),
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookies(),
    path: "/",
    maxAge: Number(process.env.OFFICIAL_SESSION_TTL_SECONDS || 8 * 60 * 60)
  });
}

export function setCitizenSession(response, citizen) {
  response.cookies.set({
    name: citizenSessionCookie,
    value: createSignedToken(
      {
        kind: "citizen",
        id: citizen.id,
        cid: citizen.cid,
        name: citizen.full_name || ""
      },
      Number(process.env.CITIZEN_SESSION_TTL_SECONDS || 7 * 24 * 60 * 60)
    ),
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookies(),
    path: "/",
    maxAge: Number(process.env.CITIZEN_SESSION_TTL_SECONDS || 7 * 24 * 60 * 60)
  });
}

export function clearSessionCookies(response) {
  for (const name of [officialSessionCookie, citizenSessionCookie]) {
    response.cookies.set({
      name,
      value: "",
      httpOnly: true,
      sameSite: "lax",
      secure: useSecureCookies(),
      path: "/",
      maxAge: 0
    });
  }
}
