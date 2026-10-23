"use client";

import { useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { Submit } from "./form";
import { Checkbox, Input, Select, cn } from "./ui";
import { paymentLabel } from "@/lib/labels";
import { centsToInput, formatMoney, parseMoney } from "@/lib/money";

const METHODS = ["PIX", "DEBITO", "CREDITO", "DINHEIRO"] as const;
type Method = (typeof METHODS)[number];
type Line = { id: number; method: Method; value: string };
export type DebtorOption = { value: string; label: string };

/**
 * Pagamento dividido: cada forma adicionada entra com o valor que falta.
 * Gera os campos ocultos pay_PIX, pay_DEBITO... esperados pelas actions.
 */
export function PaymentSplit({
  total,
  submitLabel,
  submitIcon,
  debtors,
  partial,
  disabled,
}: {
  total: number;
  /** Bloqueia o envio (ex.: carrinho vazio). */
  disabled?: boolean;
  /** Aceita receber só uma parte do total (ex.: abater pendência). */
  partial?: boolean;
  submitLabel: string;
  submitIcon?: ReactNode;
  /** Se informado, permite deixar o restante como pendência para um cliente. */
  debtors?: DebtorOption[];
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [pending, setPending] = useState(false);
  const paid = lines.reduce((s, l) => s + parseMoney(l.value), 0);
  const diff = paid - total;
  const cashPaid = lines.filter((l) => l.method === "DINHEIRO").reduce((s, l) => s + parseMoney(l.value), 0);
  const invalidChange = diff > 0 && diff > cashPaid;
  const usePending = (pending || !!partial) && diff < 0;

  const add = (method: Method) =>
    setLines([...lines, { id: Math.random(), method, value: centsToInput(Math.max(0, total - paid)) }]);

  return (
    <>
      {METHODS.map((m) => (
        <input
          key={m}
          type="hidden"
          name={`pay_${m}`}
          value={centsToInput(lines.filter((l) => l.method === m).reduce((s, l) => s + parseMoney(l.value), 0))}
        />
      ))}
      <div className="space-y-2">
        <span className="text-sm font-medium text-zinc-300">Pagamento</span>
        <div className="grid grid-cols-4 gap-1.5">
          {METHODS.map((m) => (
            <button
              type="button"
              key={m}
              onClick={() => add(m)}
              className="flex items-center justify-center gap-1 rounded-lg border border-line py-2 text-xs hover:border-accent hover:text-white"
            >
              <Plus className="size-3" /> {paymentLabel[m]}
            </button>
          ))}
        </div>
        {lines.length === 0 ? (
          <p className="text-xs text-muted">
            Clique na forma de pagamento. Para dividir, ajuste o valor e clique na próxima forma: ela entra com o restante.
          </p>
        ) : (
          lines.map((l) => (
            <div key={l.id} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-sm">{paymentLabel[l.method]}</span>
              <Input
                aria-label={`Valor em ${paymentLabel[l.method]}`}
                inputMode="decimal"
                placeholder="0,00"
                value={l.value}
                onChange={(e) => setLines(lines.map((x) => (x.id === l.id ? { ...x, value: e.target.value } : x)))}
                onFocus={(e) => e.target.select()}
              />
              <button
                type="button"
                onClick={() => setLines(lines.filter((x) => x.id !== l.id))}
                className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-rose-400"
                aria-label="Remover pagamento"
              >
                <X className="size-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {debtors && diff < 0 && (
        <div className="space-y-2 rounded-xl border border-line p-3">
          <Checkbox
            name="leavePending"
            label={`Deixar ${formatMoney(-diff)} pendente (pendura)`}
            checked={pending}
            onChange={(e) => setPending(e.target.checked)}
          />
          {pending && (
            <Select name="debtor" required defaultValue="">
              <option value="" disabled>
                Quem fica devendo?
              </option>
              {debtors.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
          )}
          {pending && debtors.length === 0 && (
            <p className="text-xs text-amber-300">Cadastre o cliente em Clientes → Pessoas ou Empresas.</p>
          )}
        </div>
      )}

      {!disabled && <div
        className={cn(
          "rounded-xl px-3 py-2 text-sm",
          invalidChange
            ? "bg-rose-500/10 text-rose-300"
            : diff === 0 || usePending
              ? "bg-emerald-500/10 text-emerald-300"
              : diff > 0
                ? "bg-sky-500/10 text-sky-300"
                : "bg-surface-2 text-muted",
        )}
      >
        {diff < 0 && (usePending ? `${formatMoney(-diff)} ${partial ? "continuará em aberto" : "ficará pendente"}` : `Faltam ${formatMoney(-diff)}`)}
        {diff === 0 && "Valor confere"}
        {diff > 0 && !invalidChange && `Troco: ${formatMoney(diff)}`}
        {invalidChange && `Pago ${formatMoney(diff)} a mais. Troco só é possível em dinheiro — ajuste os valores.`}
      </div>}
      <Submit className="w-full" size="lg" variant="success" disabled={disabled || (diff < 0 && !usePending) || invalidChange || (partial && paid === 0)}>
        {submitIcon} {submitLabel}
      </Submit>
    </>
  );
}
