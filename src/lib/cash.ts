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
    client.cashMovement.groupBy({ by: ["type"], where: { cashSessionId: sessionId }, _sum: { amount: true } }),
  ]);
  const method = (m: string) => byMethod.find((x) => x.method === m)?._sum.amount ?? 0;
  const mov = (t: string) => movements.find((x) => x.type === t)?._sum.amount ?? 0;
  const totals = { DINHEIRO: method("DINHEIRO"), PIX: method("PIX"), DEBITO: method("DEBITO"), CREDITO: method("CREDITO") };
  const revenue = totals.DINHEIRO + totals.PIX + totals.DEBITO + totals.CREDITO;
  const sangrias = mov("SANGRIA");
  const suprimentos = mov("SUPRIMENTO");
  const expectedCash = session.openingAmount + totals.DINHEIRO + suprimentos - sangrias;
  return { session, totals, revenue, sangrias, suprimentos, expectedCash };
}
