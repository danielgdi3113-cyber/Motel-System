import { db } from "./db";
import type { DebtorOption } from "@/components/payment-split";

/** Pessoas e empresas que podem ficar com pendências. */
export async function getDebtorOptions(): Promise<DebtorOption[]> {
  const [people, companies] = await Promise.all([
    db.person.findMany({ where: { blocked: false }, orderBy: { name: "asc" }, select: { id: true, name: true, phone: true } }),
    db.company.findMany({ where: { isCustomer: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return [
    ...people.map((p) => ({ value: `p:${p.id}`, label: `${p.name}${p.phone ? ` · ${p.phone}` : ""}` })),
    ...companies.map((c) => ({ value: `c:${c.id}`, label: `${c.name} (empresa)` })),
  ];
}
