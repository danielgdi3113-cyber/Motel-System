export const TIMEZONE = process.env.MOTEL_TIMEZONE ?? "America/Sao_Paulo";

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function zonedParts(date: Date, tz: string): Parts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    year: +p.year,
    month: +p.month,
    day: +p.day,
    hour: +p.hour,
    minute: +p.minute,
    second: +p.second,
  };
}

/** Diferença (ms) entre o horário local no fuso e UTC para um instante. */
function tzOffsetMs(date: Date, tz: string): number {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Converte uma data/hora "de parede" no fuso para um Date (instante UTC). */
export function fromZoned(year: number, month: number, day: number, hour: number, minute = 0, tz = TIMEZONE): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const offset = tzOffsetMs(guess, tz);
  const result = new Date(guess.getTime() - offset);
  // Ajuste para transições de horário de verão
  const offset2 = tzOffsetMs(result, tz);
  return offset2 === offset ? result : new Date(guess.getTime() - offset2);
}

export function localParts(date: Date, tz = TIMEZONE): Parts {
  return zonedParts(date, tz);
}

/** Início do dia local (00:00) do instante informado. */
export function startOfLocalDay(date: Date, tz = TIMEZONE): Date {
  const p = zonedParts(date, tz);
  return fromZoned(p.year, p.month, p.day, 0, 0, tz);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function formatDateTime(date: Date | string, tz = TIMEZONE): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatDate(date: Date | string, tz = TIMEZONE): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(date),
  );
}

export function formatTime(date: Date | string, tz = TIMEZONE): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(date));
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
