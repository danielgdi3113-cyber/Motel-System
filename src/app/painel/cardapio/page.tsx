import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireUser, ADMIN } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { PageHeader, Table, Td } from "@/components/ui";
import { MenuItemForm } from "./menu-item-form";

export const metadata = { title: "Cardápio" };

export default async function MenuAdminPage() {
  await requireUser(ADMIN);
  const products = await db.product.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] });
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Cardápio"
        subtitle="Escolha o que aparece no cardápio digital da suíte (imprima um QR Code apontando para a página pública)."
        actions={
          <Link href="/cardapio" target="_blank" className="flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm hover:border-accent">
            <ExternalLink className="size-4" /> Ver cardápio público
          </Link>
        }
      />
      <Table head={["Produto", "Categoria", "Preço", "Descrição no cardápio", "Visível", ""]}>
        {products.map((p) => (
          <tr key={p.id} className={p.showOnMenu ? "" : "opacity-50"}>
            <Td className="font-medium">{p.name}</Td>
            <Td className="text-muted">{p.category}</Td>
            <Td>{formatMoney(p.price)}</Td>
            <Td className="max-w-xs truncate text-muted">{p.description || "—"}</Td>
            <Td>{p.showOnMenu ? "Sim" : "Não"}</Td>
            <Td className="text-right">
              <MenuItemForm item={{ id: p.id, name: p.name, description: p.description, showOnMenu: p.showOnMenu }} />
            </Td>
          </tr>
        ))}
      </Table>
      <p className="mt-4 text-xs text-muted">Preço, nome e categoria são editados em Estoque → Mercadorias.</p>
    </div>
  );
}
