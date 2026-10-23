import { requireUser, ADMIN } from "@/lib/auth";
import { db } from "@/lib/db";
import { cashMovementLabel, paymentLabel } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { addDays, formatDateTime, fromZoned, localParts } from "@/lib/time";
import { PageHeader, Stat, Table, Td } from "@/components/ui";

export const metadata = { title: "Movimentos do caixa" };

export default async function CashMovementsReport({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string }> }) {
  await requireUser(ADMIN);
  const sp = await searchParams;
  const today = localParts(new Date());
  const iso = (p: { year: number; month: number; day: number }) =>
    `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.de ?? "") ? sp.de! : iso(today);
  const to = /^\d{4}-\d{2}-\d{2}$/.test(sp.ate ?? "") ? sp.ate! : from;
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const start = fromZoned(fy, fm, fd, 0);
  const end = addDays(fromZoned(ty, tm, td, 0), 1);

  const [payments, movements] = await Promise.all([
    db.payment.findMany({
      where: { createdAt: { gte: start, lt: end } },
      include: { stay: { include: { suite: true, closedBy: true } }, sale: { include: { createdBy: true } }, pending: { include: { person: true, company: true } } },
    }),
    db.cashMovement.findMany({ where: { createdAt: { gte: start, lt: end } }, include: { user: true, company: true, employee: true } }),
  ]);

  type Row = { at: Date; kind: string; detail: string; who: string; method: string; inflow: number; outflow: number };
  const rows: Row[] = [
    ...payments.map((p) => ({
      at: p.createdAt,
      kind: p.stay ? "Locação" : p.sale ? "Venda avulsa" : "Pendência",
      detail: p.stay
        ? `Suíte ${p.stay.suite.number}`
        : p.pending
          ? (p.pending.person?.name ?? p.pending.company?.name ?? "")
          : "",
      who: p.stay?.closedBy?.name ?? p.sale?.createdBy.name ?? "—",
      method: paymentLabel[p.method],
      inflow: p.amount,
      outflow: 0,
    })),
    ...movements.map((m) => ({
      at: m.createdAt,
      kind: cashMovementLabel[m.type],
      detail: [m.company?.name, m.employee?.name, m.description].filter(Boolean).join(" · "),
      who: m.user.name,
      method: paymentLabel[m.method],
      inflow: m.type === "SUPRIMENTO" ? m.amount : 0,
      outflow: m.type === "SUPRIMENTO" ? 0 : m.amount,
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const inflow = rows.reduce((s, r) => s + r.inflow, 0);
  const outflow = rows.reduce((s, r) => s + r.outflow, 0);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Movimentos do caixa"
        actions={
          <form className="flex items-end gap-2 text-sm">
            <label>
              <span className="mb-1 block text-xs text-muted">De</span>
              <input type="date" name="de" defaultValue={from} className="h-9 rounded-lg border border-line bg-bg px-2" />
            </label>
            <label>
              <span className="mb-1 block text-xs text-muted">Até</span>
              <input type="date" name="ate" defaultValue={to} className="h-9 rounded-lg border border-line bg-bg px-2" />
            </label>
            <button className="h-9 rounded-lg bg-surface-2 px-3 hover:bg-line">Filtrar</button>
          </form>
        }
      />
      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Entradas" value={formatMoney(inflow)} />
        <Stat label="Saídas" value={formatMoney(outflow)} />
        <Stat label="Saldo" value={formatMoney(inflow - outflow)} />
      </div>
      <Table head={["Data", "Tipo", "Detalhe", "Usuário", "Forma", "Entrada", "Saída"]}>
        {rows.map((r, i) => (
          <tr key={i}>
            <Td className="text-muted">{formatDateTime(r.at)}</Td>
            <Td>{r.kind}</Td>
            <Td className="text-muted">{r.detail || "—"}</Td>
            <Td className="text-muted">{r.who}</Td>
            <Td>{r.method}</Td>
            <Td className="tabular-nums text-emerald-300">{r.inflow ? formatMoney(r.inflow) : ""}</Td>
            <Td className="tabular-nums text-rose-300">{r.outflow ? formatMoney(r.outflow) : ""}</Td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <Td colSpan={7} className="text-center text-muted">
              Nenhum movimento no período.
            </Td>
          </tr>
        )}
      </Table>
    </div>
  );
}
