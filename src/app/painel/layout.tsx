import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOpenCashSession } from "@/lib/cash";
import { roleLabel } from "@/lib/labels";
import { getSettings } from "@/lib/settings";
import { Nav } from "@/components/nav";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // "Usuários online" do dashboard: atualiza no máximo uma vez por minuto
  if (!user.lastSeenAt || Date.now() - user.lastSeenAt.getTime() > 60_000) {
    await db.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
  }
  const [settings, cash, cleaning, reservations, orders, tickets, waiting, unread] = await Promise.all([
    getSettings(),
    getOpenCashSession(),
    db.cleaningTask.count({ where: { status: { not: "CONCLUIDA" } } }),
    db.reservation.count({ where: { status: "PENDENTE" } }),
    db.roomServiceOrder.count({ where: { status: { in: ["PENDENTE", "PREPARANDO"] } } }),
    db.maintenanceTicket.count({ where: { status: { in: ["ABERTA", "EM_ANDAMENTO"] } } }),
    db.waitlistEntry.count({ where: { status: "AGUARDANDO" } }),
    db.internalMessage.count({
      where: { OR: [{ toUserId: null }, { toUserId: user.id }], NOT: { readByIds: { has: user.id } } },
    }),
  ]);
  return (
    <div className="lg:flex">
      <Nav
        role={user.role}
        userName={user.name}
        roleName={roleLabel[user.role]}
        motelName={settings.motelName}
        cashOpen={!!cash}
        badges={{
          "/painel/limpeza": cleaning,
          "/painel/reservas": reservations,
          "/painel/servicos": orders,
          "/painel/manutencoes": tickets,
          "/painel/espera": waiting,
          "/painel/mensagens": unread,
        }}
      />
      <main className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
