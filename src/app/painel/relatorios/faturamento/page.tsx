import { requireUser, ADMIN } from "@/lib/auth";
import { db } from "@/lib/db";
import { modeLabel, paymentLabel } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { addDays, formatDate, localParts, startOfLocalDay } from "@/lib/time";
import { Card, PageHeader, Stat, Table, Td } from "@/components/ui";

export const metadata = { title: "Relatório de faturamento" };

const RANGES = { "7": "7 dias", "30": "30 dias", "90": "90 dias" } as const;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  await requireUser(ADMIN);
  const { dias } = await searchParams;
  const days = dias && dias in RANGES ? Number(dias) : 30;
  const end = addDays(startOfLocalDay(new Date()), 1);
  const start = addDays(end, -days);

  const [stays, payments, consumptions, suites] = await Promise.all([
    db.stay.findMany({
      where: { status: "FECHADA", checkOut: { gte: start, lt: end } },
      include: { suite: { include: { category: true } } },
    }),
    db.payment.groupBy({ by: ["method"], where: { createdAt: { gte: start, lt: end } }, _sum: { amount: true } }),
    db.consumption.groupBy({
      by: ["productId"],
      where: { createdAt: { gte: start, lt: end }, stay: { status: "FECHADA" } },
      _sum: { quantity: true },
    }),
    db.suite.count({ where: { active: true } }),
  ]);
  const products = await db.product.findMany({ where: { id: { in: consumptions.map((c) => c.productId) } } });

  const revenue = stays.reduce((s, x) => s + x.total, 0);
  const roomRevenue = stays.reduce((s, x) => s + x.roomAmount, 0);
  const consRevenue = stays.reduce((s, x) => s + x.consumptionAmount, 0);
  const discounts = stays.reduce((s, x) => s + x.discount, 0);
  const occupiedMs = stays.reduce((s, x) => s + (x.checkOut!.getTime() - x.checkIn.getTime()), 0);
  const occupancy = suites ? (occupiedMs / (suites * days * 86_400_000)) * 100 : 0;
  const avgTicket = stays.length ? Math.round(revenue / stays.length) : 0;
  const avgMinutes = stays.length ? Math.round(occupiedMs / stays.length / 60000) : 0;

  // Faturamento por dia (fuso local)
  const daily = new Map<string, number>();
  for (let i = 0; i < days; i++) daily.set(formatDate(addDays(start, i)), 0);
  for (const s of stays) {
    const k = formatDate(s.checkOut!);
    daily.set(k, (daily.get(k) ?? 0) + s.total);
  }
  const dailyEntries = [...daily.entries()];
  const maxDay = Math.max(1, ...dailyEntries.map(([, v]) => v));

  // Entradas por hora do dia
  const hours = Array.from({ length: 24 }, () => 0);
  for (const s of stays) hours[localParts(s.checkIn).hour]++;
  const maxHour = Math.max(1, ...hours);

  // Por categoria
  const byCategory = new Map<string, { count: number; revenue: number }>();
  for (const s of stays) {
    const k = s.suite.category.name;
    const cur = byCategory.get(k) ?? { count: 0, revenue: 0 };
    byCategory.set(k, { count: cur.count + 1, revenue: cur.revenue + s.total });
  }

  const topProducts = consumptions
    .map((c) => {
      const p = products.find((x) => x.id === c.productId)!;
      const qty = c._sum.quantity ?? 0;
      return { name: p.name, qty, revenue: qty * p.price, profit: qty * (p.price - p.cost) };
    })
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  const totalPayments = payments.reduce((s, p) => s + (p._sum.amount ?? 0), 0);
  const mode = { PERIODO: stays.filter((s) => s.mode === "PERIODO").length, PERNOITE: stays.filter((s) => s.mode === "PERNOITE").length };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Relatório de faturamento"
        subtitle={`${formatDate(start)} a ${formatDate(addDays(end, -1))}`}
        actions={
          <div className="flex gap-1 rounded-xl border border-line p-1">
            {Object.entries(RANGES).map(([k, label]) => (
              <a
                key={k}
                href={`?dias=${k}`}
                className={`rounded-lg px-3 py-1.5 text-sm ${Number(k) === days ? "bg-surface-2 text-white" : "text-muted hover:text-white"}`}
              >
                {label}
              </a>
            ))}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Faturamento" value={formatMoney(revenue)} hint={`${formatMoney(discounts)} em descontos`} />
        <Stat label="Locações" value={stays.length} hint={`${mode.PERIODO} período · ${mode.PERNOITE} pernoite`} />
        <Stat label="Ticket médio" value={formatMoney(avgTicket)} hint={`permanência média ${Math.floor(avgMinutes / 60)}h${String(avgMinutes % 60).padStart(2, "0")}`} />
        <Stat label="Taxa de ocupação" value={`${occupancy.toFixed(1)}%`} hint={`${suites} suítes ativas`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-4 font-semibold">Faturamento por dia</h2>
          <div className="flex h-48 items-end gap-1">
            {dailyEntries.map(([day, v]) => (
              <div key={day} className="group relative flex h-full flex-1 flex-col justify-end">
                <div className="rounded-t bg-gradient-accent opacity-80 transition group-hover:opacity-100" style={{ height: `${(v / maxDay) * 100}%`, minHeight: v ? 2 : 0 }} />
                <div className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-surface-2 px-2 py-1 text-xs group-hover:block">
                  {day.slice(0, 5)} · {formatMoney(v)}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted">
            <span>{dailyEntries[0]?.[0].slice(0, 5)}</span>
            <span>{dailyEntries.at(-1)?.[0].slice(0, 5)}</span>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 font-semibold">Receita</h2>
          <div className="space-y-3 text-sm">
            <Bar label="Suítes" value={roomRevenue} total={roomRevenue + consRevenue} />
            <Bar label="Consumo" value={consRevenue} total={roomRevenue + consRevenue} />
            <div className="border-t border-line pt-3" />
            {(["PIX", "CREDITO", "DEBITO", "DINHEIRO"] as const).map((m) => (
              <Bar key={m} label={paymentLabel[m]} value={payments.find((p) => p.method === m)?._sum.amount ?? 0} total={totalPayments} />
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="mb-4 font-semibold">Entradas por horário</h2>
          <div className="flex h-32 items-end gap-1">
            {hours.map((n, h) => (
              <div key={h} className="flex h-full flex-1 flex-col justify-end" title={`${h}h: ${n} entradas`}>
                <div className="w-full rounded-t bg-accent-2/70" style={{ height: `${(n / maxHour) * 100}%`, minHeight: n ? 2 : 0 }} />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted">
            <span>0h</span>
            <span>6h</span>
            <span>12h</span>
            <span>18h</span>
            <span>23h</span>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 font-semibold">Por categoria</h2>
          <div className="space-y-3 text-sm">
            {[...byCategory.entries()]
              .sort((a, b) => b[1].revenue - a[1].revenue)
              .map(([name, v]) => (
                <div key={name} className="flex justify-between">
                  <span>
                    {name} <span className="text-muted">({v.count})</span>
                  </span>
                  <span className="font-medium">{formatMoney(v.revenue)}</span>
                </div>
              ))}
            {byCategory.size === 0 && <p className="text-muted">Sem dados.</p>}
          </div>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 font-semibold">Produtos mais vendidos</h2>
      <Table head={["Produto", "Quantidade", "Receita", "Lucro bruto"]}>
        {topProducts.map((p) => (
          <tr key={p.name}>
            <Td className="font-medium">{p.name}</Td>
            <Td>{p.qty}</Td>
            <Td>{formatMoney(p.revenue)}</Td>
            <Td className="text-emerald-300">{formatMoney(p.profit)}</Td>
          </tr>
        ))}
        {topProducts.length === 0 && (
          <tr>
            <Td colSpan={4} className="text-center text-muted">
              Sem vendas no período.
            </Td>
          </tr>
        )}
      </Table>
      <p className="mt-4 text-xs text-muted">Modalidades: {modeLabel.PERIODO} e {modeLabel.PERNOITE}. Valores consideram locações encerradas no período.</p>
    </div>
  );
}

function Bar({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between">
        <span className="text-muted">{label}</span>
        <span>
          {formatMoney(value)} <span className="text-xs text-muted">({pct.toFixed(0)}%)</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-gradient-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
