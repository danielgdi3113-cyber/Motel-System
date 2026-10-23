"use server";

import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { homeFor, SESSION_COOKIE, SESSION_HOURS, signSession, verifySession } from "@/lib/session";
import type { ActionState } from "./types";

export async function loginAction(_: ActionState, form: FormData): Promise<ActionState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = await db.user.findUnique({ where: { email } });
  const valid = user && user.active && (await bcrypt.compare(password, user.passwordHash));
  if (!valid) return { error: "E-mail ou senha incorretos." };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  await db.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
  await audit(user.id, `${user.name} entrou no sistema (IP ${ip})`);
  const token = await signSession({ sub: user.id, name: user.name, role: user.role });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  redirect(homeFor(user.role));
}

export async function logoutAction() {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (session) {
    await db.user.update({ where: { id: session.sub }, data: { lastSeenAt: null } }).catch(() => {});
    await audit(session.sub, `${session.name} saiu do sistema`);
  }
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
