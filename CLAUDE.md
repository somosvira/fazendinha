# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Domínio

Sistema de gestão da **Fazenda Rio Novo** (produto: **Fazendinha / Terrano**). Nasceu como o relatório gerencial de fluxo de caixa (feito em Excel lendo bancos Access do BPO) e cresceu para um **ERP de fazenda** com módulos operacionais além do financeiro. Identificadores no código (modelos, campos, rotas) seguem **português** — `Operacao`, `CompromissoFinanceiro`, `Categoria`, `CentroCusto`, `Parceiro`, `Animal`, `Talhao`. Mensagens ao usuário também em PT-BR.

**Financeiro** (núcleo, **reconstruído em ago/set 2026** — branch `financeiro-rebuild`, PR #243): o modelo separa o **fato de negócio** (`Operacao` + `ItemOperacao`), o **valor pendente** (`CompromissoFinanceiro` + `Liquidacao`), o **dinheiro realizado** (`TransacaoFinanceira` → `MovimentoConta`, única fonte de alteração de saldo de `ContaFinanceira`) e o **efeito físico** (`MovimentoEstoque`). Regras fixadas em [docs/financeiro-rebuild-contrato.md](docs/financeiro-rebuild-contrato.md) — ler antes de mexer: compromisso não altera saldo; compra à vista não cria compromisso; liquidação nunca supera o saldo pendente; registros confirmados **não são apagados, são estornados** com evento inverso e `AuditoriaFinanceira`; `PeriodoFinanceiro` FECHADO bloqueia escrita/estorno no mês. O modelo legado (`Lancamento`, `FechamentoMensal`, `Caixinha`, `ClienteFornecedor`, `NotaFiscal*`) **não existe mais** no schema. O Excel histórico e o extrator (`scripts/extract_rio_novo.py` → `server/prisma/rio_novo.json`) seguem no repo como referência, mas **não há importador** para o modelo novo. **Não inventar campos** — sempre conferir o schema antes de propor mudanças.

**Módulos operacionais** (fatos próprios, cada um com dashboard + IA):
- **pecuária (v1 — Rebanho)** — schema Postgres **`pecuaria`** separado (`Animal`, `Raca`, `ComposicaoRacial`, `Lote`, `LocalizacaoAnimal`, `DestinoAnimal`, `SaidaAnimal`, `MotivoSaida`, `Pesagem`, `AuditoriaPecuaria`), carga do IDEAGRI via `import:pecuaria` (idempotente por `ideagriId`). Rota `/api/pecuaria/rebanho/*`, tela `/pecuaria/rebanho` (`client/src/pecuaria/`). Domínios seguintes (genética, sanidade, reprodução, leite) entram em cascata ligando por chave. O módulo **legado** de rebanho leiteiro + gado de corte (`public`: `Grupo`, `LoteCorte`, IATF, FIV, dieta, tanque…) foi **removido** em set/2026 (migration `remover_pecuaria_legada`) — não reintroduzir.
- **plantio** — lavoura de café (talhões, fenologia, MIP, adubação, colheita, planejamento, apontamento de máquinas).
- **cultivo / milho** — safras de grãos e silos (áreas, produção, movimentos de silo, custo por safra).
- **equipe / ponto** — funcionários, registro de ponto, folha, rateio de custo de mão de obra por setor.
- **Contas e acessos** — usuários reais com papéis, áreas (`financeiro`/`pecuaria`/`agricultura`/`equipe`) e flags de permissão (ver seção Auth).
- **WhatsApp bot** — assistente conversacional (OpenAI) via Meta Cloud API; consulta pelo motor estruturado (`services/consulta/`), sem SQL gerado pelo LLM.
- **Documentos financeiros** — upload de comprovantes/notas anexados a operações e rascunhos (`DocumentoFinanceiro`), storage local ou R2. Sem OCR/extração de dados.

Docs de referência profunda vivem em `.md` na raiz (`ARCHITECTURE.md`, `DOMAIN.md`, `PRODUCT.md`, `METRICS.md`, `DEPLOY.md`, `ROADMAP.md`, `AI_RULES.md`, `DESIGN.md`, `COMPONENTS.md`) e em `docs/` (design specs em `docs/design/`, planos/specs em `docs/superpowers/`, handoffs e auditorias datadas). Em caso de conflito, **este arquivo e o schema prevalecem**. Consultar quando precisar de detalhe além deste arquivo — **não criar novos `.md`** salvo pedido.

## Stack

- Monorepo **pnpm workspaces** (`pnpm-workspace.yaml`: `client`, `server`; `packageManager: pnpm@10.7.1`, lockfile único na raiz). Node 22 (`wrangler` exige `>=22`).
- Backend: **Hono** sobre Node.js (`@hono/node-server`), **Prisma 6**, **Zod**, validador HTTP via **`@hono/zod-validator`**. IA via **`openai`** (bot + insights). Storage de anexos via **`@aws-sdk/client-s3`** (Cloudflare R2) ou disco local. Sem OCR — `tesseract.js`/`sharp`/`pdf-parse` foram removidos por não estarem em uso (2026-09-10).
- Frontend: **React 18 + Vite 6 + TypeScript** + **Tailwind CSS v4** (plugin `@tailwindcss/vite`, tokens em `styles/theme.css`) + primitivas **shadcn-style** em `components/ui/` (incluindo `chart.tsx`; Radix: dialog, dropdown-menu, popover, select, label, slot; `cmdk`; `class-variance-authority`; `clsx`/`tailwind-merge`; ícones `lucide-react`). Alias `@` → `client/src`. Gráficos usam **Recharts 3** através do wrapper compartilhado `client/src/components/ui/chart.tsx` e dos componentes de domínio em `client/src/components/charts.tsx`. `html2pdf.js` é usado nos exports do relatório gerencial. **Não há `react-router`.**
- Testes: **Vitest** nos dois workspaces (`*.test.ts(x)` ao lado do código — ~155 arquivos no server, ~60 no client). Server cobre cálculos financeiros/zootécnicos em `services/**`; client cobre `lib/`, `router`, `components/ui` e alguns fluxos do financeiro.
- Banco: **Neon** (Postgres serverless). Runtime usa endpoint **pooled**; `schema.prisma` declara `directUrl = env("DIRECT_URL")`.
- CI: `.github/workflows/staging.yml` — build + testes do server em push/PR na `main`. Deploy em produção hoje: **Cloudflare Pages** (client, `_worker.js` faz proxy de `/api/*` → API) e **Render** (server, `render.yaml`). Existe também um **Cloudflare Worker único** (front+back, sem Render) preparado mas ainda não deployado de verdade — ver DEPLOY.md §6.
- `db.ts` escolhe o driver do Prisma por runtime (`@prisma/adapter-pg` fora de um Worker, `@prisma/adapter-neon` dentro — `lib/runtime.ts`), então o mesmo código já fala com Postgres local (`docker-compose.yml` na raiz, `pnpm db:local:up`) sem precisar de conta Neon em dev.

## Comandos

Tudo é orquestrado pela raiz:

```bash
pnpm install            # workspace inteiro (postinstall do server roda prisma generate)
pnpm dev                # sobe server (41873) e client (41875) em paralelo
pnpm dev:server         # só backend — roda `prisma migrate deploy` ANTES do tsx watch
pnpm dev:client         # só frontend
pnpm build              # build dos dois workspaces (tsc + vite build)
pnpm prisma:generate    # regera Prisma Client (delega ao server)
pnpm prisma:migrate     # prisma migrate dev (requer DIRECT_URL — ver abaixo)
pnpm prisma:studio      # abre Prisma Studio
pnpm gen:nav-doc        # regera docs/NAVEGACAO.md a partir de services/bot/navegacao.ts
pnpm db:local:up        # Postgres local via docker-compose (porta 54332), sem depender do Neon em dev
pnpm cf:build            # build só do client (assets do Cloudflare Worker)
pnpm cf:dev              # build + wrangler dev (Worker de teste local — ver DEPLOY.md §6)
pnpm cf:deploy           # build + wrangler deploy (produção — ver DEPLOY.md §6)
```

Scripts no workspace `server/`:

```bash
pnpm --filter rionovo-server exec prisma migrate deploy  # aplica migrations existentes (funciona via pooler)
pnpm --filter rionovo-server run db:push                 # sincroniza schema sem migration
pnpm --filter rionovo-server run seed                    # seed pequeno e determinístico do financeiro novo (prisma/seed.ts)
pnpm --filter rionovo-server run seed:usuarios           # usuários de exemplo (+ seed:plantio, seed:plantios, seed:ponto, seed:all)
pnpm --filter rionovo-server run seed:pecuaria           # catálogos da pecuária v1 (raças, motivos de saída)
pnpm --filter rionovo-server run import:pecuaria         # importa server/prisma/pecuaria_v1.json (IDEAGRI) — validar com validar:pecuaria
pnpm --filter rionovo-server run whatsapp:user           # gerencia allowlist de números do bot
pnpm --filter rionovo-server run bateria:gabarito        # bateria de perguntas da IA (gabarito) / bateria:run
pnpm --filter rionovo-server run backfill:propriedade    # scripts de bootstrap idempotentes — não rodam sozinhos
pnpm --filter rionovo-server run bootstrap:dono          # no boot (Node ou Worker); rodar manual pós-deploy
```

Testes (Vitest, na raiz de cada workspace):

```bash
pnpm --filter rionovo-server run test          # roda todos os testes do backend (vitest run)
pnpm --filter rionovo-client run test          # roda os testes do frontend
pnpm --filter rionovo-server exec vitest run src/services/financeiro/rascunhos.test.ts   # um arquivo só
pnpm --filter rionovo-server exec vitest -t "nome do teste"                              # por nome (watch)
```

Não há target `test` na raiz — rodar por workspace via `--filter`. Os testes do server importam módulos que passam por `env.ts`; sem `server/.env` exporte `DATABASE_URL` dummy (é o que o CI faz).

## Variáveis de ambiente

`server/.env` (copiar de `server/.env.example`). Validado por Zod em `server/src/env.ts` — importar de lá, nunca `process.env`. Muitas são opcionais e desligam features graciosamente quando ausentes:

- `DATABASE_URL` — string Neon pooled (`?sslmode=require&channel_binding=require`). **Única obrigatória.** `DIRECT_URL` — URL direct (sem `-pooler`), usada por `migrate dev` e `db push`.
- `PORT` — porta do backend (default 41873). `NODE_ENV`, `JWT_SECRET`.
- `CORS_ORIGIN` — CSV de origens permitidas; vazio libera tudo (dev). Setar em prod (o boot avisa).
- **Auth** — `AUTH_BOOTSTRAP_EMAIL` (+ `AUTH_BOOTSTRAP_NOME`): se setado e a tabela `Usuario` estiver vazia, o boot cria o dono PENDENTE e loga o link de definir senha. `APP_BASE_URL` — prefixo dos links de convite/reset. `AUTH_SESSAO_DIAS` — validade da sessão (sliding, default 30). `SHARED_ACCESS_TOKEN` (≥16 chars) — **ponte de transição**: se setado, vale como acesso de dono; sem ele e sem usuários no banco, a porta fica aberta (dev).
- `OPENAI_API_KEY` (+ `OPENAI_MODEL`, default `gpt-4o`) — cérebro do bot e das IAs dos módulos. Sem a chave: bot desligado (503) e IA em modo demonstração (regras locais).
- `WHATSAPP_*` (`VERIFY_TOKEN`, `ACCESS_TOKEN`, `PHONE_NUMBER_ID`, `APP_SECRET`) — canal Meta Cloud API; todos necessários p/ o webhook.
- `STORAGE_DRIVER` (`local`|`r2`) — anexos de documentos financeiros. `r2` exige `R2_ACCOUNT_ID`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_BUCKET_NOTAS` (validado por `superRefine`). `local` guarda em `LOCAL_STORAGE_DIR` (`.uploads/`); `LOCAL_DOWNLOAD_SECRET` assina links locais.
- `DASHBOARD_MESES_QUEIMA` — meses na média da "queima mensal" (default 6).
- (removida) `DATABASE_URL_READONLY`/`consulta_sql` não existem mais — o bot consulta via motor estruturado, sem SQL gerado pelo LLM.

`tsx` e `node` **não carregam `.env` automaticamente** — os scripts em `server/package.json` passam `--env-file=.env` ao Node/tsx. Se for criar um script que executa código TS, mantenha esse flag ou a validação Zod em `server/src/env.ts` vai abortar com `DATABASE_URL: ['Required']`. Prisma carrega `.env` por conta própria.

Client: `VITE_HOJE_ISO=YYYY-MM-DD` no build fixa a data "hoje" (`client/src/lib/hoje.ts`) — útil para demos/screenshots; não usar em prod.

## Pooled vs direct URL (Neon)

- A `DATABASE_URL` é a **pooled** (`-pooler` no host). Funciona para runtime e para `prisma migrate deploy`.
- `prisma migrate dev` precisa de shadow database e falha via pooler — por isso o schema já tem `directUrl = env("DIRECT_URL")`. Para criar migration nova basta ter `DIRECT_URL` em `server/.env`.
- `pnpm dev:server` roda `prisma migrate deploy` automaticamente no boot (aplica as migrations pendentes; **não** usa `db push`, porque o schema `pecuaria` tem índices únicos parciais escritos só no SQL das migrations e o `db push` os apagaria). Mudou o `schema.prisma`? Gere uma migration com `pnpm prisma:migrate`. Em prod o Render roda `start:prod` (só `node dist/index.js`); o schema é sincronizado por deploy controlado (ver `DEPLOY.md` e seção 9 de [docs/design/multi-propriedade.md](docs/design/multi-propriedade.md)). O histórico experimental foi consolidado em uma baseline única em `server/prisma/migrations/`; bancos locais anteriores à baseline devem ser resetados e semeados novamente.

## Arquitetura

### Backend (`server/src/`)

Hono modular com ~80 roteadores por domínio, montados em `index.ts`:

- `app.ts` — o app Hono em si: `logger()` global, `cors()` em `/api/*`, monta as rotas **isentas** (`health`, `whatsapp`, `authPublicoRouter` = login/convite/reset) **antes** de `authMiddleware`, depois os gates de área por prefixo (`exigeArea("pecuaria")` em `/api/pecuaria/rebanho/*`, `agricultura` em `/api/plantio/*` e `/api/cultivo/*`, `equipe` em `/api/ponto/*`, `financeiro` em `/api/financeiro*` e `/api/categorias*`), e só então os routers protegidos. **Ordem importa.** Runtime-agnóstico de propósito — não sabe se vai rodar em Node ou num Cloudflare Worker.
- `index.ts` — entrypoint Node (`@hono/node-server`, dev local e Render). `worker.ts` — entrypoint Cloudflare Worker (`export { app as default }`, `main` do `wrangler.jsonc` na raiz — ver DEPLOY.md §6). Nenhum dos dois dispara bootstrap sozinho: `garantirFundacaoPropriedade()` e `garantirDonoBootstrap()` viraram scripts manuais em `server/src/scripts/` (`backfill:propriedade`, `bootstrap:dono`) — não existe "boot" de processo dentro de um Worker pra disparar isso sozinho, então o mesmo tratamento vale pros dois runtimes.
- `env.ts` — valida `process.env` com Zod; falha rápido (`process.exit(1)`) se inválido.
- `db.ts` — singleton `PrismaClient` à prova de HMR.
- `middleware/auth.ts` — resolve `Authorization: Bearer <token>` → `Sessao` → `Usuario` e injeta `c.set("usuario", ...)`. Aceita `SHARED_ACCESS_TOKEN` como dono sintético (ponte). Sem token no env e sem usuários no banco, libera (dev).
- `middleware/permissao.ts` — `getUsuario(c)`, `exigeArea(area)`, `exigePermissao(flag)`. Papéis/presets/flags em `services/auth/papeis.ts` (`PAPEIS`, `AREAS_IDS`, `FLAGS_IDS`).
- `routes/` — cada arquivo exporta um `Hono()` chained. Raiz: `auth.ts`, `usuarios.ts`, `propriedade.ts`, `financeiro.ts`, `categorias.ts`, `busca.ts`, `bot.ts`, `whatsapp.ts`, `health.ts`. Módulos operacionais em subpastas (`routes/pecuaria/`, `routes/plantio/`, `routes/cultivo/`, `routes/ponto/`). As rotas são **finas**: validam com `zValidator` e delegam a `services/`.
- `services/` — **onde vive a regra de negócio e o que é testado.** Mesma organização por domínio. `services/financeiro/` = `operacoes.ts`, `contas.ts`, `parceiros.ts`, `rascunhos.ts`, `documentos.ts`, `dashboard.ts`, `schemas.ts` e `regras.ts` (`FinanceiroError` com códigos `NAO_ENCONTRADO|VALIDACAO|PERIODO_FECHADO|SALDO_INSUFICIENTE|JA_REVERTIDO|CONFLITO`, `dinheiro()`, `exigirPeriodoAberto`, `exigirContaAtiva`). `services/auth/` = sessão, hash, tokens de convite/reset, papéis, usuários. `services/consulta/` = motor estruturado de consultas da IA (registro por domínio). `services/bot/` = agente OpenAI, tools, navegação (deep-links). `services/estoque/` = saldo/movimentos de `MovimentoEstoque` (compartilhado; sem rota própria hoje). `services/pecuaria/rebanho/` = pecuária v1. Sufixos `.calc.ts`, `.recompute.ts`, `.agg.ts`, `.mappers.ts`, `.schemas.ts` isolam cálculo puro de I/O Prisma. Ao criar rota nova, siga: rota → service → (calc puro + mappers + schemas).
- `lib/` — `storage.ts` (local vs R2, usado por `documentos.ts`).
- `scripts/allowlist.ts` — CLI da allowlist do WhatsApp.

Padrão de validação de payload:

```ts
import { zValidator } from "@hono/zod-validator";
const schema = z.object({ ... });
router.post("/x", zValidator("json", schema), async (c) => {
  const body = c.req.valid("json"); // tipado
});
```

Padrão de escrita financeira: toda mutação roda em `prisma.$transaction`, chama `exigirPeriodoAberto`, registra `AuditoriaFinanceira` e nunca faz `delete` de registro confirmado (estorno via `/financeiro/operacoes/:id/estorno` e `/financeiro/transacoes/:id/estorno`). O usuário criador vem de `c.get("usuario")`.

### Frontend (`client/src/`)

- `main.tsx` → `App.tsx`. O `App.tsx` troca de "aba" via `useState<Tab>` (**sem react-router**). `router.ts` faz a ponte bidirecional `Tab ⇄ pathname` (deep-link, reload, back/forward) — abas financeiras têm slug fixo (`/financeiro`, `/financeiro/operacoes`, `/financeiro/compromissos`, `/financeiro/contas`, `/financeiro/configuracoes`, `/financeiro/relatorios`); módulos operacionais viram caminhos aninhados por prefixo (`pec-rebanho` → `/pecuaria/rebanho`, `pla-` → `/plantio`, `mil-` → `/milho`, `eqp-` → `/equipe`; `/rebanho/*`, `/corte/*` e as antigas `/pecuaria/*` redirecionam para `pec-rebanho`). Deep-links de auth: `/convite/<token>` e `/senha/<token>` renderizam `DefinirSenha` mesmo deslogado.
- `components/Shell.tsx` exporta o tipo `Tab` (fonte de verdade das abas; os ids financeiros ainda usam nomes legados: `dashboard`=visão geral, `lancar`=operações, `gastos`=compromissos, `caixinha`=contas, `cadastros`=configurações, `plano`=categorias). `AppSidebar.tsx` é a navegação principal (áreas de trabalho Pecuária/Agronomia/Equipe + Financeiro, filtradas por permissão). `CommandPalette.tsx` (⌘K) usa `lib/searchIndex.ts`. `Login.tsx`, `DefinirSenha.tsx`, `Acessos.tsx`; `lib/auth.ts` guarda token + usuário da sessão em localStorage; `api/auth.ts` fala com `/api/auth/*`. `lib/areas.ts` decide visibilidade por área.
- **Módulos operacionais** (`client/src/plantio/`, `cultivo/`, `equipe/`; a pecuária v1 vive em `pecuaria/rebanho/`) seguem um layout repetido: `<Modulo>Content.tsx` (entrypoint) · `api.ts` (fetch tipado) · `types.ts` · `HOJE.ts` (via `lib/hoje.ts`) · `components/` · `mock/` (referência de forma) · `lib/` (derive/worklists puros, com testes); plantio tem ainda `nav.ts` + `domains.tsx`. Ao adicionar um módulo, copie essa forma.
- **Financeiro** (`client/src/financeiro/`): `FinanceiroContent.tsx` roteia as abas para `VisaoGeralFinanceira`, `OperacoesFinanceiras` (+ `FormOperacao`, `OperacaoFinanceiraDetalhe`, rascunho único por usuário/propriedade), `CompromissosFinanceiros`, `ContasFinanceiras`, `ConfiguracoesFinanceiras`, `RelatoriosFinanceiros`. Fetch tipado em `financeiro/novo-api.ts` (tipos = contrato da API). `client/src/api.ts` é o cliente legado ainda usado por relatório/cockpit; `data/*` (`rionovo.ts`, `projecao.ts`, etc.) são mocks/planilha de referência.
- `propriedadeScope.ts` — sítio ativo (multi-propriedade). `comPropriedade(headers)` é o envelope padrão de TODA request: injeta `Authorization` (via `lib/auth`) e `X-Propriedade-Id`. **Usar sempre** ao escrever fetch novo.
- `components/charts.tsx` — gráficos em Recharts, montados pelo wrapper shadcn-style `components/ui/chart.tsx`: `MonthlyFlowChart`, `WaterfallChart`, `MiniBarChart`, `MonthlyTrendChart`, `Donut`, `EntradaSaidaChart` e `CategoryValueChart`. Exporta também `ChartTypeControl`, `fmt`, `fmtBR`, `fmtMoney`, `fmtMoneyExact` e `fmtBRL` — **reusar daqui**, não recriar.
- `components/ActivityPill.tsx` (Leite/Café/Outros/Misto), `components/rb/*` (primitivas de módulo, nome herdado do rebanho: `RebButton`, `RebField`, `RebModal`, `RebTable`, `RebKpiStrip`, `RebHeader`), `components/PropriedadeSelector.tsx` + `api/propriedades.ts` (cadastro de sítios), `components/report/primitives.tsx`, `components/ui/*` (shadcn-style), `DateRangePicker` / `MonthRangePicker` (pt-BR com presets), `ConfirmDialog`, `Toast`, `EmptyState`, `Loading`.

Estilos: `main.tsx` importa, nesta ordem, `styles/theme.css` (Tailwind v4 + tokens), `base.css` (paleta, tipografia, componentes compartilhados — **define as variáveis CSS**), `dashboard.css`, `dashboard-v2.css`, `cockpit.css`, `forms.css`, `acessos.css`, `terrano-intro.css`, `typescale.css` (override de escala, por último). Componentes novos usam classes Tailwind + tokens; não hardcodar hex.

Cores de atividade são variáveis CSS — `--leite` (brass), `--cafe` (deep coffee), `--outros` (sage olive). **Sempre referenciar via var()**.

Fontes carregadas de Google Fonts no `index.html`: Newsreader (serif, displays) + DM Sans (sans, body). Não bundlar.

Vite (porta 41875) faz proxy de `/api` para `http://localhost:41873` (ver `vite.config.ts`).

A pergunta editorial "**O leite paga o leite?**" existe **só no Relatório** — não recolocar na visão geral.

### Schema Prisma

`server/prisma/schema.prisma` declara `schemas = ["public", "pecuaria"]` (~65 models, ~50 enums). Núcleo financeiro:

- `Operacao` — fato central (`tipo: TipoOperacaoFinanceira`, `status: StatusOperacao` default RASCUNHO, `data`, `valorTotal`, `propriedadeId` **obrigatório**, `parceiroId?`, `categoriaId?`, `centroCustoId?`, `corrigeOperacaoId?` para correções, `criadoPorId?`). Relações: `ItemOperacao[]`, `CompromissoFinanceiro[]`, `TransacaoFinanceira[]`, `MovimentoEstoque[]`, `DocumentoFinanceiro[]`, e ponte para fatos operacionais (`OperacaoAgricola`, `ManejoSanitario`, `OperacaoComercial`, `LancamentoCusto`).
- `CompromissoFinanceiro` (PAGAR/RECEBER, `valorOriginal`/`valorLiquidado`/saldo pendente, `Liquidacao[]`), `TransacaoFinanceira` (dinheiro realizado, `FormaPagamento`, `MovimentoConta[]` ENTRADA/SAIDA por `ContaFinanceira`), `ContaFinanceira` (BANCO/CAIXA/APLICACAO/DINHEIRO, `saldoAbertura`, `incluirNoSaldoGeral`).
- `RascunhoOperacao` — um por `(propriedadeId, criadoPorId)`, `dados Json` + `versao` (concorrência otimista), sem efeito contábil.
- `PeriodoFinanceiro` — `(propriedadeId, ano, mes)` ABERTO/FECHADO; mês fechado bloqueia qualquer escrita/estorno. `AuditoriaFinanceira` — trilha de toda mutação.
- Dimensões: `Categoria` ⊂ `GrupoCategoria`, `CentroCusto`, `Parceiro` (`TipoParceiro`), `Produto` (com `estocavel`, `LocalArmazenamento`, `LoteProduto`).

Auth: `Usuario` (`papel`, `abas[]`, `areas[]`, `flags[]`, `status PENDENTE|ATIVO|INATIVO`, `dono`), `Sessao` (token hash, sliding), `TokenAcesso` (CONVITE/RESET).

Blocos dos módulos operacionais: pecuária v1 no schema `pecuaria` (ver Domínio), plantio (`Talhao`, `ResumoTalhao`, `Lavoura`, `SafraTalhao`, `OperacaoAgricola`, `InspecaoMIP`, `PassadaColheita`, `TarefaAgricola`, `ApontamentoMaquina`), cultivo/milho (`SafraCultivo`, `AreaCultivo`, `Silo`, `MovimentoSilo`, `ProducaoCultivo`, `LancamentoCusto`), ponto (`Funcionario`, `RegistroPonto`), WhatsApp (`UsuarioWhatsapp`, `ConversaWhatsapp`, `MensagemWhatsapp`).

Decimal usa `@db.Decimal(14, 2)` (quantidades `(12, 3)`, unitário `(14, 4)`) — sempre via `Prisma.Decimal` (`dinheiro()` em `regras.ts`), nunca `number` JS direto em cálculos financeiros.

### Multi-propriedade (escopo de sítio) — IMPLEMENTADO

Feature transversal: fatos ganham `propriedadeId` (nullable nos módulos antigos, **obrigatório** no financeiro novo) e as leituras filtram por sítio; fazenda de 1 sítio não percebe a camada. **Design + estado final + decisões em [docs/design/multi-propriedade.md](docs/design/multi-propriedade.md) (seções 8 e 9)** — ler antes de escopar um fato novo. Padrão: coluna + `@@index` + inverse em `Propriedade` → migration aditiva → **backfill manual** (`garantirFundacaoPropriedade` em `server/src/services/propriedade.ts`, rodado via `pnpm --filter rionovo-server run backfill:propriedade` — não dispara mais sozinho no boot) → rota resolve `resolverEscopoLeitura/Escrita(c)` → front usa `comPropriedade()`. Cadastros de referência (Produto, Raca, CentroCusto, Categoria, Parceiro, etc.) são **compartilhados** de propósito.

### Auth e permissões

- Login por e-mail/senha (`POST /auth/login` → token de sessão). Convite (`/auth/convite/:token`, `/auth/convite/aceitar`) e reset (`/auth/senha/redefinir`) são públicos; `/auth/me`, `/auth/logout` e `/usuarios/*` (CRUD, convite, reset — só dono/`gerenciarAcessos`) são protegidos.
- Autorização em duas camadas: **área** (`exigeArea` por prefixo de rota em `index.ts`) e **flag** (`exigePermissao`: `verValores`, `verInvestimento`, `verSalarios`, `lancar`, `exportar`, `gerenciarAcessos`). O front esconde módulos pelas mesmas áreas (`lib/areas.ts`), mas o gate real é o servidor.
- `SHARED_ACCESS_TOKEN` é ponte de rollout — não construir feature nova em cima dele.

## Convenções

- ESM em tudo (`"type": "module"`). No **server**, imports relativos de `.ts` precisam terminar em `.js` (ex.: `import { env } from "./env.js"`). No **client** (Vite), imports relativos **não** levam extensão.
- Code/comments podem ser em PT-BR (consistente com a base existente). Commits em PT-BR no formato `tipo(escopo): descrição` (`feat(financeiro): ...`, `fix(auth): ...`).
- Não criar arquivos `.md` de documentação extra a não ser que pedido.

## Ligando uma tela nova ao backend

1. **Backend:** rota fina em `server/src/routes/<modulo>/` → service em `services/<modulo>/`, com o cálculo puro isolado em `*.calc.ts` e testado. Respeitar escopo de propriedade (`resolverEscopoLeitura/Escrita(c)`), o gate de área do módulo e, em qualquer escrita financeira, `exigirPeriodoAberto` + auditoria + estorno em vez de delete.
2. **Frontend:** função no `api.ts` do módulo (ou `financeiro/novo-api.ts`) usando `comPropriedade()` nos headers. Trocar o import de `mock/` pela chamada real; manter o mock como referência da forma até estabilizar.
