"use client";

import { HandCoins, Plus } from "lucide-react";
import { pendingCreateAction, pendingPayAction } from "@/actions/operations";
import { ActionForm, Submit } from "@/components/form";
import { Modal } from "@/components/modal";
import { PaymentSplit, type DebtorOption } from "@/components/payment-split";
import { Button, Input, Select } from "@/components/ui";
import { formatMoney } from "@/lib/money";

export function NewPending({ debtors }: { debtors: DebtorOption[] }) {
  return (
    <Modal
      title="Nova pendência"
      trigger={(open) => (
        <Button onClick={open}>
          <Plus className="size-4" /> Nova pendência
        </Button>
      )}
    >
      {(close) => (
        <ActionForm action={pendingCreateAction} resetOnSuccess onSuccess={close}>
          <Select label="Pessoa ou empresa" name="debtor" required defaultValue="">
            <option value="" disabled>
              Selecione...
            </option>
            {debtors.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
          <Input label="Descrição" name="description" required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Valor" name="amount" inputMode="decimal" required />
            <Input label="Vencimento" name="dueDate" type="date" />
          </div>
          <Submit className="w-full">Registrar</Submit>
        </ActionForm>
      )}
    </Modal>
  );
}

export function PayPending({ id, remaining, who }: { id: string; remaining: number; who: string }) {
  return (
    <Modal
      title={`Receber de ${who}`}
      trigger={(open) => (
        <Button size="sm" onClick={open}>
          <HandCoins className="size-3" /> Receber
        </Button>
      )}
    >
      {() => (
        <ActionForm action={pendingPayAction}>
          <input type="hidden" name="pendingId" value={id} />
          <p className="text-sm text-muted">
            Restante: <strong className="text-white">{formatMoney(remaining)}</strong>. Pode receber só uma parte.
          </p>
          <PaymentSplit total={remaining} submitLabel="Confirmar recebimento" partial />
        </ActionForm>
      )}
    </Modal>
  );
}
