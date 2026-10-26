import Link from "next/link";
import type Anthropic from "@anthropic-ai/sdk";
import { MessageSquarePlus, Trash2 } from "lucide-react";
import { requireUser, ADMIN } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";
import { API_KEY_SETTING, toDisplay } from "@/lib/assistant/agent";
import { deleteChatAction } from "@/actions/assistant";
import { ActionButton, cn } from "@/components/ui";
import { AssistantChat, KeySetup } from "./assistant-client";

export const metadata = { title: "Assistente IA" };

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ c?: string; chave?: string }> }) {
  const user = await requireUser(ADMIN);
  const { c, chave } = await searchParams;
  const [settings, keyRow, chats, chat] = await Promise.all([
    getSettings(),
    db.setting.findUnique({ where: { key: API_KEY_SETTING } }),
    db.assistantChat.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, take: 30, select: { id: true, title: true, updatedAt: true } }),
    c ? db.assistantChat.findFirst({ where: { id: c, userId: user.id } }) : null,
  ]);
  const envKey = !!process.env.ANTHROPIC_API_KEY;
  const hasKey = envKey || !!keyRow?.value;
  const keyHint = envKey ? "variável de ambiente" : keyRow?.value ? `…${keyRow.value.slice(-4)}` : null;

  if (!hasKey || chave === "1") {
    return (
      <div className="mx-auto max-w-2xl">
        <KeySetup keyHint={keyHint} fromEnv={envKey} />
      </div>
    );
  }

  const items = chat ? toDisplay(chat.messages as unknown as Anthropic.Beta.BetaMessageParam[], settings.motelName) : [];

  return (
    <div className="flex h-[calc(100dvh-3rem)] gap-5 lg:h-[calc(100dvh-4rem)]">
      <aside className="hidden w-64 shrink-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface lg:flex">
        <Link href="/painel/assistente" className="m-3 flex items-center gap-2 rounded-xl bg-gradient-accent px-3 py-2 text-sm font-medium">
          <MessageSquarePlus className="size-4" /> Nova conversa
        </Link>
        <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
          {chats.map((x) => (
            <div key={x.id} className={cn("group flex items-center rounded-lg", x.id === chat?.id ? "bg-surface-2" : "hover:bg-surface-2/60")}>
              <Link href={`/painel/assistente?c=${x.id}`} className="min-w-0 flex-1 px-3 py-2">
                <div className="truncate text-sm">{x.title}</div>
                <div className="text-[11px] text-muted">{formatDateTime(x.updatedAt)}</div>
              </Link>
              <ActionButton
                action={deleteChatAction}
                fields={{ id: x.id }}
                className="mr-1 hidden rounded-md p-1.5 text-muted hover:text-rose-400 group-hover:block"
                aria-label="Apagar conversa"
                title="Apagar conversa"
              >
                <Trash2 className="size-3.5" />
              </ActionButton>
            </div>
          ))}
          {chats.length === 0 && <p className="px-3 py-2 text-xs text-muted">Nenhuma conversa ainda.</p>}
        </div>
        <Link href="/painel/assistente?chave=1" className="border-t border-line px-4 py-3 text-xs text-muted hover:text-white">
          Chave da API: {keyHint}
        </Link>
      </aside>
      <AssistantChat key={chat?.id ?? "nova"} chatId={chat?.id ?? null} initialItems={items} userName={user.name.split(" ")[0]} />
    </div>
  );
}
