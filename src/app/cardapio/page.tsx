import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Cardápio" };
export const dynamic = "force-dynamic";

export default async function PublicMenuPage() {
  const [settings, products] = await Promise.all([
    getSettings(),
    db.product.findMany({ where: { active: true, showOnMenu: true, stock: { gt: 0 } }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
  ]);
  const groups = new Map<string, typeof products>();
  for (const p of products) groups.set(p.category, [...(groups.get(p.category) ?? []), p]);

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-gradient-accent text-xl font-bold">{settings.motelName.charAt(0)}</div>
        <h1 className="text-2xl font-bold">Cardápio</h1>
        <p className="text-sm text-muted">{settings.motelName} · peça pelo interfone da suíte</p>
      </div>
      {[...groups.entries()].map(([cat, list]) => (
        <section key={cat} className="mb-8">
          <h2 className="text-gradient mb-3 text-sm font-semibold uppercase tracking-widest">{cat}</h2>
          <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {list.map((p) => (
              <div key={p.id} className="flex items-start justify-between gap-4 px-4 py-3">
                <div>
                  <div className="font-medium">{p.name}</div>
                  {p.description && <div className="text-sm text-muted">{p.description}</div>}
                </div>
                <div className="shrink-0 font-semibold">{formatMoney(p.price)}</div>
              </div>
            ))}
          </div>
        </section>
      ))}
      {products.length === 0 && <p className="text-center text-muted">Cardápio indisponível no momento.</p>}
    </main>
  );
}
