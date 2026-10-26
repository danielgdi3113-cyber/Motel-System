import { db } from "../db";
import { cashMovementLabel, modeLabel, paymentLabel, priorityLabel, reservationStatusLabel, sourceLabel } from "../labels";
import { formatMoney } from "../money";
import { formatDate, formatDateTime, localParts } from "../time";

const DAY = 86_400_000;
const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const sum = <T,>(list: T[], f: (x: T) => number) => list.reduce((s, x) => s + f(x), 0);
const pct = (part: number, total: number) => (total ? Math.round((part / total) * 1000) / 10 : 0);
const avg = (total: number, n: number) => (n ? Math.round(total / n) : 0);
const change = (now: number, before: number) => (before ? Math.round(((now - before) / before) * 1000) / 10 : null);
const minutes = (ms: number) => Math.round(ms / 60_000);

/**
 * Relatório gerencial completo de um período, calculado direto do banco.
 * Valores em centavos; o assistente apenas apresenta e analisa estes números.
 */
export async function buildPeriodReport(start: Date, end: Date) {
  const range = { gte: start, lt: end };
  const prevStart = new Date(start.getTime() - (end.getTime() - start.getTime()));

  const [
    payments,
    closedStays,
    canceledStays,
    checkIns,
    suitesActive,
    consumptions,
    sales,
    movements,
    cashSessions,
    pendingsCreated,
    pendingsOpen,
    reservationsCreated,
    reservationsScheduled,
    cleanings,
    ticketsOpened,
    ticketsClosed,
    ticketsOpenNow,
    lowStock,
    stockEntries,
    prevPayments,
    prevStays,
  ] = await Promise.all([
    db.payment.findMany({ where: { createdAt: range }, select: { amount: true, method: true, stayId: true, saleId: true, pendingId: true } }),
    db.stay.findMany({
      where: { status: "FECHADA", checkOut: range },
      include: { suite: { include: { category: true } }, closedBy: { select: { name: true } } },
    }),
    db.stay.findMany({
      where: { status: "CANCELADA", checkOut: range },
      include: { suite: true, closedBy: { select: { name: true } } },
    }),
    db.stay.count({ where: { checkIn: range, status: { not: "CANCELADA" } } }),
    db.suite.count({ where: { active: true } }),
    db.consumption.findMany({
      where: { stay: { status: "FECHADA", checkOut: range } },
      select: { quantity: true, unitPrice: true, product: { select: { name: true, cost: true, category: true } } },
    }),
    db.sale.findMany({
      where: { createdAt: range },
      include: { items: { include: { product: { select: { name: true, cost: true, category: true } } } }, createdBy: { select: { name: true } } },
    }),
    db.cashMovement.findMany({
      where: { createdAt: range },
      include: { company: { select: { name: true } }, employee: { select: { name: true } }, user: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.cashSession.findMany({
      where: { openedAt: { lt: end }, OR: [{ closedAt: null }, { closedAt: { gte: start } }] },
      include: { openedBy: { select: { name: true } }, closedBy: { select: { name: true } } },
      orderBy: { openedAt: "asc" },
    }),
    db.pending.findMany({ where: { createdAt: range }, include: { person: { select: { name: true } }, company: { select: { name: true } } } }),
    db.pending.findMany({ where: { status: "ABERTA" }, include: { person: { select: { name: true } }, company: { select: { name: true } } } }),
    db.reservation.findMany({ where: { createdAt: range }, select: { status: true, source: true } }),
    db.reservation.findMany({ where: { scheduledAt: range }, select: { status: true } }),
    db.cleaningTask.findMany({
      where: { status: "CONCLUIDA", finishedAt: range },
      select: { startedAt: true, finishedAt: true, assignedTo: { select: { name: true } } },
    }),
    db.maintenanceTicket.findMany({ where: { createdAt: range }, select: { title: true, priority: true, status: true } }),
    db.maintenanceTicket.findMany({ where: { resolvedAt: range, status: "CONCLUIDA" }, select: { title: true, cost: true } }),
    db.maintenanceTicket.findMany({
      where: { status: { in: ["ABERTA", "EM_ANDAMENTO"] } },
      select: { title: true, priority: true, suite: { select: { number: true } } },
    }),
    db.product.findMany({ where: { active: true }, select: { name: true, stock: true, minStock: true } }),
    db.stockMovement.findMany({ where: { type: "ENTRADA", createdAt: range }, select: { quantity: true, product: { select: { name: true } } } }),
    db.payment.aggregate({ where: { createdAt: { gte: prevStart, lt: start } }, _sum: { amount: true } }),
    db.stay.findMany({ where: { status: "FECHADA", checkOut: { gte: prevStart, lt: start } }, select: { total: true } }),
  ]);

  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY));

  // --- Faturamento (dinheiro que entrou) ---
  const revenue = sum(payments, (p) => p.amount);
  const byMethod = Object.fromEntries(
    (["PIX", "CREDITO", "DEBITO", "DINHEIRO"] as const).map((m) => [m, sum(payments.filter((p) => p.method === m), (p) => p.amount)]),
  ) as Record<"PIX" | "CREDITO" | "DEBITO" | "DINHEIRO", number>;
  const bySource = {
    locacoes: sum(payments.filter((p) => p.stayId), (p) => p.amount),
    vendasAvulsas: sum(payments.filter((p) => p.saleId), (p) => p.amount),
    pendenciasRecebidas: sum(payments.filter((p) => p.pendingId), (p) => p.amount),
    outros: sum(payments.filter((p) => !p.stayId && !p.saleId && !p.pendingId), (p) => p.amount),
  };

  // --- Locações ---
  const stayTotal = sum(closedStays, (s) => s.total);
  const roomRevenue = sum(closedStays, (s) => s.roomAmount);
  const consumptionRevenue = sum(closedStays, (s) => s.consumptionAmount);
  const discounts = sum(closedStays, (s) => s.discount);
  const extraHours = closedStays.map((s) => Math.max(0, s.roomAmount - (s.mode === "PERNOITE" ? s.overnightPrice : s.periodPrice)));
  const occupiedMs = sum(closedStays, (s) => s.checkOut!.getTime() - s.checkIn.getTime());
  const byCategory = new Map<string, { count: number; revenue: number; minutes: number }>();
  for (const s of closedStays) {
    const k = s.suite.category.name;
    const c = byCategory.get(k) ?? { count: 0, revenue: 0, minutes: 0 };
    byCategory.set(k, { count: c.count + 1, revenue: c.revenue + s.total, minutes: c.minutes + minutes(s.checkOut!.getTime() - s.checkIn.getTime()) });
  }
  const bySuite = new Map<string, { count: number; revenue: number }>();
  for (const s of closedStays) {
    const c = bySuite.get(s.suite.number) ?? { count: 0, revenue: 0 };
    bySuite.set(s.suite.number, { count: c.count + 1, revenue: c.revenue + s.total });
  }

  // Por dia, dia da semana e hora (fuso local)
  const daily = new Map<string, { checkouts: number; revenue: number }>();
  for (let t = start.getTime(); t < end.getTime(); t += DAY) daily.set(formatDate(new Date(t + 12 * 3_600_000)), { checkouts: 0, revenue: 0 });
  const weekday = WEEKDAYS.map(() => ({ checkouts: 0, revenue: 0 }));
  const hours = Array.from({ length: 24 }, () => 0);
  for (const s of closedStays) {
    const d = formatDate(s.checkOut!);
    const c = daily.get(d) ?? { checkouts: 0, revenue: 0 };
    daily.set(d, { checkouts: c.checkouts + 1, revenue: c.revenue + s.total });
    const wd = new Date(Date.UTC(localParts(s.checkOut!).year, localParts(s.checkOut!).month - 1, localParts(s.checkOut!).day)).getUTCDay();
    weekday[wd].checkouts++;
    weekday[wd].revenue += s.total;
    hours[localParts(s.checkIn).hour]++;
  }
  const peakHour = hours.indexOf(Math.max(...hours));

  // --- Produtos (consumo nas suítes + vendas avulsas) ---
  const productMap = new Map<string, { category: string; quantity: number; revenue: number; cost: number }>();
  const addProduct = (name: string, category: string, qty: number, price: number, cost: number) => {
    const c = productMap.get(name) ?? { category, quantity: 0, revenue: 0, cost: 0 };
    productMap.set(name, { category, quantity: c.quantity + qty, revenue: c.revenue + qty * price, cost: c.cost + qty * cost });
  };
  for (const c of consumptions) addProduct(c.product.name, c.product.category, c.quantity, c.unitPrice, c.product.cost);
  for (const s of sales) for (const i of s.items) addProduct(i.product.name, i.product.category, i.quantity, i.unitPrice, i.product.cost);
  const products = [...productMap.entries()]
    .map(([name, v]) => ({ name, ...v, profit: v.revenue - v.cost }))
    .sort((a, b) => b.revenue - a.revenue);
  const cogs = sum(products, (p) => p.cost);

  // --- Despesas e caixa ---
  const expenses = movements.filter((m) => m.type === "PAGAMENTO_FORNECEDOR" || m.type === "ADIANTAMENTO_SALARIAL");
  const totalExpenses = sum(expenses, (m) => m.amount);
  const sangrias = sum(movements.filter((m) => m.type === "SANGRIA"), (m) => m.amount);
  const suprimentos = sum(movements.filter((m) => m.type === "SUPRIMENTO"), (m) => m.amount);
  const sessions = cashSessions.map((c) => ({
    abertura: formatDateTime(c.openedAt),
    fechamento: c.closedAt ? formatDateTime(c.closedAt) : "em aberto",
    abertoPor: c.openedBy.name,
    fechadoPor: c.closedBy?.name ?? null,
    esperado: c.expectedAmount,
    contado: c.declaredAmount,
    diferenca: c.expectedAmount !== null && c.declaredAmount !== null ? c.declaredAmount - c.expectedAmount : null,
    observacoes: c.notes || null,
  }));

  // --- Equipe ---
  const staff = new Map<string, { checkouts: number; revenue: number; sales: number; cleanings: number }>();
  const staffRow = (name: string) => {
    const r = staff.get(name) ?? { checkouts: 0, revenue: 0, sales: 0, cleanings: 0 };
    staff.set(name, r);
    return r;
  };
  for (const s of closedStays) if (s.closedBy) {
    const r = staffRow(s.closedBy.name);
    r.checkouts++;
    r.revenue += s.total;
  }
  for (const s of sales) staffRow(s.createdBy.name).sales++;
  for (const c of cleanings) if (c.assignedTo) staffRow(c.assignedTo.name).cleanings++;

  const cleaningMinutes = cleanings.filter((c) => c.startedAt && c.finishedAt).map((c) => minutes(c.finishedAt!.getTime() - c.startedAt!.getTime()));
  const prevRevenue = prevPayments._sum.amount ?? 0;
  const prevTicket = avg(sum(prevStays, (s) => s.total), prevStays.length);
  const ticket = avg(stayTotal, closedStays.length);
  const debtor = (p: { person: { name: string } | null; company: { name: string } | null }) => p.person?.name ?? p.company?.name ?? "—";

  return {
    periodo: { inicio: formatDate(start), fim: formatDate(new Date(end.getTime() - 1)), dias: days },
    faturamento: {
      total: revenue,
      porForma: byMethod,
      porOrigem: bySource,
      mediaDiaria: avg(revenue, days),
      comparacaoPeriodoAnterior: { faturamentoAnterior: prevRevenue, variacaoPercentual: change(revenue, prevRevenue) },
    },
    resultado: {
      receita: revenue,
      despesas: totalExpenses,
      custoMercadorias: cogs,
      lucroEstimado: revenue - totalExpenses - cogs,
      margemPercentual: pct(revenue - totalExpenses - cogs, revenue),
    },
    locacoes: {
      checkIns,
      encerradas: closedStays.length,
      canceladas: canceledStays.length,
      valorTotal: stayTotal,
      receitaSuites: roomRevenue,
      receitaConsumo: consumptionRevenue,
      receitaHorasExtras: sum(extraHours, (x) => x),
      locacoesComHoraExtra: extraHours.filter((x) => x > 0).length,
      descontos: discounts,
      ticketMedio: ticket,
      ticketMedioAnterior: prevTicket,
      locacoesPeriodoAnterior: prevStays.length,
      tempoMedioMinutos: avg(minutes(occupiedMs), closedStays.length),
      taxaOcupacaoPercentual: suitesActive ? pct(occupiedMs, suitesActive * days * DAY) : 0,
      receitaPorSuitePorDia: suitesActive ? avg(revenue, suitesActive * days) : 0,
      porModalidade: (["PERIODO", "PERNOITE"] as const).map((m) => ({
        modalidade: modeLabel[m],
        quantidade: closedStays.filter((s) => s.mode === m).length,
        valor: sum(closedStays.filter((s) => s.mode === m), (s) => s.total),
      })),
      porCategoria: [...byCategory.entries()].map(([categoria, v]) => ({
        categoria,
        quantidade: v.count,
        valor: v.revenue,
        ticketMedio: avg(v.revenue, v.count),
        tempoMedioMinutos: avg(v.minutes, v.count),
      })),
      porSuite: [...bySuite.entries()]
        .map(([suite, v]) => ({ suite, quantidade: v.count, valor: v.revenue }))
        .sort((a, b) => b.valor - a.valor),
      porDia: [...daily.entries()].map(([dia, v]) => ({ dia, locacoes: v.checkouts, valor: v.revenue })),
      porDiaDaSemana: weekday.map((v, i) => ({ dia: WEEKDAYS[i], locacoes: v.checkouts, valor: v.revenue })),
      entradasPorHora: hours.map((n, h) => ({ hora: `${String(h).padStart(2, "0")}h`, entradas: n })),
      horarioDePico: closedStays.length ? `${String(peakHour).padStart(2, "0")}h` : null,
      cancelamentos: canceledStays.map((s) => ({
        suite: s.suite.number,
        data: formatDateTime(s.checkOut!),
        por: s.closedBy?.name ?? "—",
        motivo: s.notes.split("[Cancelada]").at(-1)?.trim() || "—",
      })),
    },
    produtos: {
      receita: sum(products, (p) => p.revenue),
      custo: cogs,
      lucroBruto: sum(products, (p) => p.profit),
      itensVendidos: sum(products, (p) => p.quantity),
      lista: products.map((p) => ({ produto: p.name, categoria: p.category, quantidade: p.quantity, receita: p.revenue, custo: p.cost, lucro: p.profit })),
    },
    vendasAvulsas: { quantidade: sales.length, valor: sum(sales, (s) => s.total), ticketMedio: avg(sum(sales, (s) => s.total), sales.length) },
    despesas: {
      total: totalExpenses,
      lista: expenses.map((m) => ({
        data: formatDateTime(m.createdAt),
        tipo: cashMovementLabel[m.type],
        favorecido: m.company?.name ?? m.employee?.name ?? "—",
        descricao: m.description || null,
        documento: m.document || null,
        forma: paymentLabel[m.method],
        valor: m.amount,
      })),
    },
    caixa: {
      sangrias,
      suprimentos,
      turnos: sessions,
      somaDiferencas: sum(sessions, (s) => s.diferenca ?? 0),
      turnosComDiferenca: sessions.filter((s) => s.diferenca).length,
    },
    pendencias: {
      criadasNoPeriodo: { quantidade: pendingsCreated.length, valor: sum(pendingsCreated, (p) => p.amount) },
      recebidasNoPeriodo: bySource.pendenciasRecebidas,
      emAbertoHoje: {
        quantidade: pendingsOpen.length,
        valor: sum(pendingsOpen, (p) => p.amount - p.paid),
        vencidas: pendingsOpen.filter((p) => p.dueDate && p.dueDate < new Date()).length,
        lista: pendingsOpen.map((p) => ({
          devedor: debtor(p),
          descricao: p.description,
          restante: p.amount - p.paid,
          vencimento: p.dueDate ? formatDate(p.dueDate) : null,
        })),
      },
    },
    reservas: {
      criadas: reservationsCreated.length,
      porOrigem: Object.entries(sourceLabel).map(([k, v]) => ({ origem: v, quantidade: reservationsCreated.filter((r) => r.source === k).length })),
      agendadasNoPeriodo: Object.entries(reservationStatusLabel).map(([k, v]) => ({
        status: v,
        quantidade: reservationsScheduled.filter((r) => r.status === k).length,
      })),
    },
    limpeza: {
      concluidas: cleanings.length,
      tempoMedioMinutos: avg(sum(cleaningMinutes, (x) => x), cleaningMinutes.length),
    },
    manutencao: {
      chamadosAbertos: ticketsOpened.length,
      chamadosConcluidos: ticketsClosed.length,
      custo: sum(ticketsClosed, (t) => t.cost),
      pendentesAgora: ticketsOpenNow.map((t) => ({ problema: t.title, prioridade: t.priority, suite: t.suite?.number ?? null })),
    },
    estoque: {
      unidadesRecebidas: sum(stockEntries, (e) => e.quantity),
      abaixoDoMinimo: lowStock.filter((p) => p.stock <= p.minStock && p.minStock > 0).map((p) => ({ produto: p.name, estoque: p.stock, minimo: p.minStock })),
    },
    equipe: [...staff.entries()].map(([nome, v]) => ({
      funcionario: nome,
      checkouts: v.checkouts,
      valorCheckouts: v.revenue,
      vendasAvulsas: v.sales,
      limpezas: v.cleanings,
    })),
  };
}

export type PeriodReport = Awaited<ReturnType<typeof buildPeriodReport>>;

// ---------- Markdown ----------

const m = formatMoney;
const table = (head: string[], rows: (string | number)[][], empty = "Sem registros no período.") =>
  rows.length === 0
    ? `_${empty}_\n`
    : `| ${head.join(" | ")} |\n| ${head.map(() => "---").join(" | ")} |\n${rows.map((r) => `| ${r.join(" | ")} |`).join("\n")}\n`;
const hm = (min: number) => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
const signed = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : ""}${v}%`);

/** Relatório completo em Markdown — gerado por código, sem depender da IA. */
export function reportToMarkdown(r: PeriodReport, motelName: string): string {
  const L = r.locacoes;
  const out: string[] = [];
  out.push(`# Relatório gerencial — ${motelName}`);
  out.push(`**Período:** ${r.periodo.inicio} a ${r.periodo.fim} (${r.periodo.dias} dia${r.periodo.dias > 1 ? "s" : ""})\n`);

  out.push(`## 1. Resumo`);
  out.push(
    table(
      ["Indicador", "Valor"],
      [
        ["Faturamento (recebido)", m(r.faturamento.total)],
        ["Variação vs. período anterior", `${signed(r.faturamento.comparacaoPeriodoAnterior.variacaoPercentual)} (antes: ${m(r.faturamento.comparacaoPeriodoAnterior.faturamentoAnterior)})`],
        ["Média diária", m(r.faturamento.mediaDiaria)],
        ["Despesas", m(r.resultado.despesas)],
        ["Custo das mercadorias vendidas", m(r.resultado.custoMercadorias)],
        ["**Lucro estimado**", `**${m(r.resultado.lucroEstimado)}** (margem ${r.resultado.margemPercentual}%)`],
        ["Locações encerradas", `${L.encerradas} (período anterior: ${L.locacoesPeriodoAnterior})`],
        ["Ticket médio", `${m(L.ticketMedio)} (antes: ${m(L.ticketMedioAnterior)})`],
        ["Tempo médio de permanência", hm(L.tempoMedioMinutos)],
        ["Taxa de ocupação", `${L.taxaOcupacaoPercentual}%`],
        ["Receita por suíte por dia (RevPAR)", m(L.receitaPorSuitePorDia)],
      ],
    ),
  );

  out.push(`## 2. Faturamento`);
  out.push(`### Por forma de pagamento`);
  out.push(table(["Forma", "Valor", "%"], Object.entries(r.faturamento.porForma).map(([k, v]) => [paymentLabel[k as keyof typeof paymentLabel], m(v), `${pct(v, r.faturamento.total)}%`])));
  out.push(`### Por origem`);
  out.push(
    table(
      ["Origem", "Valor"],
      [
        ["Locações", m(r.faturamento.porOrigem.locacoes)],
        ["Vendas avulsas", m(r.faturamento.porOrigem.vendasAvulsas)],
        ["Pendências recebidas", m(r.faturamento.porOrigem.pendenciasRecebidas)],
        ...(r.faturamento.porOrigem.outros ? [["Outros recebimentos", m(r.faturamento.porOrigem.outros)]] : []),
      ],
    ),
  );

  out.push(`## 3. Locações`);
  out.push(
    table(
      ["Item", "Valor"],
      [
        ["Check-ins no período", L.checkIns],
        ["Locações encerradas", L.encerradas],
        ["Locações canceladas", L.canceladas],
        ["Valor total das contas", m(L.valorTotal)],
        ["Receita de suítes", m(L.receitaSuites)],
        ["— dos quais horas extras", `${m(L.receitaHorasExtras)} (${L.locacoesComHoraExtra} locações)`],
        ["Receita de consumo", m(L.receitaConsumo)],
        ["Descontos concedidos", m(L.descontos)],
        ["Horário de pico (entradas)", L.horarioDePico ?? "—"],
      ],
    ),
  );
  out.push(`### Por modalidade`);
  out.push(table(["Modalidade", "Locações", "Valor"], L.porModalidade.map((x) => [x.modalidade, x.quantidade, m(x.valor)])));
  out.push(`### Por categoria de suíte`);
  out.push(table(["Categoria", "Locações", "Valor", "Ticket médio", "Tempo médio"], L.porCategoria.map((x) => [x.categoria, x.quantidade, m(x.valor), m(x.ticketMedio), hm(x.tempoMedioMinutos)])));
  out.push(`### Por suíte`);
  out.push(table(["Suíte", "Locações", "Valor"], L.porSuite.map((x) => [x.suite, x.quantidade, m(x.valor)])));
  out.push(`### Por dia`);
  out.push(table(["Dia", "Locações", "Valor"], L.porDia.map((x) => [x.dia, x.locacoes, m(x.valor)])));
  out.push(`### Por dia da semana`);
  out.push(table(["Dia", "Locações", "Valor"], L.porDiaDaSemana.map((x) => [x.dia, x.locacoes, m(x.valor)])));
  out.push(`### Entradas por horário`);
  out.push(table(["Hora", "Entradas"], L.entradasPorHora.filter((x) => x.entradas > 0).map((x) => [x.hora, x.entradas])));
  out.push(`### Cancelamentos`);
  out.push(table(["Suíte", "Data", "Cancelado por", "Motivo"], L.cancelamentos.map((x) => [x.suite, x.data, x.por, x.motivo])));

  out.push(`## 4. Produtos e consumo`);
  out.push(`Receita ${m(r.produtos.receita)} · custo ${m(r.produtos.custo)} · lucro bruto ${m(r.produtos.lucroBruto)} · ${r.produtos.itensVendidos} itens vendidos\n`);
  out.push(table(["Produto", "Categoria", "Qtd.", "Receita", "Custo", "Lucro"], r.produtos.lista.map((p) => [p.produto, p.categoria, p.quantidade, m(p.receita), m(p.custo), m(p.lucro)])));
  out.push(`### Vendas avulsas`);
  out.push(table(["Vendas", "Valor", "Ticket médio"], [[r.vendasAvulsas.quantidade, m(r.vendasAvulsas.valor), m(r.vendasAvulsas.ticketMedio)]]));

  out.push(`## 5. Despesas`);
  out.push(`Total: **${m(r.despesas.total)}**\n`);
  out.push(table(["Data", "Tipo", "Favorecido", "Descrição", "Documento", "Forma", "Valor"], r.despesas.lista.map((d) => [d.data, d.tipo, d.favorecido, d.descricao ?? "—", d.documento ?? "—", d.forma, m(d.valor)])));

  out.push(`## 6. Caixa`);
  out.push(`Sangrias ${m(r.caixa.sangrias)} · suprimentos ${m(r.caixa.suprimentos)} · ${r.caixa.turnosComDiferenca} turno(s) com diferença (soma ${m(r.caixa.somaDiferencas)})\n`);
  out.push(
    table(
      ["Abertura", "Fechamento", "Aberto por", "Fechado por", "Esperado", "Contado", "Diferença"],
      r.caixa.turnos.map((t) => [
        t.abertura,
        t.fechamento,
        t.abertoPor,
        t.fechadoPor ?? "—",
        t.esperado === null ? "—" : m(t.esperado),
        t.contado === null ? "—" : m(t.contado),
        t.diferenca === null ? "—" : m(t.diferenca),
      ]),
    ),
  );

  out.push(`## 7. Pendências (contas a receber)`);
  out.push(
    table(
      ["Item", "Valor"],
      [
        ["Criadas no período", `${r.pendencias.criadasNoPeriodo.quantidade} · ${m(r.pendencias.criadasNoPeriodo.valor)}`],
        ["Recebidas no período", m(r.pendencias.recebidasNoPeriodo)],
        ["Em aberto hoje", `${r.pendencias.emAbertoHoje.quantidade} · ${m(r.pendencias.emAbertoHoje.valor)} (${r.pendencias.emAbertoHoje.vencidas} vencida(s))`],
      ],
    ),
  );
  out.push(table(["Devedor", "Descrição", "Restante", "Vencimento"], r.pendencias.emAbertoHoje.lista.map((p) => [p.devedor, p.descricao, m(p.restante), p.vencimento ?? "—"]), "Nenhuma pendência em aberto."));

  out.push(`## 8. Reservas`);
  out.push(`Reservas criadas no período: **${r.reservas.criadas}**\n`);
  out.push(table(["Origem", "Quantidade"], r.reservas.porOrigem.map((x) => [x.origem, x.quantidade])));
  out.push(`### Reservas agendadas para o período`);
  out.push(table(["Status", "Quantidade"], r.reservas.agendadasNoPeriodo.map((x) => [x.status, x.quantidade])));

  out.push(`## 9. Limpeza e manutenção`);
  out.push(
    table(
      ["Item", "Valor"],
      [
        ["Limpezas concluídas", r.limpeza.concluidas],
        ["Tempo médio de limpeza", `${r.limpeza.tempoMedioMinutos} min`],
        ["Chamados de manutenção abertos", r.manutencao.chamadosAbertos],
        ["Chamados concluídos", r.manutencao.chamadosConcluidos],
        ["Custo de manutenção", m(r.manutencao.custo)],
      ],
    ),
  );
  out.push(`### Manutenções pendentes agora`);
  out.push(table(["Problema", "Prioridade", "Suíte"], r.manutencao.pendentesAgora.map((t) => [t.problema, priorityLabel[t.prioridade], t.suite ?? "—"]), "Nenhuma manutenção pendente."));

  out.push(`## 10. Estoque`);
  out.push(`Unidades recebidas no período: **${r.estoque.unidadesRecebidas}**\n`);
  out.push(`### Abaixo do mínimo agora`);
  out.push(table(["Produto", "Estoque", "Mínimo"], r.estoque.abaixoDoMinimo.map((p) => [p.produto, p.estoque, p.minimo]), "Nenhum produto abaixo do mínimo."));

  out.push(`## 11. Equipe`);
  out.push(table(["Funcionário", "Check-outs", "Valor dos check-outs", "Vendas avulsas", "Limpezas"], r.equipe.map((e) => [e.funcionario, e.checkouts, m(e.valorCheckouts), e.vendasAvulsas, e.limpezas])));

  out.push(`\n_Relatório gerado em ${formatDateTime(new Date())}. Faturamento = pagamentos recebidos no período; lucro estimado = faturamento − despesas − custo das mercadorias._`);
  return out.join("\n");
}
