import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <div className="text-gradient text-6xl font-bold">404</div>
        <p className="mt-2 text-muted">Página não encontrada.</p>
        <Link href="/" className="mt-6 inline-block text-sm underline">
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
