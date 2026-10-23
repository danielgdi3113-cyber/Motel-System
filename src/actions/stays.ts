"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser, STAFF, ADMIN } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOpenCashSession } from "@/lib/cash";
import { parseMoney, formatMoney } from "@/lib/money";
import { getTolerance } from "@/lib/settings";
import { stayTotals } from "@/lib/stays";
import { BusinessError, run, type ActionState } from "./types";

const checkInSchema = z.object({
  suiteId: z.string().min(1),
  mode: z.enum(["PERIODO", "PERNOITE"]),
  plate: z
    .string()
    .trim()
    .toUpperCase()
    .max(10, "Placa inválida.")
    .default(""),
  guests: z.coerce.number().int().min(1).max(6).default(2),
  notes: z.string().trim().max(300).default(""),
  reservationId: z.string().optional(),
});

export async function checkInAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  let stayId = "";
  const result = await run(async () => {
    const data = checkInSchema.parse({
      suiteId: form.get("suiteId"),
      mode: form.get("mode"),
      plate: form.get("plate") ?? "",
      guests: form.get("guests") ?? 2,
      notes: form.get("notes") ?? "",
      reservationId: form.get("reservationId") || undefined,
    });
    stayId = await openStay(user.id, data);
  });
  if (result?.ok) redirect(`/painel/locacoes/${stayId}`);
  return result;
}

export async function openStay(userId: string, data: z.infer<typeof checkInSchema>): Promise<string> {
  return db.$transaction(async (tx) => {
    const suite = await tx.suite.findUnique({ where: { id: data.suiteId }, include: { category: true } });
    if (!suite || !suite.active) throw new BusinessError("Suíte não encontrada.");

    // Trava otimista: só ocupa se ainda estiver livre/reservada
    const allowed = data.reservationId ? ["LIVRE", "RESERVADA"] : ["LIVRE"];
    const locked = await tx.suite.updateMany({
      where: { id: suite.id, status: { in: allowed as ("LIVRE" | "RESERVADA")[] } },
      data: { status: "OCUPADA" },
    });
    if (locked.count === 0) throw new BusinessError(`A suíte ${suite.number} não está disponível.`);

    if (data.reservationId) {
      const r = await tx.reservation.findUnique({ where: { id: data.reservationId } });
      if (!r || !["PENDENTE", "CONFIRMADA"].includes(r.status)) throw new BusinessError("Reserva inválida.");
      await tx.reservation.update({ where: { id: r.id }, data: { status: "CONCLUIDA", suiteId: suite.id } });
    }

    const c = suite.category;
    const stay = await tx.stay.create({
      data: {
        suiteId: suite.id,
        mode: data.mode,
        plate: data.plate,
        guests: data.guests,
        notes: data.notes,
        periodHours: c.periodHours,
        periodPrice: c.periodPrice,
        extraHourPrice: c.extraHourPrice,
        overnightPrice: c.overnightPrice,
        overnightEndHour: c.overnightEndHour,
        openedById: userId,
        reservationId: data.reservationId,
      },
    });
    return stay.id;
  });
}

export async function addConsumptionAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  const stayId = String(form.get("stayId"));
  const res = await run(async () => {
    const { productId, quantity } = z
      .object({ productId: z.string().min(1, "Escolha um produto."), quantity: z.coerce.number().int().min(1).max(50) })
      .parse({ productId: form.get("productId"), quantity: form.get("quantity") });

    await db.$transaction(async (tx) => {
      const stay = await tx.stay.findUnique({ where: { id: stayId } });
      if (!stay || stay.status !== "ABERTA") throw new BusinessError("Locação não está aberta.");
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product || !product.active) throw new BusinessError("Produto indisponível.");

      const dec = await tx.product.updateMany({
        where: { id: productId, stock: { gte: quantity } },
        data: { stock: { decrement: quantity } },
      });
      if (dec.count === 0) throw new BusinessError(`Estoque insuficiente de ${product.name} (${product.stock} un.).`);

      await tx.consumption.create({
        data: { stayId, productId, quantity, unitPrice: product.price, createdById: user.id },
      });
      await tx.stockMovement.create({
        data: { productId, type: "VENDA", quantity: -quantity, reason: `Locação ${stayId.slice(-6)}`, userId: user.id },
      });
    });
    return "Item lançado.";
  });
  revalidatePath(`/painel/locacoes/${stayId}`);
  return res;
}

export async function removeConsumptionAction(form: FormData) {
  const user = await requireUser(STAFF);
  const id = String(form.get("id"));
  const item = await db.consumption.findUnique({ where: { id }, include: { stay: true } });
  if (!item || item.stay.status !== "ABERTA") return;
  await db.$transaction([
    db.consumption.delete({ where: { id } }),
    db.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } }),
    db.stockMovement.create({
      data: {
        productId: item.productId,
        type: "ESTORNO",
        quantity: item.quantity,
        reason: `Estorno locação ${item.stayId.slice(-6)}`,
        userId: user.id,
      },
    }),
  ]);
  revalidatePath(`/painel/locacoes/${item.stayId}`);
}

const methods = ["DINHEIRO", "PIX", "DEBITO", "CREDITO"] as const;

export async function checkoutAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  const stayId = String(form.get("stayId"));
  const res = await run(async () => {
    const discount = parseMoney(String(form.get("discount") ?? ""));
    const payments = methods
      .map((method) => ({ method, amount: parseMoney(String(form.get(`pay_${method}`) ?? "")) }))
      .filter((p) => p.amount > 0);
    const tolerance = await getTolerance();

    await db.$transaction(async (tx) => {
      const cash = await getOpenCashSession(tx);
      if (!cash) throw new BusinessError("Abra o caixa antes de fazer o check-out.");

      const stay = await tx.stay.findUnique({ where: { id: stayId }, include: { consumptions: true } });
      if (!stay || stay.status !== "ABERTA") throw new BusinessError("Locação já encerrada.");

      const consumption = stay.consumptions.reduce((s, c) => s + c.quantity * c.unitPrice, 0);
      const now = new Date();
      const { room, subtotal } = stayTotals(stay, consumption, tolerance, now);
      if (discount < 0 || discount > subtotal) throw new BusinessError("Desconto inválido.");
      const total = subtotal - discount;

      // Troco: o excedente só é aceito em dinheiro
      const paid = payments.reduce((s, p) => s + p.amount, 0);
      const change = paid - total;
      if (change < 0) throw new BusinessError(`Faltam ${formatMoney(-change)} para fechar a conta.`);
      const cashPaid = payments.find((p) => p.method === "DINHEIRO")?.amount ?? 0;
      if (change > cashPaid) throw new BusinessError("Valor pago acima do total. Troco só é possível em dinheiro.");
      const finalPayments = payments
        .map((p) => (p.method === "DINHEIRO" ? { ...p, amount: p.amount - change } : p))
        .filter((p) => p.amount > 0);

      await tx.stay.update({
        where: { id: stay.id },
        data: {
          status: "FECHADA",
          checkOut: now,
          roomAmount: room.amount,
          consumptionAmount: consumption,
          discount,
          total,
          closedById: user.id,
        },
      });
      if (finalPayments.length) {
        await tx.payment.createMany({
          data: finalPayments.map((p) => ({ ...p, stayId: stay.id, cashSessionId: cash.id })),
        });
      }
      await tx.suite.update({ where: { id: stay.suiteId }, data: { status: "LIMPEZA" } });
      await tx.cleaningTask.create({ data: { suiteId: stay.suiteId, stayId: stay.id } });
    });
    return "Check-out concluído.";
  });
  if (res?.ok) redirect("/painel?checkout=ok");
  return res;
}

export async function cancelStayAction(form: FormData) {
  const user = await requireUser(ADMIN);
  const stayId = String(form.get("stayId"));
  const reason = String(form.get("reason") ?? "").slice(0, 300);
  await db.$transaction(async (tx) => {
    const stay = await tx.stay.findUnique({ where: { id: stayId }, include: { consumptions: true } });
    if (!stay || stay.status !== "ABERTA") return;
    for (const c of stay.consumptions) {
      await tx.product.update({ where: { id: c.productId }, data: { stock: { increment: c.quantity } } });
      await tx.stockMovement.create({
        data: { productId: c.productId, type: "ESTORNO", quantity: c.quantity, reason: "Locação cancelada", userId: user.id },
      });
    }
    await tx.stay.update({
      where: { id: stayId },
      data: { status: "CANCELADA", checkOut: new Date(), closedById: user.id, notes: `${stay.notes}\n[Cancelada] ${reason}`.trim() },
    });
    await tx.suite.update({ where: { id: stay.suiteId }, data: { status: "LIMPEZA" } });
    await tx.cleaningTask.create({ data: { suiteId: stay.suiteId, stayId } });
  });
  redirect("/painel");
}
