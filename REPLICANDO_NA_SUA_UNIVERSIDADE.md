# Replicando na sua universidade

Este projeto foi feito pra UFPB, mas ele e generico o suficiente pra rodar em qualquer
universidade que use SIGAA (ou qualquer outro sistema academico, na real). Ja existem
instancias rodando pra **UFG** e **UNB**, feitas exatamente pelos passos abaixo.

O custo e **zero**: Cloudflare Workers + D1 e Vercel tem planos gratuitos que aguentam
esse projeto com folga (1 check a cada 3 minutos = ~14 mil requisicoes/mes).

Tempo estimado: **30 a 60 minutos**, sendo que a maior parte e descobrir as URLs certas
do SIGAA da sua universidade.

---

## Indice

1. [O que voce vai precisar](#1-o-que-voce-vai-precisar)
2. [Entendendo a arquitetura](#2-entendendo-a-arquitetura)
3. [Passo 0 — descobrir as URLs do seu SIGAA](#3-passo-0--descobrir-as-urls-do-seu-sigaa)
4. [Passo 1 — fork do repositorio](#4-passo-1--fork-do-repositorio)
5. [Passo 2 — configurar e subir o Worker](#5-passo-2--configurar-e-subir-o-worker)
6. [Passo 3 — adaptar as camadas de health check](#6-passo-3--adaptar-as-camadas-de-health-check)
7. [Passo 4 — configurar e subir o frontend](#7-passo-4--configurar-e-subir-o-frontend)
8. [Passo 5 — dominio](#8-passo-5--dominio)
9. [Passo 6 — notificacoes no Telegram (opcional)](#9-passo-6--notificacoes-no-telegram-opcional)
10. [Passo 7 — deploy automatico via GitHub Actions](#10-passo-7--deploy-automatico-via-github-actions)
11. [Checklist final](#11-checklist-final)
12. [Entre pra lista de universidades](#12-entre-pra-lista-de-universidades)
13. [Problemas comuns](#13-problemas-comuns)

---

## 1. O que voce vai precisar

| Item | Pra que | Custo |
|---|---|---|
| Conta no [GitHub](https://github.com) | fork do codigo | gratis |
| Conta no [Cloudflare](https://dash.cloudflare.com/sign-up) | Worker (cron + API) e banco D1 | gratis |
| Conta na [Vercel](https://vercel.com/signup) | frontend Next.js | gratis |
| Node.js 20+ | rodar `wrangler` e `next` localmente | gratis |
| Uma matricula valida no SIGAA | **opcional** — camada 4 (login real de ponta a ponta) | - |
| Bot do Telegram | **opcional** — alertas quando cair | gratis |
| Dominio proprio | **opcional** — da pra usar `*.vercel.app` ou pedir um subdominio de `sigaacaiu.com` | - |

> **Sobre a camada 4:** ela faz login de verdade no SIGAA com uma conta real a cada 3 minutos.
> Use uma conta **sua**, nunca a de outra pessoa, e considere se sua universidade tem alguma
> politica contra isso. Se preferir nao usar, e so nao configurar os secrets — a camada se
> auto-desativa e o monitor continua funcionando com as 3 primeiras camadas.

---

## 2. Entendendo a arquitetura

Antes de sair mexendo, vale entender o que roda onde — assim voce sabe exatamente o que
precisa mudar:

```
worker/   ← Cloudflare Worker
          ├─ cron dispara a cada minuto (roda check de fato a cada 3 min)
          ├─ faz o health check do SIGAA em 4 camadas
          ├─ salva tudo num banco D1 (SQLite)
          └─ expoe a API publica (/api/status, /history, /stats, /incidents)

web/      ← Next.js na Vercel
          └─ so consome a API do Worker via NEXT_PUBLIC_API_URL. Nao tem backend proprio.
```

**As 4 camadas do health check** (em `worker/src/health.ts`):

| # | Camada | O que faz | Se falhar |
|---|---|---|---|
| 1 | `reachability` | `GET /sigaa/verTelaLogin.do`, espera 302 ou 200 | offline (com 2 retries antes) |
| 2 | `portal` | busca o portal publico (SPA React), confere `id="root"` e se o bundle JS carrega | offline |
| 3 | `loginForm` | busca `logon.jsf`, confere se o form JSF renderizou (`ViewState`, `form:login`, `form:senha`) | offline |
| 4 | `loginE2E` | login com credenciais erradas (tem que ser rejeitado) + login real (tem que dar 302 pro portal do discente) | offline |

O status final e o pior das camadas (`deriveOverall` em `worker/src/health.ts`). Camadas com
status `skipped` sao ignoradas — e assim que voce desliga uma camada que nao faz sentido na
sua universidade.

**Regra de ouro:** as camadas 1 e 3 funcionam em praticamente qualquer SIGAA (sao padrao do
SIG/UFRN). A camada 2 depende de a sua universidade ter o portal publico novo em React. A
camada 4 depende de voce ter credenciais.

---

## 3. Passo 0 — descobrir as URLs do seu SIGAA

Esse e o passo mais importante. Cada universidade hospeda o SIGAA num dominio diferente, e
algumas trocam o prefixo do caminho.

Na UFPB e assim:

```
https://sigaa.ufpb.br/sigaa/verTelaLogin.do   ← camada 1
https://sigaa.ufpb.br/publico/                ← camada 2
https://sigaa.ufpb.br/sigaa/logon.jsf         ← camadas 3 e 4
```

Exemplos de dominios em outras universidades: `sigaa.ufg.br`, `sig.unb.br`, `sigaa.ufrn.br`,
`sigaa.ufc.br`. **Confirme o seu** abrindo o SIGAA no navegador e olhando a barra de endereco.

### Como validar cada camada no terminal

Troque `sigaa.SUAUNI.br` pelo dominio real e rode:

```bash
# Camada 1 — tem que responder 302 (ou 200)
curl -s -o /dev/null -w "%{http_code}\n" -I https://sigaa.SUAUNI.br/sigaa/verTelaLogin.do

# Camada 2 — tem que ter <div id="root"> e um bundle em /publico/assets/*.js
curl -s https://sigaa.SUAUNI.br/publico/ | grep -o 'id="root"'
curl -s https://sigaa.SUAUNI.br/publico/ | grep -oE '/publico/assets/[a-zA-Z0-9._-]+\.js'

# Camada 3 — tem que ter o ViewState do JSF e os inputs do form
curl -s https://sigaa.SUAUNI.br/sigaa/logon.jsf | grep -o 'javax.faces.ViewState'
curl -s https://sigaa.SUAUNI.br/sigaa/logon.jsf | grep -oE 'name="form:(login|senha)"'
curl -s https://sigaa.SUAUNI.br/sigaa/logon.jsf | grep -oE 'action="/sigaa/logon\.jsf[^"]*"'
```

Anote o resultado de cada uma. **O que nao passar aqui, voce vai desligar ou adaptar no Passo 3.**

Se o caminho nao for `/sigaa/` (algumas instituicoes usam `/sigaa3/` ou servem na raiz), ajuste
tanto as constantes quanto os regex que checam `action="/sigaa/logon.jsf"` — sao dois lugares.

---

## 4. Passo 1 — fork do repositorio

```bash
# Fork pelo site do GitHub, depois:
git clone https://github.com/SEU_USUARIO/sigaa-caiu.git
cd sigaa-caiu
```

Ou, se preferir comecar do zero sem o historico:

```bash
gh repo create sigaa-caiu-SUAUNI --public --template trindadetiago/sigaa-caiu
```

---

## 5. Passo 2 — configurar e subir o Worker

### 5.1 Renomear o projeto

Edite `worker/wrangler.jsonc`:

```jsonc
{
  "name": "sigaa-caiu-SUAUNI-worker",   // <- nome unico do worker
  "account_id": "SEU_ACCOUNT_ID",       // <- pega no dashboard da Cloudflare
  "main": "src/index.ts",
  "compatibility_date": "2024-09-23",
  "placement": {
    "mode": "smart",
    "hint": "sam"                       // <- South America; mantenha
  },
  "triggers": {
    "crons": ["* * * * *"]              // <- roda todo minuto, mas so checa a cada 3
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "sigaa-caiu-SUAUNI-db",
      "database_id": "PREENCHER_NO_PASSO_5.2"
    }
  ]
}
```

O `account_id` fica no dashboard da Cloudflare, canto direito de qualquer pagina do Workers.

Ajuste tambem os scripts em `worker/package.json`, que citam o nome do banco:

```json
"db:local":  "wrangler d1 execute sigaa-caiu-SUAUNI-db --local  --file=schema.sql",
"db:remote": "wrangler d1 execute sigaa-caiu-SUAUNI-db --remote --file=schema.sql"
```

### 5.2 Criar o banco D1

```bash
cd worker
npm install
npx wrangler login

npx wrangler d1 create sigaa-caiu-SUAUNI-db
# copie o database_id que aparece e cole no wrangler.jsonc

# aplica o schema no banco remoto
npx wrangler d1 execute sigaa-caiu-SUAUNI-db --remote --file=schema.sql
```

O schema (`worker/schema.sql`) cria duas tabelas: `checks` (uma linha por verificacao, com o
detalhe de cada camada) e `incidents` (periodos de indisponibilidade). Nao precisa mudar nada
nele.

### 5.3 Trocar as URLs do SIGAA

Em `worker/src/health.ts`, no topo do arquivo:

```ts
const SIGAA_URL      = "https://sigaa.SUAUNI.br/sigaa/verTelaLogin.do";
const PORTAL_URL     = "https://sigaa.SUAUNI.br/publico/";
const PORTAL_ORIGIN  = "https://sigaa.SUAUNI.br";
const LOGIN_FORM_URL = "https://sigaa.SUAUNI.br/sigaa/logon.jsf";
const USER_AGENT     = "sigaa-caiu-monitor/1.0";
```

> Mantenha um `USER_AGENT` identificavel. Se a TI da sua universidade estranhar o trafego,
> e assim que eles vao descobrir que e um monitor e nao um ataque — e voce evita levar bloqueio.

Ajuste tambem os limiares se o seu SIGAA for naturalmente mais lento:

```ts
const TIMEOUT_MS            = 30_000;  // acima disso = offline
const THRESHOLD_DEGRADED_MS = 10_000;  // acima disso = degradado
const RETRY_DELAY_MS        = 3_000;
const MAX_RETRIES           = 2;
```

### 5.4 Testar local

```bash
npx wrangler d1 execute sigaa-caiu-SUAUNI-db --local --file=schema.sql
npx wrangler dev --port 8787 --test-scheduled

# noutro terminal — dispara um check manual:
curl "http://localhost:8787/__scheduled?cron=*/3+*+*+*+*"

# e ve o resultado:
curl http://localhost:8787/api/status | jq
```

Olhe o campo `layers` da resposta. **Cada camada tem que estar `online` ou `skipped`.** Se
alguma estiver `offline` com o SIGAA no ar, o `error` daquela camada te diz exatamente o que
adaptar — va pro Passo 3.

### 5.5 Deploy

```bash
npx wrangler deploy
```

O Worker sobe em `https://sigaa-caiu-SUAUNI-worker.SEU_SUBDOMINIO.workers.dev`. Guarde essa URL,
ela e a sua API.

---

## 6. Passo 3 — adaptar as camadas de health check

Aqui e onde as universidades mais divergem. Corrija so o que falhou no teste do Passo 5.4.

### Camada 2 — portal publico nao existe ou e diferente

Muita universidade ainda nao migrou pro portal publico em React. Se `GET /publico/` nao retorna
`id="root"`, voce tem duas opcoes.

**Opcao A — desligar a camada.** Em `worker/src/health.ts`, faca `checkPortal` retornar `skipped()`:

```ts
async function checkPortal(): Promise<LayerResult> {
  return skipped();   // sua universidade nao tem o portal publico novo
}
```

`skipped` nao conta pro status final (veja `deriveOverall`), entao o monitor segue funcionando
com as camadas 1, 3 e 4.

**Opcao B — adaptar.** Se existe um portal publico, mas com outra estrutura, mude o que a funcao
procura. As duas verificacoes que costumam quebrar:

```ts
const BUNDLE_REGEX = /\/publico\/assets\/[a-zA-Z0-9._-]+\.js/;  // caminho dos assets
// ...
if (!body.includes('id="root"')) { ... }                        // ancora do React
```

Troque `id="root"` por algo estavel na pagina da sua universidade (o nome da instituicao, um
`id` de container) e o regex pelo caminho real dos bundles.

### Camada 3 — o form de login e diferente

Os nomes dos campos vem do SIG da UFRN e sao bem padronizados, mas confira. Em `checkLoginForm`:

```ts
if (!body.includes('name="javax.faces.ViewState"')) { ... }
if (!body.includes('name="form:login"') || !body.includes('name="form:senha"')) { ... }
if (!body.includes('action="/sigaa/logon.jsf')) { ... }   // <- muda se o caminho nao for /sigaa/
```

Rode o `curl` do Passo 0 e ajuste as strings pro que aparece de verdade no HTML.

### Camada 4 — login de ponta a ponta

Se voce **nao** quiser usar, e so nao definir os secrets — o codigo ja trata isso:

```ts
} else if (!env.SIGAA_MONITOR_USER || !env.SIGAA_MONITOR_PASS) {
  loginE2e = skipped();
}
```

Se quiser usar, cadastre os secrets:

```bash
npx wrangler secret put SIGAA_MONITOR_USER
npx wrangler secret put SIGAA_MONITOR_PASS
```

E confira, em `attemptLogin`, os pontos que dependem do HTML da sua instituicao:

```ts
const body = new URLSearchParams({
  form: "form",
  "form:width": "1920",
  "form:height": "1080",
  "form:login": user,
  "form:senha": pass,
  "form:entrar": "Entrar",
  "javax.faces.ViewState": viewStateMatch[1],
});
```

e o que conta como sucesso:

```ts
if (location.includes("/portal/discente") || location.includes("/portais/discente")) {
  return { outcome: "success", durationMs };
}
```

Se voce loga como docente ou tecnico, o redirect vai ser outro (`/portais/docente`, por exemplo).
E a deteccao de rejeicao procura a palavra "invalidos" — se sua instituicao customizou a mensagem
de erro, ajuste tambem (o fallback, que checa se o form ainda esta na pagina, ja cobre a maioria
dos casos).

> Nunca commite credenciais. Localmente use `worker/.dev.vars` (copie de `.dev.vars.example`),
> que ja esta no `.gitignore`.

---

## 7. Passo 4 — configurar e subir o frontend

### 7.1 Apontar pra sua API

O frontend nao tem backend: ele le tudo de `NEXT_PUBLIC_API_URL` (`web/src/lib/api.ts`). Teste local:

```bash
cd web
npm install
NEXT_PUBLIC_API_URL=https://sigaa-caiu-SUAUNI-worker.SEU_SUBDOMINIO.workers.dev npm run dev
```

### 7.2 Trocar os textos

Tres arquivos:

**`web/src/app/layout.tsx`** — metadata e SEO. Troque toda mencao a UFPB e as URLs:

```ts
export const metadata: Metadata = {
  title: "SIGAA Caiu? — Status do SIGAA SUAUNI",
  description: "O SIGAA da SUAUNI esta no ar? Monitor em tempo real ...",
  keywords: ["SIGAA", "SUAUNI", "SIGAA caiu", "SIGAA SUAUNI", ...],
  metadataBase: new URL("https://suauni.sigaacaiu.com"),
  openGraph: { title: "...", description: "...", url: "https://suauni.sigaacaiu.com", ... },
  twitter: { title: "...", description: "..." },
  alternates: { canonical: "https://suauni.sigaacaiu.com" },
};
```

Isso importa de verdade: e o que faz o site aparecer quando alguem googla "sigaa caiu SUAUNI".

**`web/src/app/page.tsx`** — o paragrafo descritivo e o rodape:

```tsx
Monitor do SIGAA (Sistema Integrado de Gestao de Atividades Academicas) da SUAUNI.
```

No rodape ficam os links do GitHub e da API — atualize pro seu fork e pra sua URL de API, e
**deixe o link pro repositorio original** (veja a secao de creditos no README).

**`web/src/components/HeroStatus.tsx`** — as respostas aleatorias do hero ("Sim, morreu",
"Descanse em paz, SIGAA"). Nao precisa mexer, mas e a parte mais divertida de personalizar
com as piadas internas da sua universidade.

### 7.3 Deploy na Vercel

1. Importe o repositorio na Vercel.
2. **Root directory:** `web`
3. **Environment variable:** `NEXT_PUBLIC_API_URL` = a URL do seu Worker
4. Deploy. A partir dai todo push na `main` republica sozinho.

---

## 8. Passo 5 — dominio

Tres caminhos:

1. **Nao fazer nada** — usar o `seu-projeto.vercel.app` que a Vercel te da. Funciona perfeitamente.
2. **Dominio proprio** — apontar o CNAME pra Vercel nas configuracoes do projeto.
3. **Subdominio de `sigaacaiu.com`** — como fizeram UFG (`ufg.sigaacaiu.com`) e UNB
   (`unb.sigaacaiu.com`). Me chame em **tiagotrindade03@gmail.com** ou abra uma
   [issue](https://github.com/trindadetiago/sigaa-caiu/issues) que eu aponto o subdominio pro
   seu deploy. E de graca e leva 5 minutos.

Se voce for pelo caminho 3, use a URL final (`suauni.sigaacaiu.com`) nos metadados do Passo 7.2.

---

## 9. Passo 6 — notificacoes no Telegram (opcional)

O Worker manda mensagem quando o SIGAA cai (na **segunda** falha consecutiva, pra nao alarmar
com oscilacao de rede) e quando volta. A logica esta em `worker/src/notify.ts`.

1. Fale com o [@BotFather](https://t.me/BotFather) no Telegram, mande `/newbot`, guarde o token.
2. Crie um canal ou grupo, adicione o bot, e pegue o `chat_id` (o jeito mais facil e mandar uma
   mensagem no grupo e abrir `https://api.telegram.org/bot<TOKEN>/getUpdates`).
3. Cadastre os secrets:

```bash
cd worker
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
```

4. Troque o link que aparece nas mensagens, em `worker/src/notify.ts` (duas ocorrencias):

```ts
`[Ver status](https://suauni.sigaacaiu.com)`
```

Sem esses secrets, `notifyIfNeeded` retorna logo na primeira linha e nada acontece — o monitor
funciona igual, so sem alertas.

---

## 10. Passo 7 — deploy automatico via GitHub Actions

O repositorio ja vem com `.github/workflows/deploy-worker.yml`, que faz deploy do Worker a cada
push na `main` que toque em `worker/**`. Pra funcionar no seu fork:

1. Troque o `CLOUDFLARE_ACCOUNT_ID` no arquivo (esta hardcoded, e o da UFPB):

```yaml
env:
  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
  CLOUDFLARE_ACCOUNT_ID: SEU_ACCOUNT_ID
```

2. Crie um API token na Cloudflare (template **Edit Cloudflare Workers**) e cadastre em
   *Settings > Secrets and variables > Actions* do seu repositorio como `CLOUDFLARE_API_TOKEN`.

O frontend nao precisa de workflow — a Vercel cuida disso sozinha.

---

## 11. Checklist final

- [ ] `curl` da API retorna `status` com todas as camadas `online` ou `skipped`
- [ ] O site carrega e mostra o status atual
- [ ] Depois de ~1 hora, o grafico de tempo de resposta e as barras de uptime tem dados
- [ ] Metadata (titulo, descricao, canonical) fala da sua universidade, nao da UFPB
- [ ] O rodape aponta pro seu repositorio **e** pro original
- [ ] Nenhuma credencial commitada (`git log -p | grep -i senha` pra ter certeza)
- [ ] Alertas do Telegram chegando, se voce configurou
- [ ] Deploy automatico funcionando (faca um push de teste)

Pra testar o comportamento de queda sem esperar o SIGAA cair de verdade, aponte `SIGAA_URL`
temporariamente pra um dominio inexistente, rode um check local, e confira que aparece
`offline` e que o incidente e criado no banco.

---

## 12. Entre pra lista de universidades

Quando estiver no ar, abra um PR no repositorio original adicionando sua universidade em dois lugares:

1. A tabela **Universidades** no `README.md`
2. A lista de outros monitores no rodape, em `web/src/app/page.tsx`

Foi exatamente isso que os PRs da UFG e da UNB fizeram — sao mudancas de poucas linhas. Assim
quem chega pelo site de uma universidade encontra o das outras.

E o unico pedido do projeto (que e MIT, entao voce pode fazer o que quiser com o codigo):
**de credito**. Deixe em algum lugar visivel, de preferencia no rodape:

> Fork de [github.com/trindadetiago/sigaa-caiu](https://github.com/trindadetiago/sigaa-caiu)

---

## 13. Problemas comuns

**A camada 1 retorna 403 ou 503 direto.**
Alguma universidade poe WAF/Cloudflare na frente do SIGAA e bloqueia requisicoes sem cara de
navegador. Tente mandar headers mais realistas (`Accept`, `Accept-Language`) junto do
`User-Agent`. Se persistir, fale com a TI — normalmente eles liberam quando entendem que e um
monitor de status.

**Todos os checks aparecem como `degraded`.**
O SIGAA da sua universidade e mais lento que o da UFPB. Aumente `THRESHOLD_DEGRADED_MS` em
`worker/src/health.ts`.

**A camada 4 falha com `e2e_bogus_unexpected`.**
O login com credencial errada nao esta sendo detectado como rejeicao. Faca o POST manualmente e
veja o que o SIGAA responde — a mensagem de erro provavelmente e diferente de "invalidos".

**`unexpected_redirect_...` na camada 4.**
O login funcionou, mas o destino nao e `/portal/discente`. Ajuste a lista de caminhos aceitos
em `attemptLogin` pro portal do seu tipo de vinculo.

**O frontend mostra erro de conexao.**
Confira o `NEXT_PUBLIC_API_URL` na Vercel (ele precisa de um redeploy pra valer) e teste a API
direto no navegador. O CORS ja vem liberado pra `*` em `worker/src/cors.ts`.

**O banco esta vazio depois do deploy.**
O cron so dispara em producao. Espere 3 minutos, ou force um check chamando o Worker com o
parametro `__scheduled` em ambiente de dev. Confirme tambem que voce rodou o `schema.sql` com
`--remote`, e nao so `--local`.

---

Duvida em qualquer passo? Abre uma [issue](https://github.com/trindadetiago/sigaa-caiu/issues)
ou me chama em **tiagotrindade03@gmail.com**. Fico feliz em ajudar a colocar o monitor da sua
universidade no ar.
