import Link from "next/link";
import { MessageCircle } from "lucide-react";

export function SiteHeader({ name, whatsapp }: { name: string; whatsapp: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/60 bg-bg/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl bg-gradient-accent font-bold">{name.charAt(0)}</div>
          <span className="font-semibold">{name}</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/#suites" className="hidden px-3 py-2 text-muted hover:text-white sm:block">
            Suítes
          </Link>
          <a
            href={`https://wa.me/${whatsapp}`}
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1.5 px-3 py-2 text-muted hover:text-white sm:flex"
          >
            <MessageCircle className="size-4" /> WhatsApp
          </a>
          <Link href="/reservar" className="rounded-xl bg-gradient-accent px-4 py-2 font-medium">
            Reservar
          </Link>
        </nav>
      </div>
    </header>
  );
}
