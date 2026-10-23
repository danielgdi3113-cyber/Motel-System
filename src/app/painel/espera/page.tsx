import { Car, MessageCircle, Phone } from "lucide-react";
import { requireUser, STAFF } from "@/lib/auth";
import { db } from "@/lib/db";
import { modeLabel, waitlistStatusLabel } from "@/lib/labels";
import { formatTime, startOfLocalDay } from "@/lib/time";
import { AutoRefresh } from "@/components/auto-refresh";
import { ActionButton, Badge, Card, Empty, PageHeader } from "@/components/ui";
import { waitlistStatusAction } from "@/actions/operations";
import { WaitlistForm, WaitTimer } from "./waitlist-client";

export const metadata = { title: "Lista de espera" };

export default async function WaitlistPage() {
  await requireUser(STAFF);
  const [waiting, done, categories, free] = await Promise.all([
    db.waitlistEntry.findMany({ where: { status: "AGUARDANDO" }, orderBy: { createdAt: "asc" } }),
    db.waitlistEntry.findMany({
      where: { status: { not: "AGUARDANDO" }, resolvedAt: { gte: startOfLocalDay(new Date()) } },
      orderBy: { resolvedAt: "desc" },
      take: 10,
    }),
    db.suiteCategory.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.suite.groupBy({ by: ["categoryId"], where: { active: true, status: "LIVRE" }, _count: true }),
  ]);
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Qualquer suíte";
  const freeIn = (id: string | null) =>
    id ? (free.find((f) => f.categoryId === id)?._count ?? 0) : free.reduce((s, f) => s + f._count, 0);

  return (
    <div className="mx-auto max-w-4xl">
      <AutoRefresh seconds={15} />
      <PageHeader
        title="Lista de espera"
        subtitle="Clientes aguardando uma suíte vagar. Quem tem suíte livre na categoria aparece destacado."
        actions={<WaitlistForm categories={categories.map((c) => ({ id: c.id, name: c.name }))} />}
      />
      {waiting.length === 0 ? (
        <Empty>Ninguém aguardando.</Empty>
      ) : (
        <div className="space-y-3">
          {waiting.map((w, i) => {
            const available = freeIn(w.categoryId);
            return (
              <Card key={w.id} className={available > 0 ? "border-emerald-500/50" : ""}>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="grid size-10 place-items-center rounded-full bg-surface-2 font-bold">{i + 1}º</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{w.name}</div>
                    <div className="flex flex-wrap gap-x-3 text-xs text-muted">
                      <span>
                        {catName(w.categoryId)} · {modeLabel[w.mode]}
                      </span>
                      {w.plate && (
                        <span className="flex items-center gap-1">
                          <Car className="size-3" /> {w.plate}
                        </span>
                      )}
                      {w.phone && (
                        <a href={`https://wa.me/55${w.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-emerald-400">
                          <Phone className="size-3" /> {w.phone}
                        </a>
                      )}
                      {w.notes && <span>{w.notes}</span>}
                    </div>
                    {available > 0 && <div className="mt-1 text-xs font-medium text-emerald-300">{available} suíte(s) livre(s) agora!</div>}
                  </div>
                  <div className="text-right">
                    <WaitTimer since={w.createdAt.toISOString()} />
                    <div className="text-xs text-muted">desde {formatTime(w.createdAt)}</div>
                  </div>
                  <div className="flex gap-1">
                    <ActionButton
                      action={waitlistStatusAction}
                      fields={{ id: w.id, status: "ATENDIDO" }}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium hover:bg-emerald-500"
                    >
                      Atendido
                    </ActionButton>
                    <ActionButton
                      action={waitlistStatusAction}
                      fields={{ id: w.id, status: "DESISTIU" }}
                      className="rounded-lg px-3 py-1.5 text-xs text-muted hover:bg-surface-2"
                    >
                      Desistiu
                    </ActionButton>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {done.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">Resolvidos hoje</h2>
          <Card className="divide-y divide-line p-0 text-sm">
            {done.map((w) => (
              <div key={w.id} className="flex justify-between px-4 py-2.5">
                <span>{w.name}</span>
                <span className="text-muted">
                  <Badge className={w.status === "ATENDIDO" ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-500/15 text-zinc-400"}>
                    {waitlistStatusLabel[w.status]}
                  </Badge>{" "}
                  {w.resolvedAt && formatTime(w.resolvedAt)}
                </span>
              </div>
            ))}
          </Card>
        </section>
      )}
      <p className="mt-6 flex items-center gap-1 text-xs text-muted">
        <MessageCircle className="size-3" /> Dica: clique no telefone para avisar o cliente pelo WhatsApp quando a suíte vagar.
      </p>
    </div>
  );
}
