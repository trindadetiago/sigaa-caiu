export type Status = "online" | "degraded" | "offline";

export interface CheckResult {
  status: Status;
  httpCode: number | null;
  responseTimeMs: number;
  error: string | null;
}

export interface CheckRow {
  id: number;
  timestamp: string;
  status: Status;
  http_code: number | null;
  response_time_ms: number;
  error: string | null;
}

export interface IncidentRow {
  id: number;
  started_at: string;
  ended_at: string | null;
  duration_s: number | null;
}

export interface Env {
  DB: D1Database;
  ALLOWED_ORIGIN: string;
}
