import type { Env, IncidentRow, CheckRow } from "./types";
import {
  getHistory,
  getLastKnownLayers,
  getLastNChecks,
  getOpenIncident,
  getRecentIncidents,
  getSnapshotAges,
  getStatsForPeriod,
  writeSnapshot,
} from "./db";

export const PERIODS = ["24h", "7d", "30d", "90d"] as const;
export type Period = (typeof PERIODS)[number];

export const SNAPSHOT_STATUS = "status";
export const SNAPSHOT_INCIDENTS = "incidents";
export const historyKey = (p: string) => `history:${p}`;
export const statsKey = (p: string) => `stats:${p}`;

// How stale each period's snapshots may get before the cron rebuilds them.
// Scanning a window costs roughly one row per check in it (~480/day), so the
// long windows are the expensive ones and are refreshed rarely. Each interval
// is on the order of that chart's own bucket size, so the staleness is never
// visible: the 90d view buckets into 3h, and refreshes every 6h.
const REFRESH_MS: Record<Period, number> = {
  "24h": 10 * 60 * 1000,
  "7d": 30 * 60 * 1000,
  "30d": 2 * 60 * 60 * 1000,
  "90d": 6 * 60 * 60 * 1000,
};

export interface StatusPayload {
  status: string;
  confirmed: boolean;
  lastCheck: {
    timestamp: string;
    status: string;
    httpCode: number | null;
    responseTimeMs: number;
  } | null;
  consecutiveFailures: number;
  currentIncident: IncidentRow | null;
  layers?: unknown;
}

// Shared by the cron and by the API's cold-start fallback so the payload can
// only ever be built one way.
export function buildStatusPayload(
  lastChecks: CheckRow[],
  openIncident: IncidentRow | null,
  layers: unknown
): StatusPayload {
  if (lastChecks.length === 0) {
    return {
      status: "unknown",
      confirmed: false,
      lastCheck: null,
      consecutiveFailures: 0,
      currentIncident: openIncident,
    };
  }

  // Count consecutive offline checks from the most recent
  let consecutiveFailures = 0;
  for (const check of lastChecks) {
    if (check.status === "offline") {
      consecutiveFailures++;
    } else {
      break;
    }
  }

  const latestStatus = lastChecks[0].status;
  // Status is "confirmed" if online/degraded, or if 2+ consecutive offline
  const confirmed = latestStatus !== "offline" || consecutiveFailures >= 2;

  return {
    status: latestStatus,
    confirmed,
    lastCheck: {
      timestamp: lastChecks[0].timestamp,
      status: lastChecks[0].status,
      httpCode: lastChecks[0].http_code,
      responseTimeMs: lastChecks[0].response_time_ms,
    },
    consecutiveFailures,
    currentIncident: openIncident,
    layers,
  };
}

export async function computeStatusPayload(
  db: D1Database
): Promise<StatusPayload> {
  const lastChecks = await getLastNChecks(db, 5);
  const openIncident = await getOpenIncident(db);
  const layers = await getLastKnownLayers(db);
  return buildStatusPayload(lastChecks, openIncident, layers);
}

// Cheap: bounded by LIMIT, and the layer probes are index-backed.
async function refreshLive(db: D1Database): Promise<void> {
  const status = await computeStatusPayload(db);
  await writeSnapshot(db, SNAPSHOT_STATUS, status);

  const incidents = await getRecentIncidents(db);
  await writeSnapshot(db, SNAPSHOT_INCIDENTS, { incidents });
}

// Expensive: scans every check in the window. Only ever called from the cron.
async function refreshPeriod(db: D1Database, period: Period): Promise<void> {
  const checks = await getHistory(db, period);
  await writeSnapshot(db, historyKey(period), { period, checks });

  const stats = await getStatsForPeriod(db, period);
  await writeSnapshot(db, statsKey(period), stats);
}

/**
 * Rebuild whatever is due. Called on every cron tick.
 *
 * status/incidents refresh every tick; the windowed payloads refresh on the
 * staggered schedule above. A missing snapshot is always rebuilt, so a fresh
 * database (or a new fork) seeds itself on the first tick.
 */
export async function refreshSnapshots(env: Env): Promise<void> {
  const db = env.DB;

  await refreshLive(db);

  const ages = await getSnapshotAges(db);
  const isDue = (key: string, maxAge: number) => {
    const age = ages.get(key);
    return age === undefined || age >= maxAge;
  };

  // At most one window per tick. Rebuilding all four at once costs ~250k rows,
  // which is a spike big enough to matter on a cold database; ticks are 3 min
  // apart and the shortest refresh interval is 10 min, so spreading them out
  // never makes a snapshot late. PERIODS is ordered cheapest-first, so a cold
  // start fills in the 24h view (the one on screen) before the long tails.
  for (const period of PERIODS) {
    const maxAge = REFRESH_MS[period];
    if (isDue(historyKey(period), maxAge) || isDue(statsKey(period), maxAge)) {
      await refreshPeriod(db, period);
      return;
    }
  }
}
