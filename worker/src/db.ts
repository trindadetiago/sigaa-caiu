import type { CheckResult, CheckRow, IncidentRow } from "./types";

// --- Write operations ---

export async function saveCheck(
  db: D1Database,
  result: CheckResult
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO checks (status, http_code, response_time_ms, error)
       VALUES (?, ?, ?, ?)`
    )
    .bind(result.status, result.httpCode, result.responseTimeMs, result.error)
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

  // For 7d and 30d, downsample by grouping into time buckets
  const bucketMinutes = period === "7d" ? 15 : 60;

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
         NULL as error
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
  const periods = ["24h", "7d", "30d"] as const;
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
    default:
      return "-24 hours";
  }
}
