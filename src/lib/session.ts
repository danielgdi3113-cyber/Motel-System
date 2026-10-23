import { jwtVerify, SignJWT } from "jose";
import type { Role } from "@prisma/client";

export const SESSION_COOKIE = "motel_session";
export const SESSION_HOURS = 14;

export type SessionPayload = { sub: string; name: string; role: Role };

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET ausente ou muito curto (mínimo 16 caracteres).");
  return new TextEncoder().encode(s);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ name: payload.name, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { sub: payload.sub as string, name: payload.name as string, role: payload.role as Role };
  } catch {
    return null;
  }
}

/** Página inicial de cada perfil. */
export function homeFor(role: Role): string {
  return role === "CAMAREIRA" ? "/painel/limpeza" : "/painel";
}
