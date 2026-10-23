"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Role } from "@prisma/client";
import {
  BarChart3,
  BedDouble,
  CalendarClock,
  LayoutGrid,
  LogOut,
  Menu,
  Package,
  Settings,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { cn } from "./ui";

const items: { href: string; label: string; icon: typeof LayoutGrid; roles: Role[] }[] = [
  { href: "/painel", label: "Mapa de suítes", icon: LayoutGrid, roles: ["ADMIN", "RECEPCAO"] },
  { href: "/painel/reservas", label: "Reservas", icon: CalendarClock, roles: ["ADMIN", "RECEPCAO"] },
  { href: "/painel/limpeza", label: "Limpeza", icon: Sparkles, roles: ["ADMIN", "RECEPCAO", "CAMAREIRA"] },
  { href: "/painel/caixa", label: "Caixa", icon: Wallet, roles: ["ADMIN", "RECEPCAO"] },
  { href: "/painel/produtos", label: "Produtos e estoque", icon: Package, roles: ["ADMIN", "RECEPCAO"] },
  { href: "/painel/relatorios", label: "Relatórios", icon: BarChart3, roles: ["ADMIN"] },
  { href: "/painel/suites", label: "Suítes e preços", icon: BedDouble, roles: ["ADMIN"] },
  { href: "/painel/configuracoes", label: "Configurações", icon: Settings, roles: ["ADMIN"] },
];

export function Nav({
  role,
  userName,
  roleName,
  motelName,
  cashOpen,
  badges,
}: {
  role: Role;
  userName: string;
  roleName: string;
  motelName: string;
  cashOpen: boolean;
  badges: Record<string, number>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const visible = items.filter((i) => i.roles.includes(role));

  const links = (
    <nav className="flex flex-1 flex-col gap-1">
      {visible.map(({ href, label, icon: Icon }) => {
        const active = href === "/painel" ? pathname === href || pathname.startsWith("/painel/locacoes") : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
              active ? "bg-surface-2 text-white" : "text-muted hover:bg-surface-2/60 hover:text-white",
            )}
          >
            <Icon className={cn("size-4", active && "text-accent")} />
            <span className="flex-1">{label}</span>
            {badges[href] ? (
              <span className="rounded-full bg-accent/20 px-2 text-xs font-semibold text-accent">{badges[href]}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="mt-4 space-y-3 border-t border-line pt-4">
      {role !== "CAMAREIRA" && (
        <Link href="/painel/caixa" className="flex items-center gap-2 px-3 text-xs">
          <span className={cn("size-2 rounded-full", cashOpen ? "bg-emerald-400" : "bg-rose-400")} />
          <span className="text-muted">Caixa {cashOpen ? "aberto" : "fechado"}</span>
        </Link>
      )}
      <div className="flex items-center gap-3 px-3">
        <div className="grid size-9 place-items-center rounded-full bg-surface-2 text-sm font-semibold">
          {userName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{userName}</div>
          <div className="text-xs text-muted">{roleName}</div>
        </div>
        <form action={logoutAction}>
          <button className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-white" aria-label="Sair" title="Sair">
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );

  const brand = (
    <Link href="/painel" className="mb-6 flex items-center gap-3 px-3">
      <div className="grid size-9 place-items-center rounded-xl bg-gradient-accent font-bold">{motelName.charAt(0)}</div>
      <span className="font-semibold">{motelName}</span>
    </Link>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface/50 p-4 lg:flex">
        {brand}
        {links}
        {footer}
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/80 px-4 py-3 backdrop-blur lg:hidden">
        <span className="font-semibold">{motelName}</span>
        <button onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-surface-2" aria-label="Abrir menu">
          <Menu className="size-5" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-surface p-4">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-3 rounded-lg p-2 hover:bg-surface-2" aria-label="Fechar menu">
              <X className="size-5" />
            </button>
            {brand}
            {links}
            {footer}
          </aside>
        </div>
      )}
    </>
  );
}
