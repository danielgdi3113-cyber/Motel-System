import { AlertTriangle } from "lucide-react";
import { requireUser, STAFF } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { Badge, PageHeader, Table, Td } from "@/components/ui";
import { ProductForm, StockForm } from "./product-forms";

export const metadata = { title: "Produtos e estoque" };

const movementLabel = { ENTRADA: "Entrada", VENDA: "Venda", AJUSTE: "Ajuste", ESTORNO: "Estorno" };

export default async function ProductsPage() {
  const user = await requireUser(STAFF);
  const isAdmin = user.role === "ADMIN";
  const [products, movements] = await Promise.all([
    db.product.findMany({ orderBy: [{ active: "desc" }, { category: "asc" }, { name: "asc" }] }),
    db.stockMovement.findMany({ include: { product: true, user: true }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const low = products.filter((p) => p.active && p.stock <= p.minStock);
  const options = products.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name, stock: p.stock }));
  const categories = [...new Set(products.map((p) => p.category))];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Produtos e estoque"
        subtitle="Frigobar, cardápio e itens de conveniência."
        actions={
          <>
            <StockForm products={options} isAdmin={isAdmin} />
            {isAdmin && <ProductForm categories={categories} />}
          </>
        }
      />
      {low.length > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <strong>Estoque baixo:</strong> {low.map((p) => `${p.name} (${p.stock})`).join(", ")}
          </div>
        </div>
      )}
      <Table head={["Produto", "Categoria", "Preço", "Custo", "Margem", "Estoque", ""]}>
        {products.map((p) => {
          const margin = p.price > 0 && p.cost > 0 ? Math.round(((p.price - p.cost) / p.price) * 100) : null;
          return (
            <tr key={p.id} className={p.active ? "" : "opacity-50"}>
              <Td className="font-medium">
                {p.name} {!p.active && <Badge className="bg-zinc-500/20 text-zinc-400">inativo</Badge>}
              </Td>
              <Td className="text-muted">{p.category}</Td>
              <Td>{formatMoney(p.price)}</Td>
              <Td className="text-muted">{p.cost ? formatMoney(p.cost) : "—"}</Td>
              <Td className="text-muted">{margin !== null ? `${margin}%` : "—"}</Td>
              <Td>
                <span className={p.stock <= p.minStock ? "font-semibold text-amber-300" : ""}>{p.stock}</span>
                <span className="text-xs text-muted"> / mín. {p.minStock}</span>
              </Td>
              <Td className="text-right">
                {isAdmin && (
                  <ProductForm
                    categories={categories}
                    product={{ id: p.id, name: p.name, category: p.category, price: p.price, cost: p.cost, minStock: p.minStock, active: p.active }}
                  />
                )}
              </Td>
            </tr>
          );
        })}
      </Table>

      <h2 className="mb-3 mt-8 font-semibold">Últimas movimentações</h2>
      <Table head={["Data", "Produto", "Tipo", "Qtd", "Motivo", "Usuário"]}>
        {movements.map((m) => (
          <tr key={m.id}>
            <Td className="text-muted">{formatDateTime(m.createdAt)}</Td>
            <Td>{m.product.name}</Td>
            <Td>{movementLabel[m.type]}</Td>
            <Td className={m.quantity > 0 ? "text-emerald-300" : "text-rose-300"}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</Td>
            <Td className="text-muted">{m.reason || "—"}</Td>
            <Td className="text-muted">{m.user.name}</Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
