import type { StayStatus } from "@prisma/client";
import { db } from "../db";
import { cleaningStatusLabel, modeLabel, orderStatusLabel, suiteStatusLabel } from "../labels";
import { getTolerance } from "../settings";
import { stayTotals } from "../stays";
import { addDays, formatDate, formatDateTime, fromZoned } from "../time";

/** "AAAA-MM-DD" (data local) → meia-noite local. */
export function parseLocalDate(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Data inválida: ${iso} (use AAAA-MM-DD)`);
  return fromZoned(Number(m[1]), Number(m[2]), Number(m[3]), 0);
}

/** Intervalo [início, fim] em datas locais, com o fim incluído. */
export function localRange(inicio: string, fim: string) {
  const start = parseLocalDate(inicio);
  const end = addDays(parseLocalDate(fim), 1);
  if (end <= start) throw new Error("A data final deve ser igual ou posterior à inicial.");
  if (end.getTime() - start.getTime() > 400 * 86_400_000) throw new Error("Período máximo: 400 dias.");
  return { start, end };
}

/** Fotografia do motel neste momento. */
export async function currentSituation() {
  const [suites, openStays, cash, orders, cleaning, waitlist, tickets, reservations] = await Promise.all([
    db.suite.findMany({ where: { active: true }, include: { category: true }, orderBy: { number: "asc" } }),
    db.stay.findMany({ where: { status: "ABERTA" }, include: { suite: true, consumptions: true } }),
    db.cashSession.findFirst({ where: { status: "ABERTO" }, include: { openedBy: { select: { name: true } } } }),
    db.roomServiceOrder.findMany({
      where: { status: { in: ["PENDENTE", "PREPARANDO"] } },
      include: { stay: { include: { suite: true } }, items: { include: { product: true } } },
    }),
    db.cleaningTask.findMany({ where: { status: { not: "CONCLUIDA" } }, include: { suite: true, assignedTo: { select: { name: true } } } }),
    db.waitlistEntry.findMany({ where: { status: "AGUARDANDO" } }),
    db.maintenanceTicket.findMany({ where: { status: { in: ["ABERTA", "EM_ANDAMENTO"] } }, include: { suite: true } }),
    db.reservation.findMany({
      where: { status: { in: ["PENDENTE", "CONFIRMADA"] }, scheduledAt: { gte: new Date(), lt: addDays(new Date(), 2) } },
      include: { category: true },
      orderBy: { scheduledAt: "asc" },
    }),
  ]);
  const tolerance = await getTolerance();
  const now = new Date();
  return {
    agora: formatDateTime(now),
    suites: suites.map((s) => ({ suite: s.number, categoria: s.category.name, status: suiteStatusLabel[s.status], observacao: s.notes || null })),
    resumo: Object.fromEntries(
      Object.entries(suiteStatusLabel).map(([k, v]) => [v, suites.filter((s) => s.status === k).length]),
    ),
    ocupadas: openStays.map((s) => {
      const consumption = s.consumptions.reduce((sum, c) => sum + c.quantity * c.unitPrice, 0);
      const t = stayTotals(s, consumption, tolerance, now);
      return {
        suite: s.suite.number,
        modalidade: modeLabel[s.mode],
        entrada: formatDateTime(s.checkIn),
        minutos: Math.round((now.getTime() - s.checkIn.getTime()) / 60_000),
        placa: s.plate || null,
        valorParcialCentavos: t.subtotal,
        horasExtras: t.room.extraHours,
      };
    }),
    caixa: cash ? { aberto: true, desde: formatDateTime(cash.openedAt), por: cash.openedBy.name } : { aberto: false },
    pedidosCozinha: orders.map((o) => ({
      pedido: o.number,
      suite: o.stay.suite.number,
      status: orderStatusLabel[o.status],
      itens: o.items.map((i) => `${i.quantity}x ${i.product.name}`).join(", "),
      desde: formatDateTime(o.createdAt),
    })),
    filaLimpeza: cleaning.map((c) => ({ suite: c.suite.number, status: cleaningStatusLabel[c.status], camareira: c.assignedTo?.name ?? null })),
    listaEspera: waitlist.length,
    manutencoesAbertas: tickets.map((t) => ({ problema: t.title, prioridade: t.priority, suite: t.suite?.number ?? null })),
    reservasProximas48h: reservations.map((r) => ({
      codigo: r.code,
      cliente: r.customerName,
      quando: formatDateTime(r.scheduledAt),
      categoria: r.category.name,
      modalidade: modeLabel[r.mode],
      status: r.status,
    })),
  };
}

export async function searchStays(f: { inicio?: string; fim?: string; placa?: string; suite?: string; status?: StayStatus; limite?: number }) {
  const range = f.inicio && f.fim ? localRange(f.inicio, f.fim) : null;
  const plate = f.placa?.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const stays = await db.stay.findMany({
    where: {
      ...(range && { checkIn: { gte: range.start, lt: range.end } }),
      ...(plate && { plate: { contains: plate } }),
      ...(f.suite && { suite: { number: f.suite } }),
      ...(f.status && { status: f.status }),
    },
    include: {
      suite: true,
      consumptions: { include: { product: { select: { name: true } } } },
      payments: true,
      openedBy: { select: { name: true } },
      closedBy: { select: { name: true } },
    },
    orderBy: { checkIn: "desc" },
    take: Math.min(f.limite ?? 30, 100),
  });
  return stays.map((s) => ({
    suite: s.suite.number,
    status: s.status,
    modalidade: modeLabel[s.mode],
    entrada: formatDateTime(s.checkIn),
    saida: s.checkOut ? formatDateTime(s.checkOut) : null,
    placa: s.plate || null,
    totalCentavos: s.total,
    descontoCentavos: s.discount,
    consumo: s.consumptions.map((c) => `${c.quantity}x ${c.product.name}`),
    pagamentos: s.payments.map((p) => `${p.method}: ${p.amount}`),
    entradaPor: s.openedBy.name,
    saidaPor: s.closedBy?.name ?? null,
    observacoes: s.notes || null,
  }));
}

export async function stockStatus(onlyLow: boolean) {
  const products = await db.product.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] });
  return products
    .filter((p) => !onlyLow || p.stock <= p.minStock)
    .map((p) => ({
      produto: p.name,
      categoria: p.category,
      estoque: p.stock,
      minimo: p.minStock,
      abaixoDoMinimo: p.stock <= p.minStock,
      precoCentavos: p.price,
      custoCentavos: p.cost,
    }));
}

export async function pendingList(status: "ABERTA" | "QUITADA" | "TODAS") {
  const list = await db.pending.findMany({
    where: status === "TODAS" ? {} : { status },
    include: { person: { select: { name: true, phone: true } }, company: { select: { name: true } }, payments: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return list.map((p) => ({
    devedor: p.person?.name ?? p.company?.name ?? "—",
    telefone: p.person?.phone || null,
    descricao: p.description,
    valorCentavos: p.amount,
    pagoCentavos: p.paid,
    restanteCentavos: p.amount - p.paid,
    status: p.status,
    criadaEm: formatDate(p.createdAt),
    vencimento: p.dueDate ? formatDate(p.dueDate) : null,
    vencida: p.status === "ABERTA" && !!p.dueDate && p.dueDate < new Date(),
  }));
}

export async function searchClients(term: string) {
  const t = term.trim();
  const plate = t.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const [people, companies, vehicles] = await Promise.all([
    db.person.findMany({
      where: { OR: [{ name: { contains: t, mode: "insensitive" } }, { phone: { contains: t } }, { document: { contains: t } }] },
      include: { vehicles: true, pendings: { where: { status: "ABERTA" } } },
      take: 20,
    }),
    db.company.findMany({ where: { OR: [{ name: { contains: t, mode: "insensitive" } }, { document: { contains: t } }] }, take: 20 }),
    plate.length >= 3 ? db.vehicle.findMany({ where: { plate: { contains: plate } }, include: { person: true }, take: 20 }) : [],
  ]);
  const plates = [...vehicles.map((v) => v.plate), ...people.flatMap((p) => p.vehicles.map((v) => v.plate))];
  const visits = plates.length
    ? await db.stay.groupBy({ by: ["plate"], where: { plate: { in: plates }, status: "FECHADA" }, _count: true, _sum: { total: true }, _max: { checkIn: true } })
    : [];
  const visit = (plate: string) => {
    const v = visits.find((x) => x.plate === plate);
    return v ? { visitas: v._count, gastoTotalCentavos: v._sum.total ?? 0, ultimaVisita: v._max.checkIn ? formatDateTime(v._max.checkIn) : null } : { visitas: 0 };
  };
  return {
    pessoas: people.map((p) => ({
      nome: p.name,
      telefone: p.phone || null,
      bloqueado: p.blocked,
      observacoes: p.notes || null,
      veiculos: p.vehicles.map((v) => ({ placa: v.plate, ...visit(v.plate) })),
      pendenteCentavos: p.pendings.reduce((s, x) => s + x.amount - x.paid, 0),
    })),
    empresas: companies.map((c) => ({ nome: c.name, cnpj: c.document || null, fornecedor: c.isSupplier, cliente: c.isCustomer })),
    veiculos: vehicles.map((v) => ({
      placa: v.plate,
      modelo: [v.model, v.color].filter(Boolean).join(" ") || null,
      bloqueado: v.blocked,
      motivo: v.notes || null,
      dono: v.person?.name ?? null,
      ...visit(v.plate),
    })),
  };
}

export async function auditLog(f: { inicio: string; fim: string; usuario?: string; termo?: string; limite?: number }) {
  const { start, end } = localRange(f.inicio, f.fim);
  const logs = await db.auditLog.findMany({
    where: {
      createdAt: { gte: start, lt: end },
      ...(f.usuario && { user: { name: { contains: f.usuario, mode: "insensitive" } } }),
      ...(f.termo && { action: { contains: f.termo, mode: "insensitive" } }),
    },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: Math.min(f.limite ?? 50, 200),
  });
  return logs.map((l) => ({ quando: formatDateTime(l.createdAt), usuario: l.user?.name ?? "Sistema", acao: l.action, atencao: l.important }));
}
