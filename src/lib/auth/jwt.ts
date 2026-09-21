import { SignJWT, jwtVerify } from "jose";
import { SESSION_TTL_SECONDS, type UserRole } from "@/lib/constants";

// امضا و اعتبارسنجی توکن نشست.
// از jose استفاده می‌کنیم چون هم در Node و هم در Edge runtime (middleware) کار می‌کند.

export type SessionPayload = {
  userId: string;
  phone: string;
  role: UserRole;
};

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET تنظیم نشده یا کوتاه‌تر از ۳۲ کاراکتر است.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ phone: payload.phone, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.phone !== "string") return null;
    const role = payload.role === "admin" ? "admin" : "user";
    return { userId: payload.sub, phone: payload.phone, role };
  } catch {
    return null;
  }
}
