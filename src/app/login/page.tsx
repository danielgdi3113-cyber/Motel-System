import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { homeFor } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(homeFor(session.role));
  const s = await getSettings();
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4">
      <div className="pointer-events-none absolute -top-40 left-1/2 size-[600px] -translate-x-1/2 rounded-full bg-accent/20 blur-[120px]" />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-gradient-accent text-xl font-bold">
            {s.motelName.charAt(0)}
          </div>
          <h1 className="text-2xl font-semibold">{s.motelName}</h1>
          <p className="mt-1 text-sm text-muted">Acesso da equipe</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
