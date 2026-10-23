import Link from "next/link";
import {
  CalendarCheck,
  Clock,
  DoorOpen,
  Gauge as GaugeIcon,
  History,
  Percent,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { requireUser, ADMIN } from "@/lib/auth";
import { db } from "@/lib/db";
import { cashSummary, getOpenCashSession } from "@/lib/cash";
import { byWeekday, kpis, monthlyHistory, periodRange, PERIODS, progress, quickMetrics, type Period } from "@/lib/dashboard";
import { modeLabel, suiteStatusLabel } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { BarChart, Gauge } from "@/components/charts";
import { AutoRefresh } from "@/components/auto-refresh";
import { Card, cn } from "@/components/ui";

export const metadata = { title: "Dashboard" };

const DAY = 86_400_000;
const compact = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(cents / 100);
const hm = (min: number) => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}m`;

const STATUS_COLORS = { LIVRE: "#34d399", OCUPADA: "#fb7185", LIMPEZA: "#fbbf24", RESERVADA: "#38bdf8", MANUTENCAO: "#a1a1aa" } as const;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  await requireUser(ADMIN);
  const sp = (await searchParams).p;
  const period: Period = sp && sp in PERIODS ? (sp as Period) : "mes";
  const now = new Date();
  const { start, end } = periodRange(period, now);

  const [k, suites, openStays, cash, history, weekdays, prog, last, shifts, online, logs] = await Promise.all([
    kpis(start, end),
    db.suite.groupBy({ by: ["status"], where: { active: true }, _count: true }),
    db.stay.findMany({ where: { status: "ABERTA" }, include: { suite: { include: { category: true } } } }),
    getOpenCashSession(),
    monthlyHistory(now),
    byWeekday(start, end),
    progress(now),
    Promise.all([1, 7, 30].map((d) => quickMetrics(new Date(now.getTime() - d * DAY), now))),
    db.cashSession.findMany({ orderBy: { openedAt: "desc" }, take: 3 }),
    db.user.findMany({ where: { active: true, lastSeenAt: { gte: new Date(now.getTime() - 5 * 60_000) } }, select: { name: true } }),
    db.auditLog.findMany({ include: { user: true }, orderBy: { createdAt: "desc" }, take: 12 }),
  ]);
  const shiftMetrics = await Promise.all(shifts.map((s) => quickMetrics(s.openedAt, s.closedAt ?? now)));

  // Situação das suítes
  const count = (s: keyof typeof STATUS_COLORS) => suites.find((x) => x.status === s)?._count ?? 0;
  const totalSuites = suites.reduce((s, x) => s + x._count, 0);
  const others = count("LIMPEZA") + count("RESERVADA") + count("MANUTENCAO");
  const pct = (n: number) => (totalSuites ? `${((n / totalSuites) * 100).toFixed(1)}%` : "0%");

  // Tipos dos usos atuais
  const uses = new Map<string, number>();
  for (const s of openStays) {
    const key = `${s.suite.category.name} · ${s.mode === "PERNOITE" ? "Pernoite" : `${s.periodHours} horas`}`;
    uses.set(key, (uses.get(key) ?? 0) + 1);
  }

  // Movimento do caixa no turno por usuário
  const shiftRows: { name: string; inflow: number; outflow: number }[] = [];
  let drawer = 0;
  if (cash) {
    drawer = (await cashSummary(cash.id)).expectedCash;
    const [payments, movements] = await Promise.all([
      db.payment.findMany({
        where: { cashSessionId: cash.id },
        include: { stay: { include: { closedBy: true } }, sale: { include: { createdBy: true } } },
      }),
      db.cashMovement.findMany({ where: { cashSessionId: cash.id }, include: { user: true } }),
    ]);
    const row = (name: string) => {
      let r = shiftRows.find((x) => x.name === name);
      if (!r) shiftRows.push((r = { name, inflow: 0, outflow: 0 }));
      return r;
    };
    for (const p of payments) row(p.stay?.closedBy?.name ?? p.sale?.createdBy.name ?? "Recebimentos").inflow += p.amount;
    for (const m of movements) {
      if (m.type === "SUPRIMENTO") row(m.user.name).inflow += m.amount;
      else row(m.user.name).outflow += m.amount;
    }
  }

  const resultRows = (list: Awaited<ReturnType<typeof quickMetrics>>[]) => [
    { label: "Check-in / out", values: list.map((m) => `${m.checkIns}/${m.checkOuts}`) },
    { label: "Vendas avulsas", values: list.map((m) => String(m.sales)) },
    { label: "Faturamento", values: list.map((m) => formatMoney(m.revenue)) },
    { label: "Despesas", values: list.map((m) => formatMoney(m.expenses)) },
    { label: "Reservas", values: list.map((m) => String(m.reservations)) },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <AutoRefresh seconds={60} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted">
            {formatDateTime(start)} até agora ·{" "}
            <Link href="/painel/relatorios/faturamento" className="underline hover:text-white">
              relatório de faturamento
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl border border-line p-1">
          {Object.entries(PERIODS).map(([key, label]) => (
            <a
              key={key}
              href={`?p=${key}`}
              className={cn("rounded-lg px-2.5 py-1 text-xs", key === period ? "bg-gradient-accent text-white" : "text-muted hover:text-white")}
            >
              {label}
            </a>
          ))}
        </div>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Receipt} label="Faturamento" value={formatMoney(k.revenue)} hint={`Suítes ${formatMoney(k.usesRevenue)} · Vendas ${formatMoney(k.salesRevenue)}`} accent="text-sky-300" />
        <Kpi icon={TrendingDown} label="Pagamentos" value={formatMoney(k.expenses)} hint="Despesas no período" accent="text-rose-300" />
        <Kpi icon={Wallet} label="Ticket médio" value={formatMoney(k.avgTicket)} hint={`Vendas avulsas: ${formatMoney(k.avgSale)}`} accent="text-amber-300" />
        <Kpi icon={Clock} label="Tempo médio" value={hm(k.avgMinutes)} hint={`${k.finishedUses} usos finalizados`} accent="text-violet-300" />
        <Kpi icon={GaugeIcon} label="RevPAR" value={formatMoney(k.revpar)} hint="Receita por suíte por dia" accent="text-cyan-300" />
        <Kpi
          icon={Percent}
          label="Margem"
          value={`${k.margin.toFixed(1)}%`}
          hint={`Lucro ${formatMoney(k.profit)} (desc. custo das mercadorias)`}
          accent="text-emerald-300"
        />
        <Kpi icon={DoorOpen} label="Check-in / out" value={`${k.checkIns} / ${k.checkOuts}`} hint={`${k.sales} vendas avulsas`} accent="text-sky-300" />
        <Kpi icon={CalendarCheck} label="Reservas" value={String(k.reservations)} hint={`≈ ${formatMoney(k.reservationValue)}`} accent="text-amber-300" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Situação das suítes" badge={`${totalSuites} suítes`}>
          <Gauge
            segments={(Object.keys(STATUS_COLORS) as (keyof typeof STATUS_COLORS)[]).map((s) => ({
              label: suiteStatusLabel[s],
              value: count(s),
              color: STATUS_COLORS[s],
            }))}
          />
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Mini value={count("LIVRE")} label="Disponíveis" pct={pct(count("LIVRE"))} className="bg-emerald-500/10 text-emerald-300" />
            <Mini value={count("OCUPADA")} label="Ocupadas" pct={pct(count("OCUPADA"))} className="bg-rose-500/10 text-rose-300" />
            <Mini value={others} label="Outras" pct={pct(others)} className="bg-surface-2 text-zinc-300" />
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-3 text-xs text-muted">
            {(Object.keys(STATUS_COLORS) as (keyof typeof STATUS_COLORS)[]).map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: STATUS_COLORS[s] }} />
                {suiteStatusLabel[s]} {count(s)}
              </span>
            ))}
          </div>
        </Panel>
        <Panel title="Tipos dos usos atuais">
          <SimpleTable
            rows={[...uses.entries()].map(([k2, v]) => [k2, String(v)])}
            total={["Total", String(openStays.length)]}
            empty="Nenhuma suíte ocupada."
          />
          <p className="mt-3 text-xs text-muted">
            {openStays.filter((s) => s.mode === "PERNOITE").length} {modeLabel.PERNOITE.toLowerCase()} ·{" "}
            {openStays.filter((s) => s.mode === "PERIODO").length} {modeLabel.PERIODO.toLowerCase()}
          </p>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Saldo atual do caixa">
          <SimpleTable rows={cash ? [["Gaveta (dinheiro esperado)", formatMoney(drawer)]] : []} empty="Nenhum caixa aberto." />
        </Panel>
        <Panel title="Movimento do caixa no turno">
          {shiftRows.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">Sem movimento.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted">
                  <th className="py-1.5 font-medium">Usuário</th>
                  <th className="py-1.5 text-right font-medium">Entradas</th>
                  <th className="py-1.5 text-right font-medium">Saídas</th>
                  <th className="py-1.5 text-right font-medium">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shiftRows.map((r) => (
                  <tr key={r.name}>
                    <td className="py-1.5">{r.name}</td>
                    <td className="py-1.5 text-right tabular-nums text-emerald-300">+{formatMoney(r.inflow)}</td>
                    <td className="py-1.5 text-right tabular-nums text-rose-300">{formatMoney(r.outflow)}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatMoney(r.inflow - r.outflow)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-1.5">Total</td>
                  <td className="py-1.5 text-right tabular-nums">+{formatMoney(shiftRows.reduce((s, r) => s + r.inflow, 0))}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatMoney(shiftRows.reduce((s, r) => s + r.outflow, 0))}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatMoney(shiftRows.reduce((s, r) => s + r.inflow - r.outflow, 0))}</td>
                </tr>
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Últimos resultados">
          <ResultsTable head={["24h", "7 dias", "30 dias"]} rows={resultRows(last)} />
        </Panel>
        <Panel title="Resultados dos turnos">
          <ResultsTable head={shifts.map((s, i) => (i === 0 ? (s.status === "ABERTO" ? "Atual" : "Último") : `Anterior ${i}`))} rows={resultRows(shiftMetrics)} />
        </Panel>
      </div>

      <Panel title="Histórico de faturamento (12 meses)" icon={History}>
        <BarChart
          height={260}
          formatAxis={compact}
          data={history.map((m) => ({ label: m.label, value: m.revenue, tooltip: `${m.label}: ${formatMoney(m.revenue)} · ${m.uses} usos` }))}
        />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title={`Faturamento por dia da semana · ${PERIODS[period]}`}>
          <BarChart
            formatAxis={compact}
            data={weekdays.map((d) => ({ label: d.label, value: d.revenue, tooltip: `${d.label}: ${formatMoney(d.revenue)} · ${d.payments} pagamentos` }))}
          />
        </Panel>
        <Panel title={`Reservas por dia da semana · ${PERIODS[period]}`}>
          <BarChart
            color="bg-accent-2"
            integer
            formatAxis={(v) => String(Math.round(v))}
            data={weekdays.map((d) => ({ label: d.label, value: d.reservations, tooltip: `${d.label}: ${d.reservations} reservas` }))}
          />
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Andamento do mês" badge={`${prog.month.pct.toFixed(1)}%`}>
          <Progress soFar={prog.month.soFar} projection={prog.month.projection} compare={prog.month.compare} />
        </Panel>
        <Panel title="Andamento do ano" badge={`${prog.year.pct.toFixed(1)}%`}>
          <Progress soFar={prog.year.soFar} projection={prog.year.projection} compare={prog.year.compare} />
        </Panel>
      </div>

      <Panel title="Usuários online" badge={String(online.length)}>
        <div className="flex flex-wrap justify-center gap-2">
          {online.map((u) => (
            <span key={u.name} className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm">
              <span className="size-2 rounded-full bg-emerald-400" /> {u.name}
            </span>
          ))}
          {online.length === 0 && <span className="text-sm text-muted">Ninguém online.</span>}
        </div>
      </Panel>

      <Panel title="Últimas ações dos usuários">
        <div className="divide-y divide-line text-sm">
          {logs.map((l) => (
            <div key={l.id} className={cn("flex gap-4 px-1 py-2", l.important && "bg-amber-500/5")}>
              <span className="w-24 shrink-0 text-xs text-muted">{formatDateTime(l.createdAt)}</span>
              <span className="w-28 shrink-0 truncate font-medium">{l.user?.name ?? "Sistema"}</span>
              <span className="min-w-0 flex-1">{l.action}</span>
              {l.important && <span className="text-xs text-amber-300">Atenção</span>}
            </div>
          ))}
          {logs.length === 0 && <p className="py-4 text-center text-muted">Nenhuma ação registrada ainda.</p>}
        </div>
      </Panel>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint, accent }: { icon: typeof Receipt; label: string; value: string; hint: string; accent: string }) {
  return (
    <Card className="p-4 text-center">
      <Icon className={cn("mx-auto size-4", accent)} />
      <div className="mt-1.5 text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 truncate text-xs text-muted" title={hint}>
        {hint}
      </div>
    </Card>
  );
}

function Panel({ title, badge, icon: Icon, children }: { title: string; badge?: string; icon?: typeof Receipt; children: React.ReactNode }) {
  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          {Icon && <Icon className="size-4 text-muted" />}
          {title}
        </h2>
        {badge && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">{badge}</span>}
      </div>
      <div className="p-5">{children}</div>
    </Card>
  );
}

function Mini({ value, label, pct, className }: { value: number; label: string; pct: string; className: string }) {
  return (
    <div className={cn("rounded-xl py-3", className)}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs">{label}</div>
      <div className="text-xs opacity-70">{pct}</div>
    </div>
  );
}

function SimpleTable({ rows, total, empty }: { rows: string[][]; total?: string[]; empty: string }) {
  if (rows.length === 0) return <p className="py-4 text-center text-sm text-muted">{empty}</p>;
  return (
    <table className="w-full text-sm">
      <tbody className="divide-y divide-line">
        {rows.map((r) => (
          <tr key={r[0]}>
            <td className="py-1.5 text-muted">{r[0]}</td>
            <td className="py-1.5 text-right font-medium tabular-nums">{r[1]}</td>
          </tr>
        ))}
        {total && (
          <tr className="font-semibold">
            <td className="py-1.5">{total[0]}</td>
            <td className="py-1.5 text-right tabular-nums">{total[1]}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function ResultsTable({ head, rows }: { head: string[]; rows: { label: string; values: string[] }[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs uppercase text-sky-300">
          <th />
          {head.map((h) => (
            <th key={h} className="py-1.5 text-right font-medium">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((r) => (
          <tr key={r.label}>
            <td className="py-1.5 text-muted">{r.label}</td>
            {r.values.map((v, i) => (
              <td key={i} className="py-1.5 text-right font-medium tabular-nums">
                {v}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Progress({
  soFar,
  projection,
  compare,
}: {
  soFar: number;
  projection: number;
  compare: { label: string; base: number; change: number | null }[];
}) {
  return (
    <div className="text-center">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-muted">Já faturado</div>
          <div className="text-xl font-semibold text-sky-300">{formatMoney(soFar)}</div>
        </div>
        <div>
          <div className="text-xs text-muted">Projeção*</div>
          <div className="text-xl font-semibold text-sky-300">{formatMoney(projection)}</div>
        </div>
      </div>
      <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: `repeat(${compare.length}, minmax(0, 1fr))` }}>
        {compare.map((c) => (
          <div key={c.label}>
            {c.change === null ? (
              <div className="text-lg font-semibold text-muted">—</div>
            ) : (
              <div className={cn("flex items-center justify-center gap-1 text-lg font-semibold", c.change >= 0 ? "text-emerald-300" : "text-rose-300")}>
                {c.change >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                {c.change >= 0 ? "+" : ""}
                {c.change.toFixed(1)}%
              </div>
            )}
            <div className="text-xs text-muted">{c.label}</div>
            <div className="text-xs text-muted">{c.base ? formatMoney(c.base) : "sem dados"}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-muted">* Projeção linear com base no ritmo atual.</p>
    </div>
  );
}
