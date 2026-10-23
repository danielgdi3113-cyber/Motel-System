import { requireUser, STAFF } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTolerance } from "@/lib/settings";
import { startOfLocalDay } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { AutoRefresh } from "@/components/auto-refresh";
import { PageHeader, Stat } from "@/components/ui";
import { SuiteGrid, type SuiteCard } from "./suite-grid";
import { BedDouble, CircleDollarSign, Clock, ConciergeBell, Sparkles } from "lucide-react";

export const metadata = { title: "Mapa de suítes" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const user = await requireUser(STAFF);
  const params = await searchParams;
  const now = new Date();
  const today = startOfLocalDay(now);

  const [suites, tolerance, todayRevenue, todayStays, upcoming, openOrders] = await Promise.all([
    db.suite.findMany({
      where: { active: true },
      orderBy: [{ category: { sortOrder: "asc" } }, { number: "asc" }],
      include: {
        category: true,
        stays: { where: { status: "ABERTA" }, include: { consumptions: true }, take: 1 },
        cleaningTasks: { where: { status: { not: "CONCLUIDA" } }, include: { assignedTo: true }, take: 1 },
      },
    }),
    getTolerance(),
    db.payment.aggregate({ where: { createdAt: { gte: today } }, _sum: { amount: true } }),
    db.stay.count({ where: { checkIn: { gte: today }, status: { not: "CANCELADA" } } }),
    db.reservation.findMany({
      where: {
        status: { in: ["PENDENTE", "CONFIRMADA"] },
        scheduledAt: { gte: new Date(now.getTime() - 3_600_000), lte: new Date(now.getTime() + 3 * 3_600_000) },
      },
      orderBy: { scheduledAt: "asc" },
    }),
    db.roomServiceOrder.count({ where: { status: { in: ["PENDENTE", "PREPARANDO"] } } }),
  ]);

  const cards: SuiteCard[] = suites.map((s) => {
    const stay = s.stays[0];
    const task = s.cleaningTasks[0];
    return {
      id: s.id,
      number: s.number,
      status: s.status,
      notes: s.notes,
      categoryId: s.categoryId,
      category: s.category.name,
      periodHours: s.category.periodHours,
      periodPrice: s.category.periodPrice,
      overnightPrice: s.category.overnightPrice,
      stay: stay && {
        id: stay.id,
        mode: stay.mode,
        plate: stay.plate,
        checkIn: stay.checkIn.toISOString(),
        periodHours: stay.periodHours,
        periodPrice: stay.periodPrice,
        extraHourPrice: stay.extraHourPrice,
        overnightPrice: stay.overnightPrice,
        overnightEndHour: stay.overnightEndHour,
        consumption: stay.consumptions.reduce((sum, c) => sum + c.quantity * c.unitPrice, 0),
      },
      cleaning: task && { status: task.status, by: task.assignedTo?.name ?? null, since: (task.startedAt ?? task.createdAt).toISOString() },
    };
  });

  const count = (st: string) => suites.filter((s) => s.status === st).length;
  const occupied = count("OCUPADA");

  return (
    <>
      <AutoRefresh seconds={15} />
      <PageHeader title="Mapa de suítes" subtitle="Atualiza automaticamente a cada 15 segundos." />
      {params.checkout === "ok" && (
        <p className="mb-4 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          Check-out concluído. A suíte foi enviada para a fila de limpeza.
        </p>
      )}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Ocupação"
          value={`${suites.length ? Math.round((occupied / suites.length) * 100) : 0}%`}
          hint={`${occupied} de ${suites.length} suítes`}
          icon={<BedDouble className="size-4" />}
        />
        <Stat label="Livres" value={count("LIVRE")} hint={`${count("RESERVADA")} reservadas`} icon={<Clock className="size-4" />} />
        <Stat label="Em limpeza" value={count("LIMPEZA")} hint={`${count("MANUTENCAO")} em manutenção`} icon={<Sparkles className="size-4" />} />
        {user.role === "ADMIN" ? (
          <Stat
            label="Faturamento hoje"
            value={formatMoney(todayRevenue._sum.amount ?? 0)}
            hint={`${todayStays} locações`}
            icon={<CircleDollarSign className="size-4" />}
          />
        ) : (
          <Stat label="Pedidos na cozinha" value={openOrders} hint="novos ou em preparo" icon={<ConciergeBell className="size-4" />} />
        )}
      </div>
      <SuiteGrid
        suites={cards}
        tolerance={tolerance}
        serverNow={now.getTime()}
        upcoming={upcoming.map((r) => ({
          id: r.id,
          code: r.code,
          name: r.customerName,
          categoryId: r.categoryId,
          mode: r.mode,
          at: r.scheduledAt.toISOString(),
        }))}
      />
    </>
  );
}
