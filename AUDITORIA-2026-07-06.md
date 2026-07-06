# Auditoria pré-teste — Fazendinha / Rio Novo

**Data:** 2026-07-06
**Executor:** Claude Code (Opus 4.7, 1M context)
**Base:** `main` @ `29c24ab fix(ui): estiliza X dos modais e inputs da grade de Ponto`
**Escopo:** varredura completa do produto (server + client + banco + migrations + testes + dogfooding vivo) antes da fase de teste com usuário real.

> **Modo:** somente leitura. Nada foi alterado. Cada item cita `arquivo:linha` ou o endpoint / commando para verificação independente.

---

## 0. TL;DR — Está pronto para teste com o dono?

**NÃO.** Existem 5 bloqueadores que garantem que ele vai bater em erro no primeiro dia. Todos são de banco / schema / autenticação — não é código; é operação. Corrigidos, o produto tem base sólida (409 testes unitários passando, arquitetura clara, cobertura de domínio boa).

| Bloqueador | Evidência direta |
|---|---|
| Tabela `SafraCultivo` **não existe no DB** | `GET /api/cultivo/safras` → 500. Módulo Milho inteiro cai. |
| Tabela `Caixinha` **não existe no DB** | `GET /api/caixinhas` → 500. Módulo Caixinha (PR#81) cai. |
| Coluna `Animal.ehReceptora` **não existe no DB** | `GET /api/rebanho/animais` → 500. Rebanho leiteiro cai + busca ⌘K quebra com q≥2. |
| Nenhuma autenticação — user hardcoded `"marco"` | `client/src/App.tsx:104` |
| Datas "hoje" hardcoded em `28/mai/2026` | `DateRangePicker.tsx:75,168` + `Dashboard.tsx:52-54` + `Lancar.tsx:326` + `Gastos.tsx:314` + `Relatorio.tsx:520` |

Além disso: `pnpm build` a partir de um clone limpo falha (falta `prisma generate` no postinstall), e o `start:prod` roda `prisma db push --skip-generate` em toda partida — mecanismo perigoso para produção real, ver §7.

---

## 1. Estado do repositório

### 1.1 Branches / PRs
- 2 PRs **abertas** e não mergeadas:
  - **#96** `chore/track-equipe-ponto-migration` — versiona uma migration que já foi aplicada no Neon; corpo da PR ADMITE explicitamente débito: "SQL desta migration não inclui as colunas de Funcionario adicionadas depois no schema.prisma… subir um ambiente novo do zero criaria essas tabelas incompletas e a API quebraria". **É a mesma classe de bug que já está queimando no DB local hoje.**
  - **#95** `chore/pnpm-only-built-deps` — adiciona `pnpm.onlyBuiltDependencies` para `sharp` e `tesseract.js`. Baixo risco, deveria mergear.
- ~30 branches remotas antigas (`ClaudeDesign`, `IDONTKNOW`, `PLANTAS`, `Responsividade`, `fix/QAgeral`, etc.) — poluição visual, dificulta encontrar branch relevante. Recomendo purgar depois do teste.

### 1.2 Build / testes
- `pnpm test` (server): **53 arquivos, 409 testes, todos passam** em ~4s. Excelente cobertura de código puro (mappers, schemas, cálculos). **Nenhum teste bate no banco** — por isso os drifts do §2 não são pegos pela suíte.
- `pnpm build` **falha em clone fresco** com 3 erros TS em `services/rebanho/eventos.ts` (`TRANSFERENCIA_EMBRIAO`, `ehReceptora`). Causa: falta rodar `prisma generate`. Precisa passar após rodar o comando.
  - `render.yaml` contorna isso no deploy (`buildCommand: … && prisma generate && … build`), mas dev local não tem postinstall automático.
  - **Fix trivial**: adicionar `"postinstall": "prisma generate"` em `server/package.json`.
- Warning em toda invocação Prisma:
  > `The configuration property package.json#prisma is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., prisma.config.ts).`
  Prisma 7 já é iminente; hora de migrar para `prisma.config.ts`.

### 1.3 Migrations vs DB (Neon)
Rodei `prisma migrate status`:

- **13 migrations locais**. Última comum com o DB: `20260630230000_add_subtipo_plantio`.
- **3 migrations locais NUNCA aplicadas**:
  - `20260701000000_consolida_plantio_corte_whatsapp`
  - `20260701120000_cultivo_milho` ← **por isso `SafraCultivo` não existe**
  - `20260702120000_parametro_manejo`
- **1 migration no DB não versionada** (o problema da PR#96):
  - `20260706120000_add_equipe_ponto`
- Isso configura um estado impossível de rollout limpo: `migrate deploy` não vai aplicar as 3 pendentes porque a última migration comum já foi ultrapassada por uma migration nova no DB. Vai reclamar de drift.

### 1.4 Docs / arquivos soltos na raiz
Existem 12 markdowns na raiz (`AI_RULES.md`, `ANALISE-ROTAS.md`, `ARCHITECTURE.md`, `CLAUDE.md`, `COMPONENTS.md`, `DEPLOY.md`, `DESIGN.md`, `DOMAIN.md`, `METRICS.md`, `PLANO-dashboard-ia.md`, `PRODUCT.md`, `README.md`, `ROADMAP.md`, `TODO.md`). Muitos são de fase de design (jun/2026) e estão defasados vs código de julho. Depois da fase de teste, revisar quais ficam.

---

## 2. 🔴 BLOQUEADORES (não ir para teste antes de corrigir)

### B1 — Módulo Milho (Cultivo) 100% quebrado em runtime
- **Sintoma**: `GET /api/cultivo/safras` → 500 `Internal Server Error`.
- **Causa**: tabela `SafraCultivo` não existe no DB (migration `20260701120000_cultivo_milho` nunca foi aplicada).
- **Impacto**: usuário clicar em Cultivo/Milho no menu → dashboard vazio + spinner infinito ou erro na UI. Toda a modelagem de milho, silos, safras, custos por área não funciona.
- **Fix**: aplicar a migration. Como há drift, provavelmente é `prisma db push` (perigoso, ver §7) ou uma nova migration de baseline.

### B2 — Módulo Caixinha (PR#81) 100% quebrado em runtime
- **Sintoma**: `GET /api/caixinhas` → 500.
- **Causa**: tabela `Caixinha` não existe no DB.
- **Impacto**: mesma coisa — mini-módulo de fundo fixo com saldo/extrato inteiro no ar mas API 500.
- **Fix**: mesmo do B1.

### B3 — Rebanho leiteiro — 500 em qualquer listagem de animal
- **Sintoma**: `GET /api/rebanho/animais` → 500. Também `GET /api/busca?q=<2+ chars>` → 500 porque a busca global toca `Animal`.
- **Causa**: coluna `Animal.ehReceptora` (PR#94 — TE) não existe no DB. Prisma faz `SELECT *` implicitamente e o driver rejeita a coluna inexistente.
- **Impacto**: usuário abre Rebanho → **crash da tela**. Command palette ⌘K também quebra ao digitar qualquer termo. Este é o mais crítico dos 3 porque toca a feature mais visitada no dia-a-dia.
- **Fix**: mesmo do B1. Além disso, a taxa de concepção A2 tem bug conceitual — ver B4.

### B4 — Taxa de concepção (KPI A2) atribui TE à receptora, não à doadora
- **Local**: `server/src/services/rebanho/reproducao.concepcao.ts:55-65`
- **Bug**: quando um evento TE é seguido de diagnóstico positivo, o cálculo credita concepção à receptora (barriga). Genética é da doadora (`EventoReprodutivo.doadoraId`). O KPI "IA × TE" reportado no cockpit vem errado desde PR#94.
- **Impacto**: dono da fazenda vai olhar o KPI e tomar decisão econômica (comprar sêmen vs embrião) com dado errado.
- **Fix**: separar "cobertura da receptora" (registro) de "concepção da genética" no pareamento.

### B5 — Nenhuma autenticação; usuário hardcoded
- **Local**: `client/src/App.tsx:104` — `const realUserId = "marco";`
- **Server**: nenhuma rota checa auth (`grep -rn` em `server/src/routes`).
- **Impacto**: em teste com o dono, qualquer pessoa com a URL edita qualquer lançamento, apaga qualquer animal. O bot do WhatsApp usa allowlist por telefone (bom!), mas a API HTTP é livre. Se o teste vai rodar num link público (Render), é bloqueador.
- **Fix mínimo aceitável para teste**: middleware Hono validando um bearer token compartilhado + tela de login estática no client. Antes de escalar, virar Firebase/Auth0/Supabase.

### B6 — Datas "hoje" hardcoded a 28/mai/2026
- **Locais**: `DateRangePicker.tsx:75,168`, `Dashboard.tsx:52-54`, `Lancar.tsx:326`, `Gastos.tsx:314`, `Relatorio.tsx:520` (5 lugares independentes).
- **Impacto**: hoje é 06/jul/2026. Usuário abre "Hoje" no seletor de datas e vê 28/mai. Todos os presets ("Este mês", "Q2 até hoje") ficam bugados. Lançar novo gasto sugere data 28/mai/2026 — ele vai bater enter e cadastrar no mês errado.
- **Fix**: `client/src/utils/date.ts` com `getHojeReal()` (ou parametrizado via env para dev/testes) usado em todos os lugares.

### B7 — Placeholders "XXX" visíveis em produção — `RupturaCaixa.tsx`
- **Local**: `client/src/components/RupturaCaixa.tsx:62, 74, 77, 78, 79, 89, 171, 178`.
- **Sintoma**: texto literal "Ruptura em XXX", "caixa fica negativo em XXX — daqui a XXX dias", tabela com data "XXX", valor "XXX".
- **Impacto**: o componente é referenciado no Dashboard financeiro. Dono da fazenda abre e vê "XXX" espalhado. Vergonha ao vivo.
- **Fix**: religar ao backend real (dados de projeção já existem em `/api/dashboard`) OU esconder o componente até estar pronto.

### B8 — Build local só passa após rodar `prisma generate` manualmente
- **Sintoma**: `pnpm build` em clone fresco erra 3 TS2322/TS2353 em `services/rebanho/eventos.ts`.
- **Impacto**: nenhum novo desenvolvedor (ou ambiente de CI/CD sem o passo explícito) consegue subir.
- **Fix**: `"postinstall": "prisma generate"` em `server/package.json`.

---

## 3. 🟠 BUGS SÉRIOS

### S1 — 5 usos de `alert()` / `window.prompt()` no client
- `client/src/components/PlanoContas.tsx:376` — `window.prompt("Nome da nova subcategoria em "${catNome}":")` para criar subcategoria. Não valida, não permite cancelar bem, não estiliza, quebra em mobile.
- `client/src/plantio/components/PlanejamentoTab.tsx:55, 59` — `alert(e?.message ?? "Erro ao excluir.")` em vez de toast.
- `client/src/equipe/components/PontoTab.tsx:88, 90, 121` — `alert()` para "Nada a preencher" e para erros de salvar ponto.
- **Impacto**: percepção amadora; Toast global (`components/Toast.tsx`) já existe e funciona.

### S2 — Divs interativas em vez de `<button>` (a11y + teclado)
- `Gastos.tsx:368-405` — filtros de aba com `<div aria-pressed onClick>`.
- `Lancar.tsx:647, 692, 1132` — toggles com `<div role="button">`.
- `CommandPalette.tsx` — foco preso no input, tab não navega pela lista (agente confirmou).
- **Impacto**: keyboard nav quebrada; nenhum leitor de tela; violação WCAG AA.

### S3 — Fetch sem cancelamento (race condition)
- `Dashboard.tsx:1996-1999` — quando `range` muda, dispara fetch sem `AbortController`. Usuário mudando range rápido vê estado inconsistente.
- Padrão vale para `useLancamentos` no Gastos e `useTalhoes` no Plantio.

### S4 — Confirmação faltando em ações destrutivas
- `client/src/rebanho/components/AnimalForm.tsx:94-158` — "Dar baixa" (que altera status para BAIXADO) salva direto no submit, sem modal de "tem certeza?". Contraste com `DietaForm.tsx:31` e `EstoqueTab.tsx` que **têm** `confirmandoExcluir`.
- `PlanejamentoTab.tsx:55, 59` — exclusão sem confirmação.

### S5 — `brincoEletronico` sem constraint UNIQUE
- `server/prisma/schema.prisma` — `brincoEletronico String?` (linha do modelo Animal). Sem `@unique`.
- Bastão RFID pode gerar dois animais com mesmo brinco (import por engano, cadastro duplicado). PR#87 introduziu **busca** por brinco mas não bloqueia duplicidade.
- **Fix**: `@unique(map: "Animal_brincoEletronico_key")` + migration.

### S6 — Vencimentos POST sem validação Zod
- `server/src/routes/vencimentos.ts:28-40` — `POST /vencimentos/:id/liquidar` valida body com `try { JSON.parse }` manualmente. Se vier campo errado, 500 em vez de 400 claro. Todos os outros endpoints POST usam `zValidator`.

### S7 — `Funcionario.setor` é `String?` (livre) em vez de enum
- `server/prisma/schema.prisma:1351` — permite "Curral", "CURRAL", "curral" como setores distintos. No estoque, `SetorEstoque` é enum. Análise por setor vai furar em typo.
- **Fix**: promover para enum (`Leite | Cafe | Corte | Milho | Geral`).

### S8 — EquipeContent aceita `onNavEqp` e nunca usa
- `client/src/equipe/EquipeContent.tsx:7-9` — prop declarada, nunca invocada. Links internos (Funcionários ↔ Ponto ↔ Folha) não conseguem navegar; só sidebar.
- Padrão em `RebanhoContent`, `PlantioContent` funciona (reusa callback).

### S9 — OperacaoForm concatenando NPK/dose/incidência em `observacao` (string)
- `client/src/plantio/components/OperacaoForm.tsx:108-122` — dados que **têm campo próprio no schema** (`nKgHa`, `p2o5KgHa`, `k2oKgHa`, colheita) são jogados como texto na observação.
- **Impacto**: dashboards não conseguem calcular balanço nutricional; IA não tem dado estruturado. Feature aparenta funcionar, mas backend não vê nada.

### S10 — `parseValorBR` passa por `Number` (IEEE754)
- `server/src/routes/lancamentos.ts:62` — converte string BR → Number → toFixed(2) → string. Introduz risco de arredondamento (`0.1` etc.).
- **Fix**: validar com regex e trabalhar direto em string até chegar em `Prisma.Decimal`.

### S11 — Dashboard Plantio hardcoded em mock
- `server/src/services/plantio/dashboard.ts:1` — importa `mock.js`, nunca consulta Prisma.
- Mesmo com os plantios reais cadastrados (seed #86: 28k pés café + 100 ha milho), o dashboard mostra dado fictício.
- Corte tem dashboard real (`buildCorteDashboard`); é o padrão a copiar.

### S12 — Cultivo não tem dashboard nenhum
- Diretório `server/src/routes/cultivo/` não tem `dashboard.ts`. Módulo Milho não tem cockpit — só telas de sub-abas (Safras/Custos/Produção).

### S13 — Timeouts do Toast sem cleanup
- `client/src/components/Toast.tsx:44-50` — `setTimeout` dentro de `push()` nunca é cancelado. Se o toast for despachado dentro de um efeito que desmonta, memory leak (raro mas viola padrão).

---

## 4. 🟡 AMADORISMO / UX que quebra confiança

### A1 — `data/rionovo.ts` (mock) ainda cabreando telas críticas
- `Gastos.tsx:320` — KPIs leem `R.gastos` (mock) enquanto a tabela usa API real. Mistura dá impressão de "número não bate".
- `PlanoContas.tsx:56` — dropdown de grupos vem de `R.gruposPlano` (mock).
- `Lancar.tsx:575-580` — renderiza um "mockup do WhatsApp" como se fosse feature (título "Mockup — também pode lançar pelo WhatsApp"). Precisa esconder ou marcar `[FUTURO]`.

### A2 — Formatação de dinheiro re-implementada 3 vezes
- `Dashboard.tsx` define `fmtBRL()` local; `RupturaCaixa.tsx` define `fmtBRLrup()`; `Gastos.tsx` importa `fmtMoneyExact` de `charts`. Nenhuma passa por `Intl.NumberFormat("pt-BR")` de forma consistente.
- Padronizar em `client/src/lib/fmt.ts`.

### A3 — Tipagem `any` em telas grandes
- `Dashboard.tsx:24`, `RupturaCaixa.tsx:8`, `Vigilancia.tsx:11`, `PlanoContas.tsx`. Muito `eslint-disable`. Perde os benefícios do TS onde mais importa (financeiro).

### A4 — CommandPalette sem cache/cancelamento
- `CommandPalette.tsx:97-108` — debounce 200ms mas cada keystroke dispara fetch novo; sem `AbortController`. Digitação rápida deixa resultados obsoletos vencerem os novos por milissegundos. Se o backend ficar lento, sensação de UI travada.

### A5 — Sidebar sem overflow em mobile
- `AppSidebar.tsx:238-251` — 6+ abas × sub-abas sem scroll no drawer. Em mobile o menu vaza.

### A6 — CSS `dashboard.css` + `dashboard-v2.css` coabitam sem comentário
- `client/src/main.tsx:6-7` — dois arquivos carregados em ordem. Quem é ativo? Quem é legado? Ninguém sabe.

### A7 — Seleção de animal em `<select>` (sem busca) em vários forms
- `AnimalForm.tsx:145` (grupo), `LoteForm.tsx` (animais). Com 200+ cabeças, impraticável.
- O padrão certo já existe em `EventoForm` (busca por brinco); replicar.

### A8 — Sem estado vazio nas listagens
- `Gastos.tsx` — tabela vazia mostra 0 linhas sem mensagem "nenhum lançamento no período" ou CTA. Idem `Caixinha` e outros.

### A9 — Categoria animal não transiciona (Bezerra → Novilha → Vaca)
- `server/src/services/rebanho/animais.ts:59-70` — categoria é campo estático; não há regra por idade. Relatórios podem contar bezerras como novilhas se ninguém atualizar manualmente.

### A10 — Milho sem regime (próprio × arrendado × terceiro)
- Schema `SafraCultivo`/`AreaCultivo` não tem `regime`. Seed em `seed-plantios-reais.ts:179` menciona "arrendamento (terceiro planta)" **na observação**, não no modelo.
- TODO#5 tá aberto sobre isso e é o cenário real do milho (100 ha).

### A11 — Custo de mão de obra (folha) não retroalimenta módulos
- Comentário em `server/src/routes/ponto/index.ts:41-42` admite: *"Custo de mão de obra… NÃO amarrado ainda ao custo dos módulos (rebanho/plantio/corte têm custo próprio)"*.
- Ponto apura folha; dashboards operacionais não veem.

### A12 — Excluir evento reprodutivo não dropa a lactação
- `server/src/services/rebanho/eventos.ts:64-69` — `excluirEvento` só remove o `EventoReprodutivo` e chama `recomputarAnimal`. Se o evento era um PARTO, `reconstruirLactacoes()` roda mas pode deixar `Lactacao` fantasma se não sincronizar direito.
- Testes desse fluxo existem mas não cobrem exclusão específica de parto.

### A13 — Multi-fazenda simulado por `data/fazendas.ts` estático
- `Header.tsx:8, 47` — seletor de fazenda usa arquivo estático. Sem multi-tenant real. Vai colocar em teste com o dono da Rio Novo (uma fazenda), mas mostrar seletor com opções fake gera confusão.

### A14 — CORS default `"*"`
- `server/src/index.ts:59-65` — se `CORS_ORIGIN` env vazio, libera tudo. Ok em dev. Em prod: `render.yaml` deixa a variável `sync: false` — se o operador esquecer, prod fica aberto.

### A15 — JWT_SECRET default no `env.ts`
- `server/src/env.ts:7` — default `"dev-secret-trocar-em-producao"`. Ainda não é usado (auth não implementada), mas se implementar sem trocar em prod, buraco na segurança.

---

## 5. 🟢 SUGESTÕES / débito para sprint 2+

- **Migrar `package.json#prisma` → `prisma.config.ts`** (Prisma 7 removerá o suporte antigo; warning em cada comando).
- **`Prisma.Decimal` em JSON**: dashboard/lancamentos-list serializam Decimal via `toNumber()` (`server/src/services/dashboard.ts:58`, `lancamentos-list.ts:67`). Em valores muito altos perde precisão. Enquanto Rio Novo lida com R$ até ~10^8, é seguro; mas se rolar consolidação futura, migrar para string.
- **`onDelete` explícito nas FKs de `Lancamento`** (`schema.prisma:204-211`). Hoje sem regra: deletar categoria → lançamento vira órfão.
- **Recompute automático de saldo do Silo** — hoje é upsert manual em seed (`seed-plantios-reais.ts:214`). Escala pequena, mas trigger PG ou serviço centralizado dá tranquilidade.
- **Reindex/consolidação de migrations**: com o drift atual, gerar uma migration de baseline zerada.
- **Purgar branches remotas antigas** (30+ branches órfãs).
- **Consolidar formatadores em `client/src/lib/fmt.ts`** e **datas em `client/src/lib/date.ts`**.
- **Cache do fetch do CommandPalette** com SWR/React Query.
- **Validação de carência** (fitossanitário): schema tem `carenciaDias`; UI não avisa quando animal está em carência antes de venda.
- **Feature flag para módulos incompletos** (Milho, Caixinha, Ruptura) até estarem prontos; hoje aparecem no menu.
- **Rate limit** nas rotas de upload (notaFiscal) para evitar abuso.
- **Documentar `start:prod`** que roda `prisma db push --skip-generate` — ver §7.

---

## 6. ✅ O que está bom (não subestimar)

- **Cobertura de testes unitários alta**: 53 arquivos, 409 testes, todos passam em ~4s. Especialmente forte em `mappers`, `schemas`, `calc`, `recompute` (a lógica pura).
- **Padrões consistentes** nas rotas: Hono chained + `zValidator("query" | "json" | "param")` + `handle()` centralizando erros por serviço. `parametros`, `animais`, `talhoes`, `lotes`, `cultivo/safras` seguem todos o mesmo formato.
- **`FechamentoMensal` bem implementado**: `services/fechamento.ts` centraliza o guard, usado em `confirmarPendente.ts`, `notaFiscal`, `vencimentos`. Padrão a manter.
- **Upload de NF com validação forte** (`services/notaFiscal/validacaoSincrona.ts`): magic bytes, tamanho, dimensões, timing-safe. Bom trabalho de defensividade.
- **WhatsApp com signature validation via `timingSafeEqual`** (`services/whatsapp/verify.ts`) — proteção contra timing attack. Correto.
- **Allowlist do bot por telefone** — pequeno mas real: `scripts/allowlist.ts`.
- **Deep-link ⌘K** funciona no Plantio (`App.tsx:279-285`); só falta portar para Corte/Cultivo.
- **IA insights reais** no Plantio (`/api/plantio/ia/insights` retorna dados de talhões ativos + custo 12m + colheita ano corrente).
- **Dashboard financeiro** retorna projeção real (`/api/dashboard` mostra fluxo Ago→Dez/26 com valores concretos).
- **Vencimentos**: `/api/vencimentos` retorna 45KB de dados reais com dias de atraso — fluxo end-to-end (data pra "Contas a vencer" e "Marcar como paga" — PR#88).
- **Fluxo de Plantio (Café) ponta a ponta**: talhão → lavoura → operação → colheita → custo real → agregação de custo por safra. Este está pronto.
- **Fluxo de Corte** também pronto: lote → pesagem → GMD → operação comercial → resumo (arrobas, mortalidade).
- **Bot valida input**: `POST /api/bot/ask {}` → 400 com Zod issues estruturado. Bom.

---

## 7. Riscos operacionais (fora de código)

### 7.1 `start:prod` faz `prisma db push --skip-generate`
- Em `server/package.json` — cada deploy no Render **sincroniza o schema no DB automaticamente**.
- **Prós**: contorna o drift atual sem precisar de migrations perfeitas.
- **Contras**: mudança de schema breaking (renomear coluna, drop) roda **sem confirmação** em prod. Sem migração reversível. Sem histórico. Se alguém mergear um schema errado, prod perde dados.
- **Recomendação**: manter durante fase de teste, **mas registrar no runbook**. Antes de virar de "teste com o dono" para "produção real", trocar por `prisma migrate deploy` bem versionado.

### 7.2 Backup / rollback
- Não vi nenhum script de backup automático do Neon nem procedimento de restore. Neon tem branching, mas precisa ser configurado. Antes do teste real: garantir que dá para voltar 24h/7d.

### 7.3 Logs / observabilidade
- Console.error prefixados (`[cultivo/safras]`, `[whatsapp]`) — bom. Mas sem dispatcher (Sentry/Axiom). Um crash com o dono usando não vai chegar até vocês em tempo real.

### 7.4 OpenAI / IA
- `render.yaml` declara `OPENAI_API_KEY: sync: false`. Se esquecerem em prod: chat 503 e IA em "modo demo". Não é bloqueador, mas UX ruim se o dono clicar no chat e não funcionar.

### 7.5 Segurança
- Server aberto (sem auth) + CORS `"*"` fallback + user hardcoded no client. Se qualquer URL de teste for publicada (ex.: enviar link para o dono via WhatsApp), qualquer um com a URL entra.

---

## 8. Ordem sugerida de correção (roteiro pré-teste)

1. **Reconciliar schema DB** (destrava B1, B2, B3):
   1. `prisma db push` num branch Neon novo, para ver o que muda.
   2. Se ok, aplicar no branch prod ou criar migration de baseline.
   3. Correr o probe (`/tmp/probe.mjs` deste relatório) para validar.
2. **Corrigir B4** (taxa de concepção TE): patch pequeno em `reproducao.concepcao.ts`.
3. **Data "hoje" (B6)**: uma função central em `client/src/lib/date.ts`, substituir 5 lugares.
4. **RupturaCaixa "XXX" (B7)**: religar ao backend real ou esconder o componente.
5. **Autenticação mínima (B5)**: bearer token global + tela de login. Basta para o teste com uma pessoa.
6. **`postinstall: prisma generate` (B8)**: 1 linha em `server/package.json`.
7. **Fechar S1** (5 alerts nativos → toast global). É 1h de trabalho.
8. **Merge PR#95 e PR#96** (baixo risco, destravam dev env).
9. **Esconder / marcar `[FUTURO]`** módulos que não estão prontos: Ruptura, Caixinha (até B2), Milho (até B1), mock WhatsApp em Lancar.
10. **Rodar `pnpm test && pnpm build` limpos**.
11. **Snapshot do DB (Neon branch)** antes de abrir a porta pro dono.

Estimativa realista: **1 sprint de 3-4 dias** para os 6 bloqueadores. Depois já dá pra ir para teste com o dono usando roteiro guiado (não deixá-lo explorar Milho/Caixinha ainda).

---

## 9. Coisas específicas para verificar durante o teste

Deixo esses como "pontos vermelhos" para monitorar em tempo real quando o dono estiver usando:

- Lançar um débito com data anterior a hoje → confere `dataCompetencia` vs `dataLiquidacao`.
- Marcar conta como paga em "Contas a vencer" (PR#88) → conferir que o saldo do dashboard atualiza.
- Upload de NF com JPEG rotacionado 90° → OCR (`services/lib/ocr.ts`) trata? (Tesseract às vezes gagueja.)
- Registrar parto + registrar TE na mesma vaca no mesmo dia → como `reconstruirLactacoes` reage?
- Preencher grade de ponto de um mês inteiro → performance da grade se for 22 dias × 20 funcionários.
- ⌘K digitar 2 chars → deve funcionar (mas hoje 500 pelo B3).
- Tentar editar lançamento em mês fechado → deve devolver 409, não 500.
- Bot no WhatsApp → tem allowlist por telefone; conferir que número do dono está `ativo=true`.

---

## 10. Anexo — arquivos-chave visitados

Server:
- `server/src/index.ts` (montagem de 44+ routers)
- `server/prisma/schema.prisma`
- `server/src/routes/{lancamentos,cadastros,dashboard,vencimentos,busca,caixinha,notaFiscal,whatsapp,bot}.ts`
- `server/src/routes/{rebanho,plantio,corte,cultivo,ponto}/*.ts`
- `server/src/services/dashboard.ts`, `services/lancamentos-list.ts`, `services/busca.ts`, `services/rebanho/*`, `services/plantio/*`

Client:
- `client/src/App.tsx`, `router.ts`, `api.ts`, `main.tsx`
- `client/src/components/{Dashboard,Gastos,Lancar,PlanoContas,Relatorio,IA,RupturaCaixa,Vigilancia,Simulador,CommandPalette,ChatWidget,AppSidebar,DateRangePicker,Toast}.tsx`
- `client/src/financeiro/{Caixinha,ContasAVencer}.tsx`
- `client/src/rebanho/`, `plantio/`, `corte/`, `cultivo/`, `equipe/` (todos os `*.tsx`)
- `client/src/styles/*.css`

Runs:
- `pnpm test` → 409/409 pass
- `pnpm build` → falha sem `prisma generate` prévio, passa depois
- `prisma migrate status` → drift documentado em §1.3
- `curl` em 15+ endpoints da API (§ dogfooding)
- probe direto no Prisma (`/tmp/probe.mjs`) confirmando as 3 tabelas/colunas ausentes no DB

---

Fim do relatório.
