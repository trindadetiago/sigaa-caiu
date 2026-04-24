import type {
  CheckResult,
  CheckRow,
  IncidentRow,
  LastKnownLayers,
  LayerStatus,
} from "./types";

// --- Write operations ---

export async function saveCheck(
  db: D1Database,
  result: CheckResult
): Promise<void> {
  // Skipped layers persist as NULL so getLastKnownLayers only picks up ticks
  // where the layer actually ran.
  const skippedToNull = (s: LayerStatus): string | null =>
    s === "skipped" ? null : s;

  await db
    .prepare(
      `INSERT INTO checks (
         status, http_code, response_time_ms, error,
         reachability_status, reachability_http, reachability_ms, reachability_error,
         portal_status, portal_ms, portal_error,
         login_form_status, login_form_ms, login_form_error,
         login_e2e_status, login_e2e_ms, login_e2e_error
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      result.status,
      result.httpCode,
      result.responseTimeMs,
      result.error,
      skippedToNull(result.reachability.status),
      result.reachability.httpCode,
      result.reachability.responseTimeMs,
      result.reachability.error,
      skippedToNull(result.portal.status),
      result.portal.responseTimeMs || null,
      result.portal.error,
      skippedToNull(result.loginForm.status),
      result.loginForm.responseTimeMs || null,
      result.loginForm.error,
      skippedToNull(result.loginE2e.status),
      result.loginE2e.responseTimeMs || null,
      result.loginE2e.error
    )
    .run();
}

export async function manageIncidents(
  db: D1Database,
  result: CheckResult,
  lastChecks: CheckRow[]
): Promise<void> {
  const openIncident = await getOpenIncident(db);
  const previousWasOffline =
    lastChecks.length > 0 && lastChecks[0].status === "offline";

  if (result.status === "offline" && previousWasOffline && !openIncident) {
    // 2 consecutive failures: open a new incident
    // Use the previous check's timestamp as the start
    await db
      .prepare(`INSERT INTO incidents (started_at) VALUES (?)`)
      .bind(lastChecks[0].timestamp)
      .run();
  }

  if (result.status !== "offline" && openIncident) {
    // Recovered: close the incident
    const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const startedAt = new Date(openIncident.started_at).getTime();
    const durationS = Math.round((Date.now() - startedAt) / 1000);

    await db
      .prepare(
        `UPDATE incidents SET ended_at = ?, duration_s = ? WHERE id = ?`
      )
      .bind(now, durationS, openIncident.id)
      .run();
  }
}

export async function cleanupOldChecks(db: D1Database): Promise<void> {
  await db
    .prepare(`DELETE FROM checks WHERE timestamp < datetime('now', '-730 days')`)
    .run();
}

// --- Read operations ---

export async function getLastNChecks(
  db: D1Database,
  n: number
): Promise<CheckRow[]> {
  const result = await db
    .prepare(`SELECT * FROM checks ORDER BY timestamp DESC LIMIT ?`)
    .bind(n)
    .all<CheckRow>();
  return result.results;
}

export async function getOpenIncident(
  db: D1Database
): Promise<IncidentRow | null> {
  return db
    .prepare(`SELECT * FROM incidents WHERE ended_at IS NULL LIMIT 1`)
    .first<IncidentRow>();
}

export async function getHistory(
  db: D1Database,
  period: string
): Promise<CheckRow[]> {
  const interval = periodToInterval(period);

  if (period === "24h") {
    // Return all checks for 24h (max ~480 rows)
    const result = await db
      .prepare(
        `SELECT * FROM checks
         WHERE timestamp >= datetime('now', ?)
         ORDER BY timestamp ASC`
      )
      .bind(interval)
      .all<CheckRow>();
    return result.results;
  }

  // For 7d/30d/90d, downsample by grouping into time buckets
  const bucketMinutes = period === "7d" ? 15 : period === "30d" ? 60 : 180;

  const result = await db
    .prepare(
      `SELECT
         id,
         MIN(timestamp) as timestamp,
         CASE
           WHEN SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) > 0 THEN 'offline'
           WHEN SUM(CASE WHEN status = 'degraded' THEN 1 ELSE 0 END) > 0 THEN 'degraded'
           ELSE 'online'
         END as status,
         ROUND(AVG(http_code)) as http_code,
         ROUND(AVG(response_time_ms)) as response_time_ms,
         NULL as error,
         NULL as reachability_status,
         ROUND(AVG(reachability_http)) as reachability_http,
         ROUND(AVG(reachability_ms)) as reachability_ms,
         NULL as reachability_error,
         NULL as portal_status,
         ROUND(AVG(portal_ms)) as portal_ms,
         NULL as portal_error,
         NULL as login_form_status,
         ROUND(AVG(login_form_ms)) as login_form_ms,
         NULL as login_form_error,
         NULL as login_e2e_status,
         ROUND(AVG(login_e2e_ms)) as login_e2e_ms,
         NULL as login_e2e_error
       FROM checks
       WHERE timestamp >= datetime('now', ?)
       GROUP BY strftime('%Y-%m-%dT%H:', timestamp) ||
         printf('%02d', (CAST(strftime('%M', timestamp) AS INTEGER) / ${bucketMinutes}) * ${bucketMinutes})
       ORDER BY timestamp ASC`
    )
    .bind(interval)
    .all<CheckRow>();
  return result.results;
}

export async function getStats(
  db: D1Database
): Promise<Record<string, { uptimePercent: number; avgResponseMs: number; incidentCount: number }>> {
  const periods = ["24h", "7d", "30d", "90d"] as const;
  const stats: Record<string, { uptimePercent: number; avgResponseMs: number; incidentCount: number }> = {};

  for (const period of periods) {
    const interval = periodToInterval(period);

    const checksResult = await db
      .prepare(
        `SELECT
           ROUND(100.0 * SUM(CASE WHEN status != 'offline' THEN 1 ELSE 0 END) / MAX(COUNT(*), 1), 2) AS uptime_pct,
           ROUND(AVG(response_time_ms)) AS avg_ms
         FROM checks
         WHERE timestamp >= datetime('now', ?)`
      )
      .bind(interval)
      .first<{ uptime_pct: number; avg_ms: number }>();

    const incidentResult = await db
      .prepare(
        `SELECT COUNT(*) as count FROM incidents
         WHERE started_at >= datetime('now', ?)`
      )
      .bind(interval)
      .first<{ count: number }>();

    stats[period] = {
      uptimePercent: checksResult?.uptime_pct ?? 100,
      avgResponseMs: checksResult?.avg_ms ?? 0,
      incidentCount: incidentResult?.count ?? 0,
    };
  }

  return stats;
}

export async function getLastKnownLayers(
  db: D1Database
): Promise<LastKnownLayers> {
  // Most recent non-null value for each layer, independent of the others.
  // One round-trip query per layer keeps the SQL simple; SQLite is local.
  const latest = async <T>(selectCols: string, whereNonNull: string): Promise<T | null> =>
    db
      .prepare(
        `SELECT ${selectCols}, timestamp FROM checks
         WHERE ${whereNonNull} IS NOT NULL
         ORDER BY timestamp DESC LIMIT 1`
      )
      .first<T>();

  const reachability = await latest<{
    reachability_status: LayerStatus;
    reachability_http: number | null;
    reachability_ms: number | null;
    reachability_error: string | null;
    timestamp: string;
  }>(
    "reachability_status, reachability_http, reachability_ms, reachability_error",
    "reachability_status"
  );

  const portal = await latest<{
    portal_status: LayerStatus;
    portal_ms: number | null;
    portal_error: string | null;
    timestamp: string;
  }>("portal_status, portal_ms, portal_error", "portal_status");

  const loginForm = await latest<{
    login_form_status: LayerStatus;
    login_form_ms: number | null;
    login_form_error: string | null;
    timestamp: string;
  }>("login_form_status, login_form_ms, login_form_error", "login_form_status");

  const loginE2e = await latest<{
    login_e2e_status: LayerStatus;
    login_e2e_ms: number | null;
    login_e2e_error: string | null;
    timestamp: string;
  }>("login_e2e_status, login_e2e_ms, login_e2e_error", "login_e2e_status");

  return {
    reachability: reachability
      ? {
          status: reachability.reachability_status,
          error: reachability.reachability_error,
          timestamp: reachability.timestamp,
          httpCode: reachability.reachability_http,
          responseTimeMs: reachability.reachability_ms,
        }
      : null,
    portal: portal
      ? {
          status: portal.portal_status,
          error: portal.portal_error,
          timestamp: portal.timestamp,
          responseTimeMs: portal.portal_ms,
        }
      : null,
    loginForm: loginForm
      ? {
          status: loginForm.login_form_status,
          error: loginForm.login_form_error,
          timestamp: loginForm.timestamp,
          responseTimeMs: loginForm.login_form_ms,
        }
      : null,
    loginE2e: loginE2e
      ? {
          status: loginE2e.login_e2e_status,
          error: loginE2e.login_e2e_error,
          timestamp: loginE2e.timestamp,
          responseTimeMs: loginE2e.login_e2e_ms,
        }
      : null,
  };
}

export async function getRecentIncidents(
  db: D1Database
): Promise<IncidentRow[]> {
  const result = await db
    .prepare(
      `SELECT * FROM incidents ORDER BY started_at DESC LIMIT 10`
    )
    .all<IncidentRow>();
  return result.results;
}

// --- Helpers ---

function periodToInterval(period: string): string {
  switch (period) {
    case "7d":
      return "-7 days";
    case "30d":
      return "-30 days";
    case "90d":
      return "-90 days";
    default:
      return "-24 hours";
  }
}
