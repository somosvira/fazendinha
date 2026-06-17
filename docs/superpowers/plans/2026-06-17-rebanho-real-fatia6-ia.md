# Rebanho — Fase Real, Fatia 6: IA real (chat sobre o contexto do rebanho) — Plano

> **Para workers agênticos:** SUB-SKILL OBRIGATÓRIA: usar superpowers:subagent-driven-development para executar este plano. Passos usam checkbox (`- [ ]`).

**Goal:** Tornar a aba **IA** real — um endpoint que monta o contexto do rebanho a partir dos dados reais e responde perguntas em PT-BR; com **modo IA** (chama Claude se houver `ANTHROPIC_API_KEY`) e **modo demonstração** (respostas baseadas em regras sobre os dados reais) quando não houver credencial.

**Architecture:** Mesmo padrão do repo: Hono router→service + Prisma no backend; React fetch + estado no client. O **montador de contexto** e o **respondedor demo** são funções **puras** (testáveis, sem Prisma). O service orquestra: busca dados reais → monta contexto → se há chave chama o LLM (SDK oficial `@anthropic-ai/sdk`), senão responde por regras. A aba IA vira um chat interativo de verdade.

**Tech Stack:** Hono, Prisma 6, Zod, `@hono/zod-validator`, `@anthropic-ai/sdk` (nova dep do server), React 18, Vitest.

## Global Constraints

- ESM: imports relativos `.ts` no **server** terminam em `.js`; no **client** sem extensão.
- Identificadores de domínio em PT-BR; mensagens ao usuário em PT-BR.
- Decimal do Prisma → `Number(...)` antes de cálculo/serialização.
- Schema via `db push` (sem migrations) — **mas esta fatia não altera o schema**.
- Modelo Claude default: `claude-opus-4-8` (configurável por `ANTHROPIC_MODEL`). Thinking adaptativo. Sem prefill. SDK oficial — nunca `fetch` cru.
- Sem credencial → **modo demo** (nunca quebra; nunca chama rede).
- Cores via `var(--leite/--cafe/--outros)`; nada hardcoded.

---

## Visão dos arquivos

**Backend (server/src):**
- Criar `services/rebanho/ia.context.ts` — puro: `montarContexto`, `contextoParaTexto`, tipos.
- Criar `services/rebanho/ia.context.test.ts` — TDD do montador.
- Criar `services/rebanho/ia.responder.ts` — puro: `responderDemo` (regras).
- Criar `services/rebanho/ia.responder.test.ts` — TDD do respondedor demo.
- Criar `services/rebanho/ia.llm.ts` — `responderComLLM` (SDK Anthropic; só roda com chave).
- Criar `services/rebanho/ia.ts` — orquestrador `responderPergunta` (Prisma + gate da chave).
- Criar `routes/rebanho/ia.ts` — `POST /rebanho/ia`.
- Modificar `env.ts` — `ANTHROPIC_API_KEY` opcional, `ANTHROPIC_MODEL` default `claude-opus-4-8`.
- Modificar `index.ts` — montar `iaRouter`.
- Modificar `package.json` — dep `@anthropic-ai/sdk`.

**Client (client/src/rebanho):**
- Modificar `api.ts` — `IaResposta` + `perguntarIA`.
- Modificar `components/IaView.tsx` — chat interativo real.
- Modificar `__smoke__/render.test.ts` — caso IaView (some o conteúdo enlatado).

---

### Task 1: Montador de contexto do rebanho (puro, TDD)

**Files:**
- Create: `server/src/services/rebanho/ia.context.ts`
- Test: `server/src/services/rebanho/ia.context.test.ts`

**Interfaces — Produces:**
```ts
export interface AnimalCtx {
  numero: string; nome: string | null; categoria: string;
  statusReprodutivo: string | null; del: number | null;
  producaoMediaDia: number | null; ccs: number | null; ccsTendencia: string | null;
  diasGestacao: number | null; previsaoSecagem: string | null; iepProjetado: number | null;
}
export interface LoteCtx { nome: string; dietaNome: string | null; numAnimais: number; producaoMedia: number | null; }
export interface ContextoRebanho {
  totais: { ativos: number; emLactacao: number; secas: number; gestantes: number; vazias: number };
  producaoMediaRebanho: number | null;
  prenhezPct: number | null;
  ccsAlto: { numero: string; nome: string | null; ccs: number; tendencia: string | null }[];
  vaziasAtrasadas: { numero: string; nome: string | null; del: number | null }[];
  aSecar: { numero: string; nome: string | null; previsaoSecagem: string; diasGestacao: number | null }[];
  partosPrevistos: { numero: string; nome: string | null; diasGestacao: number | null }[];
  lotes: LoteCtx[];
}
export function montarContexto(animais: AnimalCtx[], lotes: LoteCtx[], hoje: string): ContextoRebanho;
export function contextoParaTexto(ctx: ContextoRebanho): string;
```

**Regras (alinhadas ao `dashboard.agg.ts`):**
- `emLactacao` = `del != null`. `secas` = ativos com `statusReprodutivo` não nulo e `del == null` (não-novilha seca) — simplificação: `secas = ativos − emLactacao − novilhas`, onde novilha = `categoria` começa com "NOVILHA"/"BEZERRA" (case-insensitive) **e** sem produção. Para manter simples e testável: `secas = animais.filter(a => a.del == null && a.statusReprodutivo != null && a.statusReprodutivo !== "").length`.
- `gestantes` = `statusReprodutivo === "PRENHE"`.
- `vazias` = `statusReprodutivo === "VAZIA"`.
- `producaoMediaRebanho` = média de `producaoMediaDia` dos que têm `del != null` e `producaoMediaDia != null`, arredondada (1 casa); `null` se ninguém.
- `prenhezPct` = `round(100 * gestantes / (vacas elegíveis))` onde elegíveis = animais com `statusReprodutivo` em {PRENHE, VAZIA, INSEMINADA, PEV}; `null` se zero.
- `ccsAlto` = `ccs != null && ccs >= 400`, ordenado por `ccs` desc.
- `vaziasAtrasadas` = `statusReprodutivo === "VAZIA" && del != null && del > 90`.
- `aSecar` = `statusReprodutivo === "PRENHE" && previsaoSecagem != null && previsaoSecagem <= (hoje + 30 dias)`. Inclui as já atrasadas (previsão ≤ hoje).
- `partosPrevistos` = `statusReprodutivo === "PRENHE" && diasGestacao != null && diasGestacao >= 253`.
- `contextoParaTexto(ctx)` produz um bloco PT-BR legível com os números e as listas (nome+número), para ser o system prompt do LLM. Deve mencionar: totais, produção média, prenhez %, e cada lista (ou "nenhum" quando vazia).

- [ ] **Step 1: Testes que falham** — `ia.context.test.ts` com um conjunto fixo de ~5 `AnimalCtx` + 2 `LoteCtx` cobrindo: 1 PRENHE perto de secar (previsaoSecagem em -2 dias, diasGestacao 260), 1 VAZIA del=120, 1 em lactação ccs=512 tend "subindo", 1 PEV del=20, 1 novilha sem resumo. Asserts: `totais`, `producaoMediaRebanho`, `prenhezPct`, tamanhos e 1º item de cada lista, e que `contextoParaTexto(ctx)` contém "512" e "Prenhez".
- [ ] **Step 2: Rodar e ver falhar** — `pnpm --filter rionovo-server test -- ia.context` → FAIL (módulo não existe).
- [ ] **Step 3: Implementar** `ia.context.ts` puro conforme as regras. Constantes nomeadas: `CCS_ALTO = 400`, `VAZIA_ATRASADA_DEL = 90`, `A_SECAR_JANELA_DIAS = 30`, `PARTO_PROXIMO_DIAS_GESTACAO = 253`. Datas comparadas como strings ISO `YYYY-MM-DD` (hoje + janela calculada com `new Date`).
- [ ] **Step 4: Rodar e ver passar** — `pnpm --filter rionovo-server test -- ia.context` → PASS.
- [ ] **Step 5: Commit** — `feat(rebanho): montador de contexto do rebanho para IA (TDD)`.

### Task 2: Respondedor demo por regras (puro, TDD)

**Files:**
- Create: `server/src/services/rebanho/ia.responder.ts`
- Test: `server/src/services/rebanho/ia.responder.test.ts`

**Interfaces — Consumes:** `ContextoRebanho` de Task 1. **Produces:**
```ts
export interface RespostaIA { resposta: string; lista?: string[]; rodape?: string; modo: "ia" | "demo"; }
export function responderDemo(pergunta: string, ctx: ContextoRebanho): RespostaIA;
```

**Roteamento (normalizar: minúsculas + sem acento). Primeiro match vence:**
- `ccs` | `celula` | `mastite` → CCS alto: `resposta` resume quantos ≥400; `lista` = `"<Nome> #<numero> — <ccs> mil · <tendencia>"`; se vazio, resposta "Nenhuma vaca com CCS ≥ 400 mil agora.".
- `prenhez` | `concep` | `caiu` | `prenhe` | `gestante` → prenhez%: resposta com `prenhezPct` e `gestantes`; `lista` dos partos previstos se houver.
- `secar` | `secagem` → `aSecar`: resposta com a contagem; `lista` = `"<Nome> #<numero> — secar até <previsaoSecagem>"`.
- `producao` | `leite` | `litro` | `lote` → produção: resposta com `producaoMediaRebanho` L/dia; `lista` por lote = `"<lote>: <producaoMedia ?? "—"> L/d · <numAnimais> animais · dieta <dietaNome ?? "sem dieta">"`.
- `vazia` | `pev` | `atrasad` → `vaziasAtrasadas`: resposta com a contagem; `lista` = `"<Nome> #<numero> — <del> DEL"`.
- senão → ajuda: resposta lista o que sabe responder (CCS, prenhez, secagem, produção, vazias); `modo: "demo"`.
- **Todas** retornam `modo: "demo"`.

- [ ] **Step 1: Testes que falham** — para cada rota acima, um caso que verifica `modo === "demo"`, presença de termo-chave na `resposta`, e (quando aplicável) 1º item da `lista`. Inclui o caso fallback.
- [ ] **Step 2: Rodar e ver falhar** — `pnpm --filter rionovo-server test -- ia.responder` → FAIL.
- [ ] **Step 3: Implementar** `ia.responder.ts`. Helper `norm(s)` = `s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"")`.
- [ ] **Step 4: Rodar e ver passar** — PASS.
- [ ] **Step 5: Commit** — `feat(rebanho): respondedor demo da IA por regras (TDD)`.

### Task 3: Camada LLM (SDK Anthropic) + dep

**Files:**
- Create: `server/src/services/rebanho/ia.llm.ts`
- Modify: `server/package.json` (dep), `server/src/env.ts`

**Interfaces — Produces:** `export async function responderComLLM(pergunta: string, contextoTexto: string, apiKey: string, model: string): Promise<string>`

- [ ] **Step 1: Instalar dep** — `pnpm --filter rionovo-server add @anthropic-ai/sdk` (registry acessível; versão ~0.104).
- [ ] **Step 2: env** — em `env.ts` adicionar ao schema: `ANTHROPIC_API_KEY: z.string().optional()`, `ANTHROPIC_MODEL: z.string().default("claude-opus-4-8")`.
- [ ] **Step 3: Implementar `ia.llm.ts`** — `import Anthropic from "@anthropic-ai/sdk";` (sem `.js` — é pacote, não relativo). Função:
```ts
const client = new Anthropic({ apiKey });
const msg = await client.messages.create({
  model,
  max_tokens: 2048,
  thinking: { type: "adaptive" },
  system:
    "Você é Rúmi, assistente da Fazenda Rio Novo (gado leiteiro). Responda em PT-BR, " +
    "de forma concisa e direta, usando SOMENTE os dados do contexto abaixo. Se a resposta " +
    "não estiver no contexto, diga que não tem esse dado.\n\n=== CONTEXTO DO REBANHO ===\n" + contextoTexto,
  messages: [{ role: "user", content: pergunta }],
});
return msg.content.filter((b) => b.type === "text").map((b: any) => b.text).join("\n").trim();
```
- [ ] **Step 4: Verificar build** — `pnpm --filter rionovo-server build` → sem erro de tipos (o pacote resolve).
- [ ] **Step 5: Commit** — `feat(rebanho): camada LLM da IA (SDK Anthropic, gated por chave)`.

### Task 4: Orquestrador + rota + montagem

**Files:**
- Create: `server/src/services/rebanho/ia.ts`, `server/src/routes/rebanho/ia.ts`
- Modify: `server/src/index.ts`

**Interfaces — Consumes:** Tasks 1–3. **Produces:** `export async function responderPergunta(pergunta: string): Promise<RespostaIA>` e `export const iaRouter`.

- [ ] **Step 1: `ia.ts`** — busca `prisma.animal.findMany({ where: { status: "ATIVO" }, include: { resumo: true } })` e os lotes (mesma forma do `nutricao.ts`/`buildRebanhoDashboard`: grupos com dieta + contagem de animais + produção média do lote). Mapeia para `AnimalCtx[]`/`LoteCtx[]` (Decimal→Number, datas→ISO `YYYY-MM-DD`). Chama `montarContexto(animais, lotes, hoje)`. Se `env.ANTHROPIC_API_KEY`: `try { resposta = await responderComLLM(pergunta, contextoParaTexto(ctx), env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL); return { resposta, modo: "ia" }; } catch { /* cai pro demo */ }`. Senão (ou em falha): `return responderDemo(pergunta, ctx)`.
- [ ] **Step 2: `routes/rebanho/ia.ts`** — `const schema = z.object({ pergunta: z.string().min(1).max(2000) }); export const iaRouter = new Hono().post("/rebanho/ia", zValidator("json", schema), async (c) => c.json(await responderPergunta(c.req.valid("json").pergunta)));`
- [ ] **Step 3: Montar** em `index.ts` (`import { iaRouter } ...` + `app.route("/api", iaRouter);`).
- [ ] **Step 4: Smoke de API** — subir server (`pnpm --filter rionovo-server build && node --env-file=.env dist/index.js` numa porta livre OU `tsx`) e `curl -s -XPOST localhost:PORT/api/rebanho/ia -H 'content-type: application/json' -d '{"pergunta":"quais vacas com CCS alto?"}'` → JSON com `modo:"demo"` e `lista`. Sem chave no `.env`, deve responder demo (nunca erro de rede). Documentar a saída.
- [ ] **Step 5: Commit** — `feat(rebanho): endpoint POST /rebanho/ia (orquestrador IA/demo)`.

### Task 5: Client — chat interativo real

**Files:**
- Modify: `client/src/rebanho/api.ts`, `client/src/rebanho/components/IaView.tsx`, `client/src/rebanho/__smoke__/render.test.ts`

- [ ] **Step 1: api.ts** — adicionar:
```ts
export interface IaResposta { resposta: string; lista?: string[]; rodape?: string; modo: "ia" | "demo"; }
export const perguntarIA = (pergunta: string) => req<IaResposta>(`/rebanho/ia`, { method: "POST", body: JSON.stringify({ pergunta }) });
```
- [ ] **Step 2: IaView.tsx** — virar chat com estado. Manter o intro, os `SUGESTOES` (chips agora **enviam** a pergunta), e a `<aside>` de insights (segue mock — cosmético). Thread começa **vazia**. Estado: `msgs`, `texto`, `enviando`. `enviar(p)`: ignora se vazio/enviando; push `{de:"user",txt:p}`; `setEnviando(true)`; `perguntarIA(p)` → push `{de:"ia", ...resp}`; em erro push `{de:"ia", txt:"Não consegui responder agora."}`; `finally setEnviando(false)`. Form com `onSubmit` (preventDefault). Bolha IA usa `<Enfase texto={txt} />`, renderiza `lista` (ul) e `rodape`; se `modo==="demo"`, mostra um chip discreto "modo demonstração". Input/botão desabilitam enquanto `enviando`. Chips desabilitam enquanto `enviando`.
- [ ] **Step 3: Atualizar smoke** — o caso "IaView" não pode mais checar "Jurema #1234" (thread vazia). Trocar asserts para: contém o intro ("Pergunte qualquer coisa sobre a fazenda"), uma sugestão ("CCS alto e subindo"), "Insights da semana", e `not.toContain("dangerouslySetInnerHTML")`.
- [ ] **Step 4: Verificar** — `pnpm --filter rionovo-client build` e `pnpm --filter rionovo-client test` → verde. `pnpm --filter rionovo-server test` → verde.
- [ ] **Step 5: Commit** — `feat(rebanho): aba IA vira chat real (demo/IA) consumindo /rebanho/ia`.

---

## Verificação final (controller)
- Build dos dois workspaces + todos os testes verdes.
- Navegador: aba IA → clicar uma sugestão → resposta real (modo demo) aparece com lista; digitar pergunta livre → resposta. Badge "modo demonstração" visível.
- Atualizar `docs/HANDOFF-noturno-2026-06-17.md`: IA = pronta (modo demo; chave `ANTHROPIC_API_KEY` ativa modo IA), sidebar de insights segue mock (cosmético), lista de PRs.

## Decisões deferidas
- Insights da semana reais (hoje mock) · streaming da resposta · histórico de conversa persistido · IA por animal (ficha).
