import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/time";
import { Card, PageHeader, cn } from "@/components/ui";
import { MessageForm } from "./message-form";

export const metadata = { title: "Comunicação interna" };

export default async function MessagesPage() {
  const user = await requireUser();
  const where = { OR: [{ toUserId: null }, { toUserId: user.id }, { authorId: user.id }] };
  const [messages, users] = await Promise.all([
    db.internalMessage.findMany({ where, include: { author: true, toUser: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.user.findMany({ where: { active: true, NOT: { id: user.id } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  // Abrir a página marca as mensagens como lidas
  const unread = messages.filter((m) => !m.readByIds.includes(user.id)).map((m) => m.id);
  if (unread.length) {
    await db.internalMessage.updateMany({ where: { id: { in: unread } }, data: { readByIds: { push: user.id } } });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Comunicação interna" subtitle="Recados entre turnos e para a equipe." />
      <MessageForm users={users} />
      <div className="mt-6 space-y-3">
        {messages.map((m) => (
          <Card key={m.id} className={cn("p-4", unread.includes(m.id) && "border-accent/50")}>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
              <span>
                <strong className="text-zinc-200">{m.author.name}</strong> → {m.toUser ? m.toUser.name : "toda a equipe"}
                {unread.includes(m.id) && <span className="ml-2 rounded-full bg-accent/20 px-2 text-accent">nova</span>}
              </span>
              <span>{formatDateTime(m.createdAt)}</span>
            </div>
            <p className="whitespace-pre-line text-sm">{m.body}</p>
          </Card>
        ))}
        {messages.length === 0 && <p className="text-center text-sm text-muted">Nenhuma mensagem ainda.</p>}
      </div>
    </div>
  );
}
