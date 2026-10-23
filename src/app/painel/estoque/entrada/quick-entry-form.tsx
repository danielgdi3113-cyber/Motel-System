"use client";

import { useState } from "react";
import { quickEntryAction } from "@/actions/products";
import { ActionForm, Submit } from "@/components/form";
import { Card, Input, cn } from "@/components/ui";

type P = { id: string; name: string; category: string; stock: number; low: boolean };

export function QuickEntryForm({ products }: { products: P[] }) {
  const [filter, setFilter] = useState("");
  const shown = products.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()));
  return (
    <ActionForm action={quickEntryAction} resetOnSuccess>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Nota fiscal / fornecedor" name="reason" placeholder="Ex.: NF 1234 — Distribuidora X" />
        <Input label="Filtrar" placeholder="Buscar produto..." value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>
      <Card className="divide-y divide-line p-0">
        {products.map((p) => (
          <label key={p.id} className={cn("flex items-center gap-4 px-4 py-2.5", !shown.includes(p) && "hidden")}>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{p.name}</div>
              <div className="text-xs text-muted">
                {p.category} · estoque atual <span className={p.low ? "font-semibold text-amber-300" : ""}>{p.stock}</span>
              </div>
            </div>
            <input
              name={`qty_${p.id}`}
              type="number"
              min={0}
              placeholder="0"
              className="h-10 w-24 rounded-xl border border-line bg-bg px-3 text-right text-sm outline-none focus:border-accent"
            />
          </label>
        ))}
      </Card>
      <Submit size="lg" className="w-full">
        Lançar entrada
      </Submit>
    </ActionForm>
  );
}
