import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "./db";

type Client = PrismaClient | Prisma.TransactionClient;

/** Registra uma ação para o quadro "Últimas ações dos usuários". Nunca quebra a operação principal. */
export async function audit(userId: string | null, action: string, important = false, client: Client = db) {
  try {
    await client.auditLog.create({ data: { userId, action: action.slice(0, 300), important } });
  } catch (e) {
    console.error("audit", e);
  }
}
