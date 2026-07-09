# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Domínio

Sistema de gestão da **Fazenda Rio Novo**. Nasceu como o relatório gerencial de fluxo de caixa (hoje feito em Excel, com tabelas dinâmicas lendo bancos Access do BPO) e cresceu para um **ERP de fazenda** com módulos operacionais além do financeiro. Identificadores no código (modelos, campos, rotas) seguem **português** — `Lancamento`, `Categoria`, `CentroCusto`, `GrupoCategoria`, `ClienteFornecedor`, `FechamentoMensal`. Mensagens ao usuário também em PT-BR.

**Financeiro** (núcleo): regime de **caixa** — lançamentos `LIQUIDADO` alimentam o *Realizado*; `ABERTO` (a vencer) alimentam a *Projeção*. Existe um Excel real (`Relatório Rio Novo 2026.05.04.xlsx`) e um extrator Python (`scripts/extract_rio_novo.py`) que lê o pivotCache, filtra `*Fonte = RIO NOVO` e gera ~6.700 lançamentos em `server/prisma/rio_novo.json`. O schema Prisma foi modelado contra esses dados reais — **não inventar campos**, sempre conferir o schema antes de propor mudanças.

**Módulos operacionais** (fatos próprios, cada um com dashboard + IA):
- **rebanho** — gado leiteiro (animais, reprodução, sanidade, nutrição, produção de leite, estoque de insumos, custo de produção/sanidade).
- **corte** — gado de corte (lotes, piquetes, pesagens, manejo sanitário, suplementação, operações comerciais).
- **plantio** — lavoura de café (talhões, fenologia, MIP, adubação, colheita, apontamento de máquinas).
- **cultivo / milho** — safras de grãos e silos (áreas, produção, movimentos de silo, custo por safra).
- **equipe / ponto** — funcionários, registro de ponto, folha, rateio de custo de mão de obra por setor.
- **caixinha** — caixa/dinheiro físico (petty cash), com movimentos que espelham lançamentos.
- **WhatsApp bot** — assistente conversacional (OpenAI) que responde perguntas e lança gastos via Meta Cloud API.
- **Notas fiscais** — upload + OCR (Tesseract) para extrair dados e validar contra lançamentos.

Docs de referência profunda vivem em `.md` na raiz (`ARCHITECTURE.md`, `DOMAIN.md`, `PRODUCT.md`, `METRICS.md`, `DEPLOY.md`, `ROADMAP.md`, `AI_RULES.md`) e em `docs/` (design specs e planos por fatia). Consultar quando precisar de detalhe além deste arquivo — **não criar novos** salvo pedido.

## Stack

- Monorepo **pnpm workspaces** (lockfile único na raiz). Workspaces: `client`, `server`.
- Backend: **Hono** sobre Node.js (`@hono/node-server`), **Prisma 6**, **Zod**, validador HTTP via **`@hono/zod-validator`**. IA via **`openai`** (bot + insights). OCR via **`tesseract.js`** + **`sharp`** + **`pdf-parse`**. Storage de anexos via **`@aws-sdk/client-s3`** (Cloudflare R2, S3-compatible) ou disco local.
- Frontend: **React 18 + Vite 6 + TypeScript**. Gráficos financeiros são **SVG inline próprios** em `client/src/components/charts.tsx`. `recharts` e `html2pdf.js` estão instalados e em uso pontual.
- Testes: **Vitest** nos dois workspaces (`*.test.ts` colocados ao lado do código, ~60 arquivos — a maioria em `server/src/services/**` cobrindo cálculos financeiros/zootécnicos).
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
pnpm --filter rionovo-server run db:push                 # sincroniza schema sem migration (é o que roda em prod)
pnpm --filter rionovo-server run seed                    # dados de exemplo do financeiro (prisma/seed.ts)
pnpm --filter rionovo-server run seed:rebanho            # (+ seed:plantio, seed:corte, seed:ponto, seed:plantios)
pnpm --filter rionovo-server run import                  # importa o histórico real do rio_novo.json
pnpm --filter rionovo-server run import:rebanho          # importa rebanho_real.json
pnpm --filter rionovo-server run whatsapp:user           # gerencia allowlist de números do bot
```

Testes (Vitest, na raiz de cada workspace):

```bash
pnpm --filter rionovo-server run test          # roda todos os testes do backend (vitest run)
pnpm --filter rionovo-client run test          # roda os testes do frontend
pnpm --filter rionovo-server exec vitest run src/services/ponto/folha.test.ts   # um arquivo só
pnpm --filter rionovo-server exec vitest -t "nome do teste"                      # por nome (watch)
```

Não há target `test` na raiz — rodar por workspace via `--filter`.

## Variáveis de ambiente

`server/.env` (copiar de `server/.env.example`). Validado por Zod em `server/src/env.ts` — importar de lá, nunca `process.env`. Muitas são opcionais e desligam features graciosamente quando ausentes:

- `DATABASE_URL` — string Neon pooled (`?sslmode=require&channel_binding=require`). **Única obrigatória.**
- `PORT` — porta do backend (default 41873). `NODE_ENV`, `JWT_SECRET` (placeholder).
- `CORS_ORIGIN` — CSV de origens permitidas; vazio libera tudo (dev). Setar em prod.
- `SHARED_ACCESS_TOKEN` — senha compartilhada de porta de entrada (piloto, ≥16 chars). Se setado, todas as rotas exceto `/api/health` e `/api/whatsapp/*` exigem `Authorization: Bearer <token>`. Vazio = porta aberta (dev). **Não** é sistema de usuários — é auth mínima até escalar.
- `OPENAI_API_KEY` (+ `OPENAI_MODEL`, default `gpt-4o`) — cérebro do bot e da IA do rebanho. Sem a chave: bot desligado (503) e IA em modo demonstração (regras locais).
- `WHATSAPP_*` (`VERIFY_TOKEN`, `ACCESS_TOKEN`, `PHONE_NUMBER_ID`, `APP_SECRET`) — canal Meta Cloud API; todos necessários p/ o webhook.
- `DATABASE_URL_READONLY` — role só-leitura p/ a ferramenta `consulta_sql` do bot. Sem ela o escape hatch de SQL fica desligado.
- `STORAGE_DRIVER` (`local`|`r2`) — anexos de nota fiscal. `r2` exige `R2_ACCOUNT_ID`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_BUCKET_NOTAS` (validado por `superRefine`). `local` guarda em `LOCAL_STORAGE_DIR` (`.uploads/`).
- `OCR_ENABLED` — Tesseract; deixe `false` em dev p/ boot rápido (evita baixar ~70MB de dados de português).
- `DASHBOARD_MESES_QUEIMA` — meses na média da "queima mensal" do fôlego de caixa (default 6).

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

Hono modular com ~50 roteadores por domínio, montados em `index.ts`:

- `index.ts` — bootstrap. Aplica `logger()` global, depois `cors()` e `authMiddleware` em `/api/*`, e monta cada router via `app.route("/api", router)`. **Ordem importa:** rotas isentas de auth (`health`, `whatsapp`) precisam ser montadas antes do `authMiddleware`. No boot também dispara `garantirFundacaoPropriedade()` (backfill multi-propriedade) e `iniciarCleanupPendentes()` (limpeza de uploads pendentes de NF).
- `env.ts` — valida `process.env` com Zod; falha rápido (`process.exit(1)`) se inválido. Importar daqui em vez de `process.env`.
- `db.ts` — singleton `PrismaClient` à prova de HMR (guarda em `globalThis` em dev).
- `middleware/auth.ts` — Bearer token vs `SHARED_ACCESS_TOKEN` (timing-safe). Sem token no env, libera tudo (dev).
- `routes/` — cada arquivo exporta um `Hono()` chained. Roteadores dos módulos operacionais ficam em subpastas (`routes/rebanho/`, `routes/corte/`, `routes/plantio/`, `routes/cultivo/`, `routes/ponto/`). As rotas são **finas**: validam com `zValidator` e delegam a lógica para `services/`.
- `services/` — **onde vive a regra de negócio e o que é testado.** Mesma organização por domínio (`services/rebanho/`, `services/corte/`, etc.). Arquivos com sufixos como `.calc.ts`, `.recompute.ts`, `.agg.ts`, `.mappers.ts`, `.schemas.ts` isolam cálculo puro (fácil de testar) de I/O Prisma. Ao criar uma rota nova, siga esse split: rota → service → (calc puro + mappers + schemas).
- `lib/` — infra transversal: `ocr.ts` (Tesseract), `storage.ts` (local vs R2).
- `scripts/allowlist.ts` — CLI de manutenção (allowlist do WhatsApp).

Padrão de validação de payload:

```ts
import { zValidator } from "@hono/zod-validator";
const schema = z.object({ ... });
router.post("/x", zValidator("json", schema), async (c) => {
  const body = c.req.valid("json"); // tipado
});
```

### Frontend (`client/src/`)

- `main.tsx` → `App.tsx`. O `App.tsx` troca de "aba" via `useState<Tab>` (**sem react-router**). `router.ts` faz só a ponte bidirecional `Tab ⇄ pathname` (deep-link, reload, back/forward) — abas financeiras têm slug fixo; módulos operacionais viram caminhos aninhados por prefixo (`reb-`, `pla-`, `cor-`, `mil-`, `eqp-` → `/rebanho/<sub>`, etc.).
- `components/Shell.tsx` exporta o tipo `Tab` (fonte de verdade das abas). `AppSidebar.tsx` é a navegação principal. `CommandPalette.tsx` (⌘K) usa `lib/searchIndex.ts`. `Login.tsx` + `lib/auth.ts` guardam o token do piloto.
- **Módulos operacionais** (`client/src/rebanho/`, `corte/`, `plantio/`, `cultivo/`, `equipe/`, `financeiro/`) seguem um layout repetido: `nav.ts` (sub-abas) · `domains.tsx` · `<Modulo>Content.tsx` (entrypoint) · `api.ts` (fetch tipado do módulo) · `types.ts` · `HOJE.ts` (data corrente via `lib/hoje.ts`) · `components/` · `mock/` (fallback/demo) · `lib/` (derive/worklists puros, com testes). Ao adicionar um módulo, copie essa forma.
- **Estado de dados: híbrido.** Cada módulo tem seu `api.ts` que bate na API real; o financeiro usa `client/src/api.ts` (nota o mapeamento de compat mock↔API dentro de `fetchDashboard`). Partes ainda sem backend leem de `data/*` (mock). `data/rionovo.ts` (export default `R`, `any`) é a referência da forma do financeiro (planilha real Jul/2024→Mai/2026).
- `propriedadeScope.ts` — sítio ativo (multi-propriedade). `comPropriedade(headers)` é o envelope padrão de TODA request: injeta `Authorization` (via `lib/auth`) e `X-Propriedade-Id`. **Usar sempre** ao escrever fetch novo.
- `components/charts.tsx` — SVG inline: `MonthlyFlowChart`, `WaterfallChart`, `MiniBarChart`, `MonthlyTrendChart`, `Donut`. Exporta os formatadores `fmt`, `fmtBR`, `fmtMoney`, `fmtMoneyExact` — **reusar daqui**, não recriar.
- `components/Gastos.tsx` exporta `ActivityPill` (Leite/Café/Outros/Misto) — reusado em vez de duplicado.
- `components/DateRangePicker.tsx` / `MonthRangePicker.tsx` — calendários pt-BR com presets.

Estilos em `client/src/styles/` (importados de `main.tsx`) + CSS por módulo (`rebanho/styles/rebanho.css`):
- `base.css` (paleta + tipografia + componentes compartilhados, **define as variáveis CSS**), depois `dashboard.css`, `dashboard-v2.css`, `forms.css`, `datepicker.css`, `cockpit.css`, `command-palette.css`, `relatorio.css`, `simulador.css`, `vigilancia.css`, `chat.css`, `acessos.css`, `terrano-intro.css`, `typescale.css`.

Cores de atividade são variáveis CSS — `--leite` (brass), `--cafe` (deep coffee), `--outros` (sage olive). **Sempre referenciar via var()**, não hardcodar hex.

Fontes carregadas de Google Fonts no `index.html`: Newsreader (serif, displays) + DM Sans (sans, body). Não bundlar.

Vite (porta 41875) faz proxy de `/api` para `http://localhost:41873` (ver `vite.config.ts`).

#### Padrão de "olhar a fonte de dados real" no Dashboard
A pergunta editorial "**O leite paga o leite?**" foi removida do Dashboard a pedido do usuário e existe **só no Relatório**. Dashboard tem 4 seções numeradas (I Timeline 23m · II DRE · III Categorias · IV Inconsistências). Não recolocar no Dashboard.

### Schema Prisma

`server/prisma/schema.prisma` é grande (~110 models + enums). Núcleo financeiro:

- `Lancamento` — fato central. Tem `natureza` (CREDITO/DEBITO), `valor` sempre **positivo** (o sinal vem da natureza), três datas (`dataCompetencia`, `dataVencimento`, `dataLiquidacao`), `situacao` (ABERTO/LIQUIDADO/LIQUIDADO_PARCIAL), `estornado`.
- Dimensões: `Categoria` ⊂ `GrupoCategoria` (plano de contas gerencial), `CentroCusto` (Leite/Café/Investimento), `ContaBancaria`, `ClienteFornecedor`, `Produto`.
- `FechamentoMensal` — meses fechados; lançamentos cuja data de caixa cai num mês fechado **não podem ser criados/editados/excluídos**. Qualquer rota CRUD de `Lancamento` precisa respeitar isso.
- `Caixinha`/`MovimentoCaixinha` — caixa físico. Notas: `NotaFiscalArquivo`, `NotaFiscalUploadPendente`.

Blocos dos módulos operacionais (todos com resumos pré-computados por `*.recompute.ts`): rebanho (`Animal`, `ResumoAnimal`, `EventoReprodutivo`, `EventoSanitario`, `Lactacao`, `Pesagem`, `Dieta`, `MovimentoEstoque`, `Raca`, `Grupo`), corte (`LoteCorte`, `ResumoLote`, `Piquete`, `PesagemLote`, `Suplementacao`, `OperacaoComercial`), plantio (`Talhao`, `ResumoTalhao`, `Lavoura`, `SafraTalhao`, `OperacaoAgricola`, `InspecaoMIP`, `PassadaColheita`), cultivo/milho (`SafraCultivo`, `AreaCultivo`, `Silo`, `MovimentoSilo`, `ProducaoCultivo`), ponto (`Funcionario`, `RegistroPonto`), WhatsApp (`UsuarioWhatsapp`, `ConversaWhatsapp`, `MensagemWhatsapp`, `LancamentoRascunho`).

Decimal usa `@db.Decimal(14, 2)` — sempre converter via Prisma Decimal, nunca tratar como `number` JS direto em cálculos financeiros.

**Sync de schema:** em prod o `start:prod` roda `prisma db push` (não `migrate deploy`). Migrations em `server/prisma/migrations/` existem mas nem tudo tem migration de `CREATE TABLE` (ver pegadinha de deploy abaixo). Para schema novo em dev, `prisma migrate dev` exige `DIRECT_URL` (ver seção Pooled vs direct URL).

### Multi-propriedade (escopo de sítio) — IMPLEMENTADO

Feature transversal (toca quase todos os módulos): cada fato ganha `propriedadeId Int?` nullable e as leituras filtram por sítio; fazenda de 1 sítio não percebe a camada (a principal é resolvida invisivelmente). **Design + estado final + decisões em [docs/design/multi-propriedade.md](docs/design/multi-propriedade.md) (seções 8 e 9)** — ler antes de escopar um fato novo. Padrão resumido: `propriedadeId Int?` + `@@index` + inverse em `Propriedade` → migration aditiva (`ADD COLUMN`+`UPDATE SET=1`+index+FK) → **backfill no boot** (`garantirFundacaoPropriedade` em `server/src/services/propriedade.ts`) → rota resolve `resolverEscopoLeitura/Escrita(c)` → front usa `comPropriedade()` (`client/src/propriedadeScope.ts`). Cadastros de referência (Produto, Raca, CentroCusto, etc.) e `FechamentoMensal` são **compartilhados** de propósito.

**Pegadinha de deploy:** o sync real é `prisma db push` (roda no `start:prod`), que **não executa** o SQL de backfill das migrations — por isso o backfill vive no boot. `Caixinha`/`MovimentoCaixinha` **não têm migration de `CREATE TABLE`** (só nascem via `db push`), então `migrate deploy` do zero quebra no `ALTER TABLE "Caixinha"` (`P3018`); recuperar com `migrate resolve --rolled-back <migration> && db push`. Detalhes na seção 9 do doc.

## Convenções

- ESM em tudo (`"type": "module"`). No **server**, imports relativos de `.ts` precisam terminar em `.js` (ex.: `import { env } from "./env.js"`) — Node ESM exige. No **client** (Vite + bundler resolution), imports relativos **não** levam extensão.
- Code/comments podem ser em PT-BR (consistente com a base existente).
- Não criar arquivos `.md` de documentação extra a não ser que pedido — o README e este arquivo já cobrem.

## Ligando uma tela nova ao backend

O backend já está plugado na maior parte do app; ainda há telas em mock. Para migrar uma:
1. **Backend:** rota fina em `server/src/routes/<modulo>/` → service em `services/<modulo>/`, com o cálculo puro isolado em `*.calc.ts` e testado (`*.calc.test.ts`). Respeitar escopo de propriedade (`resolverEscopoLeitura/Escrita(c)`) e `FechamentoMensal` em qualquer escrita de `Lancamento`.
2. **Frontend:** função no `api.ts` do módulo usando `comPropriedade()` nos headers. Trocar o import de `data/*` (mock) pela chamada real. Manter o mock como referência da forma até estabilizar.
