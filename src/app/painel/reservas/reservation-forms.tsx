"use client";

import type { StayMode, SuiteStatus } from "@prisma/client";
import { LogIn, Plus } from "lucide-react";
import { staffReservationAction } from "@/actions/reservations";
import { checkInAction } from "@/actions/stays";
import { ActionForm, Submit } from "@/components/form";
import { Modal } from "@/components/modal";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { modeLabel } from "@/lib/labels";

export function NewReservation({ categories }: { categories: { id: string; name: string }[] }) {
  return (
    <Modal
      title="Nova reserva"
      trigger={(open) => (
        <Button onClick={open}>
          <Plus className="size-4" /> Nova reserva
        </Button>
      )}
    >
      {(close) => (
        <ActionForm action={staffReservationAction} resetOnSuccess onSuccess={close}>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nome" name="customerName" required />
            <Input label="Telefone" name="phone" inputMode="tel" placeholder="(11) 99999-9999" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Categoria" name="categoryId" required>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select label="Modalidade" name="mode">
              <option value="PERIODO">Período</option>
              <option value="PERNOITE">Pernoite</option>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Data" name="date" type="date" required />
            <Input label="Hora" name="time" type="time" required />
            <Select label="Origem" name="source">
              <option value="WHATSAPP">WhatsApp</option>
              <option value="TELEFONE">Telefone</option>
              <option value="BALCAO">Balcão</option>
            </Select>
          </div>
          <Textarea label="Observações" name="notes" placeholder="Decoração, pedido especial..." />
          <Submit className="w-full">Criar reserva</Submit>
        </ActionForm>
      )}
    </Modal>
  );
}

export function ReservationCheckIn({
  reservation,
  suites,
}: {
  reservation: { id: string; code: string; mode: StayMode; name: string };
  suites: { id: string; number: string; status: SuiteStatus }[];
}) {
  return (
    <Modal
      title={`Check-in · Reserva #${reservation.code}`}
      trigger={(open) => (
        <Button size="sm" onClick={open} disabled={suites.length === 0} title={suites.length === 0 ? "Nenhuma suíte livre na categoria" : undefined}>
          <LogIn className="size-3" /> Check-in
        </Button>
      )}
    >
      {() => (
        <ActionForm action={checkInAction}>
          <input type="hidden" name="reservationId" value={reservation.id} />
          <input type="hidden" name="mode" value={reservation.mode} />
          <p className="text-sm text-muted">
            {reservation.name} · {modeLabel[reservation.mode]}
          </p>
          <Select label="Suíte" name="suiteId" required>
            {suites.map((s) => (
              <option key={s.id} value={s.id}>
                Suíte {s.number}
                {s.status === "RESERVADA" ? " (bloqueada p/ reserva)" : ""}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Placa" name="plate" maxLength={8} className="uppercase" />
            <Input label="Pessoas" name="guests" type="number" min={1} max={6} defaultValue={2} />
          </div>
          <Submit className="w-full">Confirmar entrada</Submit>
        </ActionForm>
      )}
    </Modal>
  );
}
