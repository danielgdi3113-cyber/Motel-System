"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, STAFF, ADMIN } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { parseMoney } from "@/lib/money";
import { run, type ActionState } from "./types";

export async function ticketCreateAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  const res = await run(async () => {
    const data = z
      .object({
        title: z.string().trim().min(3, "Descreva o problema.").max(120),
        description: z.string().trim().max(1000),
        priority: z.enum(["BAIXA", "MEDIA", "ALTA"]),
        suiteId: z.string().optional(),
        equipmentId: z.string().optional(),
      })
      .parse({
        title: form.get("title"),
        description: form.get("description") ?? "",
        priority: form.get("priority") ?? "MEDIA",
        suiteId: form.get("suiteId") || undefined,
        equipmentId: form.get("equipmentId") || undefined,
      });
    const blockSuite = form.get("blockSuite") === "on";
    await db.$transaction(async (tx) => {
      await tx.maintenanceTicket.create({ data: { ...data, createdById: user.id } });
      if (data.equipmentId) await tx.equipment.update({ where: { id: data.equipmentId }, data: { status: "DEFEITO" } });
      // Só bloqueia suítes que não estão ocupadas
      if (blockSuite && data.suiteId) {
        await tx.suite.updateMany({
          where: { id: data.suiteId, status: { in: ["LIVRE", "RESERVADA"] } },
          data: { status: "MANUTENCAO", notes: data.title },
        });
      }
    });
    await audit(user.id, `Chamado de manutenção aberto por ${user.name}: ${data.title}`, data.priority === "ALTA");
    return "Chamado aberto.";
  });
  revalidatePath("/painel/manutencoes");
  return res;
}

export async function ticketUpdateAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  const res = await run(async () => {
    const id = String(form.get("id"));
    const status = z.enum(["ABERTA", "EM_ANDAMENTO", "CONCLUIDA", "CANCELADA"]).parse(form.get("status"));
    const resolution = String(form.get("resolution") ?? "").slice(0, 1000);
    const cost = parseMoney(String(form.get("cost") ?? ""));
    const releaseSuite = form.get("releaseSuite") === "on";
    await db.$transaction(async (tx) => {
      const t = await tx.maintenanceTicket.update({
        where: { id },
        data: { status, resolution, cost, resolvedAt: status === "CONCLUIDA" || status === "CANCELADA" ? new Date() : null },
      });
      if (status === "CONCLUIDA") {
        if (t.equipmentId) await tx.equipment.update({ where: { id: t.equipmentId }, data: { status: "OK" } });
        if (releaseSuite && t.suiteId) {
          await tx.suite.updateMany({ where: { id: t.suiteId, status: "MANUTENCAO" }, data: { status: "LIVRE", notes: "" } });
        }
      } else if (status === "EM_ANDAMENTO" && t.equipmentId) {
        await tx.equipment.update({ where: { id: t.equipmentId }, data: { status: "EM_MANUTENCAO" } });
      }
    });
    if (status === "CONCLUIDA") await audit(user.id, `Manutenção concluída por ${user.name}`);
    return "Chamado atualizado.";
  });
  revalidatePath("/painel/manutencoes");
  revalidatePath("/painel");
  return res;
}

export async function equipmentSaveAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireUser(ADMIN);
  const res = await run(async () => {
    const id = String(form.get("id") ?? "");
    const data = z
      .object({
        name: z.string().trim().min(2, "Informe o nome.").max(80),
        code: z.string().trim().max(30),
        suiteId: z.string().nullable(),
        status: z.enum(["OK", "DEFEITO", "EM_MANUTENCAO", "BAIXADO"]),
        notes: z.string().trim().max(300),
      })
      .parse({
        name: form.get("name"),
        code: form.get("code") ?? "",
        suiteId: form.get("suiteId") || null,
        status: form.get("status") ?? "OK",
        notes: form.get("notes") ?? "",
      });
    if (id) await db.equipment.update({ where: { id }, data });
    else await db.equipment.create({ data });
    return "Equipamento salvo.";
  });
  revalidatePath("/painel/equipamentos");
  return res;
}
