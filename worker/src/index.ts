import type { Env } from "./types";
import { performHealthCheck } from "./health";
import { saveCheck, getLastNChecks, manageIncidents, cleanupOldChecks } from "./db";
import { notifyIfNeeded } from "./notify";
import { handleApiRequest } from "./api";
import { withCors, handlePreflight } from "./cors";

export default {
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    const result = await performHealthCheck(env, true);
    const lastChecks = await getLastNChecks(env.DB, 2);

    await saveCheck(env.DB, result);
    await manageIncidents(env.DB, result, lastChecks);
    ctx.waitUntil(notifyIfNeeded(env, result, lastChecks));

    // Cleanup old data once per day (when minute is 0 on the first cron of the hour)
    const now = new Date();
    if (now.getUTCHours() === 3 && now.getUTCMinutes() < 5) {
      ctx.waitUntil(cleanupOldChecks(env.DB));
    }
  },

  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext
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

    const response = await handleApiRequest(request, env);
    return withCors(response, origin);
  },
};
