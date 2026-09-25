# AI_RULES.md — Regras para Agentes de IA neste Projeto

> **Manual para Claude Code, Cursor, GitHub Copilot, ChatGPT e qualquer outra IA que toque este código.**
> Estas regras existem para preservar a **identidade do produto** mesmo quando o código é escrito ou modificado por um agente.

Quem **deve** ler antes de gerar qualquer linha de código aqui:

1. [`PRODUCT.md`](./PRODUCT.md) — para entender a missão.
2. [`DOMAIN.md`](./DOMAIN.md) — para entender o agro.
3. [`ARCHITECTURE.md`](./ARCHITECTURE.md) e [`DESIGN.md`](./DESIGN.md) — para respeitar a forma.

Se você não tem certeza, **pergunte ao humano**. É melhor uma rodada extra de clarificação que um PR errado.

---

## Sumário

1. [Princípios](#1-princípios)
2. [Antes de codar](#2-antes-de-codar)
3. [Regras de produto](#3-regras-de-produto)
4. [Regras de domínio](#4-regras-de-domínio)
5. [Regras de design](#5-regras-de-design)
6. [Regras de arquitetura](#6-regras-de-arquitetura)
7. [Regras de código](#7-regras-de-código)
8. [Regras de copy](#8-regras-de-copy)
9. [Regras de PR e commits](#9-regras-de-pr-e-commits)
10. [Testes](#10-testes)
11. [Refatoração e simplificação](#11-refatoração-e-simplificação)
12. [Performance](#12-performance)
13. [Segurança e privacidade](#13-segurança-e-privacidade)
14. [Antipadrões — proibidos](#14-antipadrões--proibidos)
15. [Checklist final antes de abrir PR](#15-checklist-final-antes-de-abrir-pr)

---

## 1. Princípios

### 1.1 Nunca codar antes de entender

Se a tarefa for vaga, **pergunte**. Se for específica mas você não vê como ela encaixa no produto, **leia PRODUCT.md e DOMAIN.md**.

### 1.2 Pense como o produtor, não como o engenheiro

Para cada decisão técnica, pergunte:

- "Isso ajuda o produtor a ganhar mais dinheiro?"
- "Isso encaixa em algo que ele já entende?"
- "Isso adiciona um clique a mais? Vale o clique?"

### 1.3 Reúse antes de criar

Componente, função, classe CSS, formatador — **antes de criar, busque**. Duplicação é o pior bug deste projeto.

### 1.4 Verdade > Aparência

Não inflar métricas. Não esconder prejuízo. Não mostrar dados como exatos quando são projeções. Marcar incertezas com `≈`.

### 1.5 Simplicidade é o trabalho

A IA tende a expandir. Resista. Cada feature, cada campo, cada componente é um **custo cognitivo** para o produtor.

---

## 2. Antes de codar

Sempre:

1. **Ler** `CLAUDE.md` para contexto operacional.
2. **Ler** o documento da seção que vai mexer (`DESIGN.md` se UI, `ARCHITECTURE.md` se backend, etc.).
3. **Buscar** no repo por implementações similares (`grep`, leitura de pasta vizinha).
4. **Identificar** quais componentes/funções existentes serão reutilizados.
5. **Listar** o que NÃO vai fazer junto (escopo limitado).

Quando em dúvida sobre intent, fazer perguntas curtas e específicas. Nunca assumir.

---

## 3. Regras de produto

### 3.1 Toda tela responde a uma pergunta de negócio

Antes de criar uma tela, formular em uma frase: **"essa tela responde 'qual?'"**. Se a resposta for "exibir dados", refine.

### 3.2 Toda métrica zootécnica vem com o seu impacto financeiro

Quando exibir CCS, IEP, DEL, etc., **mostrar (ou conseguir mostrar) quanto R$ aquele número representa**. Exemplos:

- "IEP médio 412d — ≈ R$ 28 mil/ano em receita não capturada."
- "CCS 612 — descontos da cooperativa em ~R$ 0,08/L."

Se não há cálculo financeiro disponível ainda, **deixar espaço previsto** para quando entrar.

### 3.3 Toda lista termina com uma decisão

Worklists, alertas, dashboards: cada item deve ter uma **ação clara** (botão, link). Listas para "olhar" não justificam o espaço.

### 3.4 Não construir o que está em "NÃO VAMOS FAZER" do PRODUCT.md

Releia a seção 10 do `PRODUCT.md`. Toda vez. Se a tarefa cruza essa lista, parar e perguntar.

### 3.5 Datas usando vocabulário do produtor

`"28/mai/2026"` em headers, `"hoje"`, `"ontem"`, `"esta semana"` em frases. Nunca `2026-05-28T00:00:00Z`.

---

## 4. Regras de domínio

> `DOMAIN.md` descreve o vocabulário do módulo de pecuária leiteira/corte **removido em set/2026** — hoje é referência para os domínios futuros (v2–v5), não para o que existe na v1 Rebanho (identidade, lote, movimentação, categoria configurável, baixa, pesagem). Ao mexer na v1, use o vocabulário real do schema `pecuaria` (`Animal`, `Lote`, `Movimentacao`, `CategoriaAnimal`, `BaixaAnimal`) e da seção Domínio do `CLAUDE.md`; as regras abaixo (4.3, 4.4) valem para quando os domínios de reprodução/sanidade/produção voltarem.

### 4.1 Vocabulário do agro é obrigatório

Use os termos do `DOMAIN.md`. Lá estão:

- DEL, CCS, IEP, IATF, PEV, ECC, P305, MS, PB, ED, GMD, etc.
- "vaca", "novilha", "bezerra", "cabra"
- "secagem", "lactação", "cio", "monta", "diagnóstico"

**Nunca** use:

- `cow`, `DIM` (DEL em inglês), `SCC` (CCS em inglês).
- "fêmea adulta" — diga "vaca".
- "registro" — diga "lançamento", "controle" ou "evento".

### 4.2 Não inventar campos de domínio

Se o `Animal` não tem o campo X, e você precisa do X, **não invente**. Pergunte. Ou propõe migração com justificativa.

### 4.3 Conhecer interpretações invertidas

- **Produção subindo = bom** (`--pos`).
- **CCS subindo = ruim** (`--neg`).
- **IEP menor = melhor** (não invertir comparações).
- **DEL alto + VAZIA = ruim**.
- **DEL baixo + VAZIA = normal** (PEV).

A cor da seta depende do contexto, não da direção.

### 4.4 Cuidar com unidades

| Métrica | Unidade |
|---|---|
| Produção | L (litros) ou L/d |
| Peso vivo | kg |
| Energia da dieta | Mcal/kg |
| Proteína | % |
| CCS | **mil cél/mL** (não cél/mL) |
| Gestação | dias |
| Carência | horas |
| Dinheiro | R$ com 2 decimais |

**Nunca** misturar `cél/mL` com `mil cél/mL`. Erros de unidade aqui causam decisões erradas.

---

## 5. Regras de design

### 5.1 Sempre via tokens

```css
/* ✅ certo */
color: var(--neg);
background: var(--bg-card);

/* ❌ errado */
color: #7A3328;
background: #FAF6EC;
```

### 5.2 Componentes existentes primeiro

Antes de criar `<NovoBotão>`, busque `.rb-btn`. Antes de criar `<NovoCard>`, busque `.rb-box`. Antes de criar `<NovoModal>`, busque `.rb-drawer`.

`COMPONENTS.md` é o catálogo.

### 5.3 Tipografia semântica

Use `.h1`, `.h2`, `.h3`, `.body`, `.eyebrow`, `.caption`, **não** `style={{ fontSize: 18 }}`. O override de acessibilidade (`typescale.css`) só funciona via classes.

### 5.4 Cores semânticas

| Token | Quando |
|---|---|
| `--leite` | Leite, receita |
| `--cafe` | Café, custeio |
| `--outros` | Outros, investimento |
| `--pos` | Bom |
| `--neg` | Ruim, alerta forte |
| `--warn` | Atenção, médio |

**Não** introduzir cor nova sem revisar `DESIGN.md`.

### 5.5 Estados completos sempre

Toda nova tela precisa de:

- Loading.
- Empty (com CTA para gerar dado).
- Erro (com linguagem amigável).
- Sucesso quando relevante.

Sem esses 3+1, a tela não está pronta.

### 5.6 Mobile sempre

Testar a 1180px (iPad) e 720px (mobile médio). Modal que vaza, tabela que estoura, sidebar que prende — bloqueia merge.

---

## 6. Regras de arquitetura

### 6.1 Cálculo puro separado de orquestração

- `*.calc.ts`, `*.recompute.ts`, `*.agg.ts` — **funções puras**, sem Prisma.
- `*.ts` (sem sufixo) — orquestra Prisma e chama as funções puras.

Por quê: testabilidade, clareza, reuso.

### 6.2 Validação Zod sempre

```ts
// ✅
router.post("/", zValidator("json", criarAnimalSchema), async (c) => {
  const body = c.req.valid("json");
});

// ❌
router.post("/", async (c) => {
  const body = await c.req.json() as any;
});
```

Toda payload entra por Zod. Schemas vivem em `*.schemas.ts` ao lado do service.

### 6.3 Imports com `.js` no backend

Node ESM exige extensão. Não esquecer.

```ts
// ✅ backend
import { cadastrarAnimalSchema } from "../../services/pecuaria/rebanho/schemas.js";

// ✅ frontend
import { ActivityPill } from "../components/Gastos";
```

### 6.4 Sem `process.env` direto

Importar de `env.ts`. Erros de configuração devem ser **fail-fast**.

### 6.5 Sem nova lib UI

Não introduzir Material, Antd, Chakra, ShadCN, etc. Não introduzir Recharts/D3 — usar SVG próprio em `charts.tsx`.

### 6.6 Sem react-router (ainda)

Manter `useState<Tab>` em `App.tsx`. Só migrar quando passar de ~20 telas e o deep-linking virar requisito real.

### 6.7 Schema Prisma é a verdade

Mudanças de modelo passam por migration. Não fingir que campo existe se não está no schema. Não acessar `prisma.lancamento as any` para enfiar campo novo.

---

## 7. Regras de código

### 7.1 PT-BR para identificadores

Modelos, campos, rotas, mensagens — em português. Consistente com o schema.

```ts
// ✅
async function criarAnimal(payload: CriarAnimalInput) { ... }

// ❌
async function createAnimal(payload: CreateAnimalInput) { ... }
```

### 7.2 TypeScript estrito

- Sem `any` salvo em fronteiras de mock declaradas.
- Sem `as` casts não justificados.
- DTOs canônicos em `services/pecuaria/rebanho/mappers.ts` (+ `schemas.ts` para input) e `client/src/pecuaria/rebanho/types.ts`.

### 7.3 Funções pequenas

- < 40 linhas como regra.
- 1 responsabilidade.
- Nome verbo + objeto: `calcularCustoVacaDia()`, `listarAnimaisAtivos()`.

### 7.4 Comentários — só o WHY

Só comentar quando o motivo não está óbvio do código:

```ts
// Janela de 30 dias casa com o ciclo de compras de ração
const PERIODO_DIAS = 30;
```

**Não** comentar o WHAT:

```ts
// Itera sobre os animais  ← LIXO
animais.forEach(...)
```

### 7.5 Sem comentários "TODO" perpétuos

Se é um TODO real, vire issue. Se é tarefa pequena, faça agora.

### 7.6 Datas

```ts
// ✅ representar datas-só-data como string ISO no banco
@db.Date

// ❌ Date com timezone misturada
new Date().toISOString()
```

No frontend, formatar via `Intl.DateTimeFormat('pt-BR', ...)`.

### 7.7 Decimais financeiros

- Schema: `@db.Decimal(14, 2)`.
- Backend: usar Prisma Decimal nas operações (`Prisma.Decimal`), não `Number`.
- Frontend: receber como string, formatar com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.

### 7.8 Sem `console.log` em PR

Use `logger` do Hono ou remova antes do merge.

### 7.9 Lint e format

Seguir o estilo do código vizinho. Não introduzir Prettier/ESLint config nova sem alinhar.

---

## 8. Regras de copy

### 8.1 Verbo direto

| ❌ | ✅ |
|---|---|
| "Você poderia confirmar..." | "Confirmar" |
| "Submeter o formulário" | "Salvar" |
| "Há um problema com..." | "Não conseguimos atualizar." |

### 8.2 Sem jargão técnico

| ❌ | ✅ |
|---|---|
| "CRUD de Lançamentos" | "Lançar entradas e saídas" |
| "Editar entidade" | "Editar lançamento" |
| "Filtros e classificações" | "Filtros" |
| "Sincronizando" | "Atualizando dados" |
| "Internal Server Error" | "Não conseguimos processar agora. Tente em alguns segundos." |

### 8.3 Curto

Headers ≤ 6 palavras. Tooltips ≤ 12 palavras. Mensagens de erro ≤ 1 linha.

### 8.4 Linguagem do produtor

| ❌ | ✅ |
|---|---|
| "Cabeçudo bovino fêmea" | "Vaca" |
| "Status reprodutivo: PEV" | "Apta a inseminar (PEV)" |
| "Período sanitário ativo" | "Em carência: leite descartado até 18/abr" |

### 8.5 Mensagens de erro com saída

Sempre indicar o **próximo passo** ou **dar contato**:

```
Não conseguimos validar a nota.
Tente reenviar a foto, ou registre manualmente.
```

---

## 9. Regras de PR e commits

### 9.1 Commits em PT-BR

```
feat(pecuaria): telas de baixa com motivo filtrado pela classe
fix(estoque): movimento sem fornecedor não trava
chore(infra): atualiza prisma para 6.1
docs(domain): atualiza referência de domínio da pecuária
```

Tipos: `feat`, `fix`, `chore`, `refactor`, `docs`, `style`, `test`.

Modulos: `pecuaria`, `estoque`, `financeiro`, `ui`, `db`, `infra` — `nutricao`, `producao`, `sanidade`, `repro` ficam reservados para quando esses domínios entrarem na pecuária v1 (v2–v5, ver Domínio em `CLAUDE.md`).

### 9.2 PR pequenas

Idealmente < 400 linhas alteradas. Quebrar quando passar disso.

### 9.3 Descrição da PR responde

1. **O que** muda?
2. **Por que** muda? (qual decisão do produtor melhora?)
3. **Como testar?**
4. **O que NÃO está sendo feito?** (escopo claro)

### 9.4 Documentação acompanha

Mudou design system → atualizar `DESIGN.md` ou `COMPONENTS.md`.
Mudou cálculo → atualizar `METRICS.md`.
Mudou vocabulário → atualizar `DOMAIN.md`.
Mudou arquitetura/rota → atualizar `ARCHITECTURE.md`.

PR sem atualização documental quando deveria ter = bug.

### 9.5 Não commitar direto em `main`

Sempre PR. Branch nomeada `feat/...`, `fix/...`, `docs/...`.

---

## 10. Testes

### 10.1 Cobrir funções puras

`*.calc.ts`, `*.recompute.ts`, `*.agg.ts` — tudo que faz aritmética merece teste. Vitest disponível no server.

### 10.2 Não testar trivialidades

- CRUD direto Prisma (já é o ORM).
- Roteamento Hono (Zod cobre a entrada).
- Renderização CSS.

### 10.3 Smoke render no frontend

Garantir que telas montam sem crash. Exemplo: `client/src/cultivo/__smoke__/render.test.ts`.

### 10.4 Dados de teste realistas

Use a estrutura real do `R` mock e dos seeds. Não inventar formato.

---

## 11. Refatoração e simplificação

### 11.1 Quando refatorar

- Função > 60 linhas.
- Componente > 200 linhas.
- 3+ usos do mesmo padrão duplicado.
- Nome confuso para quem entra no projeto.

### 11.2 Quando NÃO refatorar

- "Vai ficar mais limpo" sem benefício de uso.
- "Talvez precise extensão futura" (YAGNI).
- No mesmo PR que introduz a feature (separar).

### 11.3 Premissa de remoção

Se você suspeita que uma função/componente não é mais usado, **grep** primeiro. Se não tem uso, **remover**. Sem deixar `// removido`, sem renomear `_unused`.

---

## 12. Performance

### 12.1 Não otimizar prematuramente

Endpoint < 200ms = OK. Bundle do frontend não monitorado ainda; usar tooling padrão Vite quando virar problema.

### 12.2 Quando precisar

- Cache em memória para agregados de meses fechados.
- Indexar antes de cachear (Prisma `@@index`).
- Material em jobs noturnos quando uso justifica.

### 12.3 N+1 é proibido

Use `include`/`select` Prisma para trazer relações em 1 query. Auditar consultas que iteram resultados disparando outras.

---

## 13. Segurança e privacidade

### 13.1 Auth existe — respeite as duas camadas

Há contas reais (`Usuario`, `Sessao`, `TokenAcesso`). O `authMiddleware` resolve
`Authorization: Bearer <token>` e injeta `c.set("usuario", ...)`; acima dele há gates de
**área** (`exigeArea`) e de **flag** (`exigePermissao`). Rota nova sob um módulo já coberto
herda o gate montado em `index.ts` — rota fora desses prefixos precisa do gate explícito.

`SHARED_ACCESS_TOKEN` é ponte de transição (vale como dono) e não deve virar base de
feature nova. Sem token no env e com a tabela `Usuario` vazia, o dev local fica aberto —
não confundir isso com "não há auth".

### 13.2 Dados financeiros são sensíveis

- Não logar valores em texto plano em produção.
- Não expor `Operacao` / `TransacaoFinanceira` / `CompromissoFinanceiro` por rota pública
  sem filtro de propriedade (`resolverEscopoLeitura/Escrita`).
- Nunca commitar `.env`, `*.json` com credenciais.

### 13.3 LGPD

Quando coletar dados pessoais (nome do produtor, telefone, CPF de cliente/fornecedor), aplicar mínimo necessário.

### 13.4 Webhooks WhatsApp

Validar assinatura. Não confiar no `From` sem verificar.

---

## 14. Antipadrões — proibidos

### Design

- ❌ Box-shadow pesada.
- ❌ Dark mode.
- ❌ Ícones decorativos sem rótulo.
- ❌ Modal full-screen sem fechamento óbvio.

### Código

- ❌ `any` sem comentário.
- ❌ Componente `Box`/`Wrapper` genérico.
- ❌ Função > 100 linhas.
- ❌ Service importando `react`.
- ❌ Rota fazendo cálculo (mover para service).
- ❌ Frontend usando `process.env` direto (use `import.meta.env`).
- ❌ Schemas Zod duplicados frontend/backend (compartilhar via `types.ts`).

### Produto

- ❌ Construir "configurador genérico" no MVP.
- ❌ Onboarding com 10 telas.
- ❌ Notificação push sem ação clara.
- ❌ Tutorial dentro da UI (preferir simplificar a UI).

### Comunicação

- ❌ Sumarizar PRs no chat com "fiz tudo, tá lindo".
- ❌ Não atualizar `MEMORY.md` quando o usuário corrige um padrão.
- ❌ Inventar nome de componente que não existe.
- ❌ "Acho que vai funcionar" — testar.

---

## 15. Checklist final antes de abrir PR

Antes de pedir review:

- [ ] Li (ou releu) os documentos relevantes (`PRODUCT.md`, `DOMAIN.md`, etc.).
- [ ] Componentes/funções reusados em vez de criados.
- [ ] Cores via `var(--token)`, tipografia via classe semântica.
- [ ] Estados completos (loading, empty, erro, sucesso quando aplicável).
- [ ] Mobile testado a 1180px e 720px.
- [ ] Validação Zod em todo payload novo.
- [ ] Cálculos puros separados em `*.calc.ts` / `*.recompute.ts` / `*.agg.ts`.
- [ ] Imports backend com `.js`.
- [ ] PT-BR em identificadores, copy e commits.
- [ ] Mensagens de erro amigáveis.
- [ ] Sem `console.log`, sem `any`, sem `// removido`.
- [ ] Documentação correspondente atualizada (se aplicável).
- [ ] Descrição do PR explica O QUE, POR QUE, COMO TESTAR e o que NÃO está sendo feito.
- [ ] Commit message no padrão `tipo(modulo): descrição`.

Se algum item falhar, **corrigir antes**.

---

## Referências cruzadas

- [`PRODUCT.md`](./PRODUCT.md) — missão e mentalidade.
- [`DOMAIN.md`](./DOMAIN.md) — vocabulário e regras agro.
- [`DESIGN.md`](./DESIGN.md) — visual.
- [`COMPONENTS.md`](./COMPONENTS.md) — catálogo.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — código.
- [`METRICS.md`](./METRICS.md) — fórmulas.
- [`ROADMAP.md`](./ROADMAP.md) — caminho.
- [`CLAUDE.md`](./CLAUDE.md) — instruções operacionais resumidas.
