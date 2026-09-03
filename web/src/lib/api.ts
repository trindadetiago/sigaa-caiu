import type {
  StatusResponse,
  HistoryResponse,
  StatsResponse,
  IncidentsResponse,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

async function fetchApi<T>(path: string): Promise<T> {
  // The API is edge-cached for 60s, but the zone rewrites Cache-Control to a
  // 4h browser TTL on a cache hit — which would freeze a "is it down right
  // now?" page for four hours. no-store skips the browser's own cache without
  // skipping Cloudflare's: these requests still hit the edge, so polling costs
  // the origin (and the database) nothing.
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

export function fetchStatus(): Promise<StatusResponse> {
  return fetchApi("/api/status");
}

export function fetchHistory(
  period: "24h" | "7d" | "30d" | "90d"
): Promise<HistoryResponse> {
  return fetchApi(`/api/history?period=${period}`);
}

export function fetchStats(): Promise<StatsResponse> {
  return fetchApi("/api/stats");
}

export function fetchIncidents(): Promise<IncidentsResponse> {
  return fetchApi("/api/incidents");
}
