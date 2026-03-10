import type { CheckResult, Status } from "./types";

const SIGAA_URL = "https://sigaa.ufpb.br/sigaa/verTelaLogin.do";
const TIMEOUT_MS = 30_000;
const THRESHOLD_DEGRADED_MS = 10_000;

export async function performHealthCheck(): Promise<CheckResult> {
  const start = Date.now();

  try {
    const res = await fetch(SIGAA_URL, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "User-Agent": "sigaa-caiu-monitor/1.0",
      },
      cf: {
        // Forçar que a request saia do datacenter de São Paulo (GRU)
        location: { hint: "GRU" },
      },
    } as RequestInit);

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
    const isTimeout = message.includes("timed out") || message.includes("TimeoutError");

    return {
      // Timeout = provavelmente offline, mas erros de rede podem ser flap
      status: isTimeout ? "offline" : "degraded",
      httpCode: null,
      responseTimeMs,
      error: message,
    };
  }
}

function determineStatus(httpCode: number, responseTimeMs: number): Status {
  // 302 is the expected response from verTelaLogin.do when SIGAA is up
  const isExpectedResponse = httpCode === 302 || httpCode === 200;

  if (!isExpectedResponse || httpCode >= 500) {
    return "offline";
  }

  // SIGAA is naturally slow — only flag degraded at 10s+
  if (responseTimeMs >= THRESHOLD_DEGRADED_MS) {
    return "degraded";
  }

  return "online";
}
