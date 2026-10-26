import Anthropic from "@anthropic-ai/sdk";
import type { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { getApiKey, runAssistant, type AssistantEvent } from "@/lib/assistant/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const bodySchema = z.object({ chatId: z.string().nullish(), message: z.string().trim().min(1).max(4000) });

export async function POST(req: Request) {
  // Somente administradores ativos
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  const user = session && (await db.user.findUnique({ where: { id: session.sub } }));
  if (!user || !user.active || user.role !== "ADMIN") return Response.json({ error: "Acesso restrito ao administrador." }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Mensagem inválida." }, { status: 400 });
  const { chatId, message } = parsed.data;

  const apiKey = await getApiKey();
  if (!apiKey) return Response.json({ error: "Configure a chave da API para usar o assistente.", code: "NO_KEY" }, { status: 400 });

  const chat = chatId
    ? await db.assistantChat.findFirst({ where: { id: chatId, userId: user.id } })
    : await db.assistantChat.create({ data: { userId: user.id, title: message.slice(0, 80), messages: [] } });
  if (!chat) return Response.json({ error: "Conversa não encontrada." }, { status: 404 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: AssistantEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          // cliente desconectou
        }
      };
      emit({ type: "chat", id: chat.id });
      try {
        const history = chat.messages as unknown as Anthropic.Beta.BetaMessageParam[];
        const messages = await runAssistant({ apiKey, history, question: message, emit, signal: req.signal });
        // Histórico só cresce: salva tudo, inclusive consultas e resultados
        await db.assistantChat.update({ where: { id: chat.id }, data: { messages: messages as unknown as Prisma.InputJsonValue } });
        await audit(user.id, `Assistente IA consultado por ${user.name}: "${message.slice(0, 80)}"`);
      } catch (err) {
        emit({ type: "error", message: errorMessage(err) });
        if (!(err instanceof Anthropic.APIError)) console.error("assistente", err);
      } finally {
        emit({ type: "done" });
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}

function errorMessage(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "A chave da API é inválida. Confira em Assistente IA → Configurar chave.";
  if (err instanceof Anthropic.PermissionDeniedError) return "A chave da API não tem permissão para este modelo.";
  if (err instanceof Anthropic.RateLimitError) return "Limite de uso atingido. Aguarde um minuto e tente de novo.";
  if (err instanceof Anthropic.BadRequestError)
    return "A API recusou a requisição. A causa mais comum é falta de créditos: confira em console.anthropic.com → Billing.";
  if (err instanceof Anthropic.APIConnectionError) return "Não foi possível conectar à IA. Verifique a internet.";
  if (err instanceof Anthropic.APIError) return `Erro da IA (${err.status ?? "?"}). Tente novamente.`;
  if (err instanceof Error && err.name === "AbortError") return "Resposta interrompida.";
  return "Erro inesperado ao consultar o assistente.";
}
