import { requireUser, STAFF } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { Badge, Empty, PageHeader, Table, Td } from "@/components/ui";
import { SearchBox } from "../search";
import { CompanyForm } from "../client-forms";

export const metadata = { title: "Empresas" };

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireUser(STAFF);
  const { q } = await searchParams;
  const term = q?.trim();
  const companies = await db.company.findMany({
    where: term ? { OR: [{ name: { contains: term, mode: "insensitive" } }, { document: { contains: term } }] } : {},
    include: { pendings: { where: { status: "ABERTA" } } },
    orderBy: { name: "asc" },
    take: 200,
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Empresas" subtitle="Clientes corporativos e fornecedores." actions={<CompanyForm />} />
      <SearchBox q={q} placeholder="Buscar por nome ou CNPJ..." />
      {companies.length === 0 ? (
        <Empty>Nenhuma empresa cadastrada.</Empty>
      ) : (
        <Table head={["Empresa", "CNPJ", "Contato", "Tipo", "Em aberto", ""]}>
          {companies.map((c) => {
            const owed = c.pendings.reduce((s, x) => s + x.amount - x.paid, 0);
            return (
              <tr key={c.id}>
                <Td className="font-medium">{c.name}</Td>
                <Td className="text-muted">{c.document || "—"}</Td>
                <Td className="text-muted">{[c.contact, c.phone].filter(Boolean).join(" · ") || "—"}</Td>
                <Td>
                  {c.isCustomer && <Badge className="mr-1 bg-sky-500/15 text-sky-300">Cliente</Badge>}
                  {c.isSupplier && <Badge className="bg-violet-500/15 text-violet-300">Fornecedor</Badge>}
                </Td>
                <Td className={owed ? "font-semibold text-amber-300" : "text-muted"}>{owed ? formatMoney(owed) : "—"}</Td>
                <Td className="text-right">
                  <CompanyForm
                    item={{
                      id: c.id,
                      name: c.name,
                      document: c.document,
                      phone: c.phone,
                      email: c.email,
                      contact: c.contact,
                      notes: c.notes,
                      isSupplier: c.isSupplier,
                      isCustomer: c.isCustomer,
                    }}
                  />
                </Td>
              </tr>
            );
          })}
        </Table>
      )}
    </div>
  );
}
