"use client";

import { Plus } from "lucide-react";
import { expenseAction } from "@/actions/cash";
import { ActionForm, Submit } from "@/components/form";
import { Modal } from "@/components/modal";
import { Button, Input, Select } from "@/components/ui";

export function ExpenseForm({
  type,
  options,
}: {
  type: "PAGAMENTO_FORNECEDOR" | "ADIANTAMENTO_SALARIAL";
  options: { id: string; name: string }[];
}) {
  const supplier = type === "PAGAMENTO_FORNECEDOR";
  return (
    <Modal
      title={supplier ? "Pagar fornecedor" : "Adiantamento salarial"}
      trigger={(open) => (
        <Button onClick={open}>
          <Plus className="size-4" /> {supplier ? "Novo pagamento" : "Novo adiantamento"}
        </Button>
      )}
    >
      {(close) => (
        <ActionForm action={expenseAction} resetOnSuccess onSuccess={close}>
          <input type="hidden" name="type" value={type} />
          <Select label={supplier ? "Fornecedor" : "Funcionário"} name={supplier ? "companyId" : "employeeId"} required defaultValue="">
            <option value="" disabled>
              Selecione...
            </option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Valor" name="amount" inputMode="decimal" required />
            <Select label="Pago em" name="method" defaultValue="DINHEIRO">
              <option value="DINHEIRO">Dinheiro do caixa</option>
              <option value="PIX">Pix</option>
              <option value="DEBITO">Débito</option>
              <option value="CREDITO">Crédito</option>
            </Select>
          </div>
          <Input label="Descrição" name="description" placeholder={supplier ? "Ex.: bebidas" : "Ex.: vale do dia 15"} />
          {supplier && <Input label="Nota fiscal / documento" name="document" />}
          <Submit className="w-full">Registrar</Submit>
        </ActionForm>
      )}
    </Modal>
  );
}
