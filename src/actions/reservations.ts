"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { requireUser, STAFF } from "@/lib/auth";
import { db } from "@/lib/db";
import { fromZoned } from "@/lib/time";
import { BusinessError, run, type ActionState } from "./types";

const HOUR = 3_600_000;
/** Janela usada para estimar se duas reservas disputam a mesma suíte. */
const OVERLAP_HOURS = 4;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newCode() {
  return Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

const hits = new Map<string, number[]>();
function rateLimit(key: string, max = 5, windowMs = 10 * 60_000) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) throw new BusinessError("Muitas tentativas. Aguarde alguns minutos ou chame no WhatsApp.");
  list.push(now);
  hits.set(key, list);
}

const reservationSchema = z.object({
  categoryId: z.string().min(1, "Escolha a suíte."),
  mode: z.enum(["PERIODO", "PERNOITE"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido."),
  customerName: z.string().trim().min(2, "Informe seu nome ou apelido.").max(60),
  phone: z
    .string()
    .transform((s) => s.replace(/\D/g, ""))
    .refine((s) => s.length >= 10 && s.length <= 13, "Telefone inválido."),
  notes: z.string().trim().max(300).default(""),
});

async function createReservation(input: z.infer<typeof reservationSchema>, source: "SITE" | "WHATSAPP" | "TELEFONE" | "BALCAO") {
  const [y, m, d] = input.date.split("-").map(Number);
  const [hh, mm] = input.time.split(":").map(Number);
  const scheduledAt = fromZoned(y, m, d, hh, mm);
  const now = Date.now();
  if (scheduledAt.getTime() < now + 30 * 60_000) throw new BusinessError("Escolha um horário com pelo menos 30 minutos de antecedência.");
  if (scheduledAt.getTime() > now + 30 * 24 * HOUR) throw new BusinessError("Reservas com até 30 dias de antecedência.");

  const category = await db.suiteCategory.findUnique({
    where: { id: input.categoryId },
    include: { _count: { select: { suites: { where: { active: true } } } } },
  });
  if (!category || !category.active) throw new BusinessError("Categoria indisponível.");
  if (input.mode === "PERNOITE" && hh < category.overnightStartHour && hh >= category.overnightEndHour) {
    throw new BusinessError(`Pernoite com entrada a partir das ${category.overnightStartHour}h.`);
  }

  const overlapping = await db.reservation.count({
    where: {
      categoryId: category.id,
      status: { in: ["PENDENTE", "CONFIRMADA"] },
      scheduledAt: {
        gt: new Date(scheduledAt.getTime() - OVERLAP_HOURS * HOUR),
        lt: new Date(scheduledAt.getTime() + OVERLAP_HOURS * HOUR),
      },
    },
  });
  if (overlapping >= category._count.suites) {
    throw new BusinessError("Sem disponibilidade nesse horário para essa suíte. Tente outro horário ou categoria.");
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.reservation.create({
        data: {
          code: newCode(),
          categoryId: category.id,
          customerName: input.customerName,
          phone: input.phone,
          scheduledAt,
          mode: input.mode,
          notes: input.notes,
          source,
          status: source === "SITE" ? "PENDENTE" : "CONFIRMADA",
        },
      });
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e;
    }
  }
  throw new BusinessError("Não foi possível gerar o código da reserva.");
}

function parseForm(form: FormData) {
  return reservationSchema.parse({
    categoryId: form.get("categoryId"),
    mode: form.get("mode"),
    date: form.get("date"),
    time: form.get("time"),
    customerName: form.get("customerName"),
    phone: form.get("phone") ?? "",
    notes: form.get("notes") ?? "",
  });
}

/** Formulário público do site. */
export async function publicReservationAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (form.get("website")) return { error: "Requisição inválida." }; // honeypot anti-bot
  let code = "";
  const res = await run(async () => {
    const h = await headers();
    rateLimit(h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local");
    code = (await createReservation(parseForm(form), "SITE")).code;
  });
  if (res?.ok) redirect(`/reservar/${code}`);
  return res;
}

/** Reserva lançada pela recepção (WhatsApp, telefone, balcão). */
export async function staffReservationAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireUser(STAFF);
  const res = await run(async () => {
    const source = z.enum(["WHATSAPP", "TELEFONE", "BALCAO"]).parse(form.get("source"));
    const r = await createReservation(parseForm(form), source);
    return `Reserva ${r.code} criada.`;
  });
  revalidatePath("/painel/reservas");
  return res;
}

export async function setReservationStatusAction(form: FormData) {
  await requireUser(STAFF);
  const id = String(form.get("id"));
  const status = z.enum(["CONFIRMADA", "CANCELADA", "NO_SHOW"]).parse(form.get("status"));
  await db.reservation.updateMany({ where: { id, status: { in: ["PENDENTE", "CONFIRMADA"] } }, data: { status } });
  revalidatePath("/painel/reservas");
}
