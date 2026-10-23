"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { StayMode } from "@prisma/client";
import { Ban, LogOut, Plus } from "lucide-react";
import { PaymentSplit, type DebtorOption } from "@/components/payment-split";
import { addConsumptionAction, cancelStayAction, checkoutAction } from "@/actions/stays";
import { useNow } from "@/components/auto-refresh";
import { ActionForm, Submit } from "@/components/form";
import { Modal } from "@/components/modal";
import { Button, Card, Checkbox, Input, Select, Textarea, cn } from "@/components/ui";
import { formatMoney, parseMoney } from "@/lib/money";
import { calculateStayPrice } from "@/lib/pricing";
import { formatDuration, formatTime } from "@/lib/time";

type Pricing = {
  mode: StayMode;
  checkIn: string;
  periodHours: number;
  periodPrice: number;
  extraHourPrice: number;
  overnightPrice: number;
  overnightEndHour: number;
};

function usePrice(pricing: Pricing, tolerance: number) {
  const now = useNow(new Date(pricing.checkIn).getTime());
  return { now, price: calculateStayPrice({ ...pricing, checkIn: new Date(pricing.checkIn), toleranceMinutes: tolerance }, new Date(now)) };
}

export function StayTimer({ checkIn }: { checkIn: string }) {
  const now = useNow(new Date(checkIn).getTime());
  return <span className="font-mono">{formatDuration(now - new Date(checkIn).getTime())}</span>;
}

export function StayLimit({ pricing, tolerance }: { pricing: Pricing; tolerance: number }) {
  const { price } = usePrice(pricing, tolerance);
  return (
    <span className={cn(price.extraHours > 0 && "text-rose-300")}>
      {formatTime(price.limitAt)}
      {price.extraHours > 0 && <span className="ml-2 text-sm">(+{price.extraHours}h extra)</span>}
    </span>
  );
}

type ProductOption = { id: string; name: string; category: string; price: number; stock: number };

export function AddConsumption({ stayId, products }: { stayId: string; products: ProductOption[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string>("");
  const filtered = products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
  const byCategory = useMemo(() => {
    const m = new Map<string, ProductOption[]>();
    for (const p of filtered) m.set(p.category, [...(m.get(p.category) ?? []), p]);
    return [...m.entries()];
  }, [filtered]);

  return (
    <Modal
      title="Lançar consumo"
      wide
      trigger={(open) => (
        <Button size="sm" onClick={open}>
          <Plus className="size-4" /> Lançar item
        </Button>
      )}
    >
      {() => (
        <ActionForm action={addConsumptionAction} onSuccess={() => setSelected("")}>
          <input type="hidden" name="stayId" value={stayId} />
          <input type="hidden" name="productId" value={selected} />
          <Input placeholder="Buscar produto..." value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
            {byCategory.map(([cat, list]) => (
              <div key={cat}>
                <div className="mb-2 text-xs uppercase tracking-wide text-muted">{cat}</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {list.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      disabled={p.stock <= 0}
                      onClick={() => setSelected(p.id)}
                      className={cn(
                        "rounded-xl border p-3 text-left text-sm transition disabled:opacity-40",
                        selected === p.id ? "border-accent bg-accent/10" : "border-line hover:border-zinc-500",
                      )}
                    >
                      <div className="font-medium leading-tight">{p.name}</div>
                      <div className="mt-1 flex justify-between text-xs text-muted">
                        <span className="text-zinc-200">{formatMoney(p.price)}</span>
                        <span>{p.stock > 0 ? `${p.stock} un.` : "esgotado"}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-2 rounded-xl border border-line p-3">
            <Checkbox name="asOrder" label="Enviar como pedido para a cozinha / serviço de quarto" />
            <Input name="orderNotes" placeholder="Observação do pedido (ex.: sem cebola)" />
          </div>
          <div className="flex items-end gap-3">
            <Input label="Quantidade" name="quantity" type="number" min={1} max={50} defaultValue={1} className="w-28" />
            <Submit disabled={!selected} className="flex-1">
              Adicionar à conta
            </Submit>
          </div>
        </ActionForm>
      )}
    </Modal>
  );
}



export function Checkout({
  stayId,
  pricing,
  tolerance,
  consumption,
  cashOpen,
  debtors,
}: {
  stayId: string;
  pricing: Pricing;
  tolerance: number;
  consumption: number;
  cashOpen: boolean;
  debtors: DebtorOption[];
}) {
  const { price } = usePrice(pricing, tolerance);
  const [discount, setDiscount] = useState("");
  const subtotal = price.amount + consumption;
  const total = Math.max(0, subtotal - parseMoney(discount));

  return (
    <Card className="space-y-4">
      <h2 className="font-semibold">Conta</h2>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">{pricing.mode === "PERNOITE" ? "Pernoite" : `Período (${pricing.periodHours}h)`}</span>
          <span>{formatMoney(price.baseAmount)}</span>
        </div>
        {price.extraHours > 0 && (
          <div className="flex justify-between text-rose-300">
            <span>Horas extras ({price.extraHours}h)</span>
            <span>{formatMoney(price.amount - price.baseAmount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted">Consumo</span>
          <span>{formatMoney(consumption)}</span>
        </div>
        <div className="flex justify-between border-t border-line pt-2 text-2xl font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatMoney(total)}</span>
        </div>
        <p className="text-xs text-muted">Próxima cobrança às {formatTime(price.nextChargeAt)}.</p>
      </div>

      {!cashOpen ? (
        <div className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-300">
          O caixa está fechado.{" "}
          <Link href="/painel/caixa" className="font-medium underline">
            Abrir caixa
          </Link>{" "}
          para fazer o check-out.
        </div>
      ) : (
        <ActionForm action={checkoutAction}>
          <input type="hidden" name="stayId" value={stayId} />
          <Input
            label="Desconto"
            name="discount"
            inputMode="decimal"
            placeholder="0,00"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
          <PaymentSplit total={total} debtors={debtors} submitLabel="Fechar conta e liberar" submitIcon={<LogOut className="size-4" />} />
          <p className="text-xs text-muted">O valor é recalculado no momento da confirmação.</p>
        </ActionForm>
      )}
    </Card>
  );
}

export function CancelStay({ stayId }: { stayId: string }) {
  return (
    <Modal
      title="Cancelar locação"
      trigger={(open) => (
        <Button variant="ghost" size="sm" className="w-full text-rose-400" onClick={open}>
          <Ban className="size-4" /> Cancelar locação
        </Button>
      )}
    >
      {() => (
        <form action={cancelStayAction} className="space-y-4">
          <input type="hidden" name="stayId" value={stayId} />
          <p className="text-sm text-muted">
            A locação será cancelada sem cobrança, os itens consumidos voltam ao estoque e a suíte vai para limpeza.
          </p>
          <Textarea label="Motivo" name="reason" required />
          <Button variant="danger" className="w-full">
            Confirmar cancelamento
          </Button>
        </form>
      )}
    </Modal>
  );
}
