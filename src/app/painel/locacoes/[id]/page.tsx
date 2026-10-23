import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Car, Users } from "lucide-react";
import { requireUser, STAFF } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOpenCashSession } from "@/lib/cash";
import { getTolerance } from "@/lib/settings";
import { getDebtorOptions } from "@/lib/debtors";
import { modeLabel, paymentLabel } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { formatDateTime, formatDuration } from "@/lib/time";
import { Badge, Card, Td, Table } from "@/components/ui";
import { removeConsumptionAction } from "@/actions/stays";
import { StayTimer, StayLimit, AddConsumption, Checkout, CancelStay } from "./stay-client";

export const metadata = { title: "Locação" };

export default async function StayPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(STAFF);
  const { id } = await params;
  const stay = await db.stay.findUnique({
    where: { id },
    include: {
      suite: { include: { category: true } },
      consumptions: { include: { product: true }, orderBy: { createdAt: "asc" } },
      payments: true,
      openedBy: true,
      closedBy: true,
      reservation: true,
    },
  });
  if (!stay) notFound();

  const open = stay.status === "ABERTA";
  const [tolerance, products, cash, debtors] = await Promise.all([
    getTolerance(),
    open ? db.product.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }) : [],
    open ? getOpenCashSession() : null,
    open ? getDebtorOptions() : [],
  ]);
  const consumption = stay.consumptions.reduce((s, c) => s + c.quantity * c.unitPrice, 0);
  const pricing = {
    mode: stay.mode,
    checkIn: stay.checkIn.toISOString(),
    periodHours: stay.periodHours,
    periodPrice: stay.periodPrice,
    extraHourPrice: stay.extraHourPrice,
    overnightPrice: stay.overnightPrice,
    overnightEndHour: stay.overnightEndHour,
  };

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/painel" className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-white">
        <ArrowLeft className="size-4" /> Mapa de suítes
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Suíte {stay.suite.number}</h1>
        <Badge className="bg-surface-2 text-zinc-300">{stay.suite.category.name}</Badge>
        <Badge className="bg-surface-2 text-zinc-300">{modeLabel[stay.mode]}</Badge>
        <Badge
          className={
            open ? "bg-rose-500/15 text-rose-300" : stay.status === "FECHADA" ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-500/15 text-zinc-400"
          }
        >
          {open ? "Em andamento" : stay.status === "FECHADA" ? "Encerrada" : "Cancelada"}
        </Badge>
        {stay.reservation && <Badge className="bg-sky-500/15 text-sky-300">Reserva #{stay.reservation.code}</Badge>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card>
            <div className="grid gap-4 sm:grid-cols-3">
              <Info label="Entrada" value={formatDateTime(stay.checkIn)} />
              <Info label={open ? "Tempo" : "Saída"} value={open ? <StayTimer checkIn={pricing.checkIn} /> : formatDateTime(stay.checkOut!)} />
              <Info
                label={open ? "Saída prevista" : "Duração"}
                value={
                  open ? (
                    <StayLimit pricing={pricing} tolerance={tolerance} />
                  ) : (
                    formatDuration(stay.checkOut!.getTime() - stay.checkIn.getTime()).slice(0, 5)
                  )
                }
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-4 border-t border-line pt-4 text-sm text-muted">
              {stay.plate && (
                <span className="flex items-center gap-1.5">
                  <Car className="size-4" /> {stay.plate}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Users className="size-4" /> {stay.guests} pessoa(s)
              </span>
              <span>Entrada por {stay.openedBy.name}</span>
              {stay.closedBy && <span>Saída por {stay.closedBy.name}</span>}
            </div>
            {stay.notes && <p className="mt-3 whitespace-pre-line text-sm text-zinc-300">{stay.notes}</p>}
          </Card>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Consumo</h2>
              {open && <AddConsumption stayId={stay.id} products={products.map((p) => ({ id: p.id, name: p.name, category: p.category, price: p.price, stock: p.stock }))} />}
            </div>
            {stay.consumptions.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">Nenhum item lançado.</p>
            ) : (
              <Table head={["Item", "Qtd", "Unitário", "Total", "Hora", ""]}>
                {stay.consumptions.map((c) => (
                  <tr key={c.id}>
                    <Td className="font-medium">{c.product.name}</Td>
                    <Td>{c.quantity}</Td>
                    <Td>{formatMoney(c.unitPrice)}</Td>
                    <Td className="font-medium">{formatMoney(c.unitPrice * c.quantity)}</Td>
                    <Td className="text-muted">{formatDateTime(c.createdAt).slice(-5)}</Td>
                    <Td className="text-right">
                      {open && (
                        <form action={removeConsumptionAction}>
                          <input type="hidden" name="id" value={c.id} />
                          <button className="text-xs text-rose-400 hover:underline">Remover</button>
                        </form>
                      )}
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          {open ? (
            <>
              <Checkout stayId={stay.id} pricing={pricing} tolerance={tolerance} consumption={consumption} cashOpen={!!cash} debtors={debtors} />
              {user.role === "ADMIN" && <CancelStay stayId={stay.id} />}
            </>
          ) : (
            <Card className="space-y-2 text-sm">
              <h2 className="mb-2 font-semibold">Resumo</h2>
              <Row label="Suíte" value={formatMoney(stay.roomAmount)} />
              <Row label="Consumo" value={formatMoney(stay.consumptionAmount)} />
              {stay.discount > 0 && <Row label="Desconto" value={`- ${formatMoney(stay.discount)}`} />}
              <div className="flex justify-between border-t border-line pt-2 text-lg font-semibold">
                <span>Total</span>
                <span>{formatMoney(stay.total)}</span>
              </div>
              {stay.payments.length > 0 && (
                <div className="space-y-1 border-t border-line pt-2">
                  {stay.payments.map((p) => (
                    <Row key={p.id} label={paymentLabel[p.method]} value={formatMoney(p.amount)} />
                  ))}
                </div>
              )}
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}
