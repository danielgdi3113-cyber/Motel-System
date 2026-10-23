"use client";

import { UserPlus } from "lucide-react";
import { waitlistAddAction } from "@/actions/operations";
import { useNow } from "@/components/auto-refresh";
import { ActionForm, Submit } from "@/components/form";
import { Modal } from "@/components/modal";
import { Button, Input, Select } from "@/components/ui";
import { formatDuration } from "@/lib/time";

export function WaitTimer({ since }: { since: string }) {
  const now = useNow(new Date(since).getTime());
  const ms = now - new Date(since).getTime();
  return <div className={`font-mono text-lg tabular-nums ${ms > 20 * 60_000 ? "text-rose-300" : ""}`}>{formatDuration(ms).slice(0, 5)}</div>;
}

export function WaitlistForm({ categories }: { categories: { id: string; name: string }[] }) {
  return (
    <Modal
      title="Adicionar à lista de espera"
      trigger={(open) => (
        <Button onClick={open}>
          <UserPlus className="size-4" /> Adicionar
        </Button>
      )}
    >
      {(close) => (
        <ActionForm action={waitlistAddAction} resetOnSuccess onSuccess={close}>
          <Input label="Nome ou apelido" name="name" required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Telefone" name="phone" inputMode="tel" />
            <Input label="Placa" name="plate" className="uppercase" maxLength={8} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Suíte desejada" name="categoryId" defaultValue="">
              <option value="">Qualquer</option>
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
          <Input label="Observação" name="notes" />
          <Submit className="w-full">Adicionar</Submit>
        </ActionForm>
      )}
    </Modal>
  );
}
