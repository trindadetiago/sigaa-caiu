"use client";

import type { HistoryResponse, StatsResponse, Check } from "@/lib/types";

interface Props {
  history: HistoryResponse | null;
  stats: StatsResponse | null;
}

function groupChecksByDay(checks: Check[]): Map<string, Check[]> {
  const days = new Map<string, Check[]>();
  for (const check of checks) {
    const day = check.timestamp.slice(0, 10); // YYYY-MM-DD
    if (!days.has(day)) days.set(day, []);
    days.get(day)!.push(check);
  }
  return days;
}

function dayStatus(checks: Check[]): "online" | "degraded" | "offline" {
  const hasOffline = checks.some((c) => c.status === "offline");
  const hasDegraded = checks.some((c) => c.status === "degraded");
  if (hasOffline) return "offline";
  if (hasDegraded) return "degraded";
  return "online";
}

const BAR_COLORS = {
  online: "bg-green-500",
  degraded: "bg-yellow-500",
  offline: "bg-red-500",
  empty: "bg-neutral-200",
};

export function UptimeBars({ history, stats }: Props) {
  // Build 90 days of bars (most status pages show ~90 days)
  const days: { date: string; status: "online" | "degraded" | "offline" | "empty" }[] = [];
  const checksMap = history ? groupChecksByDay(history.checks) : new Map();

  for (let i = 89; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayChecks = checksMap.get(dateStr);

    if (dayChecks && dayChecks.length > 0) {
      days.push({ date: dateStr, status: dayStatus(dayChecks) });
    } else {
      days.push({ date: dateStr, status: "empty" });
    }
  }

  const uptime24h = stats?.periods["24h"]?.uptimePercent;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-neutral-700">
          Historico de status
        </h3>
        {uptime24h !== undefined && (
          <span className="text-sm text-neutral-500">
            {uptime24h}% uptime (24h)
          </span>
        )}
      </div>

      {/* Barras */}
      <div className="flex gap-[2px]">
        {days.map((day, i) => (
          <div
            key={i}
            className={`flex-1 h-8 rounded-sm ${BAR_COLORS[day.status]} transition-all hover:opacity-80`}
            title={`${day.date}: ${day.status === "empty" ? "sem dados" : day.status}`}
          />
        ))}
      </div>

      <div className="flex justify-between mt-2 text-xs text-neutral-600">
        <span>90 dias atras</span>
        <span>Hoje</span>
      </div>

      {/* Legenda */}
      <div className="flex gap-4 mt-3 text-xs text-neutral-500 justify-center">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" /> Online
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-500" /> Lento
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500" /> Offline
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-neutral-200" /> Sem dados
        </span>
      </div>
    </div>
  );
}
