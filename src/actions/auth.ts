"use server";

import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { homeFor, SESSION_COOKIE, SESSION_HOURS, signSession, verifySession } from "@/lib/session";
import type { ActionState } from "./types";

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;
const IP_MAX_FAILS = 20;
// Hash válido de uma senha aleatória: compara mesmo quando o e-mail não existe,
// para o tempo de resposta não revelar quais e-mails estão cadastrados.
let dummyHash: string | undefined;
const getDummyHash = async () => (dummyHash ??= await bcrypt.hash(String(Math.random()), 10));

const ipFails = new Map<string, number[]>();
function ipBlocked(ip: string) {
  const now = Date.now();
  const list = (ipFails.get(ip) ?? []).filter((t) => now - t < LOCK_MINUTES * 60_000);
  ipFails.set(ip, list);
  return list.length >= IP_MAX_FAILS;
}

export async function loginAction(_: ActionState, form: FormData): Promise<ActionState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const h0 = await headers();
  const clientIp = h0.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (ipBlocked(clientIp)) return { error: `Muitas tentativas. Aguarde ${LOCK_MINUTES} minutos.` };

  const user = await db.user.findUnique({ where: { email } });
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    const min = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    return { error: `Conta bloqueada por excesso de tentativas. Tente novamente em ${min} min ou peça ao administrador para desbloquear.` };
  }
  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !user.active || !passwordOk) {
    ipFails.get(clientIp)?.push(Date.now()) ?? ipFails.set(clientIp, [Date.now()]);
    if (user && user.active) {
      const fails = user.failedLogins + 1;
      const lock = fails >= MAX_FAILS;
      await db.user.update({
        where: { id: user.id },
        data: lock
          ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) }
          : { failedLogins: fails },
      });
      if (lock) {
        await audit(user.id, `Conta de ${user.name} bloqueada por ${MAX_FAILS} senhas erradas (IP ${clientIp})`, true);
        return { error: `Conta bloqueada por ${LOCK_MINUTES} minutos após ${MAX_FAILS} tentativas erradas.` };
      }
      const left = MAX_FAILS - fails;
      return { error: `E-mail ou senha incorretos.${left <= 2 ? ` Restam ${left} tentativa(s) antes do bloqueio.` : ""}` };
    }
    return { error: "E-mail ou senha incorretos." };
  }
  if (user.failedLogins || user.lockedUntil) {
    await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  }

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
