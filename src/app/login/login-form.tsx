"use client";

import { loginAction } from "@/actions/auth";
import { ActionForm, Submit } from "@/components/form";
import { Card, Input } from "@/components/ui";

export function LoginForm() {
  return (
    <Card className="p-6">
      <ActionForm action={loginAction}>
        <Input label="E-mail" name="email" type="email" autoComplete="username" required autoFocus />
        <Input label="Senha" name="password" type="password" autoComplete="current-password" required />
        <Submit className="w-full">Entrar</Submit>
      </ActionForm>
    </Card>
  );
}
