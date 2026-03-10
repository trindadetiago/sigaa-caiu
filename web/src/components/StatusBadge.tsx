"use client";

import type { StatusResponse } from "@/lib/types";
import { statusColor, statusLabel, formatMs, timeAgo } from "@/lib/utils";

interface Props {
  data: StatusResponse | null;
}

export function StatusBadge({ data }: Props) {
  const status = data?.status ?? "unknown";
  const color = statusColor(status);
  const label = statusLabel(status);

  const showWarning =
    data && status === "offline" && !data.confirmed;

  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="relative">
        <span
          className="absolute inset-0 rounded-full animate-ping opacity-30"
          style={{ backgroundColor: color }}
        />
        <span
          className="relative block w-20 h-20 rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>

      <h2 className="text-2xl font-bold" style={{ color }}>
        {label}
      </h2>

      {showWarning && (
        <p className="text-sm text-yellow-400">
          Possivel instabilidade — aguardando confirmacao
        </p>
      )}

      {data?.lastCheck && (
        <div className="flex gap-6 text-sm text-neutral-400">
          <span>
            Resposta: {formatMs(data.lastCheck.responseTimeMs)}
          </span>
          <span>
            Ultimo check: {timeAgo(data.lastCheck.timestamp)}
          </span>
        </div>
      )}

      {!data && (
        <p className="text-sm text-neutral-500">Carregando...</p>
      )}
    </div>
  );
}
