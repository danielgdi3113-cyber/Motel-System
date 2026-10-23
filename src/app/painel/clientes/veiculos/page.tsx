import { requireUser, STAFF } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/time";
import { Badge, Empty, PageHeader, Table, Td } from "@/components/ui";
import { SearchBox } from "../search";
import { VehicleForm } from "../client-forms";

export const metadata = { title: "Veículos" };

export default async function VehiclesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireUser(STAFF);
  const { q } = await searchParams;
  const term = q?.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const [vehicles, people] = await Promise.all([
    db.vehicle.findMany({
      where: term ? { OR: [{ plate: { contains: term } }, { model: { contains: q!.trim(), mode: "insensitive" } }] } : {},
      include: { person: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.person.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  // Visitas por placa (histórico de locações)
  const visits = await db.stay.groupBy({
    by: ["plate"],
    where: { plate: { in: vehicles.map((v) => v.plate) }, status: { not: "CANCELADA" } },
    _count: true,
    _max: { checkIn: true },
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Veículos"
        subtitle="Placas registradas no check-in. Bloqueie veículos que não podem entrar."
        actions={<VehicleForm people={people} />}
      />
      <SearchBox q={q} placeholder="Buscar placa ou modelo..." />
      {vehicles.length === 0 ? (
        <Empty>Nenhum veículo encontrado.</Empty>
      ) : (
        <Table head={["Placa", "Modelo / cor", "Cliente", "Visitas", "Última visita", ""]}>
          {vehicles.map((v) => {
            const stat = visits.find((x) => x.plate === v.plate);
            return (
              <tr key={v.id}>
                <Td>
                  <span className="rounded-md border border-line bg-zinc-100 px-2 py-0.5 font-mono text-sm font-bold text-zinc-900">{v.plate}</span>
                  {v.blocked && <Badge className="ml-2 bg-rose-500/15 text-rose-300">Bloqueado</Badge>}
                </Td>
                <Td className="text-muted">{[v.model, v.color].filter(Boolean).join(" · ") || "—"}</Td>
                <Td>{v.person?.name ?? "—"}</Td>
                <Td>{stat?._count ?? 0}</Td>
                <Td className="text-muted">{stat?._max.checkIn ? formatDateTime(stat._max.checkIn) : "—"}</Td>
                <Td className="text-right">
                  <VehicleForm
                    people={people}
                    item={{ id: v.id, plate: v.plate, model: v.model, color: v.color, notes: v.notes, blocked: v.blocked, personId: v.personId }}
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
