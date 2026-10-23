import { requireUser, ADMIN } from "@/lib/auth";
import { db } from "@/lib/db";
import { roleLabel } from "@/lib/labels";
import { getSettings } from "@/lib/settings";
import { Badge, PageHeader, Table, Td } from "@/components/ui";
import { SettingsForm, UserForm } from "./settings-forms";

export const metadata = { title: "Configurações" };

export default async function SettingsPage() {
  await requireUser(ADMIN);
  const [settings, users] = await Promise.all([getSettings(), db.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] })]);
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Configurações" />
      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <section>
          <h2 className="mb-3 font-semibold">Estabelecimento</h2>
          <SettingsForm settings={settings} />
        </section>
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Equipe</h2>
            <UserForm />
          </div>
          <Table head={["Nome", "Perfil", ""]}>
            {users.map((u) => (
              <tr key={u.id} className={u.active ? "" : "opacity-50"}>
                <Td>
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-muted">{u.email}</div>
                </Td>
                <Td>
                  <Badge className="bg-surface-2 text-zinc-300">{roleLabel[u.role]}</Badge>
                  {!u.active && <Badge className="ml-1 bg-zinc-500/20 text-zinc-400">inativo</Badge>}
                </Td>
                <Td className="text-right">
                  <UserForm user={{ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active }} />
                </Td>
              </tr>
            ))}
          </Table>
        </section>
      </div>
    </div>
  );
}
