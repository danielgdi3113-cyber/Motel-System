import { requireUser, STAFF } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { QuickEntryForm } from "./quick-entry-form";

export const metadata = { title: "Entrada rápida" };

export default async function QuickEntryPage() {
  await requireUser(STAFF);
  const products = await db.product.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] });
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Entrada rápida" subtitle="Lance a chegada de várias mercadorias de uma vez. Deixe em branco o que não chegou." />
      <QuickEntryForm
        products={products.map((p) => ({ id: p.id, name: p.name, category: p.category, stock: p.stock, low: p.stock <= p.minStock }))}
      />
    </div>
  );
}
