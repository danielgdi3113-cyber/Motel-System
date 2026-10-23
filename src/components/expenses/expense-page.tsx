import Link from "next/link";
import { requireUser, ADMIN } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOpenCashSession } from "@/lib/cash";
import { paymentLabel } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { addDays, formatDateTime, startOfLocalDay, startOfLocalMonth } from "@/lib/time";
import { Card, Empty, PageHeader, Stat, Table, Td } from "@/components/ui";
import { ExpenseForm } from "./expense-form";

/** Tela compartilhada por "Pag. de fornecedores" e "Adiantamento salarial". */
export async function ExpensePage({ type }: { type: "PAGAMENTO_FORNECEDOR" | "ADIANTAMENTO_SALARIAL" }) {
  await requireUser(ADMIN);
  const supplier = type === "PAGAMENTO_FORNECEDOR";
  const since = addDays(startOfLocalDay(new Date()), -60);
  const [cash, rows, companies, employees] = await Promise.all([
    getOpenCashSession(),
    db.cashMovement.findMany({
      where: { type, createdAt: { gte: since } },
      include: { company: true, employee: true, user: true },
      orderBy: { createdAt: "desc" },
    }),
    supplier ? db.company.findMany({ where: { isSupplier: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : [],
    supplier ? [] : db.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const monthStart = startOfLocalMonth(new Date());
  const month = rows.filter((r) => r.createdAt >= monthStart).reduce((s, r) => s + r.amount, 0);
  const total60 = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={supplier ? "Pagamento de fornecedores" : "Adiantamento salarial"}
        subtitle="Saídas em dinheiro são descontadas da gaveta do caixa aberto. Pix/cartão só ficam registrados."
        actions={
          cash ? (
            <ExpenseForm
              type={type}
              options={(supplier ? companies : employees).map((o) => ({ id: o.id, name: o.name }))}
            />
          ) : (
            <Link href="/painel/caixa" className="text-sm text-amber-300 underline">
              Abra o caixa para lançar
            </Link>
          )
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3">
        <Stat label="Este mês" value={formatMoney(month)} />
        <Stat label="Últimos 60 dias" value={formatMoney(total60)} />
      </div>
      {supplier && companies.length === 0 && (
        <Card className="mb-4 text-sm text-amber-300">
          Nenhum fornecedor cadastrado.{" "}
          <Link href="/painel/clientes/empresas" className="underline">
            Cadastre em Clientes → Empresas
          </Link>{" "}
          marcando “Fornecedor”.
        </Card>
      )}
      {rows.length === 0 ? (
        <Empty>Nenhum lançamento nos últimos 60 dias.</Empty>
      ) : (
        <Table head={["Data", supplier ? "Fornecedor" : "Funcionário", "Descrição", supplier ? "Nota/Doc." : "", "Forma", "Valor"]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <Td className="text-muted">{formatDateTime(r.createdAt)}</Td>
              <Td className="font-medium">{r.company?.name ?? r.employee?.name ?? "—"}</Td>
              <Td className="text-muted">{r.description || "—"}</Td>
              <Td className="text-muted">{supplier ? r.document || "—" : ""}</Td>
              <Td>{paymentLabel[r.method]}</Td>
              <Td className="font-semibold">{formatMoney(r.amount)}</Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
