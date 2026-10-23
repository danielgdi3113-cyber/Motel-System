import { Prisma } from "@prisma/client";
import { db } from "./db";
import { addDays, fromZoned, localParts, startOfLocalDay, startOfLocalMonth, startOfLocalYear, TIMEZONE } from "./time";

export const PERIODS = {
  hoje: "Hoje",
  "24h": "24h",
  semana: "Semana",
  "7d": "7 dias",
  mes: "Mês",
  "30d": "30 dias",
  ano: "Ano",
  "12m": "12 meses",
} as const;
export type Period = keyof typeof PERIODS;

const DAY = 86_400_000;

export function periodRange(p: Period, now = new Date()): { start: Date; end: Date } {
  const today = startOfLocalDay(now);
  switch (p) {
    case "hoje":
      return { start: today, end: now };
    case "24h":
      return { start: new Date(now.getTime() - DAY), end: now };
    case "semana": {
      // Semana começa na segunda-feira
      const dow = (new Date(today.getTime() + 12 * 3_600_000).getUTCDay() + 6) % 7;
      return { start: addDays(today, -dow), end: now };
    }
    case "7d":
      return { start: new Date(now.getTime() - 7 * DAY), end: now };
    case "mes":
      return { start: startOfLocalMonth(now), end: now };
    case "30d":
      return { start: new Date(now.getTime() - 30 * DAY), end: now };
    case "ano":
      return { start: startOfLocalYear(now), end: now };
    case "12m":
      return { start: startOfLocalMonth(now, -11), end: now };
  }
}

const range = (start: Date, end: Date) => ({ gte: start, lt: end });

/** Números rápidos de um intervalo (usados nas tabelas de resultados). */
export async function quickMetrics(start: Date, end: Date) {
  const [checkIns, checkOuts, sales, revenue, expenses, reservations] = await Promise.all([
    db.stay.count({ where: { checkIn: range(start, end), status: { not: "CANCELADA" } } }),
    db.stay.count({ where: { checkOut: range(start, end), status: "FECHADA" } }),
    db.sale.count({ where: { createdAt: range(start, end) } }),
    db.payment.aggregate({ where: { createdAt: range(start, end) }, _sum: { amount: true } }),
    db.cashMovement.aggregate({
      where: { createdAt: range(start, end), type: { in: ["PAGAMENTO_FORNECEDOR", "ADIANTAMENTO_SALARIAL"] } },
      _sum: { amount: true },
    }),
    db.reservation.count({ where: { createdAt: range(start, end) } }),
  ]);
  return {
    checkIns,
    checkOuts,
    sales,
    revenue: revenue._sum.amount ?? 0,
    expenses: expenses._sum.amount ?? 0,
    reservations,
  };
}

/** Indicadores principais do período selecionado. */
export async function kpis(start: Date, end: Date) {
  const [quick, bySource, stays, salesAgg, consumptions, saleItems, reservations, suites] = await Promise.all([
    quickMetrics(start, end),
    db.payment.findMany({ where: { createdAt: range(start, end) }, select: { amount: true, saleId: true } }),
    db.stay.findMany({ where: { checkOut: range(start, end), status: "FECHADA" }, select: { checkIn: true, checkOut: true, total: true } }),
    db.sale.aggregate({ where: { createdAt: range(start, end) }, _avg: { total: true } }),
    db.consumption.findMany({ where: { createdAt: range(start, end) }, select: { quantity: true, product: { select: { cost: true } } } }),
    db.saleItem.findMany({ where: { sale: { createdAt: range(start, end) } }, select: { quantity: true, product: { select: { cost: true } } } }),
    db.reservation.findMany({ where: { createdAt: range(start, end) }, select: { mode: true, category: { select: { periodPrice: true, overnightPrice: true } } } }),
    db.suite.count({ where: { active: true } }),
  ]);
  const salesRevenue = bySource.filter((p) => p.saleId).reduce((s, p) => s + p.amount, 0);
  const usesRevenue = quick.revenue - salesRevenue;
  const durations = stays.map((s) => s.checkOut!.getTime() - s.checkIn.getTime());
  const avgMinutes = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 60_000) : 0;
  const avgTicket = stays.length ? Math.round(stays.reduce((s, x) => s + x.total, 0) / stays.length) : 0;
  const cogs = [...consumptions, ...saleItems].reduce((s, c) => s + c.quantity * c.product.cost, 0);
  const profit = quick.revenue - quick.expenses - cogs;
  const days = Math.max(1, (end.getTime() - start.getTime()) / DAY);
  const reservationValue = reservations.reduce(
    (s, r) => s + (r.mode === "PERNOITE" ? r.category.overnightPrice : r.category.periodPrice),
    0,
  );
  return {
    ...quick,
    usesRevenue,
    salesRevenue,
    avgTicket,
    avgSale: Math.round(salesAgg._avg.total ?? 0),
    avgMinutes,
    finishedUses: stays.length,
    revpar: suites ? Math.round(quick.revenue / (suites * days)) : 0,
    cogs,
    profit,
    margin: quick.revenue ? (profit / quick.revenue) * 100 : 0,
    reservationValue,
  };
}

const tzSql = Prisma.raw(`'${TIMEZONE.replace(/'/g, "")}'`);
const local = (col: string) => Prisma.raw(`("${col}" AT TIME ZONE 'UTC' AT TIME ZONE ${tzSql.text})`);

/** Faturamento e locações por mês (últimos 12 meses, fuso local). */
export async function monthlyHistory(now = new Date()) {
  const start = startOfLocalMonth(now, -11);
  const [rev, uses] = await Promise.all([
    db.$queryRaw<{ m: string; total: bigint }[]>`
      SELECT to_char(date_trunc('month', ${local("createdAt")}), 'YYYY-MM') AS m, SUM(amount)::bigint AS total
      FROM "Payment" WHERE "createdAt" >= ${start} GROUP BY 1`,
    db.$queryRaw<{ m: string; n: bigint }[]>`
      SELECT to_char(date_trunc('month', ${local("checkOut")}), 'YYYY-MM') AS m, COUNT(*)::bigint AS n
      FROM "Stay" WHERE status = 'FECHADA' AND "checkOut" >= ${start} GROUP BY 1`,
  ]);
  return Array.from({ length: 12 }, (_, i) => {
    const p = localParts(startOfLocalMonth(now, i - 11));
    const key = `${p.year}-${String(p.month).padStart(2, "0")}`;
    return {
      label: `${String(p.month).padStart(2, "0")}/${String(p.year).slice(2)}`,
      revenue: Number(rev.find((r) => r.m === key)?.total ?? 0),
      uses: Number(uses.find((u) => u.m === key)?.n ?? 0),
    };
  });
}

export const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Faturamento e reservas por dia da semana no período. */
export async function byWeekday(start: Date, end: Date) {
  const [rev, res] = await Promise.all([
    db.$queryRaw<{ d: number; total: bigint; n: bigint }[]>`
      SELECT EXTRACT(DOW FROM ${local("createdAt")})::int AS d, SUM(amount)::bigint AS total, COUNT(*)::bigint AS n
      FROM "Payment" WHERE "createdAt" >= ${start} AND "createdAt" < ${end} GROUP BY 1`,
    db.$queryRaw<{ d: number; n: bigint }[]>`
      SELECT EXTRACT(DOW FROM ${local("scheduledAt")})::int AS d, COUNT(*)::bigint AS n
      FROM "Reservation" WHERE "createdAt" >= ${start} AND "createdAt" < ${end} AND status <> 'CANCELADA' GROUP BY 1`,
  ]);
  return WEEKDAYS.map((label, d) => ({
    label,
    revenue: Number(rev.find((r) => r.d === d)?.total ?? 0),
    payments: Number(rev.find((r) => r.d === d)?.n ?? 0),
    reservations: Number(res.find((r) => r.d === d)?.n ?? 0),
  }));
}

const sumPayments = async (start: Date, end: Date) =>
  (await db.payment.aggregate({ where: { createdAt: range(start, end) }, _sum: { amount: true } }))._sum.amount ?? 0;

/** Andamento do mês e do ano, com projeção linear e comparativos. */
export async function progress(now = new Date()) {
  const monthStart = startOfLocalMonth(now);
  const nextMonth = startOfLocalMonth(now, 1);
  const yearStart = startOfLocalYear(now);
  const nextYear = startOfLocalYear(now, 1);
  const p = localParts(now);

  const [monthSoFar, prevMonth, sameMonthLastYear, yearSoFar, prevYear, history] = await Promise.all([
    sumPayments(monthStart, now),
    sumPayments(startOfLocalMonth(now, -1), monthStart),
    sumPayments(fromZoned(p.year - 1, p.month, 1, 0), fromZoned(p.year - 1, p.month + 1, 1, 0)),
    sumPayments(yearStart, now),
    sumPayments(startOfLocalYear(now, -1), yearStart),
    monthlyHistory(now),
  ]);
  const monthPct = (now.getTime() - monthStart.getTime()) / (nextMonth.getTime() - monthStart.getTime());
  const yearPct = (now.getTime() - yearStart.getTime()) / (nextYear.getTime() - yearStart.getTime());
  const fullMonths = history.slice(0, -1).filter((m) => m.revenue > 0);
  const monthlyAvg = fullMonths.length ? Math.round(fullMonths.reduce((s, m) => s + m.revenue, 0) / fullMonths.length) : 0;
  const monthProjection = monthPct > 0 ? Math.round(monthSoFar / monthPct) : 0;
  const yearProjection = yearPct > 0 ? Math.round(yearSoFar / yearPct) : 0;
  const change = (projection: number, base: number) => (base > 0 ? ((projection - base) / base) * 100 : null);

  return {
    month: {
      pct: monthPct * 100,
      soFar: monthSoFar,
      projection: monthProjection,
      label: `${String(p.month).padStart(2, "0")}/${p.year - 1}`,
      compare: [
        { label: "Mês anterior", base: prevMonth, change: change(monthProjection, prevMonth) },
        { label: `Mês ${String(p.month).padStart(2, "0")}/${p.year - 1}`, base: sameMonthLastYear, change: change(monthProjection, sameMonthLastYear) },
        { label: "Média mensal", base: monthlyAvg, change: change(monthProjection, monthlyAvg) },
      ],
    },
    year: {
      pct: yearPct * 100,
      soFar: yearSoFar,
      projection: yearProjection,
      compare: [{ label: "Ano anterior", base: prevYear, change: change(yearProjection, prevYear) }],
    },
  };
}
