"use client";

import type { CleaningStatus } from "@prisma/client";
import { CheckCircle2, Play } from "lucide-react";
import { finishCleaningAction, startCleaningAction } from "@/actions/cleaning";
import { useNow } from "@/components/auto-refresh";
import { Modal } from "@/components/modal";
import { Button, Card, Checkbox, Textarea, cn } from "@/components/ui";
import { formatDuration } from "@/lib/time";

type Task = {
  id: string;
  status: CleaningStatus;
  suite: string;
  category: string;
  createdAt: string;
  startedAt: string | null;
  assignedTo: string | null;
  mine: boolean;
};

export function CleaningCard({ task }: { task: Task }) {
  const now = useNow(new Date(task.startedAt ?? task.createdAt).getTime());
  const waiting = now - new Date(task.createdAt).getTime();
  const inProgress = task.status === "EM_ANDAMENTO";
  const late = !inProgress && waiting > 15 * 60_000;

  return (
    <Card className={cn(inProgress ? "border-amber-500/40" : late ? "border-rose-500/50" : "")}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-3xl font-bold">{task.suite}</div>
          <div className="text-sm text-muted">{task.category}</div>
        </div>
        <div className="text-right">
          <div className={cn("font-mono text-xl tabular-nums", late && "text-rose-300")}>
            {formatDuration(inProgress ? now - new Date(task.startedAt!).getTime() : waiting).slice(0, 5)}
          </div>
          <div className="text-xs text-muted">{inProgress ? `limpando · ${task.assignedTo}` : "aguardando"}</div>
        </div>
      </div>
      <div className="mt-4">
        {!inProgress ? (
          <form action={startCleaningAction}>
            <input type="hidden" name="taskId" value={task.id} />
            <Button size="lg" className="w-full">
              <Play className="size-4" /> Iniciar limpeza
            </Button>
          </form>
        ) : (
          <Modal
            title={`Concluir suíte ${task.suite}`}
            trigger={(open) => (
              <Button size="lg" variant="success" className="w-full" onClick={open}>
                <CheckCircle2 className="size-4" /> Concluir limpeza
              </Button>
            )}
          >
            {() => (
              <form action={finishCleaningAction} className="space-y-4">
                <input type="hidden" name="taskId" value={task.id} />
                <Textarea label="Observações" name="notes" placeholder="Ex.: lâmpada queimada, falta toalha..." />
                <Checkbox name="maintenance" label="Precisa de manutenção (não liberar a suíte)" />
                <Button size="lg" variant="success" className="w-full">
                  Confirmar
                </Button>
              </form>
            )}
          </Modal>
        )}
      </div>
    </Card>
  );
}
