"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

export async function startCleaningAction(form: FormData) {
  const user = await requireUser();
  const id = String(form.get("taskId"));
  const r = await db.cleaningTask.updateMany({
    where: { id, status: "PENDENTE" },
    data: { status: "EM_ANDAMENTO", startedAt: new Date(), assignedToId: user.id },
  });
  if (r.count) {
    const t = await db.cleaningTask.findUnique({ where: { id }, include: { suite: true } });
    await audit(user.id, `Iniciada a limpeza da suíte ${t?.suite.number} por ${user.name}`);
  }
  revalidatePath("/painel/limpeza");
}

export async function finishCleaningAction(form: FormData) {
  const user = await requireUser();
  const id = String(form.get("taskId"));
  const notes = String(form.get("notes") ?? "").slice(0, 300);
  const maintenance = form.get("maintenance") === "on";
  await db.$transaction(async (tx) => {
    const task = await tx.cleaningTask.findUnique({ where: { id } });
    if (!task || task.status === "CONCLUIDA") return;
    await tx.cleaningTask.update({
      where: { id },
      data: { status: "CONCLUIDA", finishedAt: new Date(), startedAt: task.startedAt ?? new Date(), notes },
    });
    await tx.suite.updateMany({
      where: { id: task.suiteId, status: "LIMPEZA" },
      data: maintenance ? { status: "MANUTENCAO", notes } : { status: "LIVRE" },
    });
    // Problema relatado pela camareira vira chamado de manutenção
    if (maintenance) {
      await tx.maintenanceTicket.create({
        data: { suiteId: task.suiteId, title: notes || "Problema relatado na limpeza", priority: "ALTA", createdById: user.id },
      });
    }
  });
  const t = await db.cleaningTask.findUnique({ where: { id }, include: { suite: true } });
  await audit(user.id, `Finalizada a limpeza da suíte ${t?.suite.number} por ${user.name}${maintenance ? " — enviada para manutenção" : ""}`, maintenance);
  revalidatePath("/painel/limpeza");
  revalidatePath("/painel");
}
