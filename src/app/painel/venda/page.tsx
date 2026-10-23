import Link from "next/link";
import { requireUser, STAFF } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOpenCashSession } from "@/lib/cash";
import { getDebtorOptions } from "@/lib/debtors";
import { formatMoney } from "@/lib/money";
import { formatTime, startOfLocalDay } from "@/lib/time";
import { Card, PageHeader } from "@/components/ui";
import { SaleForm } from "./sale-form";

export const metadata = { title: "Venda avulsa" };

export default async function SalePage() {
  const user = await requireUser(STAFF);
  const isAdmin = user.role === "ADMIN";
  const [cash, products, debtors, recent] = await Promise.all([
    getOpenCashSession(),
    db.product.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    getDebtorOptions(),
    // Funcionários não veem o total vendido no dia
    isAdmin ? db.sale.findMany({
      where: { createdAt: { gte: startOfLocalDay(new Date()) } },
      include: { items: { include: { product: true } }, createdBy: true },
      orderBy: { createdAt: "desc" },
      take: 15,
    }) : [],
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Venda avulsa" subtitle="Vendas sem locação: balcão, portaria, delivery." />
      {!cash ? (
        <Card className="text-sm text-amber-300">
          O caixa está fechado.{" "}
          <Link href="/painel/caixa" className="underline">
            Abrir caixa
          </Link>{" "}
          para vender.
        </Card>
      ) : (
        <SaleForm
          products={products.map((p) => ({ id: p.id, name: p.name, category: p.category, price: p.price, stock: p.stock }))}
          debtors={debtors}
        />
      )}
      {recent.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-semibold">Vendas de hoje</h2>
          <Card className="divide-y divide-line p-0 text-sm">
            {recent.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate">{s.items.map((i) => `${i.quantity}x ${i.product.name}`).join(", ")}</div>
                  <div className="text-xs text-muted">
                    {formatTime(s.createdAt)} · {s.createdBy.name}
                    {s.customerName && ` · ${s.customerName}`}
                  </div>
                </div>
                <span className="font-medium">{formatMoney(s.total)}</span>
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
