# SIGAA Caiu?

Monitor de status do SIGAA da UFPB. Verifica se o sistema esta no ar a cada 3 minutos.

- **Worker** (Cloudflare Workers + D1): health check + API publica
- **Web** (Next.js + Vercel): dashboard de status

## Dev local

```bash
# Instalar dependencias
cd worker && npm install
cd ../web && npm install

# Rodar worker (backend)
cd worker
npx wrangler dev --port 8787 --test-scheduled

# Rodar frontend (outro terminal)
cd web
npm run dev

# Simular um health check manualmente
curl "http://localhost:8787/__scheduled?cron=*/3+*+*+*+*"
```

## Deploy

```bash
# Worker → Cloudflare
cd worker && npx wrangler deploy

# Frontend → push pro GitHub (Vercel faz deploy automatico)
git add -A && git commit -m "mensagem" && git push
```

## API

| Endpoint | Descricao |
|---|---|
| `GET /api/status` | Status atual do SIGAA |
| `GET /api/history?period=24h\|7d\|30d` | Historico de checks |
| `GET /api/stats` | Uptime % e tempo medio por periodo |
| `GET /api/incidents` | Ultimos 10 incidentes |

## Setup inicial (primeira vez)

```bash
# Login no Cloudflare
cd worker && npx wrangler login

# Criar banco D1
npx wrangler d1 create sigaa-caiu-db
# Copiar o database_id pro wrangler.jsonc

# Aplicar schema
npx wrangler d1 execute sigaa-caiu-db --remote --file=schema.sql

# Deploy
npx wrangler deploy
```

No Vercel: importar repo, root directory = `web`, env var `NEXT_PUBLIC_API_URL` = URL do worker.
