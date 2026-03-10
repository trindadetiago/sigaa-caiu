# SIGAA Caiu?

Monitor em tempo real do [SIGAA da UFPB](https://sigaa.ufpb.br). Verifica automaticamente se o sistema esta no ar, lento ou fora do ar a cada 3 minutos.

**Site:** [sigaa-caiu.vercel.app](https://sigaa-caiu.vercel.app)

## Como funciona

Um [Cloudflare Worker](https://workers.cloudflare.com/) faz requisicoes periodicas ao SIGAA e salva o resultado num banco de dados. O frontend consome esses dados e exibe o status atual, historico e incidentes.

```
Cloudflare Worker (cron a cada 3 min)
  │
  ├── GET /sigaa/verTelaLogin.do
  │   └── 302 + JSESSIONID = backend vivo
  │
  ├── Determina status:
  │   ├── < 5s    → online
  │   ├── 5-15s   → degradado (lento)
  │   └── timeout/5xx → offline (confirma apos 2 falhas)
  │
  └── Salva no D1 (SQLite)

Frontend (Next.js no Vercel)
  └── Consome a API publica do Worker
```

## API Publica

Base URL: `https://sigaa-caiu-worker.sigaa-caiu.workers.dev`

A API e aberta — qualquer pessoa pode consumir, sem autenticacao.

### `GET /api/status`

Status atual do SIGAA.

```json
{
  "status": "online",
  "confirmed": true,
  "lastCheck": {
    "timestamp": "2026-03-10T12:00:00Z",
    "status": "online",
    "httpCode": 302,
    "responseTimeMs": 724
  },
  "consecutiveFailures": 0,
  "currentIncident": null
}
```

| Campo | Descricao |
|---|---|
| `status` | `online`, `degraded` ou `offline` |
| `confirmed` | `false` se houve apenas 1 falha (possivel flap de rede) |
| `consecutiveFailures` | Quantas falhas consecutivas ate agora |
| `currentIncident` | Incidente em andamento, se houver |

### `GET /api/history?period=24h|7d|30d`

Historico de checks. Para `7d` e `30d` os dados sao agregados (downsampled).

```json
{
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
}
```

### `GET /api/stats`

Uptime e tempo medio de resposta por periodo.

```json
{
  "periods": {
    "24h": { "uptimePercent": 99.5, "avgResponseMs": 800, "incidentCount": 1 },
    "7d":  { "uptimePercent": 98.2, "avgResponseMs": 900, "incidentCount": 3 },
    "30d": { "uptimePercent": 97.8, "avgResponseMs": 850, "incidentCount": 5 }
  }
}
```

### `GET /api/incidents`

Ultimos 10 incidentes (periodos de indisponibilidade).

```json
{
  "incidents": [
    {
      "id": 1,
      "started_at": "2026-03-09T14:00:00Z",
      "ended_at": "2026-03-09T14:12:00Z",
      "duration_s": 720
    }
  ]
}
```

## Estrutura

```
sigaa-caiu/
├── worker/    ← Cloudflare Worker (API + cron + D1)
├── web/       ← Next.js (frontend no Vercel)
└── README.md
```

Veja o README de cada modulo para instrucoes de desenvolvimento e deploy.

## Contribuindo

PRs sao bem-vindos! Se encontrar um bug ou tiver uma sugestao, abra uma [issue](https://github.com/trindadetiago/sigaa-caiu/issues).
