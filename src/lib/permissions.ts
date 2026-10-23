import type { Role } from "@prisma/client";

const ALL: Role[] = ["ADMIN", "RECEPCAO", "CAMAREIRA"];
const STAFF: Role[] = ["ADMIN", "RECEPCAO"];
const ADMIN: Role[] = ["ADMIN"];

export type NavItem = { href: string; label: string; icon: string; roles: Role[] };
export type NavSection = { title: string; items: NavItem[] };

/**
 * Mapa de acesso do sistema. Funcionários (recepção e camareira) não veem
 * relatórios, faturamento, custos, despesas nem configurações.
 */
export const NAV: NavSection[] = [
  {
    title: "Operação",
    items: [
      { href: "/painel", label: "Recepção (mapa)", icon: "LayoutGrid", roles: STAFF },
      { href: "/painel/reservas", label: "Painel de reservas", icon: "CalendarClock", roles: STAFF },
      { href: "/painel/venda", label: "Venda avulsa", icon: "ShoppingCart", roles: STAFF },
      { href: "/painel/espera", label: "Lista de espera", icon: "Hourglass", roles: STAFF },
      { href: "/painel/servicos", label: "Serviços de quarto", icon: "ConciergeBell", roles: STAFF },
      { href: "/painel/limpeza", label: "Limpeza", icon: "Sparkles", roles: ALL },
      { href: "/painel/manutencoes", label: "Manutenções", icon: "Wrench", roles: ALL },
      { href: "/painel/pendencias", label: "Pendências", icon: "FileClock", roles: STAFF },
      { href: "/painel/equipamentos", label: "Equipamentos", icon: "Tv", roles: STAFF },
    ],
  },
  {
    title: "Caixa",
    items: [
      { href: "/painel/caixa", label: "Caixa / turno", icon: "Wallet", roles: STAFF },
      { href: "/painel/caixa/fornecedores", label: "Pag. de fornecedores", icon: "Truck", roles: ADMIN },
      { href: "/painel/caixa/adiantamentos", label: "Adiantamento salarial", icon: "HandCoins", roles: ADMIN },
    ],
  },
  {
    title: "Relatórios",
    items: [
      { href: "/painel/relatorios", label: "Dashboard", icon: "LayoutDashboard", roles: ADMIN },
      { href: "/painel/relatorios/faturamento", label: "Relatório de faturamento", icon: "BarChart3", roles: ADMIN },
      { href: "/painel/relatorios/movimentos", label: "Movimentos do caixa", icon: "ReceiptText", roles: ADMIN },
    ],
  },
  {
    title: "Estoque",
    items: [
      { href: "/painel/produtos", label: "Mercadorias", icon: "Package", roles: STAFF },
      { href: "/painel/cardapio", label: "Cardápio", icon: "BookOpen", roles: ADMIN },
      { href: "/painel/estoque/entrada", label: "Entrada rápida", icon: "PackagePlus", roles: STAFF },
    ],
  },
  {
    title: "Clientes",
    items: [
      { href: "/painel/clientes/veiculos", label: "Veículos", icon: "Car", roles: STAFF },
      { href: "/painel/clientes/pessoas", label: "Pessoas", icon: "Users", roles: STAFF },
      { href: "/painel/clientes/empresas", label: "Empresas", icon: "Building2", roles: STAFF },
    ],
  },
  {
    title: "Colaboradores",
    items: [
      { href: "/painel/equipe", label: "Funcionários", icon: "UserCog", roles: ADMIN },
      { href: "/painel/mensagens", label: "Comunicação interna", icon: "MessagesSquare", roles: ALL },
      { href: "/painel/conta", label: "Trocar minha senha", icon: "KeyRound", roles: ALL },
    ],
  },
  {
    title: "Ferramentas",
    items: [
      { href: "/painel/suites", label: "Suítes e preços", icon: "BedDouble", roles: ADMIN },
      { href: "/painel/configuracoes", label: "Configurações", icon: "Settings", roles: ADMIN },
    ],
  },
];

/** Perfis que acessam uma rota do painel (a regra mais específica vence). */
export function rolesFor(path: string): Role[] {
  let best: NavItem | undefined;
  for (const section of NAV)
    for (const item of section.items) {
      const match = item.href === "/painel" ? path === "/painel" : path === item.href || path.startsWith(item.href + "/");
      if (match && (!best || item.href.length > best.href.length)) best = item;
    }
  return best?.roles ?? STAFF;
}

export const isAdmin = (role: Role) => role === "ADMIN";
