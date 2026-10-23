import { NextResponse, type NextRequest } from "next/server";
import { rolesFor } from "@/lib/permissions";
import { homeFor, SESSION_COOKIE, verifySession } from "@/lib/session";

export async function middleware(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  // Funcionário tentando abrir página restrita (ex.: relatórios) volta para a tela inicial dele
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/painel/locacoes") && !rolesFor(pathname).includes(session.role)) {
    return NextResponse.redirect(new URL(homeFor(session.role), req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/painel/:path*"] };
