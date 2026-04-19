export type Status = "online" | "degraded" | "offline";

// Per-layer status; "skipped" means the layer wasn't run this tick (e.g. e2e gating, missing creds).
export type LayerStatus = Status | "skipped";

export interface ReachabilityResult {
  status: LayerStatus;
  httpCode: number | null;
  responseTimeMs: number;
  error: string | null;
}

export interface LayerResult {
  status: LayerStatus;
  error: string | null;
}

export interface CheckResult {
  // Derived overall for this tick.
  status: Status;
  // Mirror of reachability for backwards compat with existing queries.
  httpCode: number | null;
  responseTimeMs: number;
  error: string | null;
  // Per-layer detail.
  reachability: ReachabilityResult;
  portal: LayerResult;
  loginForm: LayerResult;
  loginE2e: LayerResult;
}

export interface CheckRow {
  id: number;
  timestamp: string;
  status: Status;
  http_code: number | null;
  response_time_ms: number;
  error: string | null;
  reachability_status: LayerStatus | null;
  reachability_http: number | null;
  reachability_ms: number | null;
  reachability_error: string | null;
  portal_status: LayerStatus | null;
  portal_error: string | null;
  login_form_status: LayerStatus | null;
  login_form_error: string | null;
  login_e2e_status: LayerStatus | null;
  login_e2e_error: string | null;
}

export interface IncidentRow {
  id: number;
  started_at: string;
  ended_at: string | null;
  duration_s: number | null;
}

export interface LastKnownLayer {
  status: LayerStatus;
  error: string | null;
  timestamp: string;
}

export interface LastKnownLayers {
  reachability: (LastKnownLayer & { httpCode: number | null; responseTimeMs: number | null }) | null;
  portal: LastKnownLayer | null;
  loginForm: LastKnownLayer | null;
  loginE2e: LastKnownLayer | null;
}

export interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  SIGAA_MONITOR_USER?: string;
  SIGAA_MONITOR_PASS?: string;
}
