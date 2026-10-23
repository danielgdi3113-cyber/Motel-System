import { ExpensePage } from "@/components/expenses/expense-page";

export const metadata = { title: "Pagamento de fornecedores" };

export default function Page() {
  return <ExpensePage type="PAGAMENTO_FORNECEDOR" />;
}
