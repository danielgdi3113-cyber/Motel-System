"use client";

import { useState } from "react";
import { CalendarCheck } from "lucide-react";
import { publicReservationAction } from "@/actions/reservations";
import { ActionForm, Submit } from "@/components/form";
import { Card, Input, Textarea, cn } from "@/components/ui";
import { formatMoney } from "@/lib/money";

type Category = { id: string; name: string; periodHours: number; periodPrice: number; overnightPrice: number; overnightStartHour: number };

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ReservationForm({ categories, defaultCategory }: { categories: Category[]; defaultCategory?: string }) {
  const [categoryId, setCategoryId] = useState(categories.find((c) => c.id === defaultCategory)?.id ?? categories[0]?.id);
  const [mode, setMode] = useState<"PERIODO" | "PERNOITE">("PERIODO");
  const cat = categories.find((c) => c.id === categoryId);

  return (
    <Card className="p-6">
      <ActionForm action={publicReservationAction}>
        <input type="hidden" name="categoryId" value={categoryId ?? ""} />
        <input type="hidden" name="mode" value={mode} />
        {/* honeypot */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

        <div>
          <span className="mb-2 block text-sm font-medium text-zinc-300">Suíte</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {categories.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => setCategoryId(c.id)}
                className={cn(
                  "rounded-xl border p-3 text-left transition",
                  categoryId === c.id ? "border-accent bg-accent/10" : "border-line hover:border-zinc-500",
                )}
              >
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted">
                  {c.periodHours}h {formatMoney(c.periodPrice)} · pernoite {formatMoney(c.overnightPrice)}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium text-zinc-300">Modalidade</span>
          <div className="grid grid-cols-2 gap-2">
            {(["PERIODO", "PERNOITE"] as const).map((m) => (
              <button
                type="button"
                key={m}
                onClick={() => setMode(m)}
                className={cn("rounded-xl border p-3 text-sm transition", mode === m ? "border-accent bg-accent/10" : "border-line hover:border-zinc-500")}
              >
                {m === "PERIODO" ? `Período${cat ? ` (${cat.periodHours}h)` : ""}` : "Pernoite"}
                {cat && <div className="font-semibold">{formatMoney(m === "PERIODO" ? cat.periodPrice : cat.overnightPrice)}</div>}
              </button>
            ))}
          </div>
          {mode === "PERNOITE" && cat && <p className="mt-2 text-xs text-muted">Entrada a partir das {cat.overnightStartHour}h.</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Data" name="date" type="date" min={todayISO()} defaultValue={todayISO()} required />
          <Input label="Horário de chegada" name="time" type="time" required />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Nome ou apelido" name="customerName" required maxLength={60} />
          <Input label="WhatsApp" name="phone" inputMode="tel" placeholder="(11) 99999-9999" required />
        </div>
        <Textarea label="Pedido especial" name="notes" placeholder="Ex.: decoração de aniversário, espumante gelado..." maxLength={300} />
        <Submit size="lg" className="w-full">
          <CalendarCheck className="size-4" /> Solicitar reserva
        </Submit>
        <p className="text-center text-xs text-muted">Seus dados são usados apenas para confirmar a reserva.</p>
      </ActionForm>
    </Card>
  );
}
