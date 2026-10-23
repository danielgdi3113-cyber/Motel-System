import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { priorityLabel, priorityStyle, ticketStatusLabel } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { TicketForm, TicketUpdate } from "./ticket-forms";

export const metadata = { title: "Manutenções" };

export default async function MaintenancePage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const user = await requireUser();
  const history = (await searchParams).ver === "historico";
  const [tickets, suites, equipments] = await Promise.all([
    db.maintenanceTicket.findMany({
      where: { status: history ? { in: ["CONCLUIDA", "CANCELADA"] } : { in: ["ABERTA", "EM_ANDAMENTO"] } },
      include: { suite: true, equipment: true, createdBy: true },
      orderBy: history ? { resolvedAt: "desc" } : [{ createdAt: "asc" }],
      take: history ? 50 : undefined,
    }),
    db.suite.findMany({ where: { active: true }, orderBy: { number: "asc" }, select: { id: true, number: true } }),
    db.equipment.findMany({ where: { status: { not: "BAIXADO" } }, include: { suite: true }, orderBy: { name: "asc" } }),
  ]);
  const order = { ALTA: 0, MEDIA: 1, BAIXA: 2 };
  const sorted = history ? tickets : [...tickets].sort((a, b) => order[a.priority] - order[b.priority]);
  const canManage = user.role !== "CAMAREIRA";

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Manutenções"
        subtitle="Chamados de conserto. Problemas relatados na limpeza entram aqui automaticamente."
        actions={
          <TicketForm
            suites={suites}
            equipments={equipments.map((e) => ({ id: e.id, label: `${e.name}${e.suite ? ` (suíte ${e.suite.number})` : ""}` }))}
          />
        }
      />
      <div className="mb-4 flex gap-2 text-sm">
        <a href="/painel/manutencoes" className={`rounded-full px-3 py-1.5 ${!history ? "bg-surface-2 text-white" : "text-muted"}`}>
          Em aberto
        </a>
        <a href="?ver=historico" className={`rounded-full px-3 py-1.5 ${history ? "bg-surface-2 text-white" : "text-muted"}`}>
          Histórico
        </a>
      </div>
      {sorted.length === 0 ? (
        <Empty>{history ? "Nenhum chamado concluído." : "Nenhum chamado em aberto."}</Empty>
      ) : (
        <div className="space-y-3">
          {sorted.map((t) => (
            <Card key={t.id} className="flex flex-wrap items-start gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{t.title}</span>
                  <Badge className={priorityStyle[t.priority]}>{priorityLabel[t.priority]}</Badge>
                  <Badge className="bg-surface-2 text-zinc-300">{ticketStatusLabel[t.status]}</Badge>
                </div>
                <div className="mt-1 text-xs text-muted">
                  {t.suite && `Suíte ${t.suite.number} · `}
                  {t.equipment && `${t.equipment.name} · `}
                  aberto em {formatDateTime(t.createdAt)} por {t.createdBy.name}
                  {t.resolvedAt && ` · resolvido em ${formatDateTime(t.resolvedAt)}`}
                  {t.cost > 0 && canManage && ` · custo ${formatMoney(t.cost)}`}
                </div>
                {t.description && <p className="mt-2 text-sm text-zinc-300">{t.description}</p>}
                {t.resolution && <p className="mt-2 text-sm text-emerald-300">✔ {t.resolution}</p>}
              </div>
              {canManage && !history && (
                <TicketUpdate ticket={{ id: t.id, title: t.title, status: t.status, hasSuite: !!t.suiteId, resolution: t.resolution }} />
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
