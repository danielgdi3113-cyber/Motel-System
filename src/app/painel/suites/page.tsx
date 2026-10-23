import { requireUser, ADMIN } from "@/lib/auth";
import { db } from "@/lib/db";
import { suiteStatusLabel } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { Badge, Card, PageHeader } from "@/components/ui";
import { CategoryForm, SuiteForm } from "./suite-forms";

export const metadata = { title: "Suítes e preços" };

export default async function SuitesAdminPage() {
  await requireUser(ADMIN);
  const categories = await db.suiteCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: { suites: { orderBy: { number: "asc" } } },
  });
  const catOptions = categories.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Suítes e preços"
        subtitle="Os preços são congelados no check-in: alterações valem para as próximas entradas."
        actions={
          <>
            <SuiteForm categories={catOptions} />
            <CategoryForm />
          </>
        }
      />
      <div className="space-y-4">
        {categories.map((c) => (
          <Card key={c.id} className={c.active ? "" : "opacity-60"}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">{c.name}</h2>
                  {!c.active && <Badge className="bg-zinc-500/20 text-zinc-400">inativa</Badge>}
                </div>
                <p className="mt-1 max-w-xl text-sm text-muted">{c.description}</p>
                {c.amenities.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {c.amenities.map((a) => (
                      <Badge key={a} className="bg-surface-2 text-zinc-300">
                        {a}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-start gap-6 text-sm">
                <Price label={`${c.periodHours}h`} value={c.periodPrice} />
                <Price label="Hora extra" value={c.extraHourPrice} />
                <Price label={`Pernoite (${c.overnightStartHour}h–${c.overnightEndHour}h)`} value={c.overnightPrice} />
                <CategoryForm
                  category={{
                    id: c.id,
                    name: c.name,
                    description: c.description,
                    amenities: c.amenities.join(", "),
                    periodHours: c.periodHours,
                    periodPrice: c.periodPrice,
                    extraHourPrice: c.extraHourPrice,
                    overnightPrice: c.overnightPrice,
                    overnightStartHour: c.overnightStartHour,
                    overnightEndHour: c.overnightEndHour,
                    sortOrder: c.sortOrder,
                    active: c.active,
                  }}
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
              {c.suites.map((s) => (
                <SuiteForm
                  key={s.id}
                  categories={catOptions}
                  suite={{ id: s.id, number: s.number, categoryId: s.categoryId, notes: s.notes, active: s.active }}
                  label={`${s.number} · ${s.active ? suiteStatusLabel[s.status] : "inativa"}`}
                />
              ))}
              {c.suites.length === 0 && <span className="text-sm text-muted">Nenhuma suíte nesta categoria.</span>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Price({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-right">
      <div className="text-xs text-muted">{label}</div>
      <div className="font-semibold">{formatMoney(value)}</div>
    </div>
  );
}
