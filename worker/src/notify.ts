import type { CheckResult, CheckRow, Env } from "./types";
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
        `Tempo de resposta: ${result.responseTimeMs}ms\n\n` +
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
          `Tempo de resposta: ${result.responseTimeMs}ms\n\n` +
          `[Ver status](https://sigaacaiu.com)`
      );
    }
    // If no open incident, it was just a single flap — ignore
  }
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
