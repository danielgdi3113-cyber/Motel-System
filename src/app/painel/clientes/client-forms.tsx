"use client";

import type { ReactNode } from "react";
import { Pencil, Plus } from "lucide-react";
import { companySaveAction, personSaveAction, vehicleSaveAction } from "@/actions/clients";
import type { ActionState } from "@/actions/types";
import { ActionForm, Submit } from "@/components/form";
import { Modal } from "@/components/modal";
import { Button, Checkbox, Input, Select, Textarea } from "@/components/ui";

function EntityModal({
  title,
  newLabel,
  editing,
  action,
  children,
}: {
  title: string;
  newLabel: string;
  editing: boolean;
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  children: ReactNode;
}) {
  return (
    <Modal
      title={title}
      trigger={(open) =>
        editing ? (
          <Button variant="ghost" size="sm" onClick={open} aria-label="Editar">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button onClick={open}>
            <Plus className="size-4" /> {newLabel}
          </Button>
        )
      }
    >
      {(close) => (
        <ActionForm action={action} onSuccess={close} resetOnSuccess={!editing}>
          {children}
          <Submit className="w-full">Salvar</Submit>
        </ActionForm>
      )}
    </Modal>
  );
}

type Vehicle = { id: string; plate: string; model: string; color: string; notes: string; blocked: boolean; personId: string | null };

export function VehicleForm({ item, people }: { item?: Vehicle; people: { id: string; name: string }[] }) {
  return (
    <EntityModal title={item ? `Veículo ${item.plate}` : "Novo veículo"} newLabel="Novo veículo" editing={!!item} action={vehicleSaveAction}>
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <div className="grid grid-cols-3 gap-3">
        <Input label="Placa" name="plate" defaultValue={item?.plate} className="uppercase" required />
        <Input label="Modelo" name="model" defaultValue={item?.model} />
        <Input label="Cor" name="color" defaultValue={item?.color} />
      </div>
      <Select label="Cliente" name="personId" defaultValue={item?.personId ?? ""}>
        <option value="">—</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
      <Textarea label="Observações / motivo do bloqueio" name="notes" defaultValue={item?.notes} />
      <Checkbox name="blocked" label="Bloquear entrada deste veículo" defaultChecked={item?.blocked} />
    </EntityModal>
  );
}

type Person = { id: string; name: string; document: string; phone: string; email: string; notes: string; blocked: boolean; birthDate: string };

export function PersonForm({ item }: { item?: Person }) {
  return (
    <EntityModal title={item ? item.name : "Nova pessoa"} newLabel="Nova pessoa" editing={!!item} action={personSaveAction}>
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <Input label="Nome" name="name" defaultValue={item?.name} required />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Telefone" name="phone" defaultValue={item?.phone} inputMode="tel" />
        <Input label="CPF" name="document" defaultValue={item?.document} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="E-mail" name="email" type="email" defaultValue={item?.email} />
        <Input label="Nascimento" name="birthDate" type="date" defaultValue={item?.birthDate} />
      </div>
      <Textarea label="Observações" name="notes" defaultValue={item?.notes} />
      <Checkbox name="blocked" label="Cliente bloqueado" defaultChecked={item?.blocked} />
    </EntityModal>
  );
}

type Company = {
  id: string;
  name: string;
  document: string;
  phone: string;
  email: string;
  contact: string;
  notes: string;
  isSupplier: boolean;
  isCustomer: boolean;
};

export function CompanyForm({ item }: { item?: Company }) {
  return (
    <EntityModal title={item ? item.name : "Nova empresa"} newLabel="Nova empresa" editing={!!item} action={companySaveAction}>
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <Input label="Nome / razão social" name="name" defaultValue={item?.name} required />
      <div className="grid grid-cols-2 gap-3">
        <Input label="CNPJ" name="document" defaultValue={item?.document} />
        <Input label="Telefone" name="phone" defaultValue={item?.phone} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Contato" name="contact" defaultValue={item?.contact} />
        <Input label="E-mail" name="email" type="email" defaultValue={item?.email} />
      </div>
      <Textarea label="Observações" name="notes" defaultValue={item?.notes} />
      <div className="flex gap-6">
        <Checkbox name="isCustomer" label="Cliente" defaultChecked={item?.isCustomer ?? true} />
        <Checkbox name="isSupplier" label="Fornecedor" defaultChecked={item?.isSupplier} />
      </div>
    </EntityModal>
  );
}
