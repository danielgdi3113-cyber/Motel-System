import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "./db";

type Client = PrismaClient | Prisma.TransactionClient;

export async function getOpenCashSession(client: Client = db) {
  return client.cashSession.findFirst({ where: { status: "ABERTO" }, orderBy: { openedAt: "desc" } });
}

/** Resumo do caixa: totais por forma de pagamento e dinheiro esperado na gaveta. */
export async function cashSummary(sessionId: string, client: Client = db) {
  const session = await client.cashSession.findUniqueOrThrow({ where: { id: sessionId } });
  const [byMethod, movements] = await Promise.all([
    client.payment.groupBy({ by: ["method"], where: { cashSessionId: sessionId }, _sum: { amount: true } }),
    client.cashMovement.groupBy({ by: ["type", "method"], where: { cashSessionId: sessionId }, _sum: { amount: true } }),
  ]);
  const method = (m: string) => byMethod.find((x) => x.method === m)?._sum.amount ?? 0;
  const mov = (t: string, onlyCash = false) =>
    movements.filter((x) => x.type === t && (!onlyCash || x.method === "DINHEIRO")).reduce((s, x) => s + (x._sum.amount ?? 0), 0);
  const totals = { DINHEIRO: method("DINHEIRO"), PIX: method("PIX"), DEBITO: method("DEBITO"), CREDITO: method("CREDITO") };
  const revenue = totals.DINHEIRO + totals.PIX + totals.DEBITO + totals.CREDITO;
  const sangrias = mov("SANGRIA");
  const suprimentos = mov("SUPRIMENTO");
  const fornecedores = mov("PAGAMENTO_FORNECEDOR");
  const adiantamentos = mov("ADIANTAMENTO_SALARIAL");
  const cashExpenses = mov("PAGAMENTO_FORNECEDOR", true) + mov("ADIANTAMENTO_SALARIAL", true);
  const expectedCash = session.openingAmount + totals.DINHEIRO + suprimentos - sangrias - cashExpenses;
  return { session, totals, revenue, sangrias, suprimentos, fornecedores, adiantamentos, expectedCash };
}
