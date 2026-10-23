import { requireUser, STAFF } from "@/lib/auth";
import { db } from "@/lib/db";
import { equipmentStatusLabel, equipmentStatusStyle } from "@/lib/labels";
import { Badge, Empty, PageHeader, Stat, Table, Td } from "@/components/ui";
import { EquipmentForm } from "./equipment-form";

export const metadata = { title: "Equipamentos" };

export default async function EquipmentPage({ searchParams }: { searchParams: Promise<{ suite?: string }> }) {
  const user = await requireUser(STAFF);
  const isAdmin = user.role === "ADMIN";
  const { suite } = await searchParams;
  const [items, suites] = await Promise.all([
    db.equipment.findMany({
      where: suite ? { suiteId: suite === "geral" ? null : suite } : {},
      include: { suite: true, tickets: { where: { status: { in: ["ABERTA", "EM_ANDAMENTO"] } } } },
      orderBy: [{ suite: { number: "asc" } }, { name: "asc" }],
    }),
    db.suite.findMany({ where: { active: true }, orderBy: { number: "asc" }, select: { id: true, number: true } }),
  ]);
  const count = (s: string) => items.filter((i) => i.status === s).length;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Equipamentos"
        subtitle="Patrimônio por suíte: TVs, ar-condicionado, hidromassagem, frigobar..."
        actions={isAdmin && <EquipmentForm suites={suites} />}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total" value={items.length} />
        <Stat label="Funcionando" value={count("OK")} />
        <Stat label="Com defeito" value={count("DEFEITO")} />
        <Stat label="Em manutenção" value={count("EM_MANUTENCAO")} />
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5 text-sm">
        <a href="/painel/equipamentos" className={`rounded-full px-3 py-1.5 ${!suite ? "bg-surface-2 text-white" : "text-muted"}`}>
          Todos
        </a>
        {suites.map((s) => (
          <a key={s.id} href={`?suite=${s.id}`} className={`rounded-full px-3 py-1.5 ${suite === s.id ? "bg-surface-2 text-white" : "text-muted"}`}>
            {s.number}
          </a>
        ))}
        <a href="?suite=geral" className={`rounded-full px-3 py-1.5 ${suite === "geral" ? "bg-surface-2 text-white" : "text-muted"}`}>
          Áreas comuns
        </a>
      </div>
      {items.length === 0 ? (
        <Empty>Nenhum equipamento cadastrado.</Empty>
      ) : (
        <Table head={["Equipamento", "Patrimônio", "Local", "Situação", "Observações", ""]}>
          {items.map((e) => (
            <tr key={e.id} className={e.status === "BAIXADO" ? "opacity-50" : ""}>
              <Td className="font-medium">{e.name}</Td>
              <Td className="font-mono text-xs text-muted">{e.code || "—"}</Td>
              <Td>{e.suite ? `Suíte ${e.suite.number}` : "Área comum"}</Td>
              <Td>
                <Badge className={equipmentStatusStyle[e.status]}>{equipmentStatusLabel[e.status]}</Badge>
                {e.tickets.length > 0 && <span className="ml-2 text-xs text-amber-300">{e.tickets.length} chamado(s)</span>}
              </Td>
              <Td className="max-w-xs truncate text-muted">{e.notes || "—"}</Td>
              <Td className="text-right">
                {isAdmin && (
                  <EquipmentForm
                    suites={suites}
                    item={{ id: e.id, name: e.name, code: e.code, suiteId: e.suiteId, status: e.status, notes: e.notes }}
                  />
                )}
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
