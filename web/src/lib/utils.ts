import type { Status } from "./types";

export function timeAgo(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffS = Math.floor((now - then) / 1000);

  if (diffS < 60) return `${diffS}s atras`;
  if (diffS < 3600) return `${Math.floor(diffS / 60)}min atras`;
  if (diffS < 86400) return `${Math.floor(diffS / 3600)}h atras`;
  return `${Math.floor(diffS / 86400)}d atras`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function statusColor(status: Status): string {
  switch (status) {
    case "online":
      return "#22c55e";
    case "degraded":
      return "#eab308";
    case "offline":
      return "#ef4444";
    default:
      return "#6b7280";
  }
}

export function statusLabel(status: Status): string {
  switch (status) {
    case "online":
      return "SIGAA esta no ar";
    case "degraded":
      return "SIGAA esta lento";
    case "offline":
      return "SIGAA esta fora do ar";
    default:
      return "Verificando...";
  }
}

export function formatDateTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}
