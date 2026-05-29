# Sistema de Gestão Financeira — Fazenda Rio Novo

Reescreve, como software próprio, o **relatório gerencial de fluxo de caixa** que hoje é montado em Excel (tabelas dinâmicas lendo bancos Access do BPO). Os lançamentos passam a viver em banco próprio (PostgreSQL/Neon) e os relatórios são gerados por código.

Regime de **caixa**: lançamentos `LIQUIDADO` alimentam o *Realizado*; `ABERTO` (a vencer) alimentam a *Projeção*.

## Stack

- **Backend:** Node.js + TypeScript, [Hono](https://hono.dev/), Prisma ORM, Zod — `server/`
- **Frontend:** React + TypeScript + Vite — `client/`
- **Banco:** PostgreSQL via [Neon](https://neon.tech/) (serverless)
- **Monorepo:** pnpm workspaces

## Estrutura

```
fazendinha/
├── client/          frontend Vite + React
├── server/          backend Hono + Prisma
├── scripts/         utilitários Python (extrator do .xlsx legado)
└── package.json     orquestração do workspace
```

## Pré-requisitos

- Node 20+
- pnpm 10+
- Projeto Neon (free tier resolve)

## Setup

```bash
# 1. Instalar dependências
pnpm install

# 2. Configurar conexão com o Neon
cp server/.env.example server/.env
# edite server/.env e cole o DATABASE_URL do Neon

# 3. Aplicar o schema no banco
pnpm prisma:migrate

# 4. Subir tudo (backend em :41873, frontend em :41875)
pnpm dev
```

Abra http://localhost:41875.

## Scripts úteis

| Comando | O que faz |
|---|---|
| `pnpm dev` | Sobe server e client em paralelo |
| `pnpm dev:server` | Só o backend |
| `pnpm dev:client` | Só o frontend |
| `pnpm build` | Build de produção dos dois |
| `pnpm prisma:generate` | Regera o Prisma Client |
| `pnpm prisma:migrate` | Aplica migrations no Neon |
| `pnpm prisma:studio` | Abre o Prisma Studio |

## Health checks

- `GET http://localhost:41873/api/health` → `{ "ok": true }`
- `GET http://localhost:41873/api/health/db` → `{ "ok": true, "db": "up" }` (valida Prisma + Neon)
