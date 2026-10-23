import { Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { startOfLocalDay, formatTime } from "@/lib/time";
import { AutoRefresh } from "@/components/auto-refresh";
import { Empty, PageHeader, Stat } from "@/components/ui";
import { CleaningCard } from "./cleaning-card";

export const metadata = { title: "Limpeza" };

export default async function CleaningPage() {
  const user = await requireUser();
  const today = startOfLocalDay(new Date());
  const [tasks, doneToday] = await Promise.all([
    db.cleaningTask.findMany({
      where: { status: { not: "CONCLUIDA" } },
      include: { suite: { include: { category: true } }, assignedTo: true },
      orderBy: { createdAt: "asc" },
    }),
    db.cleaningTask.findMany({
      where: { status: "CONCLUIDA", finishedAt: { gte: today } },
      include: { suite: true, assignedTo: true },
      orderBy: { finishedAt: "desc" },
    }),
  ]);

  const durations = doneToday
    .filter((t) => t.startedAt && t.finishedAt)
    .map((t) => t.finishedAt!.getTime() - t.startedAt!.getTime());
  const avg = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 60000) : 0;
  const mine = doneToday.filter((t) => t.assignedToId === user.id).length;

  return (
    <div className="mx-auto max-w-4xl">
      <AutoRefresh seconds={10} />
      <PageHeader title="Fila de limpeza" subtitle="Suítes liberadas no check-out aparecem aqui automaticamente." />
      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Na fila" value={tasks.length} />
        <Stat label="Limpas hoje" value={doneToday.length} hint={user.role === "CAMAREIRA" ? `${mine} por você` : undefined} />
        <Stat label="Tempo médio" value={`${avg} min`} />
      </div>
      {tasks.length === 0 ? (
        <Empty>
          <Sparkles className="mx-auto mb-2 size-6 text-emerald-400" />
          Tudo limpo! Nenhuma suíte aguardando.
        </Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {tasks.map((t) => (
            <CleaningCard
              key={t.id}
              task={{
                id: t.id,
                status: t.status,
                suite: t.suite.number,
                category: t.suite.category.name,
                createdAt: t.createdAt.toISOString(),
                startedAt: t.startedAt?.toISOString() ?? null,
                assignedTo: t.assignedTo?.name ?? null,
                mine: t.assignedToId === user.id,
              }}
            />
          ))}
        </div>
      )}
      {doneToday.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">Últimas concluídas hoje</h2>
          <div className="divide-y divide-line rounded-2xl border border-line bg-surface text-sm">
            {doneToday.slice(0, 10).map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3">
                <span className="font-medium">Suíte {t.suite.number}</span>
                <span className="text-muted">
                  {t.assignedTo?.name ?? "—"} · {formatTime(t.finishedAt!)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
