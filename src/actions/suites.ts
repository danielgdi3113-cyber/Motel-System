"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, STAFF, ADMIN } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseMoney } from "@/lib/money";
import { BusinessError, run, type ActionState } from "./types";

export async function saveCategoryAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireUser(ADMIN);
  const res = await run(async () => {
    const id = String(form.get("id") ?? "");
    const data = z
      .object({
        name: z.string().trim().min(2, "Nome muito curto.").max(60),
        description: z.string().trim().max(500),
        amenities: z.array(z.string()),
        periodHours: z.coerce.number().int().min(1).max(12),
        overnightStartHour: z.coerce.number().int().min(0).max(23),
        overnightEndHour: z.coerce.number().int().min(0).max(23),
        sortOrder: z.coerce.number().int(),
        active: z.boolean(),
      })
      .parse({
        name: form.get("name"),
        description: form.get("description") ?? "",
        amenities: String(form.get("amenities") ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        periodHours: form.get("periodHours"),
        overnightStartHour: form.get("overnightStartHour"),
        overnightEndHour: form.get("overnightEndHour"),
        sortOrder: form.get("sortOrder") || 0,
        active: form.get("active") === "on",
      });
    const prices = {
      periodPrice: parseMoney(String(form.get("periodPrice"))),
      extraHourPrice: parseMoney(String(form.get("extraHourPrice"))),
      overnightPrice: parseMoney(String(form.get("overnightPrice"))),
    };
    if (prices.periodPrice <= 0 || prices.overnightPrice <= 0) throw new BusinessError("Informe os preços.");
    if (id) await db.suiteCategory.update({ where: { id }, data: { ...data, ...prices } });
    else await db.suiteCategory.create({ data: { ...data, ...prices } });
    return "Categoria salva.";
  });
  revalidatePath("/painel/suites");
  return res;
}

export async function saveSuiteAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireUser(ADMIN);
  const res = await run(async () => {
    const id = String(form.get("id") ?? "");
    const data = z
      .object({
        number: z.string().trim().min(1, "Informe o número.").max(10),
        categoryId: z.string().min(1, "Escolha a categoria."),
        notes: z.string().trim().max(300),
        active: z.boolean(),
      })
      .parse({
        number: form.get("number"),
        categoryId: form.get("categoryId"),
        notes: form.get("notes") ?? "",
        active: form.get("active") === "on",
      });
    const dup = await db.suite.findFirst({ where: { number: data.number, NOT: { id } } });
    if (dup) throw new BusinessError("Já existe uma suíte com esse número.");
    if (id) await db.suite.update({ where: { id }, data });
    else await db.suite.create({ data });
    return "Suíte salva.";
  });
  revalidatePath("/painel/suites");
  return res;
}

/** Bloqueio manual: manutenção / reservada / liberar. */
export async function setSuiteStatusAction(form: FormData) {
  await requireUser(STAFF);
  const id = String(form.get("suiteId"));
  const status = z.enum(["LIVRE", "MANUTENCAO", "RESERVADA"]).parse(form.get("status"));
  // Nunca altera uma suíte ocupada por aqui
  await db.suite.updateMany({ where: { id, status: { not: "OCUPADA" } }, data: { status } });
  if (status === "LIVRE") {
    await db.cleaningTask.updateMany({
      where: { suiteId: id, status: { not: "CONCLUIDA" } },
      data: { status: "CONCLUIDA", finishedAt: new Date(), notes: "Liberada pela recepção" },
    });
  }
  revalidatePath("/painel");
}
