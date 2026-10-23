"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CleaningStatus, StayMode, SuiteStatus } from "@prisma/client";
import { AlertTriangle, CalendarClock, Car, LogIn, Sparkles, Wrench } from "lucide-react";
import { checkInAction } from "@/actions/stays";
import { setSuiteStatusAction } from "@/actions/suites";
import { useNow } from "@/components/auto-refresh";
import { ActionForm, Submit } from "@/components/form";
import { Modal } from "@/components/modal";
import { Button, Input, Textarea, cn } from "@/components/ui";
import { cleaningStatusLabel, modeLabel, suiteStatusDot, suiteStatusLabel, suiteStatusStyle } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { calculateStayPrice } from "@/lib/pricing";
import { formatDuration, formatTime } from "@/lib/time";

export type SuiteCard = {
  id: string;
  number: string;
  status: SuiteStatus;
  notes: string;
  categoryId: string;
  category: string;
  periodHours: number;
  periodPrice: number;
  overnightPrice: number;
  stay?: {
    id: string;
    mode: StayMode;
    plate: string;
    checkIn: string;
    periodHours: number;
    periodPrice: number;
    extraHourPrice: number;
    overnightPrice: number;
    overnightEndHour: number;
    consumption: number;
  };
  cleaning?: { status: CleaningStatus; by: string | null; since: string };
};

type Upcoming = { id: string; code: string; name: string; categoryId: string; mode: StayMode; at: string };

const filters: (SuiteStatus | "TODAS")[] = ["TODAS", "LIVRE", "OCUPADA", "LIMPEZA", "RESERVADA", "MANUTENCAO"];

export function SuiteGrid({ suites, tolerance, upcoming }: { suites: SuiteCard[]; tolerance: number; upcoming: Upcoming[] }) {
  const [filter, setFilter] = useState<(typeof filters)[number]>("TODAS");
  const now = useNow();
  const shown = filter === "TODAS" ? suites : suites.filter((s) => s.status === filter);
  const groups = useMemo(() => {
    const map = new Map<string, SuiteCard[]>();
    for (const s of shown) map.set(s.category, [...(map.get(s.category) ?? []), s]);
    return [...map.entries()];
  }, [shown]);

  return (
    <div className="space-y-6">
      {upcoming.length > 0 && (
        <div className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-sky-300">
            <CalendarClock className="size-4" /> Reservas nas próximas horas
          </div>
          <div className="flex flex-wrap gap-2">
            {upcoming.map((r) => (
              <Link
                key={r.id}
                href="/painel/reservas"
                className="rounded-xl border border-line bg-surface px-3 py-2 text-sm hover:border-sky-500/50"
              >
                <span className="font-semibold">{formatTime(r.at)}</span> · {r.name} ·{" "}
                <span className="text-muted">
                  {suites.find((s) => s.categoryId === r.categoryId)?.category} · {modeLabel[r.mode]} · #{r.code}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => {
          const n = f === "TODAS" ? suites.length : suites.filter((s) => s.status === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition",
                filter === f ? "border-accent bg-accent/10 text-white" : "border-line text-muted hover:text-white",
              )}
            >
              {f !== "TODAS" && <span className={cn("size-2 rounded-full", suiteStatusDot[f])} />}
              {f === "TODAS" ? "Todas" : suiteStatusLabel[f]}
              <span className="text-xs opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      {groups.map(([category, list]) => (
        <section key={category}>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">{category}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
            {list.map((s) => (
              <SuiteTile key={s.id} suite={s} now={now} tolerance={tolerance} />
            ))}
          </div>
        </section>
      ))}
      {shown.length === 0 && <p className="text-sm text-muted">Nenhuma suíte com esse status.</p>}
    </div>
  );
}

function SuiteTile({ suite, now, tolerance }: { suite: SuiteCard; now: number; tolerance: number }) {
  const base = "flex min-h-40 flex-col rounded-2xl border p-4 text-left transition";

  if (suite.status === "OCUPADA" && suite.stay) {
    const st = suite.stay;
    const checkIn = new Date(st.checkIn);
    const price = calculateStayPrice({ ...st, checkIn, toleranceMinutes: tolerance }, new Date(now));
    const overdue = price.extraHours > 0;
    const remaining = price.limitAt.getTime() - now;
    return (
      <Link href={`/painel/locacoes/${st.id}`} className={cn(base, suiteStatusStyle.OCUPADA, "hover:border-rose-400", overdue && "pulse-ring")}>
        <Header suite={suite} />
        <div className="mt-auto space-y-1 pt-3">
          <div className="font-mono text-2xl font-semibold tabular-nums text-white">{formatDuration(now - checkIn.getTime())}</div>
          <div className="flex items-center justify-between text-xs">
            <span>{modeLabel[st.mode]}</span>
            <span className="font-semibold text-white">{formatMoney(price.amount + st.consumption)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-rose-200/70">
            {st.plate ? (
              <span className="flex items-center gap-1">
                <Car className="size-3" /> {st.plate}
              </span>
            ) : (
              <span />
            )}
            {overdue ? (
              <span className="flex items-center gap-1 font-medium text-rose-300">
                <AlertTriangle className="size-3" /> +{price.extraHours}h
              </span>
            ) : (
              <span>{remaining > 0 ? `restam ${formatDuration(remaining).slice(0, 5)}` : "tolerância"}</span>
            )}
          </div>
        </div>
      </Link>
    );
  }

  if (suite.status === "LIVRE" || suite.status === "RESERVADA") {
    return (
      <Modal
        title={`Check-in · Suíte ${suite.number}`}
        trigger={(open) => (
          <button onClick={open} className={cn(base, suiteStatusStyle[suite.status], "hover:brightness-125")}>
            <Header suite={suite} />
            <div className="mt-auto space-y-1 pt-3 text-xs">
              <div className="flex justify-between">
                <span>{suite.periodHours}h</span>
                <span className="text-white">{formatMoney(suite.periodPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span>Pernoite</span>
                <span className="text-white">{formatMoney(suite.overnightPrice)}</span>
              </div>
              <div className="flex items-center gap-1 pt-1 font-medium">
                <LogIn className="size-3" /> Fazer check-in
              </div>
            </div>
          </button>
        )}
      >
        {(close) => <CheckInForm suite={suite} close={close} />}
      </Modal>
    );
  }

  // LIMPEZA / MANUTENCAO
  return (
    <Modal
      title={`Suíte ${suite.number}`}
      trigger={(open) => (
        <button onClick={open} className={cn(base, suiteStatusStyle[suite.status], "hover:brightness-125")}>
          <Header suite={suite} />
          <div className="mt-auto space-y-1 pt-3 text-xs">
            {suite.status === "LIMPEZA" && suite.cleaning && (
              <>
                <div className="flex items-center gap-1">
                  <Sparkles className="size-3" /> {cleaningStatusLabel[suite.cleaning.status]}
                </div>
                <div className="font-mono text-lg text-white">{formatDuration(now - new Date(suite.cleaning.since).getTime()).slice(0, 5)}</div>
                {suite.cleaning.by && <div className="truncate opacity-70">{suite.cleaning.by}</div>}
              </>
            )}
            {suite.status === "MANUTENCAO" && (
              <div className="flex items-start gap-1">
                <Wrench className="mt-0.5 size-3 shrink-0" /> <span className="line-clamp-2">{suite.notes || "Em manutenção"}</span>
              </div>
            )}
          </div>
        </button>
      )}
    >
      {() => (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Status atual: <strong className="text-white">{suiteStatusLabel[suite.status]}</strong>
            {suite.notes && suite.status === "MANUTENCAO" && <> — {suite.notes}</>}
          </p>
          <form action={setSuiteStatusAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="suiteId" value={suite.id} />
            <Button name="status" value="LIVRE" variant="success">
              Liberar suíte
            </Button>
            {suite.status !== "MANUTENCAO" && (
              <Button name="status" value="MANUTENCAO" variant="secondary">
                Enviar para manutenção
              </Button>
            )}
          </form>
        </div>
      )}
    </Modal>
  );
}

function Header({ suite }: { suite: SuiteCard }) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <div className="text-2xl font-bold text-white">{suite.number}</div>
        <div className="text-xs opacity-80">{suite.category}</div>
      </div>
      <span className="flex items-center gap-1.5 rounded-full bg-black/30 px-2 py-0.5 text-[11px] font-medium">
        <span className={cn("size-1.5 rounded-full", suiteStatusDot[suite.status])} />
        {suiteStatusLabel[suite.status]}
      </span>
    </div>
  );
}

function CheckInForm({ suite, close }: { suite: SuiteCard; close: () => void }) {
  const [mode, setMode] = useState<StayMode>("PERIODO");
  return (
    <ActionForm action={checkInAction} onSuccess={close}>
      <input type="hidden" name="suiteId" value={suite.id} />
      <input type="hidden" name="mode" value={mode} />
      <div className="grid grid-cols-2 gap-2">
        {(["PERIODO", "PERNOITE"] as const).map((m) => (
          <button
            type="button"
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "rounded-xl border p-3 text-left transition",
              mode === m ? "border-accent bg-accent/10" : "border-line hover:border-zinc-500",
            )}
          >
            <div className="text-sm font-medium">{m === "PERIODO" ? `Período (${suite.periodHours}h)` : "Pernoite"}</div>
            <div className="text-lg font-semibold">{formatMoney(m === "PERIODO" ? suite.periodPrice : suite.overnightPrice)}</div>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Placa do veículo" name="plate" placeholder="ABC1D23" maxLength={8} className="uppercase" />
        <Input label="Pessoas" name="guests" type="number" min={1} max={6} defaultValue={2} />
      </div>
      <Textarea label="Observações" name="notes" placeholder="Opcional" />
      {suite.status === "RESERVADA" && (
        <p className="text-xs text-sky-300">
          Suíte bloqueada para reserva. Faça o check-in pela tela de Reservas ou libere a suíte abaixo.
        </p>
      )}
      <Submit className="w-full" size="lg" disabled={suite.status === "RESERVADA"}>
        <LogIn className="size-4" /> Confirmar entrada
      </Submit>
      <div className="flex justify-between gap-2 border-t border-line pt-3">
        {suite.status === "LIVRE" ? (
          <>
            <Button type="submit" formAction={setSuiteStatusAction} name="status" value="RESERVADA" variant="ghost" size="sm">
              Bloquear p/ reserva
            </Button>
            <Button type="submit" formAction={setSuiteStatusAction} name="status" value="MANUTENCAO" variant="ghost" size="sm">
              <Wrench className="size-3" /> Manutenção
            </Button>
          </>
        ) : (
          <Button type="submit" formAction={setSuiteStatusAction} name="status" value="LIVRE" variant="secondary" size="sm">
            Liberar suíte
          </Button>
        )}
      </div>
    </ActionForm>
  );
}
