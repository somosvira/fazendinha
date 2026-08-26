# Deploy — Rio Novo

Stack: **Cloudflare Pages** (frontend estático) + **Render** (backend Hono) + **Neon** (Postgres, já existente).

Os arquivos de config já estão no repo:

- `render.yaml` — blueprint do serviço web no Render.
- `client/public/_redirects` — SPA fallback + reverse proxy `/api/*` → Render.
- `server/src/index.ts` — CORS lê de `CORS_ORIGIN` (fallback para `*` se não setada).
- `server/package.json` — script `start:prod` (sem `--env-file`, rodando `prisma migrate deploy` antes do node).

---

## 1. Render (backend)

### 1.1. Conectar o repo

1. Em https://render.com → **New** → **Blueprint**.
2. Conecte sua conta GitHub. Como o repo é do Felps, na hora de instalar o GitHub App escolha **"Only select repositories"** e marque só o `fazendinha`. Se o repo estiver numa org e ela bloquear third-party apps, o Felps precisa aprovar uma vez (notificação aparece pra ele em github.com/settings/installations).
3. Aponte para a branch que você quer servir (`Homolog` ou `main`).
4. Render detecta o `render.yaml` e propõe criar o service `rionovo-api`.

### 1.2. Setar envs (modal que aparece no Apply)

| Env             | Valor                                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`  | URL **pooled** do Neon (`?sslmode=require`). Mesma que em `server/.env`.                                                |
| `DIRECT_URL`    | URL **direct** (não-pooled: mesma sem `-pooler`). **Necessária** — o `db push` da partida usa ela (o schema tem `directUrl`). |
| `JWT_SECRET`    | String aleatória forte (`openssl rand -hex 32`). **Não** reusar o de dev.                                               |
| `CORS_ORIGIN`   | Deixe vazio agora (preenchemos depois quando soubermos a URL da CF Pages). Sem ela o CORS fica liberado pra qualquer origem. |
| `OPENAI_API_KEY` | Chave da OpenAI. Sem ela: chat/bot desligado (503) e a IA (rebanho/plantio/corte) roda em modo demo. |
| `DATABASE_URL_READONLY` | (opcional) Role somente-leitura do Neon p/ o escape-hatch de SQL do bot. Sem ela, o SQL livre fica off (ferramentas curadas seguem ok). |
| `DASHBOARD_MESES_QUEIMA` | (opcional) Nº de meses na média da queima do fôlego. Default 6. |

### 1.3. Apply

Render roda:

```
corepack enable
pnpm install --frozen-lockfile
pnpm --filter rionovo-server exec prisma generate
pnpm --filter rionovo-server run build
```

E na partida:

```
prisma db push --skip-generate --accept-data-loss # sincroniza o schema no banco (cria tabelas que faltam)
node dist/index.js               # bind em $PORT injetado pelo Render
```

> **Por que `db push` e não `migrate deploy`?** O schema vem sendo gerenciado por
> `db push` (o banco atual tem drift: só 2 de N migrations registradas). `db push`
> sincroniza o schema direto — robusto pra staging, independe do histórico. As
> migrations existem no repo (inclusive a consolidada `20260701_...`, que cobre 100%
> do schema — `migrate diff` dá "No difference"), então dá pra migrar pra
> `migrate deploy` num banco limpo depois se quiser.

> O `--accept-data-loss` confirma os avisos preventivos do Prisma ao adicionar
> índices únicos. Ele não remove registros para criar o índice: se o banco tiver
> valores duplicados, o Postgres ainda interrompe o deploy e os duplicados devem
> ser corrigidos antes de tentar novamente.

Health check: `GET /api/health`. Tempo médio de build inicial: 3-5 min.

### 1.4. Pegar a URL pública

Algo como `https://rionovo-api.onrender.com`. Anote — vamos plugar no CF Pages no passo seguinte.

> **Free tier:** o serviço dorme após 15 min ociosos. Primeira requisição depois de dormir leva ~30s pra acordar. Pra evitar, paga $7/mês no Starter (sempre on) ou agenda um cron de ping em qualquer serviço (UptimeRobot etc.).

---

## 2. Cloudflare Pages (frontend)

### 2.1. Atualizar o `_redirects` com a URL do Render

Em `client/public/_redirects`, troque `RIONOVO_API_URL` pelo subdomínio que o Render te deu:

```
/api/*  https://rionovo-api.onrender.com/api/:splat  200
/*      /index.html                                  200
```

Commit + push.

### 2.2. Criar o projeto no CF Pages

1. https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Autorize o GitHub App da CF; mesma lógica do Render (Only select repos → `fazendinha`).
3. Selecione o repo + branch.
4. Configurações de build:

| Campo                       | Valor                                                              |
| --------------------------- | ------------------------------------------------------------------ |
| Framework preset            | None (ou Vite, dá no mesmo)                                        |
| Build command               | `corepack enable && pnpm install --frozen-lockfile && pnpm --filter rionovo-client run build` |
| Build output directory      | `client/dist`                                                      |
| Root directory              | (vazio, deixa na raiz do repo)                                     |
| Node version (env var)      | `NODE_VERSION=20`                                                  |

Salvar e deployar. Build inicial: 1-2 min.

### 2.3. Pegar a URL

Algo como `https://rionovo.pages.dev` (ou o slug que você escolher). Cada PR ganha uma preview tipo `https://abc123.rionovo.pages.dev`.

### 2.4. Fechar o CORS no Render

Voltar no dashboard Render → service `rionovo-api` → **Environment** → editar `CORS_ORIGIN`:

```
https://rionovo.pages.dev,https://*.rionovo.pages.dev
```

> Hono cors suporta wildcard de subdomínio? **Não** nativamente. Se quiser bloquear strict, liste só `https://rionovo.pages.dev` e aceite que previews vão dar erro de CORS — mas como o `_redirects` faz proxy server-side, a request sai com origem `pages.dev` do mesmo domínio do front, então CORS nem entra na história nesse setup. Pode deixar `CORS_ORIGIN` vazio sem problema.

Salvar dispara redeploy do backend.

---

## 3. Domínio custom (opcional)

- **CF Pages:** Custom domains → add → aponta CNAME ou hospeda DNS no CF.
- **Render:** Custom Domain no service → ele dá um CNAME pra você apontar.

Se for usar domínio próprio no front (ex.: `rionovo.com.br`), atualizar `CORS_ORIGIN` no Render pra incluí-lo.

---

## 4. Smoke test pós-deploy

```bash
# 1. API responde
curl https://rionovo-api.onrender.com/api/health

# 2. Front carrega
curl -I https://rionovo.pages.dev

# 3. Proxy do front para a API funciona
curl https://rionovo.pages.dev/api/health

# 4. Dashboard agrega do Neon
curl https://rionovo-api.onrender.com/api/dashboard | jq '.dre2025'
```

Os 4 devem voltar 200 com payload válido. O passo 3 prova que o reverse proxy do CF Pages tá indo no Render.

---

## 5. Troubleshooting

- **Build do Render falha em `pnpm install`:** verifique `NODE_VERSION=20` e que o `corepack enable` aparece nos logs antes do install.
- **`prisma migrate deploy` falha:** confirme que `DATABASE_URL` é a URL **pooled** do Neon e tem `?sslmode=require`. Migrations via pooler funcionam para `deploy` (não funcionam para `dev`).
- **Prisma engine "Cannot find module" no runtime:** adicionar `binaryTargets = ["native", "debian-openssl-3.0.x"]` no `generator client` do `schema.prisma` e redeployar.
- **CF Pages serve `index.html` mas `/api/*` dá 404:** o `_redirects` está em `client/public/_redirects`? Confira no build output `client/dist/_redirects` — Vite copia tudo de `public/` automaticamente.
- **CORS error mesmo com proxy:** o cliente está chamando `https://rionovo-api.onrender.com` direto (em vez de relativo)? Conferir `client/src/api.ts` — deve usar `fetch('/api/...')`.
- **Free tier do Render dormindo:** ping a cada 10 min via UptimeRobot/cron-job.org pra manter quente.
