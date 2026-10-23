import Link from "next/link";
import { Clock, EyeOff, MapPin, MessageCircle, Moon, ShieldCheck, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";

const gradients = [
  "from-fuchsia-600/40 via-purple-700/30 to-transparent",
  "from-rose-600/40 via-pink-700/30 to-transparent",
  "from-violet-600/40 via-indigo-700/30 to-transparent",
  "from-amber-500/30 via-rose-700/30 to-transparent",
];

export default async function HomePage() {
  const [settings, categories] = await Promise.all([
    getSettings(),
    db.suiteCategory.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { suites: { where: { active: true } } } } },
    }),
  ]);
  const freeNow = await db.suite.groupBy({ by: ["categoryId"], where: { active: true, status: "LIVRE" }, _count: true });

  return (
    <>
      <SiteHeader name={settings.motelName} whatsapp={settings.whatsapp} />
      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute -top-32 left-1/2 size-[800px] -translate-x-1/2 rounded-full bg-accent/20 blur-[140px]" />
          <div className="relative mx-auto max-w-6xl px-4 py-24 text-center sm:py-32">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-3 py-1 text-xs text-muted">
              <Sparkles className="size-3 text-accent" /> Reserve online em menos de 1 minuto
            </p>
            <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
              {settings.motelName.split(" ").slice(0, -1).join(" ")}{" "}
              <span className="text-gradient">{settings.motelName.split(" ").at(-1)}</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-muted">{settings.slogan}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/reservar" className="rounded-xl bg-gradient-accent px-6 py-3 font-medium glow">
                Reservar agora
              </Link>
              <a
                href={`https://wa.me/${settings.whatsapp}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-xl border border-line bg-surface px-6 py-3 font-medium hover:border-zinc-500"
              >
                <MessageCircle className="size-4" /> Falar no WhatsApp
              </a>
            </div>
            <div className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              {[
                { icon: EyeOff, t: "Entrada discreta" },
                { icon: ShieldCheck, t: "Sigilo total" },
                { icon: Clock, t: "Aberto 24h" },
                { icon: Moon, t: "Pernoite" },
              ].map(({ icon: Icon, t }) => (
                <div key={t} className="rounded-2xl border border-line bg-surface/60 p-4">
                  <Icon className="mx-auto mb-2 size-5 text-accent" />
                  {t}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="suites" className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="mb-2 text-3xl font-bold">Nossas suítes</h2>
          <p className="mb-8 text-muted">Preços por período e pernoite. Hora adicional cobrada após o período contratado.</p>
          <div className="grid gap-5 md:grid-cols-2">
            {categories.map((c, i) => {
              const free = freeNow.find((f) => f.categoryId === c.id)?._count ?? 0;
              return (
                <article key={c.id} className="overflow-hidden rounded-3xl border border-line bg-surface">
                  <div className={`relative h-40 bg-gradient-to-br ${gradients[i % gradients.length]}`}>
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.12),transparent_50%)]" />
                    <div className="absolute bottom-4 left-5">
                      <h3 className="text-2xl font-bold">{c.name}</h3>
                      <span className={`text-xs ${free > 0 ? "text-emerald-300" : "text-zinc-300"}`}>
                        {free > 0 ? `● ${free} disponível(is) agora` : "● Todas ocupadas no momento"}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-4 p-5">
                    <p className="text-sm text-muted">{c.description}</p>
                    {c.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {c.amenities.map((a) => (
                          <span key={a} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-zinc-300">
                            {a}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
                      <div>
                        <div className="text-xs text-muted">{c.periodHours} horas</div>
                        <div className="font-semibold">{formatMoney(c.periodPrice)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted">Hora extra</div>
                        <div className="font-semibold">{formatMoney(c.extraHourPrice)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted">Pernoite</div>
                        <div className="font-semibold">{formatMoney(c.overnightPrice)}</div>
                      </div>
                    </div>
                    <Link
                      href={`/reservar?categoria=${c.id}`}
                      className="block rounded-xl border border-line py-2.5 text-center text-sm font-medium hover:border-accent hover:text-white"
                    >
                      Reservar {c.name}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted">
          <span className="flex items-center gap-2">
            <MapPin className="size-4" /> {settings.address}
          </span>
          <span>Proibida a entrada de menores de 18 anos.</span>
          <Link href="/login" className="hover:text-white">
            Área da equipe
          </Link>
        </div>
      </footer>
    </>
  );
}
