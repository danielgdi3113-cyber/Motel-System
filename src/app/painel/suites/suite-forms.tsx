"use client";

import { Pencil, Plus } from "lucide-react";
import { saveCategoryAction, saveSuiteAction } from "@/actions/suites";
import { ActionForm, Submit } from "@/components/form";
import { Modal } from "@/components/modal";
import { Button, Checkbox, Input, Select, Textarea } from "@/components/ui";
import { centsToInput } from "@/lib/money";

type Category = {
  id: string;
  name: string;
  description: string;
  amenities: string;
  periodHours: number;
  periodPrice: number;
  extraHourPrice: number;
  overnightPrice: number;
  overnightStartHour: number;
  overnightEndHour: number;
  sortOrder: number;
  active: boolean;
};

export function CategoryForm({ category }: { category?: Category }) {
  const c = category;
  return (
    <Modal
      title={c ? `Editar ${c.name}` : "Nova categoria"}
      wide
      trigger={(open) =>
        c ? (
          <Button variant="ghost" size="sm" onClick={open} aria-label="Editar categoria">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button onClick={open}>
            <Plus className="size-4" /> Nova categoria
          </Button>
        )
      }
    >
      {(close) => (
        <ActionForm action={saveCategoryAction} onSuccess={close} resetOnSuccess={!c}>
          <input type="hidden" name="id" value={c?.id ?? ""} />
          <div className="grid grid-cols-[1fr_100px] gap-3">
            <Input label="Nome" name="name" defaultValue={c?.name} required />
            <Input label="Ordem" name="sortOrder" type="number" defaultValue={c?.sortOrder ?? 0} />
          </div>
          <Textarea label="Descrição (aparece no site)" name="description" defaultValue={c?.description} />
          <Input label="Comodidades" hint="separadas por vírgula" name="amenities" defaultValue={c?.amenities} placeholder="Hidromassagem, Sauna, Smart TV" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Input label="Horas do período" name="periodHours" type="number" min={1} max={12} defaultValue={c?.periodHours ?? 2} />
            <Input label="Preço do período" name="periodPrice" inputMode="decimal" defaultValue={c ? centsToInput(c.periodPrice) : ""} required />
            <Input label="Hora extra" name="extraHourPrice" inputMode="decimal" defaultValue={c ? centsToInput(c.extraHourPrice) : ""} required />
            <Input label="Pernoite" name="overnightPrice" inputMode="decimal" defaultValue={c ? centsToInput(c.overnightPrice) : ""} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Pernoite: entrada a partir de (h)" name="overnightStartHour" type="number" min={0} max={23} defaultValue={c?.overnightStartHour ?? 20} />
            <Input label="Pernoite: saída até (h)" name="overnightEndHour" type="number" min={0} max={23} defaultValue={c?.overnightEndHour ?? 12} />
          </div>
          <Checkbox name="active" label="Categoria ativa" defaultChecked={c?.active ?? true} />
          <Submit className="w-full">Salvar categoria</Submit>
        </ActionForm>
      )}
    </Modal>
  );
}

export function SuiteForm({
  suite,
  categories,
  label,
}: {
  suite?: { id: string; number: string; categoryId: string; notes: string; active: boolean };
  categories: { id: string; name: string }[];
  label?: string;
}) {
  return (
    <Modal
      title={suite ? `Suíte ${suite.number}` : "Nova suíte"}
      trigger={(open) =>
        suite ? (
          <button onClick={open} className="rounded-xl border border-line px-3 py-1.5 text-sm hover:border-accent">
            {label}
          </button>
        ) : (
          <Button variant="secondary" onClick={open} disabled={categories.length === 0}>
            <Plus className="size-4" /> Nova suíte
          </Button>
        )
      }
    >
      {(close) => (
        <ActionForm action={saveSuiteAction} onSuccess={close} resetOnSuccess={!suite}>
          <input type="hidden" name="id" value={suite?.id ?? ""} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Número" name="number" defaultValue={suite?.number} required />
            <Select label="Categoria" name="categoryId" defaultValue={suite?.categoryId}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <Textarea label="Observações internas" name="notes" defaultValue={suite?.notes} />
          <Checkbox name="active" label="Suíte ativa (aparece no mapa)" defaultChecked={suite?.active ?? true} />
          <Submit className="w-full">Salvar suíte</Submit>
        </ActionForm>
      )}
    </Modal>
  );
}
