"use client";

import type { EquipmentStatus } from "@prisma/client";
import { Pencil, Plus } from "lucide-react";
import { equipmentSaveAction } from "@/actions/maintenance";
import { ActionForm, Submit } from "@/components/form";
import { Modal } from "@/components/modal";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { equipmentStatusLabel } from "@/lib/labels";

type Item = { id: string; name: string; code: string; suiteId: string | null; status: EquipmentStatus; notes: string };

export function EquipmentForm({ suites, item }: { suites: { id: string; number: string }[]; item?: Item }) {
  return (
    <Modal
      title={item ? "Editar equipamento" : "Novo equipamento"}
      trigger={(open) =>
        item ? (
          <Button variant="ghost" size="sm" onClick={open} aria-label="Editar">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button onClick={open}>
            <Plus className="size-4" /> Novo equipamento
          </Button>
        )
      }
    >
      {(close) => (
        <ActionForm action={equipmentSaveAction} onSuccess={close} resetOnSuccess={!item}>
          <input type="hidden" name="id" value={item?.id ?? ""} />
          <div className="grid grid-cols-[1fr_130px] gap-3">
            <Input label="Nome" name="name" defaultValue={item?.name} placeholder="Smart TV 50''" required />
            <Input label="Patrimônio" name="code" defaultValue={item?.code} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Local" name="suiteId" defaultValue={item?.suiteId ?? ""}>
              <option value="">Área comum</option>
              {suites.map((s) => (
                <option key={s.id} value={s.id}>
                  Suíte {s.number}
                </option>
              ))}
            </Select>
            <Select label="Situação" name="status" defaultValue={item?.status ?? "OK"}>
              {Object.entries(equipmentStatusLabel).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
          <Textarea label="Observações" name="notes" defaultValue={item?.notes} />
          <Submit className="w-full">Salvar</Submit>
        </ActionForm>
      )}
    </Modal>
  );
}
