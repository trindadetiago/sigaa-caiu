import type { CheckResult, Status } from "./types";

const SIGAA_URL = "https://sigaa.ufpb.br/sigaa/verTelaLogin.do";
const TIMEOUT_MS = 30_000;
const THRESHOLD_DEGRADED_MS = 10_000;
const RETRY_DELAY_MS = 3_000;
const MAX_RETRIES = 2;

export async function performHealthCheck(): Promise<CheckResult> {
  const result = await singleCheck();

  // If first check fails, retry up to MAX_RETRIES times
  // This catches transient network blips within the same cron execution
  if (result.status === "offline") {
    for (let i = 0; i < MAX_RETRIES; i++) {
      await sleep(RETRY_DELAY_MS);
      const retry = await singleCheck();

      if (retry.status !== "offline") {
        // It responded — use the retry result, not the failed one
        return retry;
      }
    }
  }

  return result;
}

async function singleCheck(): Promise<CheckResult> {
  const start = Date.now();

  try {
    const res = await fetch(SIGAA_URL, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "User-Agent": "sigaa-caiu-monitor/1.0",
      },
    });

    const responseTimeMs = Date.now() - start;
    const status = determineStatus(res.status, responseTimeMs);

    return {
      status,
      httpCode: res.status,
      responseTimeMs,
      error: null,
    };
  } catch (err) {
    const responseTimeMs = Date.now() - start;
    const message =
      err instanceof Error ? err.message : "Unknown error";

    return {
      status: "offline",
      httpCode: null,
      responseTimeMs,
      error: message,
    };
  }
}

function determineStatus(httpCode: number, responseTimeMs: number): Status {
  const isExpectedResponse = httpCode === 302 || httpCode === 200;

  if (!isExpectedResponse || httpCode >= 500) {
    return "offline";
  }

  if (responseTimeMs >= THRESHOLD_DEGRADED_MS) {
    return "degraded";
  }

  return "online";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
