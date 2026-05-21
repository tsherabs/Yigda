import crypto from "node:crypto";
import bcrypt from "bcryptjs";

function secret() {
  return process.env.HMAC_SECRET || "yigda-local-dev-secret-change-me";
}

function base64Url(input) {
  return Buffer.from(input).toString("base64url");
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("base64url");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, storedHash) {
  const stored = String(storedHash || "");
  if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) {
    return bcrypt.compareSync(String(password), stored);
  }

  const [scheme, salt, expectedHash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !expectedHash) return false;
  const candidate = crypto.scryptSync(String(password), salt, 64).toString("base64url");
  return (
    candidate.length === expectedHash.length &&
    crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(expectedHash))
  );
}

export function createSignedToken(payload, ttlSeconds) {
  const body = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + Number(ttlSeconds)
  };
  const encodedPayload = base64Url(JSON.stringify(body));
  const signature = crypto.createHmac("sha256", secret()).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

export function verifySignedToken(token) {
  const [encodedPayload, signature] = String(token || "").split(".");
  if (!encodedPayload || !signature) throw new Error("Session is required.");

  const expected = crypto.createHmac("sha256", secret()).update(encodedPayload).digest("base64url");
  if (
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    throw new Error("Session is invalid.");
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Session has expired.");
  }
  return payload;
}

export function sha256Hex(buffer) {
  return crypto.createHash("sha256").update(Buffer.from(buffer)).digest("hex");
}
