"use client";

import type { Role } from "@prisma/client";
import { Pencil, UserPlus } from "lucide-react";
import { saveSettingsAction, saveUserAction } from "@/actions/users";
import { ActionForm, Submit } from "@/components/form";
import { Modal } from "@/components/modal";
import { Button, Card, Checkbox, Input, Select } from "@/components/ui";
import type { Settings } from "@/lib/settings";

export function SettingsForm({ settings }: { settings: Settings }) {
  return (
    <Card>
      <ActionForm action={saveSettingsAction}>
        <Input label="Nome do motel" name="motelName" defaultValue={settings.motelName} required />
        <Input label="Slogan" name="slogan" defaultValue={settings.slogan} />
        <Input label="Endereço" name="address" defaultValue={settings.address} />
        <Input label="WhatsApp" hint="com DDI e DDD, só números" name="whatsapp" defaultValue={settings.whatsapp} />
        <Input
          label="Tolerância (minutos)"
          hint="antes de cobrar hora extra"
          name="toleranceMinutes"
          type="number"
          min={0}
          max={60}
          defaultValue={settings.toleranceMinutes}
        />
        <Submit>Salvar</Submit>
      </ActionForm>
    </Card>
  );
}

export function UserForm({ user }: { user?: { id: string; name: string; email: string; role: Role; active: boolean } }) {
  return (
    <Modal
      title={user ? "Editar usuário" : "Novo usuário"}
      trigger={(open) =>
        user ? (
          <Button variant="ghost" size="sm" onClick={open} aria-label="Editar">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button size="sm" onClick={open}>
            <UserPlus className="size-4" /> Novo usuário
          </Button>
        )
      }
    >
      {(close) => (
        <ActionForm action={saveUserAction} onSuccess={close} resetOnSuccess={!user}>
          <input type="hidden" name="id" value={user?.id ?? ""} />
          <Input label="Nome" name="name" defaultValue={user?.name} required />
          <Input label="E-mail" name="email" type="email" defaultValue={user?.email} required />
          <Select label="Perfil" name="role" defaultValue={user?.role ?? "RECEPCAO"}>
            <option value="RECEPCAO">Recepção</option>
            <option value="CAMAREIRA">Camareira</option>
            <option value="ADMIN">Administrador</option>
          </Select>
          <Input
            label={user ? "Nova senha" : "Senha"}
            hint={user ? "deixe em branco para manter" : "mínimo 6 caracteres"}
            name="password"
            type="password"
            autoComplete="new-password"
            required={!user}
          />
          <Checkbox name="active" label="Acesso ativo" defaultChecked={user?.active ?? true} />
          <Submit className="w-full">Salvar</Submit>
        </ActionForm>
      )}
    </Modal>
  );
}
