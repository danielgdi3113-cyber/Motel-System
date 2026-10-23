"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, STAFF } from "@/lib/auth";
import { db } from "@/lib/db";
import { cashSummary, getOpenCashSession } from "@/lib/cash";
import { formatMoney, parseMoney } from "@/lib/money";
import { BusinessError, run, type ActionState } from "./types";

export async function openCashAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  const res = await run(async () => {
    const openingAmount = parseMoney(String(form.get("openingAmount") ?? "0"));
    if (openingAmount < 0) throw new BusinessError("Valor inválido.");
    if (await getOpenCashSession()) throw new BusinessError("Já existe um caixa aberto.");
    await db.cashSession.create({ data: { openingAmount, openedById: user.id } });
    return "Caixa aberto.";
  });
  revalidatePath("/painel", "layout");
  return res;
}

export async function cashMovementAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  const res = await run(async () => {
    const { type, description } = z
      .object({ type: z.enum(["SANGRIA", "SUPRIMENTO"]), description: z.string().trim().max(200) })
      .parse({ type: form.get("type"), description: form.get("description") ?? "" });
    const amount = parseMoney(String(form.get("amount") ?? ""));
    if (amount <= 0) throw new BusinessError("Informe um valor maior que zero.");
    const session = await getOpenCashSession();
    if (!session) throw new BusinessError("Nenhum caixa aberto.");
    if (type === "SANGRIA") {
      const { expectedCash } = await cashSummary(session.id);
      if (amount > expectedCash) throw new BusinessError(`Sangria maior que o dinheiro em caixa (${formatMoney(expectedCash)}).`);
    }
    await db.cashMovement.create({ data: { cashSessionId: session.id, type, amount, description, userId: user.id } });
    return type === "SANGRIA" ? "Sangria registrada." : "Suprimento registrado.";
  });
  revalidatePath("/painel/caixa");
  return res;
}

export async function closeCashAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  const res = await run(async () => {
    const declaredAmount = parseMoney(String(form.get("declaredAmount") ?? ""));
    const notes = String(form.get("notes") ?? "").slice(0, 500);
    const session = await getOpenCashSession();
    if (!session) throw new BusinessError("Nenhum caixa aberto.");
    const { expectedCash } = await cashSummary(session.id);
    await db.cashSession.update({
      where: { id: session.id },
      data: { status: "FECHADO", closedAt: new Date(), closedById: user.id, declaredAmount, expectedAmount: expectedCash, notes },
    });
    const diff = declaredAmount - expectedCash;
    return diff === 0 ? "Caixa fechado sem diferenças." : `Caixa fechado com diferença de ${formatMoney(diff)}.`;
  });
  revalidatePath("/painel", "layout");
  return res;
}
