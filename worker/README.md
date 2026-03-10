# Worker

Backend do SIGAA Caiu — Cloudflare Worker com Cron Triggers e banco D1 (SQLite).

## Estrutura

```
src/
  index.ts    ← entry point (scheduled + fetch handlers)
  health.ts   ← health check do SIGAA (fetch + logica de status)
  db.ts       ← operacoes no D1 (salvar, consultar, incidentes)
  api.ts      ← rotas da API (/api/status, /history, /stats, /incidents)
  cors.ts     ← headers CORS
  types.ts    ← interfaces TypeScript
schema.sql    ← schema do banco D1
```

## Dev local

```bash
npm install

# Criar banco local
npx wrangler d1 execute sigaa-caiu-db --local --file=schema.sql

# Rodar
npx wrangler dev --port 8787 --test-scheduled

# Simular um health check (cron)
curl "http://localhost:8787/__scheduled?cron=*/3+*+*+*+*"

# Testar endpoints
curl http://localhost:8787/api/status
curl http://localhost:8787/api/history?period=24h
curl http://localhost:8787/api/stats
curl http://localhost:8787/api/incidents
```

## Setup inicial (primeira vez)

```bash
# Login no Cloudflare
npx wrangler login

# Criar banco D1
npx wrangler d1 create sigaa-caiu-db
# Copiar o database_id retornado pro wrangler.jsonc

# Aplicar schema no banco remoto
npx wrangler d1 execute sigaa-caiu-db --remote --file=schema.sql
```

## Deploy

```bash
npx wrangler deploy
```

## Schema D1

```sql
checks (id, timestamp, status, http_code, response_time_ms, error)
incidents (id, started_at, ended_at, duration_s)
```

Dados sao mantidos por 2 anos. Cleanup automatico roda diariamente via cron.
