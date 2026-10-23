import { requireUser, ADMIN } from "@/lib/auth";
import { db } from "@/lib/db";
import { roleLabel } from "@/lib/labels";
import { formatDateTime } from "@/lib/time";
import { Badge, Card, PageHeader, Table, Td } from "@/components/ui";
import { UserForm } from "../configuracoes/settings-forms";

export const metadata = { title: "Funcionários" };

const roleInfo = [
  { role: "Administrador", text: "Acesso total: relatórios, dashboard, despesas, preços, configurações e funcionários." },
  {
    role: "Recepção",
    text: "Opera o dia a dia: mapa, check-in/out, reservas, vendas, pedidos, caixa (sem ver faturamento — fechamento cego), estoque e clientes.",
  },
  { role: "Camareira", text: "Só fila de limpeza, manutenções e comunicação interna." },
];

export default async function TeamPage() {
  await requireUser(ADMIN);
  const users = await db.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
  const online = (d: Date | null) => !!d && Date.now() - d.getTime() < 5 * 60_000;
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Funcionários" subtitle="Cada funcionário entra com o próprio e-mail e senha." actions={<UserForm />} />
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        {roleInfo.map((r) => (
          <Card key={r.role} className="p-4">
            <div className="text-sm font-semibold">{r.role}</div>
            <p className="mt-1 text-xs text-muted">{r.text}</p>
          </Card>
        ))}
      </div>
      <Table head={["Nome", "Login", "Perfil", "Último acesso", ""]}>
        {users.map((u) => (
          <tr key={u.id} className={u.active ? "" : "opacity-50"}>
            <Td className="font-medium">
              <span className={`mr-2 inline-block size-2 rounded-full ${online(u.lastSeenAt) ? "bg-emerald-400" : "bg-zinc-600"}`} />
              {u.name}
            </Td>
            <Td className="text-muted">{u.email}</Td>
            <Td>
              <Badge className="bg-surface-2 text-zinc-300">{roleLabel[u.role]}</Badge>
              {!u.active && <Badge className="ml-1 bg-zinc-500/20 text-zinc-400">inativo</Badge>}
            </Td>
            <Td className="text-muted">{u.lastSeenAt ? formatDateTime(u.lastSeenAt) : "—"}</Td>
            <Td className="text-right">
              <UserForm user={{ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active }} />
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
