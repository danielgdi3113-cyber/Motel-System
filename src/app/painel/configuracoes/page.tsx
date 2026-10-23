import Link from "next/link";
import { requireUser, ADMIN } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui";
import { SettingsForm } from "./settings-forms";

export const metadata = { title: "Configurações" };

export default async function SettingsPage() {
  await requireUser(ADMIN);
  const settings = await getSettings();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Configurações"
        subtitle="Dados do estabelecimento e regras de cobrança."
        actions={
          <Link href="/painel/equipe" className="text-sm text-muted underline hover:text-white">
            Funcionários e logins →
          </Link>
        }
      />
      <SettingsForm settings={settings} />
    </div>
  );
}
