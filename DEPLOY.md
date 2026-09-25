# Deploy — Rio Novo

Stack: **Cloudflare Pages** (frontend estático + Worker de proxy) + **Render** (backend Hono, serviço `terrano-api`) + **Neon** (Postgres, já existente). Esse é o deploy em produção hoje — descrito nas seções 1-5. Existe também um **Cloudflare Worker único** (front + back no mesmo Worker, sem Render) preparado e testado localmente (build, dry-run), mas ainda **não deployado de verdade** — falta testar contra uma conta Cloudflare real antes de considerar substituir o caminho atual. Ver §6.

Os arquivos de config já estão no repo:

- `render.yaml` — blueprint do serviço web `terrano-api` no Render (branch `main`, `autoDeployTrigger: checksPass`).
- `client/public/_worker.js` — Worker do CF Pages (modo avançado) que faz o proxy `/api/*` → Render, lendo a env `API_ORIGIN`.
- `client/public/_redirects` — **só** o SPA fallback (`/* → /index.html`). Não faz mais proxy.
- `.github/workflows/staging.yml` — CI (build + testes). É o gate da `main`; não faz deploy.
- `server/src/index.ts` — CORS lê de `CORS_ORIGIN` (fallback `*` se não setada). Não dispara mais nenhum bootstrap sozinho no boot (dono, resultados ginecológicos, multi-propriedade) — todos viraram scripts manuais (ver §1.5).
- `server/src/env.ts` — validação Zod das envs (fonte de verdade da tabela abaixo).
- `server/package.json` — `start:prod` é **só** `node dist/index.js`. Nenhum sync de schema roda no start (ver §1.4).

---

## 0. CI (GitHub Actions)

`.github/workflows/staging.yml` roda em `push` e `pull_request` para `main` (e manual via `workflow_dispatch`), job único `build + test`:

1. `pnpm install --frozen-lockfile` (Node 20, pnpm via `packageManager` do `package.json`).
2. `pnpm --filter rionovo-server exec prisma generate` — o Prisma Client é necessário para o `tsc`; não conecta ao banco.
3. `pnpm -r run build` — server (`tsc`) e client (`tsc -b && vite build`).
4. Sobe um Postgres 16 efêmero, aplica as migrations com `prisma migrate deploy` e roda `pnpm --filter rionovo-server test`. A integração de recuperação usa somente fixtures `@example.test`, removidas após cada caso; nenhum ambiente ou proprietário real é acessado.

O CI **não** deploya. Os deploys são feitos pelas integrações Git nativas: Render (`autoDeployTrigger: checksPass` → só deploya a `main` depois do CI verde) e Cloudflare Pages (build a cada push). Não há credenciais de infra no GitHub Actions.

---

## 1. Render (backend)

### 1.1. Conectar o repo

1. Em https://render.com → **New** → **Blueprint**.
2. Conecte a conta GitHub. Na instalação do GitHub App escolha **"Only select repositories"** e marque só o `fazendinha`. Se o repo estiver numa org que bloqueia third-party apps, o dono da org precisa aprovar uma vez (github.com/settings/installations).
3. Render detecta o `render.yaml` e propõe criar o service **`terrano-api`** apontado para a branch `main`.

### 1.2. Setar envs (modal que aparece no Apply)

Todas são validadas por `server/src/env.ts`; se algo obrigatório faltar o processo aborta no boot com `[env] configuração inválida`.

| Env | Valor |
| --- | --- |
| `DATABASE_URL` | **Obrigatória.** URL **pooled** do Neon (`-pooler` no host, `?sslmode=require&channel_binding=require`). Runtime usa esta. |
| `DIRECT_URL` | URL **direct** do Neon (mesma sem `-pooler`). O `schema.prisma` declara `directUrl = env("DIRECT_URL")`, então os comandos `prisma *` exigem que ela exista. Reservada para sync de schema controlado (§1.4). Se não tiver a direct à mão, pode apontar para a pooled — `migrate deploy` funciona via pooler. |
| `NODE_ENV` | `production` (já vem do `render.yaml`). Em produção o boot **avisa** se `CORS_ORIGIN` ou `SHARED_ACCESS_TOKEN` estiverem vazios. |
| `JWT_SECRET` | String aleatória forte (`openssl rand -hex 32`, ≥ 8 chars). **Não** reusar o de dev. |
| `CORS_ORIGIN` | CSV de origens permitidas. Deixe vazio na primeira subida (libera tudo) e preencha depois com a URL do CF Pages (§2.4). |
| `AUTH_BOOTSTRAP_EMAIL` | E-mail do dono. **Só tem efeito quando alguém roda o script de bootstrap com a tabela `Usuario` vazia** (ver §1.5). Pode esvaziar depois que o dono foi criado. |
| `AUTH_BOOTSTRAP_NOME` | (opcional) Nome do dono. Default `Proprietário`. |
| `APP_BASE_URL` | Base para montar os links de convite/reset (ex.: `https://rionovo.pages.dev`). Host sem esquema é normalizado para `https://`; vazio gera link relativo. |
| `AUTH_SESSAO_DIAS` | (opcional) Validade da sessão em dias (sliding). Default 30. |
| `AUTH_EMAIL_PROVIDER` | `resend` para habilitar a recuperação por e-mail em produção. `log` (ou variável ausente) imprime o link em dev/teste e é rejeitado em produção. |
| `AUTH_EMAIL_FROM` | Remetente em domínio verificado, por exemplo `Terrano <acesso@dominio.com.br>`. Obrigatória com provider `resend`. |
| `RESEND_API_KEY` | Chave do Resend usada somente pelo backend. Obrigatória com provider `resend`. |
| `AUTH_RESET_RATE_WINDOW_MINUTES`, `AUTH_RESET_MAX_PER_EMAIL`, `AUTH_RESET_MAX_PER_IP` | (opcionais) Janela e limites da recuperação pública. Defaults: 15 minutos, 3 por e-mail e 10 por origem. |
| `SHARED_ACCESS_TOKEN` | (opcional, ≥ 16 chars) **Ponte de transição**: se setado, este token vale como acesso de dono via `Authorization: Bearer`. Não é sistema de usuários — as contas reais vivem em `Usuario`/`Sessao`. Útil para o smoke test e para o piloto; remover quando as contas estiverem de pé. |
| `OPENAI_API_KEY` (+ `OPENAI_MODEL`) | Chave da OpenAI. Sem ela: chat/bot desligado (503) e a IA dos módulos (rebanho/plantio/corte) roda em modo demo. Default do modelo: `gpt-4o`. |
| `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET` | (opcionais) Canal Meta Cloud API. Os quatro são necessários para o webhook `/api/whatsapp/*` funcionar. |
| `STORAGE_DRIVER` | `local` (default; grava em `LOCAL_STORAGE_DIR`, `.uploads/`) ou `r2`. **No Render free o disco é efêmero** — anexos em `local` somem a cada deploy. Em produção use `r2`. |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NOTAS` | Obrigatórias **quando** `STORAGE_DRIVER=r2` (validado por `superRefine`). |
| `LOCAL_DOWNLOAD_SECRET` | (≥ 16 chars) Segredo HMAC que assina as URLs de download no modo `local`. Tem default de dev — trocar em produção se usar `local`. |
| `DASHBOARD_MESES_QUEIMA` | (opcional) Nº de meses na média da queima do fôlego. Default 6. |

> `DATABASE_URL_READONLY` **não existe mais** no código — o bot consulta via motor estruturado (`server/src/services/consulta/`), sem SQL gerado pelo LLM. Se ainda estiver no dashboard do Render, pode apagar.

### 1.3. Apply — o que o Render roda

Build (`buildCommand` do `render.yaml`):

```
corepack enable
pnpm install --frozen-lockfile        # o postinstall do server já roda prisma generate
pnpm --filter rionovo-server exec prisma generate
pnpm --filter rionovo-server run build   # tsc → server/dist
```

Start (`startCommand`):

```
pnpm --filter rionovo-server run start:prod   # = node dist/index.js, bind em $PORT
```

Health check: `GET /api/health`. Build inicial: 3-5 min. Com `autoDeployTrigger: checksPass`, cada push na `main` só vira deploy depois do CI (§0) ficar verde.

### 1.4. Sincronizar o schema no Neon (passo manual, controlado)

**Não há passo automático de schema no start em produção.** `start:prod` é só `node dist/index.js`; quem roda `prisma migrate deploy` é o script `dev` **local**. Se o código novo depende de coluna/tabela nova e o banco não foi sincronizado, a API sobe e quebra na primeira query (`P2021`/`P2022`).

Sempre que um deploy trouxer mudança em `server/prisma/schema.prisma`, sincronize **antes** (ou logo depois) do deploy, com o `server/.env` apontando para o Neon de produção (ou via Shell do Render). Depois de sincronizar, rode também o backfill de multi-propriedade (não dispara mais sozinho no boot):

```bash
pnpm --filter rionovo-server run backfill:propriedade
```

Idempotente — seguro rodar de novo mesmo se nada mudou.

**Opção A — `migrate deploy` (preferida, funciona via pooler):**

```bash
pnpm --filter rionovo-server exec prisma migrate deploy
```

Aplica só as migrations de `server/prisma/migrations/` ainda não registradas. Não precisa de shadow DB, então a `DATABASE_URL` pooled basta.

**Opção B — `db push` (sem histórico, exige `DIRECT_URL` válida). Não usar enquanto houver o schema `pecuaria`:** os índices únicos parciais e as categorias padrão existem só no SQL da migration e o `db push` não os cria (ou os apagaria).

```bash
pnpm --filter rionovo-server run db:push
```

Sincroniza o schema direto, ignorando o histórico de migrations. É o que historicamente materializou o schema no Neon, então o banco tem **drift** em relação à tabela `_prisma_migrations`.

**Pegadinhas (detalhe em `docs/design/multi-propriedade.md`, seção 9):**

- `db push` **não roda o SQL de backfill** das migrations (`UPDATE ... SET propriedadeId = 1`). Por isso existe `garantirFundacaoPropriedade` — rode `pnpm --filter rionovo-server run backfill:propriedade` manualmente depois de sincronizar o schema (não dispara mais sozinho no boot).
- Como o Neon de prod foi sincronizado por `db push`, migrations que **criam** tabelas já existentes (ex.: `20260706185000_add_caixinha_movimento_caixinha`) precisam ser marcadas como aplicadas uma vez antes do primeiro `migrate deploy`: `pnpm --filter rionovo-server exec prisma migrate resolve --applied <nome_da_migration>`. Sem isso o deploy falha com "already exists".
- Se um `migrate deploy` travar no meio (`P3018`), recupere com `prisma migrate resolve --rolled-back <migration>` e depois `db push`.
- `prisma migrate dev` (criar migration nova) precisa da `DIRECT_URL` real — ver "Pooled vs direct URL" no `CLAUDE.md`.

#### Histórico consolidado (25/09/2026, PR #296)

As migrations viraram duas: `20260925120000_baseline` (o estado final da `main` antes da pecuária v1, gerado pelo Prisma a partir do schema) e `20260925130000_pecuaria_v1_rebanho` (cria o schema `pecuaria`, apaga as 68 tabelas do módulo legado e os vínculos do estoque com dieta/sanidade, e tem o SQL escrito à mão: índices únicos parciais e categorias padrão).

Um banco com o histórico antigo em `_prisma_migrations` (qualquer ambiente anterior a esta data) **não** aceita o `migrate deploy` novo — a baseline tentaria recriar tabelas existentes. Como hoje não há dados reais em produção, o caminho é recriar o banco: apagar os schemas `public` e `pecuaria`, rodar `prisma migrate deploy` no banco vazio e depois os bootstraps (§1.5). Quando houver dados reais, a alternativa sem perda é conferir que o banco está no estado da `main` de 24/09, registrar a baseline com `prisma migrate resolve --applied 20260925120000_baseline` e então aplicar a migration da pecuária.

### 1.5. Bootstrap do dono (script manual)

O login é por conta real (`Usuario` + `Sessao`). `garantirDonoBootstrap()` não dispara mais sozinho no boot (nem em Node, nem faria sentido num Worker) — rode manualmente depois do primeiro deploy, com `AUTH_BOOTSTRAP_EMAIL` setado e a tabela `Usuario` vazia:

```bash
pnpm --filter rionovo-server run bootstrap:dono
```

1. Cria o usuário com papel `proprietario`, `dono: true`, status **`PENDENTE`**.
2. Gera um token de convite e **loga no stdout** um link único para definir a senha:

   ```
   [auth] Dono criado (email@...). Link único para definir a senha:
     https://<APP_BASE_URL>/convite/<token>
   ```

3. Abra o link, defina a senha, faça login. A partir daí `AUTH_BOOTSTRAP_EMAIL` não faz mais nada (tabela não está vazia) e pode ser esvaziada. Rodar o script de novo com a tabela já povoada é seguro — não faz nada.

Mesmo comando serve pro deploy no Worker (§6) — é um script Node, roda local (ou em CI) apontando `DATABASE_URL` pro banco de produção, não dentro do runtime do Worker.

Enquanto o dono não define a senha, ou em ambientes sem conta nenhuma, o `SHARED_ACCESS_TOKEN` serve de ponte: o `authMiddleware` aceita esse token como um "dono sintético" com acesso total. Em dev local, sem `SHARED_ACCESS_TOKEN` **e** sem nenhum usuário no banco, a porta fica aberta.

### 1.6. Pegar a URL pública

Algo como `https://terrano-api.onrender.com`. Anote — vai na env `API_ORIGIN` do CF Pages (§2.2).

> **Free tier:** o serviço dorme após 15 min ociosos; a primeira requisição depois leva ~30s. Pra evitar, Starter ($7/mês) ou um cron de ping (UptimeRobot etc.) em `/api/health`.

---

## 2. Cloudflare Pages (frontend)

### 2.1. Como o proxy funciona

CF Pages **não** faz proxy para origem externa via `_redirects`. O proxy `/api/*` → Render é o `client/public/_worker.js` (Pages em modo avançado): toda request cujo path começa com `/api/` é repassada (método, headers incluindo `Authorization`, body) para `env.API_ORIGIN + path + query`; o resto vai para `env.ASSETS` (estáticos + SPA fallback do `_redirects`). Se `API_ORIGIN` não estiver setada, o Worker responde `503 { error: "API_ORIGIN não configurada no Cloudflare Pages" }`.

Vite copia `public/` para `client/dist`, então `_worker.js` e `_redirects` chegam ao output sem configuração extra. **Não há nada para editar no repo** ao trocar a URL do Render — é só env.

O rate limit de recuperação usa o último endereço de `X-Forwarded-For`, acrescentado pelo Render. Não confia em `CF-Connecting-IP` nem no primeiro item da cadeia, que podem ser forjados por quem acessa o host do Render diretamente. O fluxo normal deve continuar passando pelo Worker do Pages; o limite por e-mail permanece ativo também em acessos diretos.

### 2.2. Criar o projeto no CF Pages

1. https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Autorize o GitHub App da CF (Only select repos → `fazendinha`).
3. Selecione o repo + branch `main`.
4. Configurações de build:

| Campo | Valor |
| --- | --- |
| Framework preset | None (ou Vite) |
| Build command | `corepack enable && pnpm install --frozen-lockfile && pnpm --filter rionovo-client run build` |
| Build output directory | `client/dist` |
| Root directory | (vazio — raiz do repo, por causa do lockfile único) |

5. Variáveis de ambiente (**Settings → Environment variables**, em Production e Preview):

| Env | Valor |
| --- | --- |
| `NODE_VERSION` | `20` |
| `API_ORIGIN` | URL pública do Render, ex.: `https://terrano-api.onrender.com` (sem barra final; o Worker tolera, mas evite). |

Salvar e deployar. Build inicial: 1-2 min.

> O build do client roda `tsc -b && vite build` — erro de tipo derruba o deploy, igual ao CI.

### 2.3. Pegar a URL

Algo como `https://rionovo.pages.dev` (ou o slug escolhido). Cada PR ganha uma preview `https://<hash>.rionovo.pages.dev`, que usa a env `API_ORIGIN` do ambiente Preview — aponte para o mesmo Render se quiser previews funcionais.

### 2.4. Fechar o CORS no Render

Render → service `terrano-api` → **Environment** → `CORS_ORIGIN`:

```
https://rionovo.pages.dev
```

> Como o browser só fala com o domínio do Pages e é o Worker que chama o Render server-side, CORS não entra no caminho normal — `CORS_ORIGIN` só importa se alguém chamar `terrano-api.onrender.com` direto do browser. Ainda assim, setar em produção silencia o warning do boot e fecha a porta. O `cors()` do Hono não aceita wildcard de subdomínio, então previews de PR chamando a API direto dariam erro — via Worker não dão.

Salvar dispara redeploy do backend.

---

## 3. Domínio custom (opcional)

- **CF Pages:** Custom domains → add → CNAME ou DNS hospedado no CF.
- **Render:** Custom Domain no service → CNAME para apontar.

Com domínio próprio no front (ex.: `rionovo.com.br`): atualizar `CORS_ORIGIN` no Render e `APP_BASE_URL` (para os links de convite/reset saírem com o domínio certo).

---

## 4. Smoke test pós-deploy

```bash
API=https://terrano-api.onrender.com
FRONT=https://rionovo.pages.dev
TOKEN=<SHARED_ACCESS_TOKEN ou token de sessão obtido em POST /api/auth/login>

# 1. API responde (sem auth)
curl $API/api/health

# 2. Front carrega
curl -I $FRONT

# 3. Worker do Pages faz proxy para o Render
curl $FRONT/api/health

# 4. Sem token → 401 (auth está ligada)
curl -i $API/api/financeiro/dashboard | head -1

# 5. Com token → dashboard financeiro agrega do Neon (exige área "financeiro")
curl -H "Authorization: Bearer $TOKEN" $FRONT/api/financeiro/dashboard | jq 'keys'
```

1–3 e 5 devem voltar 200 com JSON; 4 deve ser `401 {"error":"não autenticado"}`. O passo 3 prova que o `_worker.js` está indo no Render; o 5 prova que o `Authorization` atravessa o proxy.

Para obter um token de sessão real em vez do `SHARED_ACCESS_TOKEN`: `curl -X POST $API/api/auth/login -H 'content-type: application/json' -d '{"email":"...","senha":"..."}'` — o token vem no corpo da resposta.

---

## 5. Troubleshooting

- **Build do Render falha em `pnpm install`:** confira `NODE_VERSION=20` e que `corepack enable` aparece nos logs antes do install.
- **API sobe mas cai com `[env] configuração inválida`:** faltou env obrigatória (`DATABASE_URL`), ou `STORAGE_DRIVER=r2` sem as quatro `R2_*`, ou `SHARED_ACCESS_TOKEN`/`LOCAL_DOWNLOAD_SECRET` com menos de 16 chars. O log lista os campos.
- **API sobe e queries dão `P2021`/`P2022` (tabela/coluna não existe):** o schema não foi sincronizado — o `start:prod` **não** faz isso. Rodar `migrate deploy` ou `db push` (§1.4).
- **`prisma migrate deploy` falha com "already exists":** tabela criada por `db push` antes da migration existir. `prisma migrate resolve --applied <migration>` e repetir (§1.4).
- **`prisma migrate deploy` falha com `P3018`:** migration parcial. `prisma migrate resolve --rolled-back <migration>` → `db push`.
- **Comando `prisma *` reclama de `DIRECT_URL`:** o `schema.prisma` declara `directUrl`, então a env precisa existir para o CLI. Aponte para a direct do Neon (ou, no aperto, para a própria pooled — `migrate deploy` funciona via pooler; `migrate dev` não).
- **Prisma engine "Cannot find module" no runtime:** adicionar `binaryTargets = ["native", "debian-openssl-3.0.x"]` no `generator client` do `schema.prisma` e redeployar.
- **`/api/*` no Pages responde `503 API_ORIGIN não configurada`:** a env `API_ORIGIN` não está setada no ambiente (Production/Preview) que serviu a request. Setar e redeployar o Pages.
- **`/api/*` no Pages dá 404 ou volta o `index.html`:** o `_worker.js` não chegou ao output. Confira `client/dist/_worker.js` no build — precisa estar em `client/public/`.
- **Front carrega mas tudo dá 401:** ninguém logado. Ou o dono ainda não definiu a senha (link no output de `bootstrap:dono`, §1.5) ou o token do `localStorage` expirou (`AUTH_SESSAO_DIAS`). Como ponte, `SHARED_ACCESS_TOKEN` na tela de login.
- **`bootstrap:dono` não criou o dono:** `AUTH_BOOTSTRAP_EMAIL` vazio ou a tabela `Usuario` já tinha registro. Ver log `[auth]`; se precisar recriar, criar o usuário direto (Prisma Studio) e gerar convite pelo app.
- **Anexos de nota fiscal somem após deploy:** `STORAGE_DRIVER=local` no Render (disco efêmero). Migrar para `r2`.
- **CORS error:** o cliente está chamando `terrano-api.onrender.com` direto (em vez de `/api/...` relativo)? Toda request deve sair via `comPropriedade()` com path relativo para passar pelo Worker.
- **Free tier do Render dormindo:** ping a cada 10 min em `/api/health` via UptimeRobot/cron-job.org.

---

## 6. Alternativa: Cloudflare Worker único (front + back)

**Ainda não é o deploy de produção** — as seções 1-5 continuam sendo a verdade sobre o que está no ar. Isto aqui é a infraestrutura pronta pra rodar front (estático) e back (API Hono) num único Cloudflare Worker, sem Render, testada localmente (build real + `wrangler deploy --dry-run`), mas **nunca deployada contra uma conta Cloudflare de verdade**. O fluxo é **dashboard-first** (§6.2), igual ao Render e ao Pages hoje — Git integration builda e deploya a cada push, sem precisar de `wrangler login` local. Antes de considerar substituir o caminho atual, conecte o repo (§6.2) e confira que tudo funciona igual.

### 6.1. O que muda

- `server/src/app.ts` — construção do Hono (rotas, CORS, gates de área). Compartilhado pelos dois entrypoints:
  - `server/src/index.ts` — Node (`@hono/node-server`), o que já existe hoje (dev local, Render).
  - `server/src/worker.ts` — Cloudflare Worker (`export { app as default }`, padrão oficial do Hono). Referenciado por `main` em `wrangler.jsonc` (raiz do repo).
- `server/src/db.ts` — escolhe o driver do Prisma pelo runtime (`server/src/lib/runtime.ts`, `isCloudflareWorkers()`): `PrismaNeon` (HTTP/WebSocket) dentro do Worker, `PrismaPg` (TCP) em Node. Mesma `DATABASE_URL` nos dois casos.
- `wrangler.jsonc` — `assets.directory` aponta pro `client/dist` (build do Vite); `run_worker_first: ["/api/*"]` garante que só `/api/*` invoca o Worker, o resto é asset estático ou cai no `index.html` (SPA) via `not_found_handling: "single-page-application"`. `keep_vars: true` evita que um deploy apague as variáveis "Text" criadas no dashboard.
- `client/public/_worker.js`, `_redirects` (proxy/SPA fallback do Cloudflare Pages, §2) **removidos nesta branch** — o teste do Worker novo roda direto nela, sem passar por `main`, então não tem risco de quebrar o Pages ao vivo (que continua intacto em `main`). Se um dia esta branch for mergeada substituindo o Pages, essa remoção vai junto; se não, não mergear esses três arquivos removidos.
- `scripts/cf-deploy.sh` — Deploy command do Workers Builds (§6.2), baseado no `scripts/deploy.sh` do kumon: roda `prisma migrate deploy`, só chama `wrangler deploy` se as migrations passarem, e confere pós-deploy via `/api/health` que o commit novo está de fato no ar.

### 6.2. Criar o Worker via dashboard (Git integration — Workers Builds)

Mesmo modelo do Render (§1) e do Pages (§2): conecta o repo, Cloudflare builda e deploya sozinho a cada push. **Não precisa de `wrangler login` nem de rodar deploy local** — é a Cloudflare quem builda, com um token dela mesma, não com credencial sua.

1. Dashboard da Cloudflare → **Workers & Pages** → **Create** → **Workers** → **Import a repository** (é a feature "Workers Builds").
2. Autorize o GitHub App da Cloudflare (Only select repos → `fazendinha`), igual já fez pro Pages.
3. Selecione o repo + branch **`deploy-cloudflare`** (é o que está sendo testado agora; trocar pra `main` só depois que esta branch for mergeada).
4. Configurações de build (mesma lógica do Pages em §2.2, adaptada — **Root directory** fica vazio/raiz do repo, é onde `wrangler.jsonc` e o lockfile único vivem):

| Campo | Valor |
| --- | --- |
| Root directory | (vazio — raiz do repo) |
| Build command | `corepack enable && pnpm install --frozen-lockfile && pnpm --filter rionovo-server exec prisma generate && pnpm cf:build` |
| Deploy command | `sh scripts/cf-deploy.sh` |

   O Workers Builds tem uma etapa própria de instalação automática de dependências **antes** do Build command (equivalente a `npm ci`/`pnpm install --frozen-lockfile`, detecta o lockfile/`packageManager` sozinho) — mas rodar o install explícito aqui, igual ao `render.yaml` (§1.3), dá mais controle e previsibilidade do que confiar num passo implícito da plataforma (não documentado em detalhe: não dá pra confirmar, por exemplo, se ele roda lifecycle scripts como `postinstall`). Por isso o passo automático é desligado com `SKIP_DEPENDENCY_INSTALL=1` (Build variables, item 5) e o Build command replica o mesmo install do Render. `pnpm cf:build` builda só o client (`client/dist`); o server **não** passa por `tsc` aqui — diferente do Render, o Worker não roda `dist/`, o `wrangler deploy` (dentro do `cf-deploy.sh`) bunda `worker.ts` direto via esbuild no passo de deploy. O `scripts/cf-deploy.sh` (baseado no `scripts/deploy.sh` do kumon) substitui o `npx wrangler deploy` default: roda `prisma migrate deploy` antes, aborta o build se as migrations falharem (nunca deploya um Worker contra um schema desatualizado), e depois de deployar confere via `/api/health` que o commit novo está de fato no ar, com retry pra dar tempo da propagação nas edges da Cloudflare.

5. **Build variables and secrets** (aba própria, escopo só do build — não confundir com as Variables/Secrets de runtime do passo 6): `SKIP_DEPENDENCY_INSTALL` = `1` (Text) — desliga o install automático da Cloudflare, já que o Build command acima faz isso explicitamente. `DATABASE_URL` e `DIRECT_URL` (tipo **Secret**), que `cf-deploy.sh` lê pra rodar `prisma migrate deploy`. `APP_BASE_URL` (tipo Text, mesmo valor do passo 6 — ex.: `https://fazendinha.<subdomínio>.workers.dev`) é opcional — sem ela (tipicamente só no primeiro deploy, antes de existir uma URL pra configurar), o script cai pro workers.dev que o próprio `wrangler deploy` acabou de imprimir, então o health check pós-deploy roda de qualquer forma; só pula de verdade se nem isso existir (ex.: `workers_dev` desativado e sem custom domain). `APP_BASE_URL` precisa existir nos **dois** escopos (Build e runtime) porque a Cloudflare trata como abas separadas, mas é a mesma env — não criar uma variável nova só pra isso.
6. Variáveis de ambiente de **runtime** (**Settings → Variables and Secrets**, depois de criado): as mesmas de `server/.env.example`. Tipo **Secret** pra `DATABASE_URL`, `JWT_SECRET`, `SHARED_ACCESS_TOKEN`, `OPENAI_API_KEY`, `LOCAL_DOWNLOAD_SECRET`, `RESEND_API_KEY`, `R2_*`, `WHATSAPP_*` — como "Text" ficam legíveis por qualquer um com acesso ao dashboard. `STORAGE_DRIVER` **precisa ser `r2`** — o driver `local` não funciona dentro do Worker (sem filesystem; `getStorage()` recusa com erro claro se tentar). `APP_BASE_URL` aqui deve ser a URL pública do próprio Worker (mesmo valor do passo 5, é o que o `cf-deploy.sh` reusa pro health check). `keep_vars: true` no `wrangler.jsonc` garante que essas variáveis sobrevivem aos próximos deploys automáticos.
7. Salvar dispara o primeiro build. Depois disso, todo push na `main` builda e deploya sozinho — igual ao Pages hoje.

> O histórico de migrations foi consolidado em `20260925120000_baseline` + `20260925130000_pecuaria_v1_rebanho` (PR #296; ver §1.4) — `prisma migrate deploy` contra um banco vazio foi confirmado de ponta a ponta. O risco de drift comentado no topo de `scripts/cf-deploy.sh` (Neon de produção sincronizado historicamente por `db push`, não por `migrate deploy`) continua valendo — é sobre o **estado do banco de produção**, não sobre os arquivos de migration; se `cf-deploy.sh` abortar por isso no primeiro deploy, seguir o §1.4 ("Histórico consolidado").

### 6.3. Teste local opcional (sem afetar o Worker do dashboard)

`wrangler dev` roda o Worker localmente via Miniflare — **não precisa de login** pra isso, desde que não use nenhum binding remoto (o único binding daqui é `ASSETS`, que é local):

```bash
pnpm cf:build     # só o client (vite build → client/dist)
pnpm cf:dev       # build + wrangler dev (Worker de teste local, com Miniflare)
```

Cria um `.dev.vars` na raiz (formato `.env`, git-ignorado) com as mesmas envs, pra `wrangler dev` ter o que validar. Isso é só pra testar antes de dar `git push` — quem builda/deploya de verdade é o dashboard (§6.2), não o `wrangler deploy` local (`pnpm cf:deploy` continua existindo no `package.json` só como via de emergência, não é o fluxo esperado).

Schema do banco e os três bootstraps continuam manuais e iguais ao fluxo do Render (§1.4, §1.5) — são scripts Node, rodam local ou em CI apontando `DATABASE_URL` pro Neon, não dentro do Worker:

```bash
pnpm --filter rionovo-server exec prisma migrate deploy
pnpm --filter rionovo-server run backfill:propriedade
pnpm --filter rionovo-server run bootstrap:dono
pnpm --filter rionovo-server run bootstrap:resultados-ginecologicos
```

### 6.4. Smoke test

```bash
WORKER=https://fazendinha.<subdomínio>.workers.dev

curl $WORKER/api/health | jq            # {status, runtime:"cloudflare-workers", database, config, migrations, commit, buildId}
curl -I $WORKER                          # front (index.html)
curl -i $WORKER/api/financeiro/dashboard | head -1   # 401 sem token
```

`runtime: "cloudflare-workers"` na resposta do `/api/health` confirma que é o adapter do Neon (não o `pg`) respondendo — se aparecer `"node"`, o Worker não está rodando onde deveria.

### 6.5. Troubleshooting específico do Worker

- **`wrangler deploy` recusa subir um asset chamado `_worker.js`:** só acontece se `client/public/_worker.js` (do Pages) voltar a existir nesta branch — nela ele foi removido de propósito (§6.1). Se reaparecer (ex.: merge de `main`), resolver com `.assetsignore` (conteúdo `_worker.js`, na raiz de `client/public/`) em vez de recriar o arquivo removido.
- **Erro de import/módulo Node no bundle do Worker:** algo importou um módulo `node:*` sem suporte no `nodejs_compat` (ex.: `node:fs` fora do padrão lazy-import que `storage.ts` já usa) estaticamente no topo de um arquivo alcançável a partir de `worker.ts`. Ver o comentário em `server/src/lib/storage.ts` sobre por que isso importa.
- **`STORAGE_DRIVER=local não funciona dentro de um Cloudflare Worker`:** erro esperado — trocar pra `r2` nas envs do Worker (§6.2).
- **`/api/health` volta `database.connected:false`:** confira se a secret `DATABASE_URL` está setada no Worker (não só no `.dev.vars` local) e se é a connection string **pooled** do Neon.
- **`/api/health` volta `config.ok:false`:** alguma env obrigatória falhou a validação Zod — olhar os logs do Worker (dashboard → Logs, com `observability.enabled` já ligado) pra ver o `[health] configuração inválida:` com os campos.
