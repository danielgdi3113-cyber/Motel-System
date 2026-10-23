import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOpenCashSession } from "@/lib/cash";
import { roleLabel } from "@/lib/labels";
import { getSettings } from "@/lib/settings";
import { Nav } from "@/components/nav";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [settings, cash, cleaning, reservations] = await Promise.all([
    getSettings(),
    getOpenCashSession(),
    db.cleaningTask.count({ where: { status: { not: "CONCLUIDA" } } }),
    db.reservation.count({ where: { status: "PENDENTE" } }),
  ]);
  return (
    <div className="lg:flex">
      <Nav
        role={user.role}
        userName={user.name}
        roleName={roleLabel[user.role]}
        motelName={settings.motelName}
        cashOpen={!!cash}
        badges={{ "/painel/limpeza": cleaning, "/painel/reservas": reservations }}
      />
      <main className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
