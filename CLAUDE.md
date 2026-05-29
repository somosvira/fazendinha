# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Domínio

Sistema de gestão financeira da **Fazenda Rio Novo** — reimplementa o relatório gerencial de fluxo de caixa que hoje é feito em Excel (tabelas dinâmicas lendo bancos Access do BPO). Regime de **caixa**: lançamentos `LIQUIDADO` alimentam o *Realizado*; `ABERTO` (a vencer) alimentam a *Projeção*. Identificadores no código (modelos, campos, rotas) seguem **português** — `Lancamento`, `Categoria`, `CentroCusto`, `GrupoCategoria`, `ClienteFornecedor`, `FechamentoMensal`. Mensagens ao usuário também em PT-BR.

Existe um Excel real (`Relatório Rio Novo 2026.05.04.xlsx`) e um extrator Python (`scripts/extract_rio_novo.py`) que lê o pivotCache, filtra `*Fonte = RIO NOVO` e gera ~6.700 lançamentos em `server/prisma/rio_novo.json`. O schema Prisma foi modelado contra esses dados reais — **não inventar campos**, sempre conferir o schema antes de propor mudanças.

## Stack

- Monorepo **pnpm workspaces** (lockfile único na raiz). Workspaces: `client`, `server`.
- Backend: **Hono** sobre Node.js (`@hono/node-server`), **Prisma 6**, **Zod**, validador HTTP via **`@hono/zod-validator`**.
- Frontend: **React 18 + Vite 6 + TypeScript**, gráficos com **Recharts**.
- Banco: **Neon** (Postgres serverless). Conexão usa endpoint **pooled** (PgBouncer transaction mode).

## Comandos

Tudo é orquestrado pela raiz:

```bash
pnpm install            # workspace inteiro
pnpm dev                # sobe server (41873) e client (41875) em paralelo
pnpm dev:server         # só backend
pnpm dev:client         # só frontend
pnpm build              # build dos dois workspaces (tsc + vite build)
pnpm prisma:generate    # regera Prisma Client (delega ao server)
pnpm prisma:migrate     # prisma migrate dev (requer DIRECT_URL — ver abaixo)
pnpm prisma:studio      # abre Prisma Studio
```

Scripts no workspace `server/`:

```bash
pnpm --filter rionovo-server exec prisma migrate deploy  # aplica migrations existentes (funciona via pooler)
pnpm --filter rionovo-server run seed                    # popula com dados de exemplo (prisma/seed.ts)
pnpm --filter rionovo-server run import                  # importa o histórico real do rio_novo.json
```

Não há suite de testes ainda.

## Variáveis de ambiente

`server/.env` (copiar de `server/.env.example`):

- `DATABASE_URL` — string Neon pooled (`?sslmode=require&channel_binding=require`).
- `PORT` — porta do backend (default 41873).
- `JWT_SECRET` — placeholder; só passa a importar quando auth for implementada.

`tsx` e `node` **não carregam `.env` automaticamente** neste projeto — os scripts `dev` e `start` em `server/package.json` passam `--env-file=.env` ao Node (Node 20+ suporta nativo). Se for criar um script que executa código TS, mantenha esse flag ou a validação Zod em `server/src/env.ts` vai abortar com `DATABASE_URL: ['Required']`.

Prisma carrega `.env` por conta própria — comandos `prisma *` funcionam sem o flag.

## Pooled vs direct URL (Neon)

- A `DATABASE_URL` é a **pooled** (`-pooler` no host). Funciona para runtime e para `prisma migrate deploy` (apenas aplica SQL).
- `prisma migrate dev` precisa de uma **shadow database** e geralmente falha via pooler. Quando for criar uma migration nova:
  1. Pegar a URL **direct** do Neon (mesma URL sem `-pooler`).
  2. Adicionar `directUrl = env("DIRECT_URL")` no bloco `datasource db` do `schema.prisma`.
  3. Adicionar `DIRECT_URL=...` em `server/.env`.

## Arquitetura

### Backend (`server/src/`)

Hono modular com roteadores por domínio:

- `index.ts` — bootstrap. Aplica `logger()` global, `cors()` em `/api/*`, monta cada router em `/api` via `app.route("/api", router)`. Serve via `@hono/node-server`.
- `env.ts` — valida `process.env` com Zod; falha rápido (`process.exit(1)`) se inválido. Importar daqui em vez de `process.env`.
- `db.ts` — singleton `PrismaClient` à prova de HMR (guarda em `globalThis` em dev).
- `routes/` — cada arquivo exporta um `Hono()` chained (`new Hono().get(...).post(...)`); o chaining preserva os tipos das rotas, útil se for adicionar [hono/client](https://hono.dev/docs/guides/rpc) depois.
- `routes/health.ts` é o template — copiar a forma dele ao criar novas rotas.

Padrão para validação de payload (quando criar rotas reais):

```ts
import { zValidator } from "@hono/zod-validator";
const schema = z.object({ ... });
router.post("/x", zValidator("json", schema), async (c) => {
  const body = c.req.valid("json"); // tipado
});
```

Estado pós-setup: **apenas `routes/health.ts` existe**. Auth, lançamentos, cadastros, relatórios, fechamentos ainda não foram implementados — esperando o design do Claude Design.

### Frontend (`client/src/`)

- `main.tsx` → `App.tsx`. O `App.tsx` atual é um shell mínimo que pinga `/api/health` e `/api/health/db`; será substituído quando o design chegar.
- `api.ts` — wrapper de fetch já pronto: `apiGet`, `apiSend`, `download`, `login`, gerenciamento de token JWT em localStorage (`rionovo_token`), handler global de 401 (`setUnauthorizedHandler`). **Reaproveitar** em vez de fazer fetch direto.
- `types.ts` está vazio aguardando o design.
- Vite faz proxy de `/api` para `http://localhost:41873` (ver `vite.config.ts`).

### Schema Prisma

`server/prisma/schema.prisma` modela:

- `Lancamento` — fato central. Tem `natureza` (CREDITO/DEBITO), `valor` sempre **positivo** (o sinal vem da natureza), três datas (`dataCompetencia`, `dataVencimento`, `dataLiquidacao`), `situacao` (ABERTO/LIQUIDADO/LIQUIDADO_PARCIAL), `estornado`.
- Dimensões: `Categoria` ⊂ `GrupoCategoria` (plano de contas gerencial), `CentroCusto` (Leite/Café/Investimento), `ContaBancaria`, `ClienteFornecedor`.
- `FechamentoMensal` — meses fechados; lançamentos cuja data de caixa cai num mês fechado **não podem ser criados/editados/excluídos**. Qualquer rota CRUD de `Lancamento` precisa respeitar isso.

Decimal usa `@db.Decimal(14, 2)` — sempre converter via Prisma Decimal, nunca tratar como `number` JS direto em cálculos financeiros.

Migrations em `server/prisma/migrations/` foram aplicadas no Neon via `migrate deploy`. A `seed.ts` e `import.ts` ainda usam imports antigos — **podem precisar de ajuste** se forem reativadas.

## Convenções

- ESM em tudo (`"type": "module"`). Imports relativos de `.ts` usam extensão `.js` (ex.: `import { env } from "./env.js"`) porque o TypeScript com `module: ESNext` + Node ESM exige assim.
- Code/comments podem ser em PT-BR (consistente com a base existente).
- Não criar arquivos `.md` de documentação extra a não ser que pedido — o README e este arquivo já cobrem.
