import { requireUser, STAFF } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { Badge, Empty, PageHeader, Table, Td } from "@/components/ui";
import { SearchBox } from "../search";
import { PersonForm } from "../client-forms";

export const metadata = { title: "Pessoas" };

export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireUser(STAFF);
  const { q } = await searchParams;
  const term = q?.trim();
  const people = await db.person.findMany({
    where: term
      ? { OR: [{ name: { contains: term, mode: "insensitive" } }, { phone: { contains: term } }, { document: { contains: term } }] }
      : {},
    include: { vehicles: true, pendings: { where: { status: "ABERTA" } } },
    orderBy: { name: "asc" },
    take: 200,
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Pessoas" subtitle="Clientes cadastrados (opcional — use para pendências, fidelidade ou bloqueios)." actions={<PersonForm />} />
      <SearchBox q={q} placeholder="Buscar por nome, telefone ou CPF..." />
      {people.length === 0 ? (
        <Empty>Nenhuma pessoa cadastrada.</Empty>
      ) : (
        <Table head={["Nome", "Telefone", "CPF", "Veículos", "Em aberto", ""]}>
          {people.map((p) => {
            const owed = p.pendings.reduce((s, x) => s + x.amount - x.paid, 0);
            return (
              <tr key={p.id}>
                <Td className="font-medium">
                  {p.name} {p.blocked && <Badge className="ml-1 bg-rose-500/15 text-rose-300">Bloqueado</Badge>}
                </Td>
                <Td className="text-muted">{p.phone || "—"}</Td>
                <Td className="text-muted">{p.document || "—"}</Td>
                <Td className="font-mono text-xs">{p.vehicles.map((v) => v.plate).join(", ") || "—"}</Td>
                <Td className={owed ? "font-semibold text-amber-300" : "text-muted"}>{owed ? formatMoney(owed) : "—"}</Td>
                <Td className="text-right">
                  <PersonForm
                    item={{
                      id: p.id,
                      name: p.name,
                      document: p.document,
                      phone: p.phone,
                      email: p.email,
                      notes: p.notes,
                      blocked: p.blocked,
                      birthDate: p.birthDate?.toISOString().slice(0, 10) ?? "",
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
