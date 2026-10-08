# Fazendinha — Plataforma Inteligente de Pecuária Leiteira

> **Nosso objetivo não é registrar vacas. Nosso objetivo é aumentar a lucratividade das fazendas leiteiras através de dados, automação e inteligência.**

Fazendinha é uma plataforma de gestão completa para propriedades rurais. Unifica **financeiro**, **pecuária** e **estoque compartilhado** em um único produto, projetado para responder a pergunta que importa para o produtor:

> *"O que devo fazer hoje para ganhar mais dinheiro?"*

A primeira propriedade rodando o produto é a **Fazenda Rio Novo**, que migrou seu fluxo de caixa do Excel/Access (BPO) para o Fazendinha e hoje serve como dataset real de validação (~6.700 lançamentos contábeis + rebanho ativo).

---

## Sumário

- [Visão Geral](#visão-geral)
- [Documentação](#documentação)
- [Stack](#stack)
- [Arquitetura](#arquitetura)
- [Setup Local](#setup-local)
- [Estrutura do Repositório](#estrutura-do-repositório)
- [Scripts](#scripts)
- [Contribuição](#contribuição)
- [Filosofia](#filosofia)
- [Roadmap](#roadmap)

---

> Nesta branch, agricultura (café/plantio e milho/cultivo) e equipe/ponto foram retiradas para reconstrução. A conciliação de 07/10/2026 preserva a V3 final, financeiro e estoque único. Consulte [a análise da remoção, bases e validações](./docs/remocao-agricultura-equipe.md).

## Visão Geral

| Módulo | O que entrega |
|---|---|
| **Financeiro** | Reconstruído em torno de `Operacao` → `CompromissoFinanceiro` → `TransacaoFinanceira` → `MovimentoConta` em `ContaFinanceira`. Rascunho de operação, documentos anexos, períodos fechados (mês fechado bloqueia escrita), estorno com auditoria. Regime de caixa: DRE, fluxo de 23 meses, top categorias, projeção de saldo, reclassificação custeio/investimento. Lançamento de gastos também pelo bot do WhatsApp. |
| **Pecuária (v1 — Rebanho)** | Cadastro de animais, composição racial, lotes, movimentação (histórico completo, nunca apagado), categoria calculada por regras configuráveis da fazenda, baixa (venda/abate/morte/doação/extravio) com motivo, pesagens, auditoria. Schema Postgres próprio (`pecuaria`), carga única a partir do IDEAGRI. |
| **Estoque** | Saldos, movimentos, ponte automática com financeiro em compras. |
| **Inteligência** | Assistente conversacional e bot WhatsApp (OpenAI, `gpt-4o` por padrão) consultando um motor estruturado — sem SQL gerado pelo LLM. |
| **Contas e acessos** | Usuários com sessão, papéis (presets), áreas e flags de permissão; dono criado no primeiro boot. Multi-propriedade (escopo de sítio) transversal. |

O produto nasceu como plataforma de pecuária **leiteira** completa (reprodução, sanidade, produção, nutrição, score por animal — ver histórico em `DOMAIN.md`/`METRICS.md`); esse módulo foi removido em set/2026 e reconstruído do zero como a **v1 Rebanho** acima, mais simples e cobrindo qualquer rebanho (não só leiteiro). Os domínios de reprodução/sanidade/produção voltam em cascata nas próximas versões (v2–v5).

A plataforma é multi-tenant na intenção (uma propriedade hoje, várias amanhã) e foi modelada contra dados reais do BPO da Rio Novo — **não inventamos campos**.

---

## Documentação

Esta é a fonte de verdade do projeto. Antes de implementar qualquer coisa, leia:

| Documento | Para quem | O que define |
|---|---|---|
| [`PRODUCT.md`](./PRODUCT.md) | Todos | Missão, visão, público, proposta de valor, mentalidade de produto. |
| [`DOMAIN.md`](./DOMAIN.md) | Devs, designers, PMs | Conhecimento profundo do agro leiteiro: DEL, CCS, IEP, lactação, IATF, secagem, mastite, ECC, glossário. Histórico do módulo removido em set/2026, mantido como referência para os próximos domínios da pecuária (v2–v5). |
| [`DESIGN.md`](./DESIGN.md) | Designers, devs UI | Filosofia visual, tipografia, paleta, hierarquia, espaçamento, acessibilidade para o produtor 45–70. |
| [`COMPONENTS.md`](./COMPONENTS.md) | Devs UI | Catálogo dos componentes existentes e quando usar cada um. |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Devs backend e fullstack | Bounded contexts, modelagem, fluxos, organização de pastas, ESM, validação Zod. |
| [`METRICS.md`](./METRICS.md) | PMs, devs, analistas | Fórmulas, origem dos dados e interpretação de cada KPI. |
| [`AI_RULES.md`](./AI_RULES.md) | Claude Code, Cursor, Copilot, ChatGPT | Como qualquer IA deve trabalhar neste projeto (padrões, nomenclatura, anti-padrões). |
| [`ROADMAP.md`](./ROADMAP.md) | Todos | MVP, V1, V2, V3, longo prazo, IoT, integrações. |
| [`CLAUDE.md`](./CLAUDE.md) | Claude Code | Instruções operacionais resumidas para o agente. |
| [`DEPLOY.md`](./DEPLOY.md) | DevOps | Procedimentos de deploy (Cloudflare Pages + Render + Neon). |
| [`TODO.md`](./TODO.md) | Todos | Pendências correntes. |
| [`docs/pecuaria/README.md`](./docs/pecuaria/README.md) | Devs, designers, PMs e agentes | Base versionada da reconstrução da pecuária: artefatos da v1/v2, mapa do IDEAGRI, estado dos PRs, decisões e próximos passos. |

Notas de trabalho na raiz: `ANALISE-ROTAS.md`, `AUDITORIA-2026-07-06.md`, `HANDOFF-sprint-pre-teste-2026-07-06.md`, `PLANO-dashboard-ia.md`.

Em `docs/`:

- **Pecuária v1–v5** — [`docs/pecuaria/README.md`](./docs/pecuaria/README.md) organiza os quatro artefatos-base, explicita o que já está na `main`, o que ainda está em PR e a sequência recomendada de evolução.
- **Design specs** — `docs/design/` (`multi-propriedade.md`, `pecuaria-unificada.md`, `reproducao-paridade-ideagri.md`, `ia-consulta-semantica.md`, `relatorios-gerais.md`, `dieta-estoque-baixa-automatica.md`, `ocr-folhas-setor.md`, `ideagri-catalogo-features.md`, `ideagri-gaps.md`, painel milho/equipe).
- **Planos e specs por fatia** — `docs/superpowers/plans/` e `docs/superpowers/specs/` (rebanho fatia 1–18, reprodução blocos A–C, shadcn fases 0–5, auth/contas, central de relatórios).
- **Financeiro novo** — `financeiro-rebuild-contrato.md`, `proposta-reestruturacao-financeiro.md`, `handoff-design-novo-financeiro.md`, `avaliacao-produto-financeiro-2026-09-01.md`.
- **Navegação e QA** — `NAVEGACAO.md` (gerado por `pnpm gen:nav-doc`), `QA-pecuaria-unificada.md`, `HOMOLOGACAO-codex-semana-2026-08-05.md`, `bateria-ia-consultas-2026-07-14.md`, `auditoria-indicadores-zootecnicos.md`.
- **Campo e benchmark** — `visita-fazenda-*.md`, `feedback-fazenda-2026-07-21-diagnostico.md`, `benchmark-ideagri.md`, `reproducao-runbook-maquina-dados.md`, `reproducao-teste-na-maquina-ideagri.md`.
- **Handoffs** — `HANDOFF-*.md`.

> Toda PR que mude comportamento de produto, vocabulário do domínio ou estrutura visual deve atualizar o documento correspondente. Documentação desatualizada é **bug**.

---

## Stack

| Camada | Tecnologia | Por quê |
|---|---|---|
| Frontend | React 18 + Vite 6 + TypeScript | Build rápido, HMR, tipagem forte. Sem react-router: `App.tsx` troca abas por estado e `router.ts` faz a ponte com o pathname. |
| UI | Tailwind CSS v4 (`@tailwindcss/vite`) + primitivas shadcn-style em `client/src/components/ui/` (Radix, cmdk, lucide-react, cva, tailwind-merge) | Componentes acessíveis sobre a paleta própria em `styles/base.css`. |
| Charts | SVG inline próprio (`client/src/components/charts.tsx`) | Controle total da estética; sem Recharts/D3. |
| Fontes | Newsreader (serif) + DM Sans (sans) | Editorial e legível em tablets a 60cm de distância. |
| Backend | Hono + `@hono/node-server` | Roteamento leve, tipos preservados, compatível Edge se preciso. |
| Validação | Zod + `@hono/zod-validator` | Schemas únicos para parsing de env, payload e respostas. |
| ORM | Prisma 6 | Migrations declarativas e tipagem ponta-a-ponta. |
| Banco | PostgreSQL serverless via Neon | Branching de banco por feature, custo zero idle. |
| IA | OpenAI (`openai`, `gpt-4o` por padrão) | Bot WhatsApp (Meta Cloud API), assistente conversacional e insights. Sem chave, cai em modo demonstração. |
| Anexos | `@aws-sdk/client-s3` (Cloudflare R2) ou disco local | Documentos financeiros e notas. `tesseract.js`/`sharp`/`pdf-parse` estão instalados, mas o OCR não está ligado a nenhuma rota. |
| Testes | Vitest nos dois workspaces | ~60 arquivos `*.test.ts` ao lado do código, maioria em `server/src/services/**`. |
| Monorepo | pnpm workspaces (lockfile na raiz) | Instalação rápida, hoisting estrito. |
| Deploy | Cloudflare Pages (client, `_worker.js` faz proxy de `/api`) + Render (`render.yaml`) + Neon | CI de staging em `.github/workflows/staging.yml`. |

---

## Arquitetura

```mermaid
flowchart LR
  P((Produtor)) -->|web/tablet/mobile| C[Client React]
  W[WhatsApp Cloud API] -->|webhooks| S
  C -->|/api/*| S[Hono Server]
  S -->|Prisma| DB[(Neon Postgres)]
  S -->|SDK| AI[OpenAI]
  S -->|S3| OBJ[(Cloudflare R2 / disco local)]
  P -->|pergunta / gasto| W
```

- **Cliente** consome `/api/*` (proxy do Vite em dev; `_worker.js` do Cloudflare Pages em prod). Toda request passa por `comPropriedade()`, que injeta o token de sessão e `X-Propriedade-Id`.
- **Servidor** Hono modular (~50 roteadores finos que delegam a `services/`). Auth por **sessão** (`Usuario`/`Sessao`) com papéis, áreas e flags; `SHARED_ACCESS_TOKEN` sobrevive só como ponte de transição. Rotas isentas: `/api/health` e `/api/whatsapp/*`.
- **Postgres (Neon)** persiste tudo (financeiro, rebanho, eventos, configuração). Escopo multi-propriedade via `propriedadeId` com backfill no boot.
- **OpenAI** atua no bot WhatsApp (respostas e lançamento de gastos via motor de consulta estruturado), no assistente e nos insights.
- **Deploy**: Cloudflare Pages (frontend) + Render (backend; sync de schema é passo manual — ver DEPLOY.md) + Neon.

Detalhes completos em [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Setup Local

```bash
# 1. Instalar dependências
pnpm install

# 2. Configurar Neon
cp server/.env.example server/.env
# Mínimo: DATABASE_URL (pooled). Adicione DIRECT_URL para db push / migrate dev.
# Opcional: AUTH_BOOTSTRAP_EMAIL cria o dono (pendente) no primeiro boot e loga
# o link de definir senha. Sem usuários e sem SHARED_ACCESS_TOKEN, a porta fica
# aberta em dev.

# 3. Subir tudo (`dev:server` roda `prisma migrate deploy` antes do watch)
pnpm dev

# 4. Dados de desenvolvimento até a V3 (somente PostgreSQL local fazendinha_seedatev3)
# Configure DATABASE_URL e DIRECT_URL para esse banco e aplique as migrations primeiro.
pnpm --filter rionovo-server exec prisma migrate deploy
pnpm --filter rionovo-server run seedatev3
pnpm --filter rionovo-server run seedatev3 --verificar
```

| Porta | Serviço |
|---|---|
| 41873 | Backend Hono |
| 41875 | Frontend Vite (proxy /api → 41873) |

Abra `http://localhost:41875`.

### Cenário unificado `seedatev3`

O ponto de entrada é `server/prisma/seedatev3.ts`; `seed` e o seed padrão do Prisma apontam para ele. Só aceita o banco **local** `fazendinha_seedatev3`, fora de produção, com todas as migrations aplicadas e inalteradas. Não cria nem exclui bancos. Não execute `migrate reset` para retomar: ele apagaria dados e invalidaria a identidade do manifesto.

A massa tem duas fazendas (**Principal** e **Destino**), 18 animais (16 ativos e duas baixas), seis lotes, genitores externos, sêmen/embrião comprados, parceiros usados nos fatos, três contas com abertura zero e aportes. Compras, vendas, compromissos, liquidações, transferências, cancelamento e estorno sustentam o financeiro e o estoque. Sanidade inclui quatro protocolos (três publicados), quatro ciclos, oito aplicações, quatro exames e ocorrências abertas/encerrada. Nutrição inclui quatro receitas (três publicadas), cinco vigências e seis fechamentos (um estornado). Documentos demonstrativos em PDF/XML e dois relatórios são preparados pelos serviços existentes; não são documentos fiscais reais.

Os padrões ficam **na carga inicial**, não como listas imutáveis do produto: quatro centros de custo (Pecuária, Agronomia, Equipe, Gestão), 39 categorias financeiras, dez raças, 29 motivos de baixa, sete categorias animais das migrations, 34 doenças, três tipos de aplicação e quatro exames mais um demonstrativo por opções. A lista completa está em `server/prisma/seedatev3/catalogos.ts`. Centros/categorias financeiros de Agronomia/Equipe não reintroduzem os módulos removidos. IDs e cadastros das migrations são reaproveitados; o seed não restaura ou sobrescreve configurações do usuário.

Credenciais **fictícias, exclusivas deste ambiente**; senha inicial das três contas: `SeedateV3!Local2026`.

| Acesso | E-mail | Permissões |
|---|---|---|
| Proprietário | `seedatev3.dono@example.test` | Dono com acesso completo |
| Consulta | `seedatev3.consulta@example.test` | Consulta das duas áreas, sem lançamentos |
| Operador | `seedatev3.operador@example.test` | Lançamentos nas duas áreas; flag de valores desabilitada (ver ressalva abaixo) |

Exemplos: **DEV-001 Aurora** (doadora), **DEV-002 Brisa** (receptora, papel separado da filiação), **DEV-008 Hera** (descendência e desmama), **DEV-011 Kairo** (castração), **DEV-013 Monte** (reprodutor), **DEV-007 Gaia** (transferência), **DEV-017 Rubí** (venda) e **DEV-018 Sol** (morte). O lote Novilhas troca dieta no dia 16 do mês anterior; Flora muda de lote no dia 6 e Gaia de fazenda no dia 20, alterando os participantes reais dos fechamentos. Produtos, doses, dietas, doenças e carências são demonstrações, **não prescrições**.

A data-base é calculada uma única vez em `America/Sao_Paulo` e guardada em `server/.seedatev3/manifesto.json` (ignorado pelo Git), junto de versão, identidade do banco, IDs, ações e etapas concluídas. Neste ambiente: **07/10/2026**. Reexecuções mantêm a data, não duplicam fatos e não refazem etapas concluídas. Um registro removido manualmente não é recriado. Preserve o manifesto junto do banco; se restaurar/recriar o banco, confira a identidade antes de reaproveitá-lo. A trava de execução é liberada pelo PostgreSQL inclusive se o processo morrer.

`--verificar` utiliza conexões de banco somente leitura e confere relações, dinheiro, estoque por sítio/validade, carências na data-base, animal-dias, custos e arquivos. Para testar retomada, `--interromper-apos=catalogos` provoca uma falha controlada; rodar sem a opção continua da etapa seguinte. Etapas: catalogos, rebanho, financeiro, sanidade, nutricao, financeiro-atual, dados-verificados, arquivos, periodo. Não há eventos de reprodução ou produção de leite de versões futuras. O período financeiro do primeiro dos três meses só fecha depois dos lançamentos e arquivos; como ainda não há serviço de fechamento administrativo, a fixture registra período e auditoria na mesma transação. A emissão de relatório ganhou identificador interno opcional de reenvio, sem mudar o fluxo da interface.

**Armazenamento e consolidação local — concluídos em 07/10/2026:** documentos e relatórios foram gerados no R2 autorizado, dentro de `dev/`, e seus downloads/conteúdos foram conferidos. Os dois documentos de operações e os dois relatórios passaram pela API autenticada; o XML do rascunho foi conferido no armazenamento, pois não há rota de download de anexos de rascunho antes da confirmação. Arquivos antigos continuam sendo lidos pelos caminhos persistidos. O período de agosto/2026 da Principal está fechado com auditoria, após seus lançamentos. `DATABASE_URL` e `DIRECT_URL` locais agora apontam para `fazendinha_seedatev3`; as demais configurações foram preservadas. Somente os 13 bancos autorizados foram removidos, após novos backups integrais; `postgres`, templates, containers e volumes foram preservados.

Validação: cenário completo em banco inicialmente vazio, retomada após interrupção e reexecução completa sem diferenças em 68 tabelas de negócio ou nos saldos. `--verificar` passou sem alterar banco/manifesto. As 27 páginas/visões foram conferidas com dados reais da API; capturas de financeiro, sanidade e nutrição foram inspecionadas. Servidor: 1.044 testes aprovados, 115 integrações PostgreSQL puladas (não habilitadas nesta rodada); builds e tipos passaram. Isso não substitui a homologação manual integral da V3. Evidências locais ficam em `server/.seedatev3/`, ignorado pelo Git.

**Falha de acesso registrada para entrega separada, por decisão do usuário:** o operador é cadastrado sem `verValores`, mas a conferência com sessão real revelou que a API financeira existente ainda devolve valores de operações comuns a esse perfil. A configuração do seed não corrige essa exposição. Não considerar esse acesso seguro para dados sensíveis antes de corrigir e retestar a autorização/mascaramento das consultas financeiras. A consulta sem permissão de lançamento foi bloqueada corretamente na API. Essa correção não integra a entrega do seed.

Backups finais da consolidação: `.backups/seedatev3-final-E5pdI7/`, ignorados pelo Git, com 13 dumps dos bancos removidos e um do novo cenário, listagens e `manifesto.json` contendo tamanhos/SHA-256 e exclusões efetuadas. Todos tiveram catálogo e conteúdo integral conferidos. Inclui o manifesto do seed e a configuração anterior, mantida privada. Os backups iniciais em `.backups/seedatev3-2026-10-07T23-55-22-089Z/` também foram preservados. Para recuperar um banco, crie-o explicitamente e restaure seu dump com `pg_restore`; não remova o volume Docker. A mudança de `POSTGRES_DB` só vale para inicialização de um volume novo, não renomeia bancos de um volume existente. Não combinar esse cenário com os seeds históricos ou com a preparação destrutiva do guia manual.

A falha de inicialização do Docker foi recuperada sem reset ou exclusão de dados: somente as pastas temporárias de comunicação `Docker/run` e `docker-secrets-engine`, em `%LOCALAPPDATA%`, foram renomeadas para `run.seedatev3-preservado-20261007` e `docker-secrets-engine.seedatev3-preservado-20261007`. O Docker recriou os pontos de comunicação e o mesmo container PostgreSQL voltou a responder. As pastas antigas permanecem preservadas; não são backups de volumes.

### Pré-requisitos

- Node **20+** (usamos `--env-file` nativo).
- pnpm **10+**.
- Conta Neon (free tier basta).
- `OPENAI_API_KEY` opcional — sem ela, bot desligado (503) e IA em modo demo.
- Demais variáveis (`WHATSAPP_*`, `STORAGE_DRIVER`/`R2_*`, `CORS_ORIGIN`, `APP_BASE_URL`, `AUTH_SESSAO_DIAS`) são opcionais e validadas por Zod em `server/src/env.ts`.

---

## Estrutura do Repositório

```
fazendinha/
├── client/                    # Frontend Vite + React
│   ├── public/_worker.js      # Cloudflare Pages: proxy /api/* → Render + SPA fallback
│   └── src/
│       ├── App.tsx router.ts  # Troca de abas por estado + ponte com pathname
│       ├── api.ts api/auth.ts # Fetch do financeiro legado e de auth/sessão
│       ├── propriedadeScope.ts# Sítio ativo + comPropriedade() (envelope de toda request)
│       ├── components/        # Shell, AppSidebar, CommandPalette, Login, charts, pickers
│       │   └── ui/            # Primitivas shadcn-style (button, dialog, select, sheet, ...)
│       ├── financeiro/        # Operações, compromissos, contas, relatórios (novo-api.ts)
│       ├── pecuaria/rebanho/   # Módulos operacionais
│       ├── lib/               # auth, hoje, searchIndex, areas, reconciliacao, utils
│       ├── data/              # Mocks/referência de forma (rionovo.ts, acessos)
│       └── styles/            # CSS modular (base define as variáveis, dashboard, forms, ...)
├── server/                    # Backend Hono + Prisma
│   ├── src/
│   │   ├── routes/            # Roteadores finos por domínio (auth, financeiro, usuarios, whatsapp, pecuaria/)
│   │   ├── services/          # Regra de negócio testada
│   │   │   ├── auth/          # Usuário, sessão, papéis/áreas/flags, bootstrap do dono
│   │   │   ├── financeiro/    # operacoes, rascunhos, contas, documentos, regras, dashboard
│   │   │   ├── consulta/      # Motor estruturado de consultas do bot
│   │   │   ├── bot/ whatsapp/ # Assistente OpenAI + canal Meta Cloud API
│   │   │   └── pecuaria/rebanho/
│   │   ├── middleware/auth.ts # Sessão / token compartilhado
│   │   ├── lib/               # storage (local/R2), ocr
│   │   ├── env.ts             # Validação Zod do .env
│   │   ├── db.ts              # PrismaClient singleton HMR-safe
│   │   └── index.ts           # Bootstrap (backfill multi-propriedade, cleanup)
│   ├── scripts/               # bateria-ia (gabarito/run)
│   └── prisma/
│       ├── schema.prisma      # 69 models (schemas `public` + `pecuaria`)
│       ├── migrations/        # baseline + migration da pecuária v1 (sync em prod é manual: migrate deploy)
│       ├── seed*.ts import-pecuaria.ts
│       └── rio_novo.json      # Dados reais extraídos (pecuaria_v1.json é gerado, não versionado)
├── scripts/                   # extract_rio_novo.py, gen-nav-doc.ts
├── docs/                      # design/, superpowers/{plans,specs}, handoffs, QA, visitas
├── .github/workflows/staging.yml
├── render.yaml                # Blueprint do backend no Render
├── PRODUCT.md DOMAIN.md DESIGN.md COMPONENTS.md
├── ARCHITECTURE.md METRICS.md AI_RULES.md ROADMAP.md
├── README.md CLAUDE.md DEPLOY.md TODO.md
├── package.json pnpm-workspace.yaml pnpm-lock.yaml
└── tsconfig*.json
```

---

## Scripts

| Comando | O que faz |
|---|---|
| `pnpm dev` | Sobe server (41873) e client (41875) em paralelo. |
| `pnpm dev:server` | Só backend (roda `prisma migrate deploy` antes do watch). |
| `pnpm dev:client` | Só frontend. |
| `pnpm build` | Build de produção dos dois workspaces. |
| `pnpm prisma:generate` | Regera Prisma Client. |
| `pnpm prisma:migrate` | `prisma migrate dev` (requer `DIRECT_URL`). |
| `pnpm prisma:studio` | Abre Prisma Studio. |
| `pnpm gen:nav-doc` | Regera `docs/NAVEGACAO.md` a partir da navegação. |
| `pnpm --filter rionovo-server run db:push` | Sincroniza o schema sem migration — não usar com o schema `pecuaria` (apaga os índices parciais). |
| `pnpm --filter rionovo-server run seed` / `seedatev3` | Cenário unificado até a V3, somente no banco local autorizado. |
| `pnpm --filter rionovo-server run seedatev3 --verificar` | Confere dados e arquivos sem criar registros. |
| `pnpm --filter rionovo-server run seedatev3:typecheck` | Confere tipos do seed e seus módulos auxiliares. |
| `pnpm --filter rionovo-server run seed:financeiro-legado` | Seed financeiro antigo, apenas execução explícita. |
| `pnpm --filter rionovo-server run seed:usuarios` | Usuários de exemplo. |
| `pnpm --filter rionovo-server run seed:pecuaria` / `seed:rebanho` | Seeds por módulo (`seed:pecuaria` = catálogos; `seed:rebanho` = 4 sítios de demonstração). |
| `pnpm --filter rionovo-server run seed:all` | Orquestrador histórico; não é mais o seed padrão e não deve ser combinado com seedatev3. |
| `pnpm --filter rionovo-server run import:pecuaria` | Importa a carga do IDEAGRI (`server/prisma/pecuaria_v1.json`, gerado por `scripts/build-pecuaria-json.mjs`). |
| `pnpm --filter rionovo-server run whatsapp:user` | Gerencia a allowlist de números do bot. |
| `pnpm --filter rionovo-server run bateria:gabarito` / `bateria:run` | Bateria de consultas de IA (gera gabarito / executa). |
| `pnpm --filter rionovo-server run test` | Testes do backend (Vitest). |
| `pnpm --filter rionovo-client run test` | Testes do frontend. |
| `pnpm --filter rionovo-server exec prisma migrate deploy` | Aplica migrations existentes via pooler (sem shadow DB). |

---

## Contribuição

1. Leia `PRODUCT.md` e `DOMAIN.md` antes de propor qualquer feature. Quem não conhece o domínio gera código que parece certo mas dá conselho errado para o produtor.
2. Toda PR de feature precisa responder em 1 linha: **qual decisão do produtor isso melhora?**
3. Toda nova tela ou componente segue [`DESIGN.md`](./DESIGN.md) e reusa de [`COMPONENTS.md`](./COMPONENTS.md). Não criar componentes paralelos.
4. Validação de payload com Zod no backend; nada de `c.req.json() as any`.
5. Identificadores em **português** consistentes com o schema (`Operacao`, `Animal`, `Categoria`).
6. Commits em PT-BR no padrão `feat(modulo): mensagem` (veja histórico em `git log`).
7. Rota fina → service → cálculo puro (`*.calc.ts`) com teste ao lado (`*.test.ts`). Rode `pnpm --filter rionovo-server run test` antes de abrir PR.

---

## Filosofia

Esses cinco princípios estão acima de qualquer feature. Eles são detalhados em [`PRODUCT.md`](./PRODUCT.md):

1. **Dados viram decisões.** Toda tela deve responder a uma pergunta de negócio, não exibir dados pelo prazer de exibir.
2. **Lucratividade primeiro.** Indicadores zootécnicos só importam quando ligados ao bolso.
3. **Produtor é o usuário, não o agrônomo.** Interface para alguém que aprendeu a operar no Excel e prefere clareza a modernidade.
4. **Profundidade > Vastidão.** Antes de adicionar um módulo, esgotar o módulo existente.
5. **Verdade > Aparência.** Não inflar números. Não esconder prejuízo. Não enfeitar projeções.

---

## Roadmap

Resumo (detalhe em [`ROADMAP.md`](./ROADMAP.md)):

- **MVP** ✅ — financeiro do BPO + cadastro de animais + ficha individual + painel executivo.
- **Financeiro novo** ✅ (ago/set 2026) — `Operacao`/`CompromissoFinanceiro`/`TransacaoFinanceira`/`MovimentoConta` reconstruídos do zero (ver contrato em `docs/financeiro-rebuild-contrato.md`).
- **Pecuária v1 — Rebanho** ✅ (set 2026) — o módulo de pecuária leiteira/corte anterior (produção, reprodução com IATF, sanidade com carência...) foi removido e reconstruído como um rebanho genérico: identidade, lote, movimentação, categoria configurável, baixa, pesagem. É a base sobre a qual os próximos domínios entram em cascata.
- **V2–V5 (pecuária)** — reprodução, sanidade, produção/leite e nutrição voltam como domínios ligados por chave à v1 Rebanho — ver `DOMAIN.md`/`METRICS.md` para o conhecimento de domínio mantido como referência.
- **Depois** — IA preditiva (descarte, prenhez, mastite subclínica), WhatsApp como interface principal de lançamento, integrações IoT, marketplace de insumos, benchmarking entre fazendas, aplicativo nativo, BI próprio, score de crédito rural.

---

## Licença

Software proprietário. Todos os direitos reservados.

## Contato

Time interno — ver `CLAUDE.md` para instruções operacionais do agente e `docs/HANDOFF-*.md` / `HANDOFF-*.md` na raiz para passagens de bastão.
