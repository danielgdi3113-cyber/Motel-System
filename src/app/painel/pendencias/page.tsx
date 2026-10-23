import { requireUser, STAFF } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDebtorOptions } from "@/lib/debtors";
import { pendingStatusLabel } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/time";
import { Badge, Empty, PageHeader, Stat, Table, Td } from "@/components/ui";
import { pendingCancelAction } from "@/actions/operations";
import { NewPending, PayPending } from "./pending-forms";

export const metadata = { title: "Pendências" };

export default async function PendingPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const user = await requireUser(STAFF);
  const history = (await searchParams).ver === "historico";
  const [pendings, debtors] = await Promise.all([
    db.pending.findMany({
      where: { status: history ? { in: ["QUITADA", "CANCELADA"] } : "ABERTA" },
      include: { person: true, company: true, stay: { include: { suite: true } }, createdBy: true },
      orderBy: { createdAt: history ? "desc" : "asc" },
      take: 100,
    }),
    getDebtorOptions(),
  ]);
  const open = pendings.filter((p) => p.status === "ABERTA");
  const totalOpen = open.reduce((s, p) => s + p.amount - p.paid, 0);
  const overdue = open.filter((p) => p.dueDate && p.dueDate < new Date()).length;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Pendências"
        subtitle="Contas que ficaram para pagar depois (pendura), de check-outs, vendas ou lançadas aqui."
        actions={<NewPending debtors={debtors} />}
      />
      {!history && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Stat label="Total a receber" value={formatMoney(totalOpen)} />
          <Stat label="Pendências abertas" value={open.length} />
          <Stat label="Vencidas" value={overdue} />
        </div>
      )}
      <div className="mb-4 flex gap-2 text-sm">
        <a href="/painel/pendencias" className={`rounded-full px-3 py-1.5 ${!history ? "bg-surface-2 text-white" : "text-muted"}`}>
          Em aberto
        </a>
        <a href="?ver=historico" className={`rounded-full px-3 py-1.5 ${history ? "bg-surface-2 text-white" : "text-muted"}`}>
          Quitadas / canceladas
        </a>
      </div>
      {pendings.length === 0 ? (
        <Empty>Nenhuma pendência.</Empty>
      ) : (
        <Table head={["Devedor", "Descrição", "Data", "Vencimento", "Valor", "Restante", ""]}>
          {pendings.map((p) => {
            const remaining = p.amount - p.paid;
            const late = p.status === "ABERTA" && p.dueDate && p.dueDate < new Date();
            return (
              <tr key={p.id}>
                <Td className="font-medium">{p.person?.name ?? p.company?.name ?? "—"}</Td>
                <Td className="text-muted">{p.description}</Td>
                <Td className="text-muted">{formatDateTime(p.createdAt)}</Td>
                <Td className={late ? "text-rose-300" : "text-muted"}>{p.dueDate ? formatDate(p.dueDate) : "—"}</Td>
                <Td>{formatMoney(p.amount)}</Td>
                <Td className="font-semibold">
                  {p.status === "ABERTA" ? formatMoney(remaining) : <Badge className="bg-surface-2 text-zinc-300">{pendingStatusLabel[p.status]}</Badge>}
                </Td>
                <Td className="text-right">
                  {p.status === "ABERTA" && (
                    <div className="flex justify-end gap-1">
                      <PayPending id={p.id} remaining={remaining} who={p.person?.name ?? p.company?.name ?? ""} />
                      {user.role === "ADMIN" && (
                        <form action={pendingCancelAction}>
                          <input type="hidden" name="id" value={p.id} />
                          <button className="rounded-lg px-2 py-1 text-xs text-rose-400 hover:bg-surface-2">Cancelar</button>
                        </form>
                      )}
                    </div>
                  )}
                </Td>
              </tr>
            );
          })}
        </Table>
      )}
    </div>
  );
}
