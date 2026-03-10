import type { Env } from "./types";
import {
  getLastNChecks,
  getOpenIncident,
  getHistory,
  getStats,
  getRecentIncidents,
} from "./db";

export async function handleApiRequest(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/api/status") {
    return handleStatus(env);
  }

  if (path === "/api/history") {
    const period = url.searchParams.get("period") || "24h";
    if (!["24h", "7d", "30d"].includes(period)) {
      return json({ error: "Invalid period. Use: 24h, 7d, 30d" }, 400);
    }
    return handleHistory(env, period);
  }

  if (path === "/api/stats") {
    return handleStats(env);
  }

  if (path === "/api/incidents") {
    return handleIncidents(env);
  }

  if (path === "/") {
    return json({
      name: "sigaa-caiu-api",
      endpoints: ["/api/status", "/api/history", "/api/stats", "/api/incidents"],
    });
  }

  return json({ error: "Not found" }, 404);
}

async function handleStatus(env: Env): Promise<Response> {
  const lastChecks = await getLastNChecks(env.DB, 5);
  const openIncident = await getOpenIncident(env.DB);

  if (lastChecks.length === 0) {
    return json({
      status: "unknown",
      confirmed: false,
      lastCheck: null,
      consecutiveFailures: 0,
      currentIncident: openIncident,
    });
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
  const confirmed =
    latestStatus !== "offline" || consecutiveFailures >= 2;

  return json({
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
  });
}

async function handleHistory(env: Env, period: string): Promise<Response> {
  const checks = await getHistory(env.DB, period);
  return json({ period, checks });
}

async function handleStats(env: Env): Promise<Response> {
  const stats = await getStats(env.DB);
  return json({ periods: stats });
}

async function handleIncidents(env: Env): Promise<Response> {
  const incidents = await getRecentIncidents(env.DB);
  return json({ incidents });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
