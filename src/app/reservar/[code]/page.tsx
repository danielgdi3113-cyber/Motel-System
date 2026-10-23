import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { db } from "@/lib/db";
import { modeLabel, reservationStatusLabel } from "@/lib/labels";
import { getSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Reserva recebida" };

export default async function ReservationDone({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [settings, r] = await Promise.all([
    getSettings(),
    db.reservation.findUnique({ where: { code: code.toUpperCase() }, include: { category: true } }),
  ]);
  if (!r) notFound();
  const msg = `Olá! Fiz a reserva #${r.code} para ${formatDateTime(r.scheduledAt)} (${r.category.name}, ${modeLabel[r.mode]}).`;

  return (
    <>
      <SiteHeader name={settings.motelName} whatsapp={settings.whatsapp} />
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <CheckCircle2 className="mx-auto size-14 text-emerald-400" />
        <h1 className="mt-4 text-2xl font-bold">Reserva recebida!</h1>
        <p className="mt-2 text-muted">Guarde seu código e apresente na chegada.</p>
        <div className="my-8 rounded-3xl border border-line bg-surface p-6">
          <div className="text-xs uppercase tracking-widest text-muted">Código</div>
          <div className="text-gradient my-2 font-mono text-4xl font-bold tracking-[0.3em]">{r.code}</div>
          <div className="mt-4 space-y-1 text-sm">
            <div>
              {r.category.name} · {modeLabel[r.mode]}
            </div>
            <div className="text-muted">{formatDateTime(r.scheduledAt)}</div>
            <div className="text-muted">Status: {reservationStatusLabel[r.status]}</div>
          </div>
        </div>
        <a
          href={`https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(msg)}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-medium hover:bg-emerald-500"
        >
          <MessageCircle className="size-4" /> Confirmar pelo WhatsApp
        </a>
        <Link href="/" className="mt-4 block text-sm text-muted hover:text-white">
          Voltar ao início
        </Link>
      </main>
    </>
  );
}
