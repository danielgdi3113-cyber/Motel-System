import { cn } from "./ui";

type Bar = { label: string; value: number; tooltip: string };

function niceMax(max: number) {
  if (max <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(max));
  const n = max / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
}

/** Gráfico de barras com um único eixo, grade discreta e tooltip por barra. */
export function BarChart({
  data,
  formatAxis,
  height = 220,
  color = "bg-accent",
  integer,
}: {
  data: Bar[];
  formatAxis: (v: number) => string;
  height?: number;
  color?: string;
  /** Contagens: o topo do eixo vira múltiplo de 4 para as marcas serem inteiras. */
  integer?: boolean;
}) {
  const raw = Math.max(0, ...data.map((d) => d.value));
  const max = integer ? Math.max(4, Math.ceil(raw / 4) * 4) : niceMax(raw);
  const ticks = [1, 0.75, 0.5, 0.25, 0];
  return (
    <div className="flex gap-2" style={{ height }} role="img" aria-label={data.map((d) => d.tooltip).join("; ")}>
      <div className="flex flex-col justify-between pb-6 text-right text-[11px] tabular-nums text-muted">
        {ticks.map((t) => (
          <span key={t} className="-translate-y-1/2 leading-none first:translate-y-0 last:translate-y-0">
            {formatAxis(max * t)}
          </span>
        ))}
      </div>
      <div className="relative flex-1">
        <div className="absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between">
          {ticks.map((t) => (
            <div key={t} className={cn("border-t", t === 0 ? "border-zinc-600" : "border-line/60")} />
          ))}
        </div>
        <div className="absolute inset-x-0 top-0 bottom-0 flex gap-[2px]">
          {data.map((d) => (
            <div key={d.label} className="group relative flex h-full flex-1 flex-col">
              <div className="relative flex flex-1 items-end">
                <div
                  className={cn("w-full rounded-t-[4px] opacity-80 transition group-hover:opacity-100", color)}
                  style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 2 : 0 }}
                />
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-surface-2 px-2 py-1 text-xs shadow-lg group-hover:block">
                  {d.tooltip}
                </div>
              </div>
              <div className="h-6 truncate pt-1.5 text-center text-[11px] text-muted">{d.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type Segment = { label: string; value: number; color: string };

/** Medidor semicircular (situação das suítes). */
export function Gauge({ segments }: { segments: Segment[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = 80;
  const cx = 100;
  const cy = 95;
  const gap = 0.012; // ~2px de respiro entre fatias
  let acc = 0;
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const a0 = Math.PI * (1 - acc / total) - (acc > 0 ? gap : 0);
      acc += s.value;
      const a1 = Math.PI * (1 - acc / total) + (acc < total ? gap : 0);
      const p = (a: number) => `${cx + r * Math.cos(a)} ${cy - r * Math.sin(a)}`;
      const large = a0 - a1 > Math.PI ? 1 : 0;
      return { ...s, d: `M ${p(a0)} A ${r} ${r} 0 ${large} 1 ${p(a1)}` };
    });
  return (
    <svg viewBox="0 0 200 105" className="mx-auto w-full max-w-sm" role="img" aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(", ")}>
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="var(--color-surface-2)" strokeWidth="26" />
      {arcs.map((a) => (
        <path key={a.label} d={a.d} fill="none" stroke={a.color} strokeWidth="26">
          <title>{`${a.label}: ${a.value}`}</title>
        </path>
      ))}
    </svg>
  );
}
