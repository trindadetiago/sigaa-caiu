"use client";

import type { StatsResponse } from "@/lib/types";
import { formatMs } from "@/lib/utils";

interface Props {
  data: StatsResponse | null;
}

const PERIOD_LABELS: Record<string, string> = {
  "24h": "24 horas",
  "7d": "7 dias",
  "30d": "30 dias",
};

function uptimeColor(pct: number): string {
  if (pct >= 99) return "text-green-400";
  if (pct >= 95) return "text-yellow-400";
  return "text-red-400";
}

export function UptimeStats({ data }: Props) {
  if (!data) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-neutral-900 rounded-lg p-4 animate-pulse h-24"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {Object.entries(data.periods).map(([period, stats]) => (
        <div
          key={period}
          className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 text-center"
        >
          <p className="text-xs text-neutral-500 uppercase mb-1">
            {PERIOD_LABELS[period] ?? period}
          </p>
          <p className={`text-2xl font-bold ${uptimeColor(stats.uptimePercent)}`}>
            {stats.uptimePercent}%
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            avg {formatMs(stats.avgResponseMs)}
          </p>
        </div>
      ))}
    </div>
  );
}
