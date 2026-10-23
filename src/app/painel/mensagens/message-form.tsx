"use client";

import { Send } from "lucide-react";
import { sendMessageAction } from "@/actions/staff";
import { ActionForm, Submit } from "@/components/form";
import { Card, Select, Textarea } from "@/components/ui";

export function MessageForm({ users }: { users: { id: string; name: string }[] }) {
  return (
    <Card>
      <ActionForm action={sendMessageAction} resetOnSuccess>
        <Textarea name="body" placeholder="Escreva um recado... (ex.: suíte 203 com toalha faltando)" required />
        <div className="flex items-end gap-3">
          <Select label="Para" name="toUserId" defaultValue="" className="w-56">
            <option value="">Toda a equipe</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
          <Submit>
            <Send className="size-4" /> Enviar
          </Submit>
        </div>
      </ActionForm>
    </Card>
  );
}
