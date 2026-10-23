import { MessageCircle } from "lucide-react";
import { requireUser, STAFF } from "@/lib/auth";
import { db } from "@/lib/db";
import { modeLabel, reservationStatusLabel, reservationStatusStyle, sourceLabel } from "@/lib/labels";
import { formatDateTime, startOfLocalDay } from "@/lib/time";
import { AutoRefresh } from "@/components/auto-refresh";
import { ActionButton, Badge, Empty, PageHeader, Table, Td } from "@/components/ui";
import { setReservationStatusAction } from "@/actions/reservations";
import { NewReservation, ReservationCheckIn } from "./reservation-forms";

export const metadata = { title: "Reservas" };

export default async function ReservationsPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  await requireUser(STAFF);
  const { ver } = await searchParams;
  const history = ver === "historico";
  const today = startOfLocalDay(new Date());

  const [reservations, categories, freeSuites] = await Promise.all([
    db.reservation.findMany({
      where: history
        ? { OR: [{ status: { notIn: ["PENDENTE", "CONFIRMADA"] } }, { scheduledAt: { lt: today } }] }
        : { status: { in: ["PENDENTE", "CONFIRMADA"] }, scheduledAt: { gte: today } },
      include: { category: true, suite: true },
      orderBy: { scheduledAt: history ? "desc" : "asc" },
      take: 100,
    }),
    db.suiteCategory.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.suite.findMany({ where: { active: true, status: { in: ["LIVRE", "RESERVADA"] } }, orderBy: { number: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <AutoRefresh seconds={30} />
      <PageHeader
        title="Reservas"
        subtitle="Reservas do site entram como pendentes — confirme com o cliente pelo WhatsApp."
        actions={<NewReservation categories={categories.map((c) => ({ id: c.id, name: c.name }))} />}
      />
      <div className="mb-4 flex gap-2 text-sm">
        <a href="/painel/reservas" className={`rounded-full px-3 py-1.5 ${!history ? "bg-surface-2 text-white" : "text-muted"}`}>
          Próximas
        </a>
        <a href="/painel/reservas?ver=historico" className={`rounded-full px-3 py-1.5 ${history ? "bg-surface-2 text-white" : "text-muted"}`}>
          Histórico
        </a>
      </div>
      {reservations.length === 0 ? (
        <Empty>Nenhuma reserva {history ? "no histórico" : "agendada"}.</Empty>
      ) : (
        <Table head={["Código", "Data", "Cliente", "Suíte", "Origem", "Status", ""]}>
          {reservations.map((r) => {
            const active = r.status === "PENDENTE" || r.status === "CONFIRMADA";
            const wa = `https://wa.me/${r.phone.length <= 11 ? "55" : ""}${r.phone}?text=${encodeURIComponent(
              `Olá ${r.customerName}! Sua reserva #${r.code} para ${formatDateTime(r.scheduledAt)} (${r.category.name}, ${modeLabel[r.mode]}) está confirmada.`,
            )}`;
            return (
              <tr key={r.id}>
                <Td className="font-mono font-semibold">#{r.code}</Td>
                <Td>{formatDateTime(r.scheduledAt)}</Td>
                <Td>
                  <div className="font-medium">{r.customerName}</div>
                  <a href={wa} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-emerald-400 hover:underline">
                    <MessageCircle className="size-3" /> {r.phone}
                  </a>
                </Td>
                <Td>
                  {r.category.name}
                  <div className="text-xs text-muted">
                    {modeLabel[r.mode]}
                    {r.suite && ` · nº ${r.suite.number}`}
                  </div>
                </Td>
                <Td className="text-muted">{sourceLabel[r.source]}</Td>
                <Td>
                  <Badge className={reservationStatusStyle[r.status]}>{reservationStatusLabel[r.status]}</Badge>
                </Td>
                <Td>
                  {active && (
                    <div className="flex flex-wrap justify-end gap-1">
                      <ReservationCheckIn
                        reservation={{ id: r.id, code: r.code, mode: r.mode, name: r.customerName }}
                        suites={freeSuites.filter((s) => s.categoryId === r.categoryId).map((s) => ({ id: s.id, number: s.number, status: s.status }))}
                      />
                      {r.status === "PENDENTE" && (
                        <ActionButton
                          action={setReservationStatusAction}
                          fields={{ id: r.id, status: "CONFIRMADA" }}
                          className="rounded-lg px-2 py-1 text-xs text-sky-300 hover:bg-surface-2"
                        >
                          Confirmar
                        </ActionButton>
                      )}
                      <ActionButton
                        action={setReservationStatusAction}
                        fields={{ id: r.id, status: "NO_SHOW" }}
                        className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-surface-2"
                      >
                        Não veio
                      </ActionButton>
                      <ActionButton
                        action={setReservationStatusAction}
                        fields={{ id: r.id, status: "CANCELADA" }}
                        className="rounded-lg px-2 py-1 text-xs text-rose-400 hover:bg-surface-2"
                      >
                        Cancelar
                      </ActionButton>
                    </div>
                  )}
                </Td>
              </tr>
            );
          })}
        </Table>
      )}
    </div>
  );
}
