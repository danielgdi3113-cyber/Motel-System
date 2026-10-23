import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { SiteHeader } from "@/components/site-header";
import { ReservationForm } from "./reservation-form";

export const metadata = { title: "Reservar" };
export const dynamic = "force-dynamic";

export default async function ReservePage({ searchParams }: { searchParams: Promise<{ categoria?: string }> }) {
  const { categoria } = await searchParams;
  const [settings, categories] = await Promise.all([
    getSettings(),
    db.suiteCategory.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  return (
    <>
      <SiteHeader name={settings.motelName} whatsapp={settings.whatsapp} />
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-3xl font-bold">Fazer reserva</h1>
        <p className="mb-8 mt-2 text-muted">
          Sem cadastro e sem pagamento antecipado. Você recebe um código e nossa equipe confirma pelo WhatsApp.
        </p>
        <ReservationForm
          defaultCategory={categoria}
          categories={categories.map((c) => ({
            id: c.id,
            name: c.name,
            periodHours: c.periodHours,
            periodPrice: c.periodPrice,
            overnightPrice: c.overnightPrice,
            overnightStartHour: c.overnightStartHour,
          }))}
        />
      </main>
    </>
  );
}
