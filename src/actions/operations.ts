"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, STAFF } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getOpenCashSession } from "@/lib/cash";
import { parseMoney, formatMoney } from "@/lib/money";
import { parseDebtor, parsePayments, settlePayments } from "@/lib/payments";
import { BusinessError, run, type ActionState } from "./types";

// ---------- Venda avulsa ----------

export async function saleAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  const res = await run(async () => {
    const items = z
      .array(z.object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(99) }))
      .min(1, "Adicione pelo menos um item.")
      .parse(JSON.parse(String(form.get("items") ?? "[]")));
    const discount = parseMoney(String(form.get("discount") ?? ""));
    const customerName = String(form.get("customerName") ?? "").trim().slice(0, 60);
    const payments = parsePayments(form);
    const debtor = form.get("leavePending") === "on" ? parseDebtor(form.get("debtor")) : null;

    const sale = await db.$transaction(async (tx) => {
      const cash = await getOpenCashSession(tx);
      if (!cash) throw new BusinessError("Abra o caixa antes de vender.");
      let subtotal = 0;
      const lines = [];
      for (const it of items) {
        const product = await tx.product.findUnique({ where: { id: it.productId } });
        if (!product || !product.active) throw new BusinessError("Produto indisponível.");
        const dec = await tx.product.updateMany({
          where: { id: product.id, stock: { gte: it.quantity } },
          data: { stock: { decrement: it.quantity } },
        });
        if (dec.count === 0) throw new BusinessError(`Estoque insuficiente de ${product.name} (${product.stock} un.).`);
        subtotal += product.price * it.quantity;
        lines.push({ productId: product.id, quantity: it.quantity, unitPrice: product.price });
      }
      if (discount < 0 || discount > subtotal) throw new BusinessError("Desconto inválido.");
      const total = subtotal - discount;
      const { final, pendingAmount } = settlePayments(payments, total, !!debtor);

      const sale = await tx.sale.create({
        data: {
          customerName,
          subtotal,
          discount,
          total,
          createdById: user.id,
          cashSessionId: cash.id,
          items: { create: lines },
          payments: { create: final.map((p) => ({ ...p, cashSessionId: cash.id })) },
        },
      });
      await tx.stockMovement.createMany({
        data: lines.map((l) => ({ productId: l.productId, type: "VENDA" as const, quantity: -l.quantity, reason: "Venda avulsa", userId: user.id })),
      });
      if (pendingAmount > 0 && debtor) {
        await tx.pending.create({
          data: { ...debtor, description: "Venda avulsa", amount: pendingAmount, saleId: sale.id, createdById: user.id },
        });
      }
      return sale;
    });
    await audit(user.id, `Venda avulsa de ${formatMoney(sale.total)} por ${user.name}`);
    return `Venda registrada: ${formatMoney(sale.total)}.`;
  });
  revalidatePath("/painel/venda");
  return res;
}

// ---------- Lista de espera ----------

export async function waitlistAddAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireUser(STAFF);
  const res = await run(async () => {
    const data = z
      .object({
        name: z.string().trim().min(1, "Informe um nome ou apelido.").max(60),
        phone: z.string().trim().max(20),
        plate: z.string().trim().toUpperCase().max(10),
        categoryId: z.string().optional(),
        mode: z.enum(["PERIODO", "PERNOITE"]),
        notes: z.string().trim().max(200),
      })
      .parse({
        name: form.get("name"),
        phone: form.get("phone") ?? "",
        plate: form.get("plate") ?? "",
        categoryId: form.get("categoryId") || undefined,
        mode: form.get("mode") ?? "PERIODO",
        notes: form.get("notes") ?? "",
      });
    await db.waitlistEntry.create({ data });
    return "Adicionado à lista de espera.";
  });
  revalidatePath("/painel/espera");
  return res;
}

export async function waitlistStatusAction(form: FormData) {
  await requireUser(STAFF);
  const status = z.enum(["ATENDIDO", "DESISTIU"]).parse(form.get("status"));
  await db.waitlistEntry.updateMany({
    where: { id: String(form.get("id")), status: "AGUARDANDO" },
    data: { status, resolvedAt: new Date() },
  });
  revalidatePath("/painel/espera");
}

// ---------- Serviço de quarto ----------

export async function orderStatusAction(form: FormData) {
  const user = await requireUser(STAFF);
  const id = String(form.get("id"));
  const status = z.enum(["PREPARANDO", "ENTREGUE", "CANCELADO"]).parse(form.get("status"));
  await db.$transaction(async (tx) => {
    const order = await tx.roomServiceOrder.findUnique({ where: { id }, include: { items: true, stay: true } });
    if (!order || order.status === "ENTREGUE" || order.status === "CANCELADO") return;
    if (status === "CANCELADO") {
      if (order.stay.status !== "ABERTA") return;
      // Cancelar o pedido estorna os itens da conta e do estoque
      for (const c of order.items) {
        await tx.product.update({ where: { id: c.productId }, data: { stock: { increment: c.quantity } } });
        await tx.stockMovement.create({
          data: { productId: c.productId, type: "ESTORNO", quantity: c.quantity, reason: `Pedido #${order.number} cancelado`, userId: user.id },
        });
      }
      await tx.consumption.deleteMany({ where: { orderId: id } });
    }
    await tx.roomServiceOrder.update({ where: { id }, data: { status } });
    if (status !== "PREPARANDO") {
      const items = order.items.map((c) => `${c.quantity}x`).join(", ");
      await tx.auditLog.create({
        data: { userId: user.id, action: `Pedido #${order.number} ${status === "ENTREGUE" ? "entregue" : "cancelado"} (${items} itens) por ${user.name}` },
      });
    }
  });
  revalidatePath("/painel/servicos");
}

// ---------- Pendências ----------

export async function pendingCreateAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  const res = await run(async () => {
    const debtor = parseDebtor(form.get("debtor"));
    if (!debtor) throw new BusinessError("Escolha a pessoa ou empresa.");
    const description = z.string().trim().min(2, "Descreva a pendência.").max(200).parse(form.get("description"));
    const amount = parseMoney(String(form.get("amount") ?? ""));
    if (amount <= 0) throw new BusinessError("Informe o valor.");
    const due = String(form.get("dueDate") ?? "");
    await db.pending.create({
      data: { ...debtor, description, amount, dueDate: due ? new Date(`${due}T12:00:00`) : null, createdById: user.id },
    });
    return "Pendência registrada.";
  });
  revalidatePath("/painel/pendencias");
  return res;
}

export async function pendingPayAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  const res = await run(async () => {
    const id = String(form.get("pendingId"));
    const payments = parsePayments(form);
    await db.$transaction(async (tx) => {
      const cash = await getOpenCashSession(tx);
      if (!cash) throw new BusinessError("Abra o caixa para receber.");
      const p = await tx.pending.findUnique({ where: { id } });
      if (!p || p.status !== "ABERTA") throw new BusinessError("Pendência não está em aberto.");
      const remaining = p.amount - p.paid;
      const paid = payments.reduce((s, x) => s + x.amount, 0);
      if (paid <= 0) throw new BusinessError("Informe o valor recebido.");
      // Pagamento parcial é permitido; o excedente vira troco
      const { final } = settlePayments(payments, Math.min(paid, remaining));
      const received = final.reduce((s, x) => s + x.amount, 0);
      await tx.payment.createMany({ data: final.map((x) => ({ ...x, pendingId: p.id, cashSessionId: cash.id })) });
      await tx.pending.update({
        where: { id },
        data: { paid: { increment: received }, status: p.paid + received >= p.amount ? "QUITADA" : "ABERTA" },
      });
    });
    await audit(user.id, `Recebimento de pendência por ${user.name}`);
    return "Recebimento registrado.";
  });
  revalidatePath("/painel/pendencias");
  return res;
}

export async function pendingCancelAction(form: FormData) {
  await requireUser(["ADMIN"]);
  await db.pending.updateMany({ where: { id: String(form.get("id")), status: "ABERTA" }, data: { status: "CANCELADA" } });
  revalidatePath("/painel/pendencias");
}
