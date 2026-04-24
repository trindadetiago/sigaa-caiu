import type { Env } from "./types";
import {
  getLastNChecks,
  getOpenIncident,
  getHistory,
  getStats,
  getRecentIncidents,
  getLastKnownLayers,
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
    if (!["24h", "7d", "30d", "90d"].includes(period)) {
      return json({ error: "Invalid period. Use: 24h, 7d, 30d, 90d" }, 400);
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
    return new Response(DOCS_HTML, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
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

  const layers = await getLastKnownLayers(env.DB);

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
    layers,
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

const DOCS_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SIGAA Caiu? — API</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, sans-serif; background: #fafafa; color: #171717; line-height: 1.6; padding: 2rem; max-width: 720px; margin: 0 auto; }
  h1 { font-size: 2rem; margin-bottom: 0.25rem; }
  .sub { color: #737373; margin-bottom: 2rem; }
  .sub a { color: #737373; }
  h2 { font-size: 1.1rem; margin-top: 2rem; margin-bottom: 0.5rem; padding-top: 1rem; border-top: 1px solid #e5e5e5; }
  h2:first-of-type { border-top: none; padding-top: 0; }
  code { background: #f0f0f0; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.9rem; }
  pre { background: #1a1a1a; color: #e5e5e5; padding: 1rem; border-radius: 8px; overflow-x: auto; margin: 0.75rem 0; font-size: 0.85rem; line-height: 1.5; }
  pre code { background: none; padding: 0; }
  .endpoint { margin-bottom: 1.5rem; }
  .method { color: #22c55e; font-weight: bold; }
  p { margin: 0.5rem 0; }
  table { width: 100%; border-collapse: collapse; margin: 0.75rem 0; font-size: 0.9rem; }
  th, td { text-align: left; padding: 0.4rem 0.75rem; border-bottom: 1px solid #e5e5e5; }
  th { font-weight: 600; color: #525252; }
  footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #e5e5e5; color: #a3a3a3; font-size: 0.8rem; }
  footer a { color: #a3a3a3; }
</style>
</head>
<body>
<h1>SIGAA Caiu? API</h1>
<p class="sub">API publica do monitor de status do SIGAA da UFPB. Sem autenticacao.<br><a href="https://sigaacaiu.com">sigaacaiu.com</a> · <a href="https://github.com/trindadetiago/sigaa-caiu">GitHub</a></p>

<h2><span class="method">GET</span> <code>/api/status</code></h2>
<div class="endpoint">
<p>Status atual do SIGAA com detalhamento por camada de verificacao.</p>
<pre><code>{
  "status": "online",
  "confirmed": true,
  "lastCheck": {
    "timestamp": "2026-03-10T12:00:00Z",
    "status": "online",
    "httpCode": 302,
    "responseTimeMs": 724
  },
  "consecutiveFailures": 0,
  "currentIncident": null,
  "layers": {
    "reachability": { "status": "online", "error": null, "timestamp": "...", "httpCode": 302, "responseTimeMs": 479 },
    "portal":       { "status": "online", "error": null, "timestamp": "..." },
    "loginForm":    { "status": "online", "error": null, "timestamp": "..." },
    "loginE2e":     { "status": "online", "error": null, "timestamp": "..." }
  }
}</code></pre>
<table>
<tr><th>Campo</th><th>Descricao</th></tr>
<tr><td><code>status</code></td><td><code>online</code>, <code>degraded</code> ou <code>offline</code> (derivado das camadas)</td></tr>
<tr><td><code>confirmed</code></td><td><code>false</code> se houve apenas 1 falha (possivel instabilidade de rede)</td></tr>
<tr><td><code>consecutiveFailures</code></td><td>Numero de falhas consecutivas</td></tr>
<tr><td><code>currentIncident</code></td><td>Incidente em andamento, se houver</td></tr>
<tr><td><code>layers</code></td><td>Status individual de cada camada de verificacao (ver abaixo)</td></tr>
</table>
<p style="margin-top:1rem"><strong>Camadas de verificacao:</strong></p>
<table>
<tr><th>Camada</th><th>O que verifica</th></tr>
<tr><td><code>reachability</code></td><td>Servidor acessivel (GET verTelaLogin.do, espera 302)</td></tr>
<tr><td><code>portal</code></td><td>Portal publico carrega (SPA /publico/ com bundle JS)</td></tr>
<tr><td><code>loginForm</code></td><td>Tela de login renderiza (JSF com ViewState e campos de login)</td></tr>
<tr><td><code>loginE2e</code></td><td>Login completo funciona (POST com credenciais reais)</td></tr>
</table>
</div>

<h2><span class="method">GET</span> <code>/api/history?period=24h|7d|30d</code></h2>
<div class="endpoint">
<p>Historico de checks. Dados agregados para 7d e 30d.</p>
<pre><code>{
  "period": "24h",
  "checks": [
    {
      "id": 1,
      "timestamp": "2026-03-10T12:00:00Z",
      "status": "online",
      "http_code": 302,
      "response_time_ms": 724,
      "error": null
    }
  ]
}</code></pre>
</div>

<h2><span class="method">GET</span> <code>/api/stats</code></h2>
<div class="endpoint">
<p>Uptime e tempo medio de resposta por periodo.</p>
<pre><code>{
  "periods": {
    "24h": { "uptimePercent": 99.5, "avgResponseMs": 800, "incidentCount": 1 },
    "7d":  { "uptimePercent": 98.2, "avgResponseMs": 900, "incidentCount": 3 },
    "30d": { "uptimePercent": 97.8, "avgResponseMs": 850, "incidentCount": 5 }
  }
}</code></pre>
</div>

<h2><span class="method">GET</span> <code>/api/incidents</code></h2>
<div class="endpoint">
<p>Ultimos 10 incidentes.</p>
<pre><code>{
  "incidents": [
    {
      "id": 1,
      "started_at": "2026-03-09T14:00:00Z",
      "ended_at": "2026-03-09T14:12:00Z",
      "duration_s": 720
    }
  ]
}</code></pre>
</div>

<footer>
  Verifica o SIGAA a cada 3 minutos com 4 camadas de verificacao · <a href="https://github.com/trindadetiago/sigaa-caiu">GitHub</a>
</footer>
</body>
</html>`;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
