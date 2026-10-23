import Link from "next/link";
import { ChefHat } from "lucide-react";
import type { OrderStatus } from "@prisma/client";
import { requireUser, STAFF } from "@/lib/auth";
import { db } from "@/lib/db";
import { orderStatusLabel } from "@/lib/labels";
import { formatTime, startOfLocalDay } from "@/lib/time";
import { AutoRefresh } from "@/components/auto-refresh";
import { ActionButton, Card, PageHeader, cn } from "@/components/ui";
import { orderStatusAction } from "@/actions/operations";
import { OrderTimer } from "./order-timer";

export const metadata = { title: "Serviços de quarto" };

const columns: { status: OrderStatus; next?: OrderStatus; nextLabel?: string; style: string }[] = [
  { status: "PENDENTE", next: "PREPARANDO", nextLabel: "Iniciar preparo", style: "border-amber-500/40" },
  { status: "PREPARANDO", next: "ENTREGUE", nextLabel: "Confirmar entrega", style: "border-sky-500/40" },
  { status: "ENTREGUE", style: "border-emerald-500/30" },
];

export default async function RoomServicePage() {
  await requireUser(STAFF);
  const orders = await db.roomServiceOrder.findMany({
    where: {
      OR: [{ status: { in: ["PENDENTE", "PREPARANDO"] } }, { status: "ENTREGUE", updatedAt: { gte: startOfLocalDay(new Date()) } }],
    },
    include: { items: { include: { product: true } }, stay: { include: { suite: true } }, createdBy: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <AutoRefresh seconds={10} />
      <PageHeader
        title="Serviços de quarto"
        subtitle="Pedidos para a cozinha/copa. Para criar um pedido, abra a locação e use “Lançar item” marcando “Enviar como pedido”."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        {columns.map((col) => {
          const list = orders.filter((o) => o.status === col.status);
          const shown = col.status === "ENTREGUE" ? list.slice(-10).reverse() : list;
          return (
            <section key={col.status} className="rounded-2xl border border-line bg-surface/40 p-3">
              <h2 className="mb-3 flex items-center justify-between px-1 text-sm font-semibold">
                {col.status === "ENTREGUE" ? "Entregues hoje" : orderStatusLabel[col.status]}
                <span className="rounded-full bg-surface-2 px-2 text-xs">{list.length}</span>
              </h2>
              <div className="space-y-3">
                {shown.map((o) => (
                  <Card key={o.id} className={cn("p-4", col.style)}>
                    <div className="flex items-start justify-between">
                      <div>
                        <Link href={`/painel/locacoes/${o.stayId}`} className="text-lg font-bold hover:underline">
                          Suíte {o.stay.suite.number}
                        </Link>
                        <div className="text-xs text-muted">
                          Pedido #{o.number} · {formatTime(o.createdAt)} · {o.createdBy.name}
                        </div>
                      </div>
                      {col.status !== "ENTREGUE" && <OrderTimer since={o.createdAt.toISOString()} />}
                    </div>
                    <ul className="my-3 space-y-1 text-sm">
                      {o.items.map((i) => (
                        <li key={i.id}>
                          <strong>{i.quantity}x</strong> {i.product.name}
                        </li>
                      ))}
                      {o.items.length === 0 && <li className="text-muted">Sem itens</li>}
                    </ul>
                    {o.notes && <p className="mb-3 rounded-lg bg-amber-500/10 px-2 py-1 text-xs text-amber-200">{o.notes}</p>}
                    {col.next && (
                      <div className="flex gap-2">
                        <ActionButton
                          action={orderStatusAction}
                          fields={{ id: o.id, status: col.next }}
                          className="flex-1 rounded-xl bg-gradient-accent px-3 py-2 text-sm font-medium hover:brightness-110"
                        >
                          {col.nextLabel}
                        </ActionButton>
                        <ActionButton
                          action={orderStatusAction}
                          fields={{ id: o.id, status: "CANCELADO" }}
                          className="rounded-xl px-3 py-2 text-xs text-rose-400 hover:bg-surface-2"
                        >
                          Cancelar
                        </ActionButton>
                      </div>
                    )}
                  </Card>
                ))}
                {shown.length === 0 && (
                  <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted">
                    <ChefHat className="size-5" /> Nada aqui
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
