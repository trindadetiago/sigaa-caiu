export type Status = "online" | "degraded" | "offline" | "unknown";

export interface Check {
  id: number;
  timestamp: string;
  status: Status;
  http_code: number | null;
  response_time_ms: number;
  error: string | null;
}

export interface Incident {
  id: number;
  started_at: string;
  ended_at: string | null;
  duration_s: number | null;
}

export type LayerStatus = "online" | "degraded" | "offline" | "skipped";

export interface LayerInfo {
  status: LayerStatus;
  error: string | null;
  timestamp: string;
  httpCode?: number | null;
  responseTimeMs?: number | null;
}

export interface Layers {
  reachability: LayerInfo | null;
  portal: LayerInfo | null;
  loginForm: LayerInfo | null;
  loginE2e: LayerInfo | null;
}

export interface StatusResponse {
  status: Status;
  confirmed: boolean;
  lastCheck: {
    timestamp: string;
    status: Status;
    httpCode: number | null;
    responseTimeMs: number;
  } | null;
  consecutiveFailures: number;
  currentIncident: Incident | null;
  layers?: Layers;
}

export interface HistoryResponse {
  period: string;
  checks: Check[];
}

export interface StatsResponse {
  periods: Record<
    string,
    {
      uptimePercent: number;
      avgResponseMs: number;
      incidentCount: number;
    }
  >;
}

export interface IncidentsResponse {
  incidents: Incident[];
}
