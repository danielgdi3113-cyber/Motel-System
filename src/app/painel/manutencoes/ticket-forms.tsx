"use client";

import type { TicketStatus } from "@prisma/client";
import { Plus } from "lucide-react";
import { ticketCreateAction, ticketUpdateAction } from "@/actions/maintenance";
import { ActionForm, Submit } from "@/components/form";
import { Modal } from "@/components/modal";
import { Button, Checkbox, Input, Select, Textarea } from "@/components/ui";

export function TicketForm({ suites, equipments }: { suites: { id: string; number: string }[]; equipments: { id: string; label: string }[] }) {
  return (
    <Modal
      title="Novo chamado de manutenção"
      trigger={(open) => (
        <Button onClick={open}>
          <Plus className="size-4" /> Abrir chamado
        </Button>
      )}
    >
      {(close) => (
        <ActionForm action={ticketCreateAction} resetOnSuccess onSuccess={close}>
          <Input label="Problema" name="title" placeholder="Ex.: chuveiro sem água quente" required />
          <Textarea label="Detalhes" name="description" />
          <div className="grid grid-cols-3 gap-3">
            <Select label="Suíte" name="suiteId" defaultValue="">
              <option value="">—</option>
              {suites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.number}
                </option>
              ))}
            </Select>
            <Select label="Equipamento" name="equipmentId" defaultValue="">
              <option value="">—</option>
              {equipments.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </Select>
            <Select label="Prioridade" name="priority" defaultValue="MEDIA">
              <option value="BAIXA">Baixa</option>
              <option value="MEDIA">Média</option>
              <option value="ALTA">Alta</option>
            </Select>
          </div>
          <Checkbox name="blockSuite" label="Bloquear a suíte até resolver" />
          <Submit className="w-full">Abrir chamado</Submit>
        </ActionForm>
      )}
    </Modal>
  );
}

export function TicketUpdate({
  ticket,
}: {
  ticket: { id: string; title: string; status: TicketStatus; hasSuite: boolean; resolution: string };
}) {
  return (
    <Modal
      title={ticket.title}
      trigger={(open) => (
        <Button variant="secondary" size="sm" onClick={open}>
          Atualizar
        </Button>
      )}
    >
      {(close) => (
        <ActionForm action={ticketUpdateAction} onSuccess={close}>
          <input type="hidden" name="id" value={ticket.id} />
          <Select label="Situação" name="status" defaultValue={ticket.status === "ABERTA" ? "EM_ANDAMENTO" : "CONCLUIDA"}>
            <option value="ABERTA">Aberta</option>
            <option value="EM_ANDAMENTO">Em andamento</option>
            <option value="CONCLUIDA">Concluída</option>
            <option value="CANCELADA">Cancelada</option>
          </Select>
          <Textarea label="O que foi feito" name="resolution" defaultValue={ticket.resolution} />
          <Input label="Custo" name="cost" inputMode="decimal" placeholder="0,00" />
          {ticket.hasSuite && <Checkbox name="releaseSuite" label="Liberar a suíte ao concluir" defaultChecked />}
          <Submit className="w-full">Salvar</Submit>
        </ActionForm>
      )}
    </Modal>
  );
}
