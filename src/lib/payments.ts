import { BusinessError } from "@/actions/types";
import { formatMoney, parseMoney } from "./money";

export const PAYMENT_METHODS = ["PIX", "DEBITO", "CREDITO", "DINHEIRO"] as const;
export type Method = (typeof PAYMENT_METHODS)[number];

export function parsePayments(form: FormData) {
  return PAYMENT_METHODS.map((method) => ({ method, amount: parseMoney(String(form.get(`pay_${method}`) ?? "")) })).filter(
    (p) => p.amount > 0,
  );
}

/**
 * Confere os pagamentos contra o total. O excedente vira troco (só em dinheiro);
 * a falta só é aceita se `allowPending`, virando uma pendência.
 */
export function settlePayments(payments: { method: Method; amount: number }[], total: number, allowPending = false) {
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const diff = paid - total;
  if (diff < 0 && !allowPending) throw new BusinessError(`Faltam ${formatMoney(-diff)} para fechar a conta.`);
  const change = Math.max(0, diff);
  const cashPaid = payments.find((p) => p.method === "DINHEIRO")?.amount ?? 0;
  if (change > cashPaid) throw new BusinessError("Valor pago acima do total. Troco só é possível em dinheiro.");
  const final = payments
    .map((p) => (p.method === "DINHEIRO" ? { ...p, amount: p.amount - change } : p))
    .filter((p) => p.amount > 0);
  return { final, change, pendingAmount: Math.max(0, -diff) };
}

/** "p:<id>" → pessoa, "c:<id>" → empresa. */
export function parseDebtor(value: FormDataEntryValue | null) {
  const v = String(value ?? "");
  if (v.startsWith("p:")) return { personId: v.slice(2) };
  if (v.startsWith("c:")) return { companyId: v.slice(2) };
  return null;
}
