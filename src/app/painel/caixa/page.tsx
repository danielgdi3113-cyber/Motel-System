import { requireUser, STAFF } from "@/lib/auth";
import { db } from "@/lib/db";
import { cashSummary, getOpenCashSession } from "@/lib/cash";
import { cashMovementLabel as movementLabel, paymentLabel } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { Card, PageHeader, Stat, Table, Td } from "@/components/ui";
import { CloseCash, MovementForm, OpenCash } from "./cash-forms";

export const metadata = { title: "Caixa" };

export default async function CashPage() {
  const user = await requireUser(STAFF);
  const isAdmin = user.role === "ADMIN";
  const open = await getOpenCashSession();
  const history = isAdmin
    ? await db.cashSession.findMany({
        where: { status: "FECHADO" },
        orderBy: { closedAt: "desc" },
        take: 15,
        include: { openedBy: true, closedBy: true },
      })
    : [];

  if (!open) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader title="Caixa" subtitle="Nenhum caixa aberto no momento." />
        <OpenCash />
        <History sessions={history} />
      </div>
    );
  }

  const openedBy = await db.user.findUnique({ where: { id: open.openedById } });
  const movements = await db.cashMovement.findMany({
    where: { cashSessionId: open.id, ...(isAdmin ? {} : { type: { in: ["SANGRIA", "SUPRIMENTO"] } }) },
    include: { user: true, company: true, employee: true },
    orderBy: { createdAt: "desc" },
  });

  const actions = (
    <>
      <MovementForm type="SUPRIMENTO" />
      <MovementForm type="SANGRIA" />
      <CloseCash expected={isAdmin ? (await cashSummary(open.id)).expectedCash : null} />
    </>
  );

  const movementList = (
    <section>
      <h2 className="mb-3 font-semibold">Movimentações do turno</h2>
      <Card className="divide-y divide-line p-0 text-sm">
        {movements.map((m) => (
          <div key={m.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <div className={m.type === "SUPRIMENTO" ? "text-emerald-300" : "text-rose-300"}>
                {movementLabel[m.type]}
                {m.type !== "SANGRIA" && m.type !== "SUPRIMENTO" && ` · ${paymentLabel[m.method]}`}
              </div>
              <div className="text-xs text-muted">
                {[m.company?.name, m.employee?.name, m.description].filter(Boolean).join(" · ") || "—"} · {m.user.name}
              </div>
            </div>
            <span className="font-medium">{formatMoney(m.amount)}</span>
          </div>
        ))}
        {movements.length === 0 && <div className="p-4 text-center text-muted">Nenhuma movimentação.</div>}
      </Card>
    </section>
  );

  // Funcionário: opera o caixa, mas não vê faturamento nem o valor esperado (conferência cega)
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Caixa aberto" subtitle={`Aberto em ${formatDateTime(open.openedAt)} por ${openedBy?.name}`} actions={actions} />
        {movementList}
      </div>
    );
  }

  const summary = await cashSummary(open.id);
  const payments = await db.payment.findMany({
    where: { cashSessionId: open.id },
    include: { stay: { include: { suite: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Situação do turno atual"
        subtitle={`Aberto em ${formatDateTime(open.openedAt)} por ${openedBy?.name} com ${formatMoney(open.openingAmount)}`}
        actions={actions}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Stat label="Faturamento" value={formatMoney(summary.revenue)} />
        {(["DINHEIRO", "PIX", "DEBITO", "CREDITO"] as const).map((m) => (
          <Stat key={m} label={paymentLabel[m]} value={formatMoney(summary.totals[m])} />
        ))}
        <Stat
          label="Dinheiro na gaveta"
          value={formatMoney(summary.expectedCash)}
          hint={`+${formatMoney(summary.suprimentos)} / −${formatMoney(summary.sangrias)}`}
        />
      </div>
      {(summary.fornecedores > 0 || summary.adiantamentos > 0) && (
        <p className="mb-6 text-sm text-muted">
          Despesas do turno: fornecedores {formatMoney(summary.fornecedores)} · adiantamentos {formatMoney(summary.adiantamentos)}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section>
          <h2 className="mb-3 font-semibold">Recebimentos</h2>
          <Table head={["Hora", "Origem", "Forma", "Valor"]}>
            {payments.map((p) => (
              <tr key={p.id}>
                <Td className="text-muted">{formatDateTime(p.createdAt)}</Td>
                <Td>{p.stay ? `Suíte ${p.stay.suite.number}` : p.saleId ? "Venda avulsa" : p.pendingId ? "Pendência" : "—"}</Td>
                <Td>{paymentLabel[p.method]}</Td>
                <Td className="font-medium">{formatMoney(p.amount)}</Td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <Td colSpan={4} className="text-center text-muted">
                  Nenhum recebimento ainda.
                </Td>
              </tr>
            )}
          </Table>
        </section>
        {movementList}
      </div>
      <History sessions={history} />
    </div>
  );
}

function History({
  sessions,
}: {
  sessions: Awaited<ReturnType<typeof db.cashSession.findMany<{ include: { openedBy: true; closedBy: true } }>>>;
}) {
  if (!sessions.length) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-3 font-semibold">Fechamentos anteriores</h2>
      <Table head={["Abertura", "Fechamento", "Responsável", "Esperado", "Contado", "Diferença"]}>
        {sessions.map((s) => {
          const diff = (s.declaredAmount ?? 0) - (s.expectedAmount ?? 0);
          return (
            <tr key={s.id}>
              <Td>{formatDateTime(s.openedAt)}</Td>
              <Td>{s.closedAt && formatDateTime(s.closedAt)}</Td>
              <Td>{s.closedBy?.name}</Td>
              <Td>{formatMoney(s.expectedAmount ?? 0)}</Td>
              <Td>{formatMoney(s.declaredAmount ?? 0)}</Td>
              <Td className={diff === 0 ? "text-emerald-300" : "text-rose-300"}>{formatMoney(diff)}</Td>
            </tr>
          );
        })}
      </Table>
    </section>
  );
}
