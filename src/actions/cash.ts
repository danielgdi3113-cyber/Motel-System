"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, STAFF, ADMIN } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
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
    await audit(user.id, `Caixa aberto por ${user.name} com ${formatMoney(openingAmount)}`);
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
    await audit(user.id, `${type === "SANGRIA" ? "Sangria" : "Suprimento"} de ${formatMoney(amount)} por ${user.name}`, type === "SANGRIA");
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
    await audit(user.id, `Fechamento do caixa/turno por ${user.name}${diff ? ` — diferença de ${formatMoney(diff)}` : ""}`, diff !== 0);
    if (user.role !== "ADMIN") return "Caixa fechado.";
    return diff === 0 ? "Caixa fechado sem diferenças." : `Caixa fechado com diferença de ${formatMoney(diff)}.`;
  });
  revalidatePath("/painel", "layout");
  return res;
}

/** Pagamento de fornecedor ou adiantamento salarial. Só saídas em dinheiro mexem na gaveta. */
export async function expenseAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser(ADMIN);
  const res = await run(async () => {
    const data = z
      .object({
        type: z.enum(["PAGAMENTO_FORNECEDOR", "ADIANTAMENTO_SALARIAL"]),
        method: z.enum(["DINHEIRO", "PIX", "DEBITO", "CREDITO"]),
        description: z.string().trim().max(200),
        document: z.string().trim().max(60),
        companyId: z.string().nullable(),
        employeeId: z.string().nullable(),
      })
      .parse({
        type: form.get("type"),
        method: form.get("method") ?? "DINHEIRO",
        description: form.get("description") ?? "",
        document: form.get("document") ?? "",
        companyId: form.get("companyId") || null,
        employeeId: form.get("employeeId") || null,
      });
    if (data.type === "PAGAMENTO_FORNECEDOR" && !data.companyId) throw new BusinessError("Escolha o fornecedor.");
    if (data.type === "ADIANTAMENTO_SALARIAL" && !data.employeeId) throw new BusinessError("Escolha o funcionário.");
    const amount = parseMoney(String(form.get("amount") ?? ""));
    if (amount <= 0) throw new BusinessError("Informe um valor maior que zero.");
    const session = await getOpenCashSession();
    if (!session) throw new BusinessError("Nenhum caixa aberto.");
    if (data.method === "DINHEIRO") {
      const { expectedCash } = await cashSummary(session.id);
      if (amount > expectedCash) throw new BusinessError(`Valor maior que o dinheiro em caixa (${formatMoney(expectedCash)}).`);
    }
    await db.cashMovement.create({ data: { ...data, amount, cashSessionId: session.id, userId: user.id } });
    await audit(user.id, `${data.type === "PAGAMENTO_FORNECEDOR" ? "Pagamento a fornecedor" : "Adiantamento salarial"} de ${formatMoney(amount)} por ${user.name}`);
    return data.type === "PAGAMENTO_FORNECEDOR" ? "Pagamento registrado." : "Adiantamento registrado.";
  });
  revalidatePath("/painel/caixa", "layout");
  return res;
}
