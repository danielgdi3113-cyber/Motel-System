"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Role } from "@prisma/client";
import * as Icons from "lucide-react";
import { LogOut, Menu, Repeat, X } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { NAV } from "@/lib/permissions";
import { cn } from "./ui";

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
  const sections = NAV.map((s) => ({ ...s, items: s.items.filter((i) => i.roles.includes(role)) })).filter((s) => s.items.length);
  const allHrefs = sections.flatMap((s) => s.items.map((i) => i.href));
  // Destaca o item mais específico que casa com a rota atual
  const activeHref =
    pathname.startsWith("/painel/locacoes")
      ? "/painel"
      : allHrefs.filter((h) => (h === "/painel" ? pathname === h : pathname === h || pathname.startsWith(h + "/"))).sort((a, b) => b.length - a.length)[0];

  const links = (
    <nav className="-mx-1 flex-1 space-y-4 overflow-y-auto px-1">
      {sections.map((section) => (
        <div key={section.title}>
          <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{section.title}</div>
          {section.items.map(({ href, label, icon }) => {
            const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[icon] ?? Icons.Circle;
            const active = href === activeHref;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
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
        </div>
      ))}
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
          <button className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-white" aria-label="Trocar de usuário" title="Trocar de usuário">
            <Repeat className="size-4" />
          </button>
        </form>
        <form action={logoutAction}>
          <button className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-white" aria-label="Sair" title="Sair">
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );

  const brand = (
    <Link href={role === "CAMAREIRA" ? "/painel/limpeza" : "/painel"} className="mb-5 flex items-center gap-3 px-3">
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
