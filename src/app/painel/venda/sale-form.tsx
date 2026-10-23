"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { saleAction } from "@/actions/operations";
import { ActionForm } from "@/components/form";
import { PaymentSplit, type DebtorOption } from "@/components/payment-split";
import { Card, Input, cn } from "@/components/ui";
import { formatMoney, parseMoney } from "@/lib/money";

type Product = { id: string; name: string; category: string; price: number; stock: number };

export function SaleForm({ products, debtors }: { products: Product[]; debtors: DebtorOption[] }) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [discount, setDiscount] = useState("");
  // Recria o formulário de pagamento após cada venda
  const [formKey, setFormKey] = useState(0);
  const [lastTotal, setLastTotal] = useState<number | null>(null);

  const filtered = products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
  const groups = useMemo(() => {
    const m = new Map<string, Product[]>();
    for (const p of filtered) m.set(p.category, [...(m.get(p.category) ?? []), p]);
    return [...m.entries()];
  }, [filtered]);

  const lines = Object.entries(cart)
    .map(([id, q]) => ({ product: products.find((p) => p.id === id)!, quantity: q }))
    .filter((l) => l.product && l.quantity > 0);
  const subtotal = lines.reduce((s, l) => s + l.product.price * l.quantity, 0);
  const total = Math.max(0, subtotal - parseMoney(discount));

  const change = (id: string, delta: number) => {
    const p = products.find((x) => x.id === id)!;
    const next = Math.min(p.stock, Math.max(0, (cart[id] ?? 0) + delta));
    setCart({ ...cart, [id]: next });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <Input placeholder="Buscar produto..." value={query} onChange={(e) => setQuery(e.target.value)} />
        {groups.map(([cat, list]) => (
          <div key={cat}>
            <div className="mb-2 text-xs uppercase tracking-wide text-muted">{cat}</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {list.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={p.stock <= (cart[p.id] ?? 0)}
                  onClick={() => change(p.id, 1)}
                  className={cn(
                    "rounded-xl border p-3 text-left text-sm transition disabled:opacity-40",
                    cart[p.id] ? "border-accent bg-accent/10" : "border-line hover:border-zinc-500",
                  )}
                >
                  <div className="font-medium leading-tight">{p.name}</div>
                  <div className="mt-1 flex justify-between text-xs text-muted">
                    <span className="text-zinc-200">{formatMoney(p.price)}</span>
                    <span>{cart[p.id] ? `${cart[p.id]} no carrinho` : `${p.stock} un.`}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Card className="h-fit space-y-4 lg:sticky lg:top-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <ShoppingCart className="size-4" /> Carrinho
        </h2>
        {lastTotal !== null && lines.length === 0 && (
          <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">Venda de {formatMoney(lastTotal)} registrada!</p>
        )}
        {lines.length === 0 ? (
          <p className="text-sm text-muted">Clique nos produtos para adicionar.</p>
        ) : (
          <div className="space-y-2">
            {lines.map(({ product: p, quantity }) => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <button type="button" onClick={() => change(p.id, -1)} className="rounded-md p-1 hover:bg-surface-2" aria-label="Menos">
                  <Minus className="size-3" />
                </button>
                <span className="w-6 text-center tabular-nums">{quantity}</span>
                <button type="button" onClick={() => change(p.id, 1)} className="rounded-md p-1 hover:bg-surface-2" aria-label="Mais">
                  <Plus className="size-3" />
                </button>
                <span className="w-20 text-right tabular-nums">{formatMoney(p.price * quantity)}</span>
                <button type="button" onClick={() => setCart({ ...cart, [p.id]: 0 })} className="rounded-md p-1 text-muted hover:text-rose-400" aria-label="Remover">
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-between border-t border-line pt-3 text-2xl font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatMoney(total)}</span>
        </div>
        <ActionForm
          key={formKey}
          action={saleAction}
          onSuccess={() => {
            setLastTotal(total);
            setCart({});
            setDiscount("");
            setFormKey((k) => k + 1);
          }}
        >
          <input type="hidden" name="items" value={JSON.stringify(lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Cliente" name="customerName" placeholder="Opcional" />
            <Input label="Desconto" name="discount" inputMode="decimal" placeholder="0,00" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </div>
          <PaymentSplit total={total} debtors={debtors} submitLabel="Finalizar venda" disabled={lines.length === 0} />
        </ActionForm>
      </Card>
    </div>
  );
}
