"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, STAFF, ADMIN } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseMoney } from "@/lib/money";
import { BusinessError, run, type ActionState } from "./types";

export async function saveProductAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireUser(ADMIN);
  const res = await run(async () => {
    const id = String(form.get("id") ?? "");
    const data = z
      .object({
        name: z.string().trim().min(2, "Nome muito curto.").max(80),
        category: z.string().trim().min(1).max(40),
        minStock: z.coerce.number().int().min(0),
        active: z.boolean(),
      })
      .parse({
        name: form.get("name"),
        category: form.get("category") || "Geral",
        minStock: form.get("minStock") || 0,
        active: form.get("active") === "on",
      });
    const price = parseMoney(String(form.get("price") ?? ""));
    const cost = parseMoney(String(form.get("cost") ?? ""));
    if (price <= 0) throw new BusinessError("Informe o preço de venda.");

    const dup = await db.product.findFirst({ where: { name: { equals: data.name, mode: "insensitive" }, NOT: { id } } });
    if (dup) throw new BusinessError("Já existe um produto com esse nome.");

    if (id) await db.product.update({ where: { id }, data: { ...data, price, cost } });
    else await db.product.create({ data: { ...data, price, cost } });
    return "Produto salvo.";
  });
  revalidatePath("/painel/produtos");
  return res;
}

export async function stockMovementAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  const res = await run(async () => {
    const { productId, type, quantity, reason } = z
      .object({
        productId: z.string().min(1, "Escolha um produto."),
        type: z.enum(["ENTRADA", "AJUSTE"]),
        quantity: z.coerce.number().int().refine((n) => n !== 0, "Quantidade não pode ser zero."),
        reason: z.string().trim().max(200),
      })
      .parse({
        productId: form.get("productId"),
        type: form.get("type"),
        quantity: form.get("quantity"),
        reason: form.get("reason") ?? "",
      });
    if (type === "ENTRADA" && quantity < 0) throw new BusinessError("Entrada deve ser positiva.");
    if (type === "AJUSTE" && user.role !== "ADMIN") throw new BusinessError("Apenas administradores fazem ajustes.");

    await db.$transaction(async (tx) => {
      const p = await tx.product.findUniqueOrThrow({ where: { id: productId } });
      if (p.stock + quantity < 0) throw new BusinessError("O estoque não pode ficar negativo.");
      await tx.product.update({ where: { id: productId }, data: { stock: { increment: quantity } } });
      await tx.stockMovement.create({ data: { productId, type, quantity, reason, userId: user.id } });
    });
    return "Estoque atualizado.";
  });
  revalidatePath("/painel/produtos");
  return res;
}
