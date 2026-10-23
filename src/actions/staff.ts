"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BusinessError, run, type ActionState } from "./types";

export async function changePasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  return run(async () => {
    const current = String(form.get("current") ?? "");
    const next = String(form.get("next") ?? "");
    if (!(await bcrypt.compare(current, user.passwordHash))) throw new BusinessError("Senha atual incorreta.");
    if (next.length < 6) throw new BusinessError("A nova senha precisa de pelo menos 6 caracteres.");
    if (next !== String(form.get("confirm") ?? "")) throw new BusinessError("A confirmação não confere.");
    await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next, 10) } });
    return "Senha alterada.";
  });
}

export async function sendMessageAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const res = await run(async () => {
    const body = z.string().trim().min(1, "Escreva a mensagem.").max(1000).parse(form.get("body"));
    const toUserId = String(form.get("toUserId") ?? "") || null;
    await db.internalMessage.create({ data: { body, authorId: user.id, toUserId, readByIds: [user.id] } });
    return "Mensagem enviada.";
  });
  revalidatePath("/painel", "layout");
  return res;
}
