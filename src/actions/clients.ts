"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, STAFF } from "@/lib/auth";
import { db } from "@/lib/db";
import { BusinessError, run, type ActionState } from "./types";

const text = (max: number) => z.string().trim().max(max);

export async function personSaveAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireUser(STAFF);
  const res = await run(async () => {
    const id = String(form.get("id") ?? "");
    const data = z
      .object({
        name: z.string().trim().min(2, "Informe o nome.").max(80),
        document: text(20),
        phone: text(20),
        email: text(80),
        notes: text(500),
        blocked: z.boolean(),
      })
      .parse({
        name: form.get("name"),
        document: form.get("document") ?? "",
        phone: form.get("phone") ?? "",
        email: form.get("email") ?? "",
        notes: form.get("notes") ?? "",
        blocked: form.get("blocked") === "on",
      });
    const birth = String(form.get("birthDate") ?? "");
    const payload = { ...data, birthDate: birth ? new Date(`${birth}T12:00:00`) : null };
    if (id) await db.person.update({ where: { id }, data: payload });
    else await db.person.create({ data: payload });
    return "Pessoa salva.";
  });
  revalidatePath("/painel/clientes/pessoas");
  return res;
}

export async function companySaveAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireUser(STAFF);
  const res = await run(async () => {
    const id = String(form.get("id") ?? "");
    const data = z
      .object({
        name: z.string().trim().min(2, "Informe a razão social / nome.").max(100),
        document: text(20),
        phone: text(20),
        email: text(80),
        contact: text(60),
        notes: text(500),
        isSupplier: z.boolean(),
        isCustomer: z.boolean(),
      })
      .parse({
        name: form.get("name"),
        document: form.get("document") ?? "",
        phone: form.get("phone") ?? "",
        email: form.get("email") ?? "",
        contact: form.get("contact") ?? "",
        notes: form.get("notes") ?? "",
        isSupplier: form.get("isSupplier") === "on",
        isCustomer: form.get("isCustomer") === "on",
      });
    if (!data.isSupplier && !data.isCustomer) throw new BusinessError("Marque se é cliente, fornecedor ou ambos.");
    if (id) await db.company.update({ where: { id }, data });
    else await db.company.create({ data });
    return "Empresa salva.";
  });
  revalidatePath("/painel/clientes/empresas");
  return res;
}

export async function vehicleSaveAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireUser(STAFF);
  const res = await run(async () => {
    const id = String(form.get("id") ?? "");
    const data = z
      .object({
        plate: z
          .string()
          .trim()
          .toUpperCase()
          .transform((s) => s.replace(/[^A-Z0-9]/g, ""))
          .refine((s) => s.length >= 5 && s.length <= 8, "Placa inválida."),
        model: text(60),
        color: text(30),
        notes: text(500),
        blocked: z.boolean(),
        personId: z.string().nullable(),
      })
      .parse({
        plate: form.get("plate"),
        model: form.get("model") ?? "",
        color: form.get("color") ?? "",
        notes: form.get("notes") ?? "",
        blocked: form.get("blocked") === "on",
        personId: form.get("personId") || null,
      });
    const dup = await db.vehicle.findFirst({ where: { plate: data.plate, NOT: { id } } });
    if (dup) throw new BusinessError("Placa já cadastrada.");
    if (id) await db.vehicle.update({ where: { id }, data });
    else await db.vehicle.create({ data });
    return "Veículo salvo.";
  });
  revalidatePath("/painel/clientes/veiculos");
  return res;
}
