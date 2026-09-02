import type { Env } from "./types";
import { performHealthCheck } from "./health";
import { saveCheck, getLastNChecks, manageIncidents, cleanupOldChecks } from "./db";
import { notifyIfNeeded } from "./notify";
import { handleApiRequest } from "./api";
import { refreshSnapshots } from "./snapshots";
import { withCors, handlePreflight } from "./cors";

// The payloads only change when the cron writes a new check (every 3 min), so a
// short edge TTL is safe and collapses every visitor in a colo onto one origin
// hit. The same header lets browsers skip the request entirely -- which matters
// because the frontend re-polls every 60s for as long as a tab stays open.
const API_CACHE_SECONDS = 60;
const DOCS_CACHE_SECONDS = 3600;

export default {
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    const now = new Date();
    const minute = now.getUTCMinutes();

    // Cron fires every minute. Normal cadence = every 3 min.
    // But if the last check was offline (unconfirmed), run every minute
    // so we can confirm or dismiss faster.
    if (minute % 3 !== 0) {
      const lastChecks = await getLastNChecks(env.DB, 1);
      const lastWasOffline =
        lastChecks.length > 0 && lastChecks[0].status === "offline";
      if (!lastWasOffline) return; // healthy — skip this tick
    }

    const result = await performHealthCheck(env, true);
    const lastChecks = await getLastNChecks(env.DB, 2);

    await saveCheck(env.DB, result);
    await manageIncidents(env.DB, result, lastChecks);
    ctx.waitUntil(notifyIfNeeded(env, result, lastChecks));

    // Rebuild the precomputed API payloads. This is where the expensive window
    // scans live now -- a few times a day instead of once per request. Never let
    // it fail the tick: the check itself is already durably saved above.
    try {
      await refreshSnapshots(env);
    } catch (err) {
      console.error("snapshot refresh failed", err);
    }

    // Cleanup old data once per day
    if (now.getUTCHours() === 3 && minute < 5) {
      ctx.waitUntil(cleanupOldChecks(env.DB));
    }
  },

  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const origin = "*";

    if (request.method === "OPTIONS") {
      return handlePreflight(origin);
    }

    if (request.method !== "GET") {
      return withCors(
        new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: { "Content-Type": "application/json" },
        }),
        origin
      );
    }

    const cache = caches.default;
    const hit = await cache.match(request);
    if (hit) return hit;

    const response = withCors(await handleApiRequest(request, env), origin);

    // Only cache successes: an error must not be pinned at the edge for a
    // minute, and a 404 is cheap to recompute anyway.
    if (response.status === 200) {
      const maxAge =
        new URL(request.url).pathname === "/"
          ? DOCS_CACHE_SECONDS
          : API_CACHE_SECONDS;
      const cacheable = new Response(response.body, response);
      cacheable.headers.set("Cache-Control", `public, max-age=${maxAge}`);
      // Body can only be consumed once; hand the clone to the cache.
      ctx.waitUntil(cache.put(request, cacheable.clone()));
      return cacheable;
    }

    return response;
  },
};
