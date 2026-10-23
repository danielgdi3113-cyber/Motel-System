"use client";

import { ArrowDownCircle, ArrowUpCircle, Lock, Unlock } from "lucide-react";
import { cashMovementAction, closeCashAction, openCashAction } from "@/actions/cash";
import { ActionForm, Submit } from "@/components/form";
import { Modal } from "@/components/modal";
import { Button, Card, Input, Textarea } from "@/components/ui";
import { formatMoney } from "@/lib/money";

export function OpenCash() {
  return (
    <Card className="max-w-md">
      <h2 className="mb-1 font-semibold">Abrir caixa</h2>
      <p className="mb-4 text-sm text-muted">Informe o fundo de troco que está na gaveta.</p>
      <ActionForm action={openCashAction}>
        <Input label="Fundo de troco" name="openingAmount" inputMode="decimal" placeholder="0,00" defaultValue="0,00" />
        <Submit className="w-full">
          <Unlock className="size-4" /> Abrir caixa
        </Submit>
      </ActionForm>
    </Card>
  );
}

export function MovementForm({ type }: { type: "SANGRIA" | "SUPRIMENTO" }) {
  const label = type === "SANGRIA" ? "Sangria" : "Suprimento";
  return (
    <Modal
      title={label}
      trigger={(open) => (
        <Button variant="secondary" onClick={open}>
          {type === "SANGRIA" ? <ArrowUpCircle className="size-4" /> : <ArrowDownCircle className="size-4" />}
          {label}
        </Button>
      )}
    >
      {(close) => (
        <ActionForm action={cashMovementAction} resetOnSuccess onSuccess={close}>
          <input type="hidden" name="type" value={type} />
          <Input label="Valor" name="amount" inputMode="decimal" placeholder="0,00" required />
          <Input label="Descrição" name="description" placeholder={type === "SANGRIA" ? "Ex.: depósito no cofre" : "Ex.: reforço de troco"} />
          <Submit className="w-full">Registrar</Submit>
        </ActionForm>
      )}
    </Modal>
  );
}

export function CloseCash({ expected }: { expected: number | null }) {
  return (
    <Modal
      title="Fechar caixa"
      trigger={(open) => (
        <Button onClick={open}>
          <Lock className="size-4" /> Fechar caixa
        </Button>
      )}
    >
      {() => (
        <ActionForm action={closeCashAction}>
          <p className="text-sm text-muted">
            Conte o dinheiro da gaveta e informe o valor.
            {expected !== null && (
              <>
                {" "}O sistema espera <strong className="text-white">{formatMoney(expected)}</strong>.
              </>
            )}
          </p>
          <Input label="Dinheiro contado" name="declaredAmount" inputMode="decimal" placeholder="0,00" required />
          <Textarea label="Observações" name="notes" />
          <Submit className="w-full">Confirmar fechamento</Submit>
        </ActionForm>
      )}
    </Modal>
  );
}
