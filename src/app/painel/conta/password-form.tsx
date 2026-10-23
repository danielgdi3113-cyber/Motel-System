"use client";

import { changePasswordAction } from "@/actions/staff";
import { ActionForm, Submit } from "@/components/form";
import { Card, Input } from "@/components/ui";

export function PasswordForm() {
  return (
    <Card>
      <ActionForm action={changePasswordAction} resetOnSuccess>
        <Input label="Senha atual" name="current" type="password" autoComplete="current-password" required />
        <Input label="Nova senha" name="next" type="password" autoComplete="new-password" minLength={6} required />
        <Input label="Confirme a nova senha" name="confirm" type="password" autoComplete="new-password" required />
        <Submit className="w-full">Alterar senha</Submit>
      </ActionForm>
    </Card>
  );
}
