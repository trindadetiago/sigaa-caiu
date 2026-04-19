import type { CheckResult, CheckRow, Env, LayerStatus } from "./types";
import { getOpenIncident } from "./db";

export async function notifyIfNeeded(
  env: Env,
  result: CheckResult,
  lastChecks: CheckRow[]
): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;

  const previousWasOffline =
    lastChecks.length > 0 && lastChecks[0].status === "offline";
  const twoPreviousOffline =
    lastChecks.length >= 2 &&
    lastChecks[0].status === "offline" &&
    lastChecks[1].status === "offline";

  // Notify when SIGAA goes down (2nd consecutive failure = confirmed)
  if (result.status === "offline" && previousWasOffline && !twoPreviousOffline) {
    // Only notify on the 2nd failure (the moment it's confirmed)
    // Don't re-notify on 3rd, 4th, etc.
    await sendTelegram(
      env,
      "🔴 *SIGAA caiu!*\n\n" +
        `Erro: ${result.error || "HTTP " + result.httpCode}\n` +
        `Tempo de resposta: ${result.responseTimeMs}ms\n` +
        layerSummary(result) +
        "\n\n" +
        `[Ver status](https://sigaacaiu.com)`
    );
  }

  // Notify recovery only if there's an actual open incident
  if (result.status !== "offline" && previousWasOffline) {
    const openIncident = await getOpenIncident(env.DB);
    if (openIncident) {
      await sendTelegram(
        env,
        "🟢 *SIGAA voltou!*\n\n" +
          `Tempo de resposta: ${result.responseTimeMs}ms\n` +
          layerSummary(result) +
          "\n\n" +
          `[Ver status](https://sigaacaiu.com)`
      );
    }
    // If no open incident, it was just a single flap — ignore
  }
}

function layerSummary(result: CheckResult): string {
  const icon = (l: { status: LayerStatus }): string => {
    switch (l.status) {
      case "online":
        return "✓";
      case "degraded":
        return "~";
      case "offline":
        return "✗";
      default:
        return "·";
    }
  };
  const parts = [
    `reachability ${icon(result.reachability)}`,
    `portal ${icon(result.portal)}`,
    `login_form ${icon(result.loginForm)}`,
    `login_e2e ${icon(result.loginE2e)}`,
  ];
  // Append the failing layer's error for quick diagnosis.
  const failingLayer =
    result.reachability.status === "offline"
      ? result.reachability
      : result.portal.status === "offline"
        ? result.portal
        : result.loginForm.status === "offline"
          ? result.loginForm
          : result.loginE2e.status === "offline"
            ? result.loginE2e
            : null;
  const escapeMd = (s: string) => s.replace(/([_*`\[\]()])/g, "\\$1");
  const body = `_${parts.join(" · ")}_`;
  const suffix = failingLayer?.error ? ` (${escapeMd(failingLayer.error)})` : "";
  return body + suffix;
}

async function sendTelegram(env: Env, text: string): Promise<void> {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    }),
  });
}
