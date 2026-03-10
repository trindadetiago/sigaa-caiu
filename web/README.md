# Web

Frontend do SIGAA Caiu — Next.js (App Router) com Tailwind CSS, deployado no Vercel.

## Estrutura

```
src/
  app/
    layout.tsx              ← layout raiz (metadata, fonts)
    page.tsx                ← pagina principal (hero + detalhes)
    globals.css             ← estilos globais
  components/
    HeroStatus.tsx          ← status principal com respostas aleatorias
    UptimeBars.tsx          ← barras de uptime estilo status page (90 dias)
    ResponseTimeChart.tsx   ← grafico de tempo de resposta (recharts)
    IncidentsList.tsx       ← lista de incidentes recentes
  lib/
    api.ts                  ← fetch wrappers para a API do Worker
    types.ts                ← tipos TypeScript
    utils.ts                ← formatadores (tempo, duracao, etc)
```

## Dev local

```bash
npm install

# Apontar pra API de producao
NEXT_PUBLIC_API_URL=https://sigaa-caiu-worker.sigaa-caiu.workers.dev npm run dev

# Ou apontar pro worker local
npm run dev
# (usa http://localhost:8787 como fallback)
```

O frontend roda em `http://localhost:3000`.

## Build

```bash
npm run build
```

## Deploy

O deploy e automatico via Vercel ao dar push no GitHub.

Configuracao no Vercel:
- **Root directory:** `web`
- **Environment variable:** `NEXT_PUBLIC_API_URL` = URL do worker
