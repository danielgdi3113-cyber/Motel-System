"use client";

import { useNow } from "@/components/auto-refresh";
import { formatDuration } from "@/lib/time";

export function OrderTimer({ since }: { since: string }) {
  const now = useNow(new Date(since).getTime());
  const ms = now - new Date(since).getTime();
  return (
    <span className={`font-mono text-sm tabular-nums ${ms > 20 * 60_000 ? "text-rose-300" : "text-muted"}`}>
      {formatDuration(ms).slice(0, 5)}
    </span>
  );
}
