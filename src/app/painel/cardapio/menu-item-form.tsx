"use client";

import { Pencil } from "lucide-react";
import { menuItemAction } from "@/actions/products";
import { ActionForm, Submit } from "@/components/form";
import { Modal } from "@/components/modal";
import { Button, Checkbox, Textarea } from "@/components/ui";

export function MenuItemForm({ item }: { item: { id: string; name: string; description: string; showOnMenu: boolean } }) {
  return (
    <Modal
      title={item.name}
      trigger={(open) => (
        <Button variant="ghost" size="sm" onClick={open} aria-label="Editar">
          <Pencil className="size-4" />
        </Button>
      )}
    >
      {(close) => (
        <ActionForm action={menuItemAction} onSuccess={close}>
          <input type="hidden" name="id" value={item.id} />
          <Textarea label="Descrição" name="description" defaultValue={item.description} placeholder="Ex.: 500g, acompanha molho da casa" />
          <Checkbox name="showOnMenu" label="Mostrar no cardápio" defaultChecked={item.showOnMenu} />
          <Submit className="w-full">Salvar</Submit>
        </ActionForm>
      )}
    </Modal>
  );
}
