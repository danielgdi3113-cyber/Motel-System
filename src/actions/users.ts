"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, ADMIN } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { BusinessError, run, type ActionState } from "./types";

export async function saveUserAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser(ADMIN);
  const res = await run(async () => {
    const id = String(form.get("id") ?? "");
    const data = z
      .object({
        name: z.string().trim().min(2, "Nome muito curto.").max(60),
        email: z.string().trim().toLowerCase().email("E-mail inválido."),
        role: z.enum(["ADMIN", "RECEPCAO", "CAMAREIRA"]),
        active: z.boolean(),
      })
      .parse({ name: form.get("name"), email: form.get("email"), role: form.get("role"), active: form.get("active") === "on" });
    const password = String(form.get("password") ?? "");
    if (!id && password.length < 6) throw new BusinessError("A senha precisa de pelo menos 6 caracteres.");
    if (password && password.length < 6) throw new BusinessError("A senha precisa de pelo menos 6 caracteres.");
    if (id === me.id && (!data.active || data.role !== "ADMIN")) throw new BusinessError("Você não pode remover seu próprio acesso de administrador.");

    const dup = await db.user.findFirst({ where: { email: data.email, NOT: { id } } });
    if (dup) throw new BusinessError("E-mail já cadastrado.");
    const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;
    if (id) await db.user.update({ where: { id }, data: { ...data, ...(passwordHash && { passwordHash }) } });
    else await db.user.create({ data: { ...data, passwordHash: passwordHash! } });
    return "Usuário salvo.";
  });
  revalidatePath("/painel/configuracoes");
  return res;
}

export async function saveSettingsAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireUser(ADMIN);
  const res = await run(async () => {
    const keys = Object.keys(DEFAULT_SETTINGS) as (keyof typeof DEFAULT_SETTINGS)[];
    const tolerance = Number(form.get("toleranceMinutes"));
    if (!Number.isInteger(tolerance) || tolerance < 0 || tolerance > 60) throw new BusinessError("Tolerância entre 0 e 60 minutos.");
    await db.$transaction(
      keys.map((key) => {
        const value = String(form.get(key) ?? DEFAULT_SETTINGS[key]).trim().slice(0, 200);
        return db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
      }),
    );
    return "Configurações salvas.";
  });
  revalidatePath("/", "layout");
  return res;
}
