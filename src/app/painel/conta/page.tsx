import { requireUser } from "@/lib/auth";
import { roleLabel } from "@/lib/labels";
import { PageHeader } from "@/components/ui";
import { PasswordForm } from "./password-form";

export const metadata = { title: "Minha senha" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Trocar minha senha" subtitle={`${user.name} · ${user.email} · ${roleLabel[user.role]}`} />
      <PasswordForm />
    </div>
  );
}
