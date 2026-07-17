# Rebanho — Work-list Operacional “A Secar” Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar a work-list “A secar” em uma fila dos próximos 30 dias + atrasadas, com registro de secagem pré-preenchido e persistência transacional que preserve o histórico enriquecido de lactações.

**Architecture:** Primeiro substituímos a reconstrução destrutiva de `Lactacao` por um planner puro de operações pontuais (`CRIAR`, `ENCERRAR`, `REABRIR`) aplicado dentro da mesma transação do evento reprodutivo. Depois evoluímos a regra pura e a apresentação declarativa da work-list; o formulário existente recebe valores iniciais opcionais, e uma intenção explícita controla se o pós-salvamento volta à lista ou navega ao cockpit.

**Tech Stack:** Prisma 6/PostgreSQL, Hono, TypeScript/Node ESM, React 18, Vite 6, Vitest, Testing Library.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-16-rebanho-worklist-a-secar-design.md`.
- Um PR para toda a fatia; commits pequenos por tarefa.
- TDD obrigatório: teste vermelho observado antes de cada implementação.
- Server ESM: imports relativos terminam em `.js`; client sem extensão.
- Sem alteração de schema, migration ou import do Ideagri.
- Lactações importadas são a fonte histórica; nunca derivar o estado persistido inteiro somente de eventos.
- `PARTO` criado abre ciclo quando ainda não há ciclo com o mesmo `dtInicio`.
- `SECAGEM` criada fecha somente a lactação aberta mais recente e grava o motivo.
- Excluir `SECAGEM` reabre o ciclo correspondente; excluir `PARTO` preserva a lactação; outros eventos não alteram lactações.
- Mutação do evento, lactações, flag de receptora e resumo ocorre numa única transação.
- Work-list: `PRENHE && del != null && previsaoSecagem válida <= hoje + 30 dias`; sem limite inferior.
- Datas são civis ISO `YYYY-MM-DD`; não usar `new Date(iso).toLocaleDateString()` sem `timeZone: "UTC"`.
- A janela de 30 dias é fixa nesta fatia; `SECAGEM_ANTEC` continua sendo o parâmetro que calcula a previsão.
- Verificação E2E escreve apenas no PostgreSQL local isolado, nunca no Neon.

## File Structure

### Backend

- `server/src/services/rebanho/reproducao.recompute.ts` — cálculo reprodutivo existente + planner puro de operações pontuais sobre lactações.
- `server/src/services/rebanho/reproducao.recompute.test.ts` — testes do planner, idempotência, ambiguidades e política de exclusão.
- `server/src/services/rebanho/eventos.ts` — transação de criação/exclusão, aplicação pontual das operações e recomputação do resumo.
- `server/src/services/rebanho/eventos.service.test.ts` — regressões de service: preservação de campos, rollback e conflitos.
- `server/src/routes/rebanho/eventos.ts` — mapeamento de conflitos de lactação para HTTP 409.

### Frontend

- `client/src/rebanho/lib/worklists.ts` — filtro/ordenação `aSecar`, validação de data civil e texto de urgência.
- `client/src/rebanho/lib/worklists.test.ts` — fronteiras -N/hoje/+30/+31, `del`, datas inválidas, ordem e texto.
- `client/src/rebanho/domains.tsx` — metadados opcionais de colunas/dica/ação por work-list.
- `client/src/rebanho/components/HerdDomainView.tsx` — seleção controlada opcional e renderização dos metadados.
- `client/src/rebanho/components/HerdDomainView.test.tsx` — contrato genérico da work-list selecionada.
- `client/src/rebanho/components/EventoForm.tsx` — `tipoInicial`/`dataInicial` opcionais.
- `client/src/rebanho/components/EventoForm.test.tsx` — defaults de secagem e regressão do default genérico.
- `client/src/rebanho/components/ReproducaoTab.tsx` — mantém work-list selecionada, emite intenção de registro e recarrega dados.
- `client/src/rebanho/RebanhoContent.tsx` — estado da intenção e bifurcação pós-salvamento (`lista` × `cockpit`).
- `client/src/rebanho/components/ReproducaoTab.test.tsx` — intenção `SECAGEM` e recarga preservando seleção.
- `client/src/rebanho/RebanhoContent.test.tsx` — bifurcação pós-salvamento: permanecer na lista ou navegar ao cockpit.

---

## Task 1: Planner Puro de Sincronização Não Destrutiva

**Files:**
- Modify: `server/src/services/rebanho/reproducao.recompute.ts`
- Test: `server/src/services/rebanho/reproducao.recompute.test.ts`

**Interfaces:**
- Consumes: lactações estruturais persistidas e a mutação de um evento.
- Produces:

```ts
export interface LactacaoEstrutural {
  id: number;
  numero: number;
  dtInicio: string;
  dtFim: string | null;
  motivoSecagem: string | null;
}

export type OperacaoLactacao =
  | { tipo: "CRIAR"; numero: number; dtInicio: string }
  | { tipo: "ENCERRAR"; lactacaoId: number; dtFim: string; motivoSecagem: string | null }
  | { tipo: "REABRIR"; lactacaoId: number };

export type MutacaoEvento =
  | { tipo: "CRIACAO"; evento: EvtRepro }
  | { tipo: "EXCLUSAO"; evento: EvtRepro };

export class ConflitoLactacaoError extends Error {
  constructor(public code: "AMBIGUIDADE" | "SEM_LACTACAO_ABERTA", message: string);
}

export function planejarSincronizacaoLactacoes(
  persistidas: readonly LactacaoEstrutural[],
  mutacao: MutacaoEvento,
  numPartosEntrada?: number,
): OperacaoLactacao[];
```

- [ ] **Step 1: Escrever os testes vermelhos do planner**

Em `reproducao.recompute.test.ts`, estenda o import e adicione fixtures/testes:

```ts
import {
  reconstruirLactacoes,
  recomputarResumoReproducao,
  planejarSincronizacaoLactacoes,
  ConflitoLactacaoError,
  type LactacaoEstrutural,
} from "./reproducao.recompute.js";

const lact = (over: Partial<LactacaoEstrutural> = {}): LactacaoEstrutural => ({
  id: 10,
  numero: 2,
  dtInicio: "2025-01-10",
  dtFim: null,
  motivoSecagem: null,
  ...over,
});
const evento = (id: number, tipo: any, data: string, extra: any = {}) => ({ id, tipo, data, ...extra });

describe("planejarSincronizacaoLactacoes", () => {
  it("evento alheio à lactação não produz operação", () => {
    expect(planejarSincronizacaoLactacoes([lact()], { tipo: "CRIACAO", evento: evento(1, "DIAGNOSTICO", "2026-06-01") })).toEqual([]);
  });

  it("PARTO com início já persistido é idempotente e preserva o ciclo", () => {
    expect(planejarSincronizacaoLactacoes([lact()], { tipo: "CRIACAO", evento: evento(2, "PARTO", "2025-01-10") })).toEqual([]);
  });

  it("PARTO novo cria só um ciclo com número após o maior persistido/entrada", () => {
    expect(planejarSincronizacaoLactacoes([lact({ numero: 4 })], { tipo: "CRIACAO", evento: evento(3, "PARTO", "2026-02-01") }, 2)).toEqual([
      { tipo: "CRIAR", numero: 5, dtInicio: "2026-02-01" },
    ]);
  });

  it("SECAGEM encerra a lactação aberta mais recente e carrega o motivo", () => {
    const rows = [lact({ id: 1, numero: 1, dtInicio: "2024-01-01" }), lact({ id: 2, numero: 2, dtInicio: "2025-01-01" })];
    expect(planejarSincronizacaoLactacoes(rows, { tipo: "CRIACAO", evento: evento(4, "SECAGEM", "2025-11-01", { motivoSecagem: "Rotina" }) })).toEqual([
      { tipo: "ENCERRAR", lactacaoId: 2, dtFim: "2025-11-01", motivoSecagem: "Rotina" },
    ]);
  });

  it("SECAGEM sem ciclo aberto gera conflito explícito", () => {
    expect(() => planejarSincronizacaoLactacoes([lact({ dtFim: "2025-10-01" })], { tipo: "CRIACAO", evento: evento(5, "SECAGEM", "2025-11-01") }))
      .toThrowError(expect.objectContaining({ code: "SEM_LACTACAO_ABERTA" }));
  });

  it("excluir SECAGEM reabre o ciclo fechado por aquela data", () => {
    const rows = [lact({ id: 7, dtFim: "2025-11-01", motivoSecagem: "Rotina" })];
    expect(planejarSincronizacaoLactacoes(rows, { tipo: "EXCLUSAO", evento: evento(6, "SECAGEM", "2025-11-01") })).toEqual([
      { tipo: "REABRIR", lactacaoId: 7 },
    ]);
  });

  it("excluir PARTO preserva a lactação histórica", () => {
    expect(planejarSincronizacaoLactacoes([lact()], { tipo: "EXCLUSAO", evento: evento(7, "PARTO", "2025-01-10") })).toEqual([]);
  });

  it("recusa duas lactações com o mesmo início", () => {
    const rows = [lact({ id: 1 }), lact({ id: 2 })];
    expect(() => planejarSincronizacaoLactacoes(rows, { tipo: "CRIACAO", evento: evento(8, "CIO", "2026-01-01") }))
      .toThrowError(expect.objectContaining({ code: "AMBIGUIDADE" }));
  });
});
```

- [ ] **Step 2: Rodar e observar RED**

Run:

```bash
pnpm --filter rionovo-server exec vitest run src/services/rebanho/reproducao.recompute.test.ts
```

Expected: FAIL porque os exports do planner ainda não existem.

- [ ] **Step 3: Implementar o planner mínimo**

Em `reproducao.recompute.ts`, amplie `EvtRepro` sem quebrar fixtures existentes (`id` opcional) e adicione:

```ts
export interface EvtRepro {
  id?: number;
  tipo: TipoEvt;
  data: string;
  resultado?: string | null;
  dtPartoPrevista?: string | null;
  reprodutor?: string | null;
  motivoSecagem?: string | null;
}

export interface LactacaoEstrutural {
  id: number;
  numero: number;
  dtInicio: string;
  dtFim: string | null;
  motivoSecagem: string | null;
}

export type OperacaoLactacao =
  | { tipo: "CRIAR"; numero: number; dtInicio: string }
  | { tipo: "ENCERRAR"; lactacaoId: number; dtFim: string; motivoSecagem: string | null }
  | { tipo: "REABRIR"; lactacaoId: number };

export type MutacaoEvento =
  | { tipo: "CRIACAO"; evento: EvtRepro }
  | { tipo: "EXCLUSAO"; evento: EvtRepro };

export class ConflitoLactacaoError extends Error {
  constructor(public code: "AMBIGUIDADE" | "SEM_LACTACAO_ABERTA", message: string) {
    super(message);
  }
}

export function planejarSincronizacaoLactacoes(
  persistidas: readonly LactacaoEstrutural[],
  mutacao: MutacaoEvento,
  numPartosEntrada = 0,
): OperacaoLactacao[] {
  const porInicio = new Map<string, LactacaoEstrutural[]>();
  for (const l of persistidas) porInicio.set(l.dtInicio, [...(porInicio.get(l.dtInicio) ?? []), l]);
  const duplicada = [...porInicio.entries()].find(([, rows]) => rows.length > 1);
  if (duplicada) throw new ConflitoLactacaoError("AMBIGUIDADE", `Mais de uma lactação começa em ${duplicada[0]}.`);

  const { evento } = mutacao;
  if (mutacao.tipo === "CRIACAO" && evento.tipo === "PARTO") {
    if (porInicio.has(evento.data)) return [];
    const maior = Math.max(numPartosEntrada, 0, ...persistidas.map((l) => l.numero));
    return [{ tipo: "CRIAR", numero: maior + 1, dtInicio: evento.data }];
  }
  if (mutacao.tipo === "CRIACAO" && evento.tipo === "SECAGEM") {
    const abertas = persistidas.filter((l) => l.dtFim == null).sort((a, b) =>
      b.dtInicio.localeCompare(a.dtInicio) || b.numero - a.numero || b.id - a.id,
    );
    if (!abertas.length) throw new ConflitoLactacaoError("SEM_LACTACAO_ABERTA", "O animal não possui lactação aberta para secar.");
    return [{ tipo: "ENCERRAR", lactacaoId: abertas[0].id, dtFim: evento.data, motivoSecagem: evento.motivoSecagem ?? null }];
  }
  if (mutacao.tipo === "EXCLUSAO" && evento.tipo === "SECAGEM") {
    const candidatas = persistidas
      .filter((l) => l.dtFim === evento.data && l.dtInicio <= evento.data)
      .sort((a, b) => b.dtInicio.localeCompare(a.dtInicio) || b.numero - a.numero || b.id - a.id);
    return candidatas.length ? [{ tipo: "REABRIR", lactacaoId: candidatas[0].id }] : [];
  }
  return [];
}
```

Nos sorts existentes de eventos, desempate a mesma data por `id ?? 0`:

```ts
const evs = eventos.slice().sort((a, b) => Date.parse(a.data) - Date.parse(b.data) || (a.id ?? 0) - (b.id ?? 0));
```

- [ ] **Step 4: Rodar GREEN**

Run: mesmo comando do Step 2.

Expected: todos os testes de `reproducao.recompute.test.ts` passam.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/rebanho/reproducao.recompute.ts server/src/services/rebanho/reproducao.recompute.test.ts
git commit -m "fix(rebanho): planeja sincronização não destrutiva de lactações"
```

---

## Task 2: Aplicação Transacional no Service de Eventos

**Files:**
- Modify: `server/src/services/rebanho/eventos.ts`
- Modify: `server/src/routes/rebanho/eventos.ts`
- Create: `server/src/services/rebanho/eventos.service.test.ts`

**Interfaces:**
- Consumes: `planejarSincronizacaoLactacoes`, `OperacaoLactacao`, `MutacaoEvento` da Task 1.
- Produces: `registrarEvento`/`excluirEvento` com transação única e updates field-minimal; `EventoError.code` inclui conflitos de lactação.

- [ ] **Step 1: Escrever teste vermelho de preservação e transação**

Crie `eventos.service.test.ts` com mock hoisted do Prisma. O fake deve armazenar estado em memória e implementar `$transaction` por snapshot/rollback:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => {
  const baseLactacao = {
    id: 10, animalId: 1, numero: 2,
    dtInicio: new Date("2025-01-01T00:00:00Z"), dtFim: null,
    motivoSecagem: null, tipoAleitamento: "A", induzida: true,
    producaoTotal: 8123.45, producao305: 7600, duracaoDias: 300,
  };
  const state: any = { eventos: [], lactacoes: [structuredClone(baseLactacao)], resumo: null, animais: [{ id: 1, numPartosEntrada: 1, ehReceptora: false }] };
  let nextId = 1;
  const tx: any = {
    animal: {
      findUnique: vi.fn(async ({ where }: any) => state.animais.find((a: any) => a.id === where.id) ?? null),
      update: vi.fn(async ({ where, data }: any) => Object.assign(state.animais.find((a: any) => a.id === where.id), data)),
    },
    eventoReprodutivo: {
      create: vi.fn(async ({ data }: any) => { const e = { id: nextId++, ...data }; state.eventos.push(e); return e; }),
      findUnique: vi.fn(async ({ where }: any) => state.eventos.find((e: any) => e.id === where.id) ?? null),
      findMany: vi.fn(async ({ where }: any) => state.eventos.filter((e: any) => e.animalId === where.animalId)),
      delete: vi.fn(async ({ where }: any) => { const i = state.eventos.findIndex((e: any) => e.id === where.id); return state.eventos.splice(i, 1)[0]; }),
    },
    lactacao: {
      findMany: vi.fn(async ({ where }: any) => state.lactacoes.filter((l: any) => l.animalId === where.animalId)),
      create: vi.fn(async ({ data }: any) => { const l = { id: 99, dtFim: null, motivoSecagem: null, tipoAleitamento: null, induzida: false, producaoTotal: null, producao305: null, duracaoDias: null, ...data }; state.lactacoes.push(l); return l; }),
      update: vi.fn(async ({ where, data }: any) => Object.assign(state.lactacoes.find((l: any) => l.id === where.id), data)),
    },
    resumoAnimal: { upsert: vi.fn(async ({ create, update }: any) => { state.resumo = state.resumo ? { ...state.resumo, ...update } : create; return state.resumo; }) },
  };
  const prisma: any = {
    ...tx,
    $transaction: vi.fn(async (cb: any) => {
      const snapshot = structuredClone({ eventos: state.eventos, lactacoes: state.lactacoes, resumo: state.resumo, animais: state.animais });
      try { return await cb(tx); }
      catch (e) { Object.assign(state, snapshot); throw e; }
    }),
  };
  return { prisma, tx, state, baseLactacao, reset: () => { state.eventos = []; state.lactacoes = [structuredClone(baseLactacao)]; state.resumo = null; state.animais = [{ id: 1, numPartosEntrada: 1, ehReceptora: false }]; nextId = 1; vi.clearAllMocks(); } };
});

vi.mock("../../db.js", () => ({ prisma: mock.prisma }));
vi.mock("./parametros.js", () => ({ getNumero: vi.fn(async (chave: string) => ({ PEV_DIAS: 60, GESTACAO_DIAS: 283, SECAGEM_ANTEC: 60 }[chave])) }));

import { registrarEvento, excluirEvento } from "./eventos.js";

beforeEach(() => mock.reset());

describe("eventos + lactações em transação", () => {
  it("SECAGEM encerra o ciclo e preserva todos os campos enriquecidos", async () => {
    await registrarEvento(1, { tipo: "SECAGEM", data: "2025-11-01", motivoSecagem: "Rotina" } as any);
    expect(mock.state.lactacoes[0]).toMatchObject({
      dtFim: new Date("2025-11-01T00:00:00Z"), motivoSecagem: "Rotina",
      tipoAleitamento: "A", induzida: true,
      producaoTotal: 8123.45, producao305: 7600, duracaoDias: 300,
    });
  });

  it("evento alheio não escreve nem recria lactações", async () => {
    await registrarEvento(1, { tipo: "CIO", data: "2025-06-01" } as any);
    expect(mock.tx.lactacao.create).not.toHaveBeenCalled();
    expect(mock.tx.lactacao.update).not.toHaveBeenCalled();
    expect(mock.state.lactacoes[0]).toEqual(mock.baseLactacao);
  });

  it("excluir SECAGEM reabre o ciclo sem apagar produção", async () => {
    const e = await registrarEvento(1, { tipo: "SECAGEM", data: "2025-11-01", motivoSecagem: "Rotina" } as any);
    await excluirEvento(Number(e.id.replace(/\D/g, "")) || 1);
    expect(mock.state.lactacoes[0]).toMatchObject({ dtFim: null, motivoSecagem: null, producaoTotal: 8123.45, induzida: true });
  });

  it("rollback desfaz evento e lactação se o resumo falhar", async () => {
    mock.tx.resumoAnimal.upsert.mockRejectedValueOnce(new Error("falha resumo"));
    await expect(registrarEvento(1, { tipo: "SECAGEM", data: "2025-11-01" } as any)).rejects.toThrow("falha resumo");
    expect(mock.state.eventos).toEqual([]);
    expect(mock.state.lactacoes[0]).toEqual(mock.baseLactacao);
  });
});
```

- [ ] **Step 2: Rodar e observar RED**

```bash
pnpm --filter rionovo-server exec vitest run src/services/rebanho/eventos.service.test.ts
```

Expected: FAIL porque o service atual usa `findUnique(include)`, `deleteMany/createMany` e não executa tudo no transaction client.

- [ ] **Step 3: Refatorar o service para transação e operações pontuais**

Em `eventos.ts`:

1. importe `Prisma` e o planner;
2. converta datas Prisma para ISO;
3. leia parâmetros antes da transação;
4. aplique operações com writes mínimos;
5. releia eventos/lactações dentro da transação e faça o upsert do resumo.

Use estes helpers:

```ts
import type { Prisma } from "@prisma/client";
import {
  planejarSincronizacaoLactacoes,
  recomputarResumoReproducao,
  ConflitoLactacaoError,
  type EvtRepro,
  type OperacaoLactacao,
} from "./reproducao.recompute.js";

type ReproTx = Prisma.TransactionClient;

async function aplicarOperacoes(tx: ReproTx, animalId: number, ops: OperacaoLactacao[]) {
  for (const op of ops) {
    if (op.tipo === "CRIAR") {
      await tx.lactacao.create({ data: { animalId, numero: op.numero, dtInicio: new Date(`${op.dtInicio}T00:00:00Z`) } });
    } else if (op.tipo === "ENCERRAR") {
      await tx.lactacao.update({ where: { id: op.lactacaoId }, data: { dtFim: new Date(`${op.dtFim}T00:00:00Z`), motivoSecagem: op.motivoSecagem } });
    } else {
      await tx.lactacao.update({ where: { id: op.lactacaoId }, data: { dtFim: null, motivoSecagem: null } });
    }
  }
}

const eventoParaCalculo = (e: any): EvtRepro => ({
  id: e.id, tipo: e.tipo, data: iso(e.data)!, resultado: e.resultado,
  dtPartoPrevista: iso(e.dtPartoPrevista), reprodutor: e.reprodutor,
  motivoSecagem: e.motivoSecagem,
});

async function recomputarResumoTx(tx: ReproTx, animalId: number, numPartosEntrada: number, hoje: string, params: { pevDias?: number; gestacaoDias?: number; secagemAntec?: number }) {
  const [eventos, lactacoes] = await Promise.all([
    tx.eventoReprodutivo.findMany({ where: { animalId }, orderBy: [{ data: "asc" }, { id: "asc" }] }),
    tx.lactacao.findMany({ where: { animalId }, orderBy: [{ dtInicio: "asc" }, { numero: "asc" }, { id: "asc" }] }),
  ]);
  const evs = eventos.map(eventoParaCalculo);
  const lacts = lactacoes.map((l) => ({ numero: l.numero, dtInicio: iso(l.dtInicio)!, dtFim: iso(l.dtFim) }));
  const r = recomputarResumoReproducao(evs, lacts, numPartosEntrada, hoje, params);
  await tx.resumoAnimal.upsert({
    where: { animalId },
    create: { animalId, statusReprodutivo: r.statusReprodutivo, del: r.del, ordemLactacao: r.ordemLactacao, ultimoDgData: d(r.ultimoDgData ?? undefined), ultimoDgResultado: r.ultimoDgResultado, diasGestacao: r.diasGestacao, iepProjetado: r.iepProjetado, previsaoSecagem: d(r.previsaoSecagem ?? undefined) },
    update: { statusReprodutivo: r.statusReprodutivo, del: r.del, ordemLactacao: r.ordemLactacao, ultimoDgData: d(r.ultimoDgData ?? undefined) ?? null, ultimoDgResultado: r.ultimoDgResultado, diasGestacao: r.diasGestacao, iepProjetado: r.iepProjetado, previsaoSecagem: d(r.previsaoSecagem ?? undefined) ?? null },
  });
}
```

`registrarEvento` deve seguir esta forma:

```ts
export async function registrarEvento(animalId: number, input: CriarEventoInput): Promise<EventoTimelineDTO> {
  const [pevDias, gestacaoDias, secagemAntec] = await Promise.all([getNumero("PEV_DIAS"), getNumero("GESTACAO_DIAS"), getNumero("SECAGEM_ANTEC")]);
  const hoje = new Date().toISOString().slice(0, 10);
  try {
    const criado = await prisma.$transaction(async (tx) => {
      const animal = await tx.animal.findUnique({ where: { id: animalId } });
      if (!animal) throw new EventoError("NAO_ENCONTRADO", "animal não encontrado");
      const doadoraId = (input as any).doadoraId as number | undefined;
      if (doadoraId != null && !(await tx.animal.findUnique({ where: { id: doadoraId } }))) throw new EventoError("NAO_ENCONTRADO", "doadora não encontrada");
      const e = await tx.eventoReprodutivo.create({ data: { animalId, tipo: input.tipo, data: new Date(input.data), observacao: (input as any).observacao, reprodutor: (input as any).reprodutor, protocolo: (input as any).protocolo, resultado: (input as any).resultado, dtPartoPrevista: d((input as any).dtPartoPrevista), tipoParto: (input as any).tipoParto, numCrias: (input as any).numCrias, sexoCria: (input as any).sexoCria, motivoSecagem: (input as any).motivoSecagem, doadoraId } });
      if (input.tipo === "TRANSFERENCIA_EMBRIAO") await tx.animal.update({ where: { id: animalId }, data: { ehReceptora: true } });
      const rows = await tx.lactacao.findMany({ where: { animalId }, orderBy: [{ dtInicio: "asc" }, { numero: "asc" }, { id: "asc" }] });
      const ops = planejarSincronizacaoLactacoes(rows.map((l) => ({ id: l.id, numero: l.numero, dtInicio: iso(l.dtInicio)!, dtFim: iso(l.dtFim), motivoSecagem: l.motivoSecagem })), { tipo: "CRIACAO", evento: eventoParaCalculo(e) }, animal.numPartosEntrada);
      await aplicarOperacoes(tx, animalId, ops);
      await recomputarResumoTx(tx, animalId, animal.numPartosEntrada, hoje, { pevDias: pevDias ?? undefined, gestacaoDias: gestacaoDias ?? undefined, secagemAntec: secagemAntec ?? undefined });
      return e;
    });
    return toTimeline(criado);
  } catch (e) {
    if (e instanceof ConflitoLactacaoError) throw new EventoError(e.code === "AMBIGUIDADE" ? "AMBIGUIDADE_LACTACAO" : "SEM_LACTACAO_ABERTA", e.message);
    throw e;
  }
}
```

Implemente `excluirEvento` explicitamente com a mesma fronteira transacional:

```ts
export async function excluirEvento(eventoId: number): Promise<void> {
  const [pevDias, gestacaoDias, secagemAntec] = await Promise.all([getNumero("PEV_DIAS"), getNumero("GESTACAO_DIAS"), getNumero("SECAGEM_ANTEC")]);
  const hoje = new Date().toISOString().slice(0, 10);
  try {
    await prisma.$transaction(async (tx) => {
      const e = await tx.eventoReprodutivo.findUnique({ where: { id: eventoId } });
      if (!e) throw new EventoError("NAO_ENCONTRADO", "evento não encontrado");
      const animal = await tx.animal.findUnique({ where: { id: e.animalId } });
      if (!animal) throw new EventoError("NAO_ENCONTRADO", "animal não encontrado");
      const rows = await tx.lactacao.findMany({ where: { animalId: e.animalId }, orderBy: [{ dtInicio: "asc" }, { numero: "asc" }, { id: "asc" }] });
      const ops = planejarSincronizacaoLactacoes(
        rows.map((l) => ({ id: l.id, numero: l.numero, dtInicio: iso(l.dtInicio)!, dtFim: iso(l.dtFim), motivoSecagem: l.motivoSecagem })),
        { tipo: "EXCLUSAO", evento: eventoParaCalculo(e) },
        animal.numPartosEntrada,
      );
      await tx.eventoReprodutivo.delete({ where: { id: eventoId } });
      await aplicarOperacoes(tx, e.animalId, ops);
      await recomputarResumoTx(tx, e.animalId, animal.numPartosEntrada, hoje, {
        pevDias: pevDias ?? undefined,
        gestacaoDias: gestacaoDias ?? undefined,
        secagemAntec: secagemAntec ?? undefined,
      });
    });
  } catch (e) {
    if (e instanceof ConflitoLactacaoError) throw new EventoError(e.code === "AMBIGUIDADE" ? "AMBIGUIDADE_LACTACAO" : "SEM_LACTACAO_ABERTA", e.message);
    throw e;
  }
}
```

A ordem “planejar antes de deletar” mantém o contexto; o rollback da transação protege toda falha.

Amplie `EventoError.code`:

```ts
"NAO_ENCONTRADO" | "AMBIGUIDADE_LACTACAO" | "SEM_LACTACAO_ABERTA"
```

- [ ] **Step 4: Mapear conflitos para HTTP 409**

Em `routes/rebanho/eventos.ts`:

```ts
function fail(e: unknown): { status: 404 | 409 | 500; body: { error: string } } {
  if (e instanceof svc.EventoError) {
    const status = e.code === "NAO_ENCONTRADO" ? 404 : 409;
    return { status, body: { error: e.message } };
  }
  console.error("[eventos]", e);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}
```

- [ ] **Step 5: Rodar GREEN e regressões do backend**

```bash
pnpm --filter rionovo-server exec vitest run src/services/rebanho/eventos.service.test.ts src/services/rebanho/reproducao.recompute.test.ts src/services/rebanho/eventos.schemas.test.ts src/services/rebanho/eventos.mappers.test.ts
pnpm --filter rionovo-server exec tsc --noEmit
```

Expected: PASS, sem `deleteMany`/`createMany` no fluxo de eventos.

- [ ] **Step 6: Commit**

```bash
git add server/src/services/rebanho/eventos.ts server/src/routes/rebanho/eventos.ts server/src/services/rebanho/eventos.service.test.ts
git commit -m "fix(rebanho): preserva histórico de lactações nos eventos"
```

---

## Task 3: Regra Pura da Work-list e Urgência

**Files:**
- Modify: `client/src/rebanho/lib/worklists.ts`
- Modify: `client/src/rebanho/lib/worklists.test.ts`
- Modify: `client/src/rebanho/types.ts`

**Interfaces:**

```ts
export interface PrazoSecagem { texto: string; tom: "bad" | "warn" }
export function prazoSecagem(previsao: string, hoje: string): PrazoSecagem;
export function aSecar(resumos: ResumoAnimal[], hoje: string, janelaDias?: number): ResumoAnimal[];
```

- [ ] **Step 1: Escrever testes vermelhos de fronteira, validação e ordem**

Substitua o teste atual de `aSecar` por:

```ts
const vaca = (animalId: string, previsaoSecagem: string | null | undefined, del: number | null | undefined = 100, statusReprodutivo: any = "PRENHE") =>
  ({ animalId, statusReprodutivo, previsaoSecagem, del }) as ResumoAnimal;

describe("aSecar", () => {
  const rebanho = [
    vaca("atrasada-antiga", "2026-06-10"),
    vaca("atrasada-recente", "2026-06-15"),
    vaca("hoje", "2026-06-16", 0),
    vaca("trinta-b", "2026-07-16"),
    vaca("trinta-a", "2026-07-16"),
    vaca("trinta-um", "2026-07-17"),
    vaca("seca", "2026-06-10", null),
    vaca("vazia", "2026-06-10", 100, "VAZIA"),
    vaca("sem-data", undefined),
    vaca("invalida", "2026-02-30"),
  ];

  it("inclui atrasadas, hoje e +30; exclui +31, secas, não-prenhes e datas inválidas", () => {
    expect(aSecar(rebanho, HOJE).map((r) => r.animalId)).toEqual([
      "atrasada-antiga", "atrasada-recente", "hoje", "trinta-a", "trinta-b",
    ]);
  });

  it("usa janela customizada", () => {
    expect(aSecar([vaca("d10", "2026-06-26"), vaca("d11", "2026-06-27")], HOJE, 10).map((r) => r.animalId)).toEqual(["d10"]);
  });
});

describe("prazoSecagem", () => {
  it.each([
    ["2026-06-14", { texto: "Atrasada há 2 dias", tom: "bad" }],
    ["2026-06-15", { texto: "Atrasada há 1 dia", tom: "bad" }],
    ["2026-06-16", { texto: "Secar hoje", tom: "warn" }],
    ["2026-06-17", { texto: "Secar em 1 dia", tom: "warn" }],
    ["2026-06-18", { texto: "Secar em 2 dias", tom: "warn" }],
  ])("%s", (previsao, esperado) => expect(prazoSecagem(previsao, HOJE)).toEqual(esperado));
});
```

- [ ] **Step 2: Rodar RED**

```bash
pnpm --filter rionovo-client exec vitest run src/rebanho/lib/worklists.test.ts
```

Expected: FAIL na janela/ordenação e helper inexistente.

- [ ] **Step 3: Implementar data civil estrita, filtro e texto**

Em `types.ts`, permita ausência explícita do backend:

```ts
previsaoSecagem?: string | null;
```

Em `worklists.ts`:

```ts
const ISO_CIVIL = /^(\d{4})-(\d{2})-(\d{2})$/;
function dataCivilValida(iso: string): boolean {
  const m = ISO_CIVIL.exec(iso);
  if (!m) return false;
  const [ano, mes, dia] = m.slice(1).map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}
const addDiasCivil = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export interface PrazoSecagem { texto: string; tom: "bad" | "warn" }
export function prazoSecagem(previsao: string, hoje: string): PrazoSecagem {
  const delta = diffDias(hoje, previsao);
  if (delta < 0) { const n = Math.abs(delta); return { texto: `Atrasada há ${n} ${n === 1 ? "dia" : "dias"}`, tom: "bad" }; }
  if (delta === 0) return { texto: "Secar hoje", tom: "warn" };
  return { texto: `Secar em ${delta} ${delta === 1 ? "dia" : "dias"}`, tom: "warn" };
}

export function aSecar(resumos: ResumoAnimal[], hoje: string, janelaDias = 30): ResumoAnimal[] {
  const limite = addDiasCivil(hoje, janelaDias);
  return resumos
    .filter((r) => r.statusReprodutivo === "PRENHE" && r.del != null && typeof r.previsaoSecagem === "string" && dataCivilValida(r.previsaoSecagem) && r.previsaoSecagem <= limite)
    .sort((a, b) => a.previsaoSecagem!.localeCompare(b.previsaoSecagem!) || a.animalId.localeCompare(b.animalId));
}
```

Confirme a orientação de `diffDias` no arquivo `derive.ts`; se ela for `diffDias(inicio, fim)`, o código acima é o correto. Não inverta testes para acomodar implementação.

- [ ] **Step 4: Rodar GREEN**

Mesmo comando do Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/rebanho/lib/worklists.ts client/src/rebanho/lib/worklists.test.ts client/src/rebanho/types.ts
git commit -m "feat(rebanho): amplia fila a secar para próximos 30 dias"
```

---

## Task 4: Metadados Declarativos e Seleção Controlada da Work-list

**Files:**
- Modify: `client/src/rebanho/domains.tsx`
- Modify: `client/src/rebanho/components/HerdDomainView.tsx`
- Create: `client/src/rebanho/components/HerdDomainView.test.tsx`

**Interfaces:**

```ts
export interface WorkList {
  id: string;
  label: string;
  alerta?: boolean;
  selecionar: (rs: ResumoAnimal[]) => ResumoAnimal[];
  colunasExtras?: Coluna[];
  dicaLinha?: string;
  acaoLinha?: string;
}
```

`HerdDomainView` ganha props opcionais `worklistId`, `onWorklistChange`; callback de linha recebe o id da work-list.

- [ ] **Step 1: Escrever teste vermelho do contrato genérico**

Crie `HerdDomainView.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HerdDomainView } from "./HerdDomainView";
import type { DomainConfig } from "../domains";

afterEach(cleanup);
const resumo: any = { animalId: "1", statusReprodutivo: "PRENHE", del: 100, previsaoSecagem: "2026-06-20" };
const config: DomainConfig = {
  titulo: "Reprodução", eyebrow: "Rebanho", kpis: () => [], colunas: [],
  worklists: [
    { id: "outra", label: "Outra", selecionar: () => [] },
    { id: "secar", label: "A secar", selecionar: () => [resumo], colunasExtras: [{ nome: "Prazo", render: () => "Secar em 4 dias" }], dicaLinha: "clique para registrar secagem", acaoLinha: "Registrar secagem" },
  ],
};

describe("HerdDomainView controlada", () => {
  it("renderiza metadados da work-list selecionada e informa seu id no clique da linha", () => {
    const abrir = vi.fn();
    render(<HerdDomainView config={config} resumos={[resumo]} nomes={{ "1": { nome: "Carolina", numero: "1001" } }} onAbrirAnimal={abrir} worklistId="secar" />);
    expect(screen.getByText("Prazo")).toBeTruthy();
    expect(screen.getByText("Registrar secagem")).toBeTruthy();
    expect(screen.getByText("clique para registrar secagem")).toBeTruthy();
    fireEvent.click(screen.getByText("Carolina"));
    expect(abrir).toHaveBeenCalledWith("1", "secar");
  });

  it("em modo controlado delega mudança ao pai", () => {
    const mudar = vi.fn();
    render(<HerdDomainView config={config} resumos={[resumo]} onAbrirAnimal={() => {}} worklistId="secar" onWorklistChange={mudar} />);
    fireEvent.click(screen.getByText("Outra"));
    expect(mudar).toHaveBeenCalledWith("outra");
  });
});
```

- [ ] **Step 2: Rodar RED**

```bash
pnpm --filter rionovo-client exec vitest run src/rebanho/components/HerdDomainView.test.tsx
```

Expected: FAIL por props/metadados inexistentes.

- [ ] **Step 3: Estender `WorkList` e configurar “A secar”**

Em `domains.tsx`, importe `prazoSecagem`; acrescente os campos opcionais ao tipo e helpers civis:

```tsx
const fmtDataCivil = (iso?: string | null) => iso ? iso.split("-").reverse().join("/") : "—";

{
  id: "secar",
  label: "A secar",
  selecionar: (rs) => aSecar(rs, HOJE),
  colunasExtras: [
    { nome: "Secar até", render: (r) => fmtDataCivil(r.previsaoSecagem) },
    { nome: "Prazo", render: (r) => { const p = prazoSecagem(r.previsaoSecagem!, HOJE); return pill(p.texto, p.tom); } },
  ],
  dicaLinha: "clique numa linha pra registrar a secagem",
  acaoLinha: "Registrar secagem",
}
```

Remova `alerta: true` do card misto: nem toda vaca está atrasada; o pill da linha comunica a urgência correta.

- [ ] **Step 4: Implementar modo controlado em `HerdDomainView`**

Use estado interno apenas quando as props controladas não vierem:

```tsx
const [wlIdInterno, setWlIdInterno] = useState(config.worklists[0]?.id);
const wlId = worklistId ?? wlIdInterno;
const mudarWorklist = (id: string) => {
  if (onWorklistChange) onWorklistChange(id);
  else setWlIdInterno(id);
};
const wl = config.worklists.find((w) => w.id === wlId);
const colunas = [...config.colunas, ...(wl?.colunasExtras ?? [])];
```

Troque:

- `setWlId(w.id)` por `mudarWorklist(w.id)`;
- dica por `wl?.dicaLinha ?? dicaLinha ?? "clique numa linha pra abrir a ficha"`;
- headers/células de `config.colunas` por `colunas`;
- callback por `onAbrirAnimal(r.animalId, wl?.id)`;
- quando `wl?.acaoLinha` existir, adicione `<th>Ação</th>` e uma célula com o texto da ação.

Atualize a tipagem da prop:

```ts
onAbrirAnimal: (id: string, worklistId?: string) => void;
worklistId?: string;
onWorklistChange?: (id: string) => void;
```

- [ ] **Step 5: Rodar GREEN e testes da work-list**

```bash
pnpm --filter rionovo-client exec vitest run src/rebanho/components/HerdDomainView.test.tsx src/rebanho/lib/worklists.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/rebanho/domains.tsx client/src/rebanho/components/HerdDomainView.tsx client/src/rebanho/components/HerdDomainView.test.tsx
git commit -m "feat(rebanho): apresenta urgência e ação na fila a secar"
```

---

## Task 5: Formulário de Evento com Defaults de Abertura

**Files:**
- Modify: `client/src/rebanho/components/EventoForm.tsx`
- Create: `client/src/rebanho/components/EventoForm.test.tsx`

**Interfaces:**

```ts
export interface EventoFormProps {
  animalId: string;
  animal?: Animal;
  dominioFixo?: "reproducao" | "sanidade";
  tipoInicial?: EventoPayload["tipo"];
  dataInicial?: string;
  onFechar: () => void;
  onSalvo: (evento?: EventoTimeline) => void;
}
```

- [ ] **Step 1: Escrever teste vermelho dos defaults e payload**

Crie `EventoForm.test.tsx` usando `vi.hoisted` para mocks:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const api = vi.hoisted(() => ({
  listarRacas: vi.fn(async () => []), listarAnimais: vi.fn(async () => []),
  registrarEvento: vi.fn(async () => ({ id: "evento:1" })), registrarEventoSanidade: vi.fn(),
}));
vi.mock("../api", () => api);
import { EventoForm } from "./EventoForm";

afterEach(() => { cleanup(); vi.clearAllMocks(); });
const props = { animalId: "5", onFechar: vi.fn(), onSalvo: vi.fn() };

describe("EventoForm defaults de abertura", () => {
  it("abre em SECAGEM e hoje quando solicitado", () => {
    render(<EventoForm {...props} dominioFixo="reproducao" tipoInicial="SECAGEM" dataInicial="2026-07-16" />);
    expect(screen.getByDisplayValue("Secagem")).toBeTruthy();
    expect(screen.getByDisplayValue("2026-07-16")).toBeTruthy();
    expect(screen.getByText("Motivo")).toBeTruthy();
  });

  it("preserva defaults genéricos sem props iniciais", () => {
    render(<EventoForm {...props} dominioFixo="reproducao" />);
    expect(screen.getByDisplayValue("Inseminação")).toBeTruthy();
    const data = document.querySelector('input[type="date"]') as HTMLInputElement;
    expect(data.value).toBe("");
  });

  it("envia SECAGEM, data e motivo ao salvar", async () => {
    render(<EventoForm {...props} dominioFixo="reproducao" tipoInicial="SECAGEM" dataInicial="2026-07-16" />);
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(api.registrarEvento).toHaveBeenCalledWith("5", expect.objectContaining({ tipo: "SECAGEM", data: "2026-07-16", motivoSecagem: "Fim de ciclo (60d pré-parto)" })));
  });
});
```

Se o label real estiver ligado ao select e `getByLabelText` for mais estável, prefira-o; não selecione por posição no DOM.

- [ ] **Step 2: Rodar RED**

```bash
pnpm --filter rionovo-client exec vitest run src/rebanho/components/EventoForm.test.tsx
```

Expected: FAIL porque as props ainda não existem/estado inicia nos defaults antigos.

- [ ] **Step 3: Implementar inicializadores one-shot**

Extraia a interface de props e altere a assinatura. Inicialize:

```tsx
const [tipo, setTipo] = useState<EventoPayload["tipo"]>(() => tipoInicial ?? "INSEMINACAO");
const [f, setF] = useState<any>(() => ({
  data: dataInicial ?? "",
  racaReprodutorId: "", fracaoReprodutor: "8/8", racaSecReprodutorId: "",
  protocolo: PROTOCOLOS[0], protocoloOutro: "", deteccaoCio: DETECCAO_CIO[0],
  doadoraId: "", semenTE: "", resultado: "positivo", dtPartoPrevista: "",
  numCrias: "1", sexoCria: "F", tipoParto: "normal",
  motivoSecagem: MOTIVOS_SECAGEM[0], observacao: "",
  doenca: "", diasTratamento: "", produto: "", dose: "", carencia: "", loteProduto: "",
  ccs: "", gordura: "", proteina: "", quarto: QUARTOS_UBERE[0], severidade: SEVERIDADES_MASTITE[0], resultadoCultivo: "",
}));
```

Não crie `useEffect` para sincronizar as props: o mount condicional do modal é a fronteira de reset, e alterações posteriores não devem apagar edição em andamento.

- [ ] **Step 4: Rodar GREEN**

Mesmo comando do Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/rebanho/components/EventoForm.tsx client/src/rebanho/components/EventoForm.test.tsx
git commit -m "feat(rebanho): permite abrir evento preparado para secagem"
```

---

## Task 6: Intenção Operacional, Retorno à Lista e Recarga

**Files:**
- Modify: `client/src/rebanho/components/ReproducaoTab.tsx`
- Modify: `client/src/rebanho/RebanhoContent.tsx`
- Create: `client/src/rebanho/components/ReproducaoTab.test.tsx`
- Create: `client/src/rebanho/RebanhoContent.test.tsx`

**Interfaces:**

```ts
export type DestinoPosRegistro = "lista" | "cockpit";
export interface RegistroEventoIntent {
  tipoInicial?: EventoPayload["tipo"];
  dataInicial?: string;
  destino?: DestinoPosRegistro;
}
```

- [ ] **Step 1: Escrever teste vermelho de intenção e recarga**

Crie `ReproducaoTab.test.tsx`, mockando `useAnimais`, `useParametros`, `useTaxaConcepcao`, `HerdDomainView` e componentes visuais. O mock de `HerdDomainView` deve capturar props e expor botões para disparar callbacks:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  recarregar: vi.fn(), propsHerd: null as any,
  animal: { id: "5", numero: "1001", nome: "CAROLINA", sexo: "F", categoria: "VACA", dataEntrada: "2020-01-01", resumo: { animalId: "5", statusReprodutivo: "PRENHE", del: 200, previsaoSecagem: "2026-07-20" } },
}));
vi.mock("../api", () => ({
  useAnimais: () => ({ data: [mocks.animal], loading: false, erro: null, recarregar: mocks.recarregar }),
  useParametros: () => ({ data: [], loading: false }), useTaxaConcepcao: () => ({ data: [], loading: false }),
}));
vi.mock("./HerdDomainView", () => ({ HerdDomainView: (p: any) => { mocks.propsHerd = p; return <><button onClick={() => p.onWorklistChange("secar")}>selecionar secar</button><button onClick={() => p.onAbrirAnimal("5", "secar")}>abrir secagem</button></>; } }));
vi.mock("./RebHeader", () => ({ RebHeader: () => null }));
vi.mock("@/components/rb/RebKpiStrip", () => ({ RebKpiStrip: ({ children }: any) => <>{children}</>, RebKpi: () => null }));
vi.mock("@/components/rb/RebPrimitives", () => ({ RebMain: ({ children }: any) => <>{children}</> }));
import { ReproducaoTab } from "./ReproducaoTab";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("ReproducaoTab — fila a secar", () => {
  it("emite intenção de SECAGEM com data de hoje e retorno à lista", () => {
    const registrar = vi.fn();
    render(<ReproducaoTab onRegistrarEvento={registrar} recarga={0} />);
    fireEvent.click(screen.getByText("abrir secagem"));
    expect(registrar).toHaveBeenCalledWith(mocks.animal, { tipoInicial: "SECAGEM", dataInicial: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), destino: "lista" });
  });

  it("mudança do token recarrega dados e preserva a seleção levantada", async () => {
    const { rerender } = render(<ReproducaoTab onRegistrarEvento={() => {}} recarga={0} />);
    fireEvent.click(screen.getByText("selecionar secar"));
    expect(mocks.propsHerd.worklistId).toBe("secar");
    rerender(<ReproducaoTab onRegistrarEvento={() => {}} recarga={1} />);
    await waitFor(() => expect(mocks.recarregar).toHaveBeenCalledTimes(1));
    expect(mocks.propsHerd.worklistId).toBe("secar");
  });
});
```

Crie também `client/src/rebanho/RebanhoContent.test.tsx` para provar a bifurcação no dono do estado:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ animal: { id: "5", numero: "1001", nome: "CAROLINA" } as any }));
vi.mock("./components/ReproducaoTab", () => ({
  ReproducaoTab: (p: any) => <><span>recarga:{p.recarga}</span><button onClick={() => p.onRegistrarEvento(mocks.animal, { tipoInicial: "SECAGEM", dataInicial: "2026-07-16", destino: "lista" })}>iniciar lista</button><button onClick={() => p.onRegistrarEvento(mocks.animal, { destino: "cockpit" })}>iniciar cockpit</button></>,
}));
vi.mock("./components/EventoForm", () => ({
  EventoForm: (p: any) => <><span>{`${p.tipoInicial ?? "GENÉRICO"}:${p.dataInicial ?? "SEM_DATA"}`}</span><button onClick={() => p.onSalvo({ id: "77" })}>salvar evento</button></>,
}));
vi.mock("./components/AnimalCockpit", () => ({ AnimalCockpit: ({ animalId }: any) => <span>cockpit:{animalId}</span> }));
vi.mock("./components/AnimalTab", () => ({ AnimalTab: () => null }));
vi.mock("./components/SanidadeTab", () => ({ SanidadeTab: () => null }));
vi.mock("./components/NutricaoTab", () => ({ NutricaoTab: () => null }));
vi.mock("./components/ProducaoTab", () => ({ ProducaoTab: () => null }));
vi.mock("./components/EstoqueTab", () => ({ EstoqueTab: () => null }));
vi.mock("./components/CustoProducaoTab", () => ({ CustoProducaoTab: () => null }));
vi.mock("./components/AnimalForm", () => ({ AnimalForm: () => null }));
vi.mock("./components/DashboardView", () => ({ DashboardView: () => null }));
import { RebanhoContent } from "./RebanhoContent";

afterEach(cleanup);

describe("RebanhoContent — destino pós-registro", () => {
  it("SECAGEM operacional fecha modal, incrementa recarga e não navega", () => {
    const nav = vi.fn();
    render(<RebanhoContent aba="reproducao" onNavReb={nav} />);
    fireEvent.click(screen.getByText("iniciar lista"));
    expect(screen.getByText("SECAGEM:2026-07-16")).toBeTruthy();
    fireEvent.click(screen.getByText("salvar evento"));
    expect(screen.getByText("recarga:1")).toBeTruthy();
    expect(nav).not.toHaveBeenCalled();
  });

  it("fluxo genérico preserva navegação ao cockpit", () => {
    const nav = vi.fn();
    render(<RebanhoContent aba="reproducao" onNavReb={nav} />);
    fireEvent.click(screen.getByText("iniciar cockpit"));
    fireEvent.click(screen.getByText("salvar evento"));
    expect(nav).toHaveBeenCalledWith("animal");
  });
});
```

- [ ] **Step 2: Rodar RED**

```bash
pnpm --filter rionovo-client exec vitest run src/rebanho/components/ReproducaoTab.test.tsx src/rebanho/RebanhoContent.test.tsx
```

Expected: FAIL por contratos inexistentes.

- [ ] **Step 3: Implementar intenção e seleção em `ReproducaoTab`**

Adicione imports `useEffect`, `useRef`, `useState`, `EventoPayload`. Exporte os tipos:

```ts
export type DestinoPosRegistro = "lista" | "cockpit";
export interface RegistroEventoIntent { tipoInicial?: EventoPayload["tipo"]; dataInicial?: string; destino?: DestinoPosRegistro }
```

Assinatura:

```ts
export function ReproducaoTab({ onRegistrarEvento, recarga = 0 }: {
  onRegistrarEvento: (animal: Animal, intent?: RegistroEventoIntent) => void;
  recarga?: number;
})
```

Desestruture `recarregar`, mantenha seleção e observe o token sem fetch duplicado no mount:

```ts
const { data, loading, erro, recarregar } = useAnimais({ status: "ATIVO" });
const [worklistId, setWorklistId] = useState(DOMAINS.reproducao.worklists[0]?.id);
const recargaAnterior = useRef(recarga);
useEffect(() => {
  if (recargaAnterior.current === recarga) return;
  recargaAnterior.current = recarga;
  void recarregar();
}, [recarga, recarregar]);
```

Handler:

```ts
const abrirRegistro = (id: string, wlId?: string) => {
  const animal = data.find((a) => a.id === id);
  if (!animal) return;
  if (wlId === "secar") onRegistrarEvento(animal, { tipoInicial: "SECAGEM", dataInicial: HOJE, destino: "lista" });
  else onRegistrarEvento(animal, { destino: "cockpit" });
};
```

Passe `worklistId={worklistId}` e `onWorklistChange={setWorklistId}` ao `HerdDomainView`.

- [ ] **Step 4: Implementar bifurcação em `RebanhoContent`**

Importe os tipos de intenção e `EventoPayload`. Modele o estado:

```ts
type RegistroInline = {
  animal: Animal;
  dominio: "reproducao" | "sanidade";
  tipoInicial?: EventoPayload["tipo"];
  dataInicial?: string;
  destino: "lista" | "cockpit";
};
```

- Reprodução: `setRegistroInline({ animal, dominio: "reproducao", tipoInicial: intent?.tipoInicial, dataInicial: intent?.dataInicial, destino: intent?.destino ?? "cockpit" })`.
- Sanidade: `destino: "cockpit"`.
- Renderize `<ReproducaoTab recarga={recarga} ... />` sem `key={recarga}`.
- Passe `tipoInicial` e `dataInicial` para `EventoForm`.
- Em `onSalvo`:

```ts
const atual = registroInline;
setRegistroInline(null);
if (atual.destino === "lista") {
  setRecarga((n) => n + 1);
  return;
}
setFlashEventoId(evento?.id ?? null);
setFlashKey((n) => n + 1);
proximoAnimalRef.current = atual.animal.id;
onNavReb?.("animal");
```

- [ ] **Step 5: Rodar GREEN + smoke tests**

```bash
pnpm --filter rionovo-client exec vitest run src/rebanho/components/ReproducaoTab.test.tsx src/rebanho/RebanhoContent.test.tsx src/rebanho/components/EventoForm.test.tsx src/rebanho/components/HerdDomainView.test.tsx src/rebanho/__smoke__/render.test.ts
pnpm --filter rionovo-client exec tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/rebanho/components/ReproducaoTab.tsx client/src/rebanho/RebanhoContent.tsx client/src/rebanho/components/ReproducaoTab.test.tsx client/src/rebanho/RebanhoContent.test.tsx
git commit -m "feat(rebanho): registra secagem sem sair da fila"
```

---

## Task 7: Verificação Final, E2E Local e PR

**Files:** nenhum arquivo de produto novo; apenas ajustes decorrentes de falha observada.

- [ ] **Step 1: Rodar verificação automatizada completa**

```bash
pnpm --filter rionovo-server run test
pnpm --filter rionovo-client run test
pnpm --filter rionovo-server exec tsc --noEmit
pnpm --filter rionovo-client exec tsc --noEmit
pnpm build
```

Expected:

- server: todos os testes passam;
- client: todos os testes passam;
- ambos typechecks sem saída/erro;
- build conclui; aviso conhecido de chunk >500 kB não bloqueia.

- [ ] **Step 2: Preparar banco local isolado**

Confirme `server/.env` aponta para `postgresql://toledo@localhost:5432/rionovo`, nunca Neon. Depois:

```bash
pnpm --filter rionovo-server run db:push
pnpm --filter rionovo-server run import:rebanho
pnpm --filter rionovo-server run seed:usuarios
```

Expected: import informa centenas de animais/lactações/controles; usuário `testdev@rionovo.com.br` existe localmente.

- [ ] **Step 3: Capturar baseline de uma lactação enriquecida**

Antes de registrar secagem, use `psql` local para selecionar uma vaca elegível e guardar os campos:

```bash
/opt/homebrew/opt/postgresql@16/bin/psql -d rionovo -c '
SELECT a.id AS animal_id, a.numero, a.nome, l.id AS lactacao_id, l."dtInicio", l."dtFim",
       l."motivoSecagem", l."tipoAleitamento", l.induzida,
       l."producaoTotal", l."producao305", l."duracaoDias",
       r."previsaoSecagem", r.del
FROM "Animal" a
JOIN "ResumoAnimal" r ON r."animalId" = a.id
JOIN "Lactacao" l ON l."animalId" = a.id AND l."dtFim" IS NULL
WHERE r."statusReprodutivo" = '\''PRENHE'\'' AND r.del IS NOT NULL
  AND r."previsaoSecagem" <= CURRENT_DATE + INTERVAL '\''30 days'\''
ORDER BY r."previsaoSecagem" ASC LIMIT 5;'
```

Expected: pelo menos uma linha elegível; copie `animal_id`/`lactacao_id` para comparação.

Se o snapshot importado não tiver nenhuma previsão dentro da janela relativa à data atual, ajuste **somente o banco local** criando um DG/parto previsto por API para uma vaca com lactação aberta; não altere fixture ou regra de produção para fabricar elegibilidade.

- [ ] **Step 4: Rodar o app e verificar o happy path pelos pixels**

```bash
pnpm dev
```

No navegador:

1. login `testdev@rionovo.com.br` / `senha123` (apenas local);
2. Reprodução → “A secar”;
3. confirmar atrasadas e próximas 30 dias ordenadas por “Secar até”;
4. confirmar pills “Atrasada há N dias”, “Secar hoje” ou “Secar em N dias”;
5. clicar numa linha;
6. modal abre com tipo `Secagem`, data de hoje e motivo selecionável;
7. salvar;
8. confirmar retorno à mesma work-list;
9. confirmar que a vaca saiu da lista.

Capture screenshot da lista/modal e da lista após salvar em `/tmp`, não dentro do repositório.

- [ ] **Step 5: Verificar preservação dos campos no banco**

Repita o SELECT da lactação pelo `lactacao_id` e confirme:

- `dtFim` agora é a data registrada;
- `motivoSecagem` é o escolhido;
- `tipoAleitamento`, `induzida`, `producaoTotal`, `producao305`, `duracaoDias` são idênticos ao baseline.

- [ ] **Step 6: Probes adjacentes**

1. Outra work-list (ex.: “A inseminar”) ainda abre o formulário genérico em `Inseminação` e data vazia.
2. Tentar secar animal sem lactação aberta retorna HTTP 409/mensagem clara e mantém o modal aberto.
3. Excluir localmente o evento `SECAGEM` reabre o ciclo e preserva produção/flags.
4. Excluir localmente um `PARTO` preserva a lactação correspondente.
5. Console/rede: nenhum erro novo relacionado à work-list/formulário/eventos. Avisos preexistentes de keys duplicadas na Timeline devem ser relatados, não confundidos com esta fatia.

- [ ] **Step 7: Revisar diff e solicitar code review**

```bash
git diff main...HEAD --check
git status --short
git log --oneline main..HEAD
```

Invoke: `superpowers:requesting-code-review`. Corrija Critical/Important e repita os comandos de Step 1 + E2E afetado.

- [ ] **Step 8: Push e abrir um PR**

```bash
git push -u origin HEAD
gh pr create --base main --title "feat(rebanho): work-list operacional a secar" --body "$(cat <<'EOF'
## Resumo

Transforma “A secar” numa fila operacional de próximas 30 dias + atrasadas e permite registrar a secagem sem sair da lista.

- preserva o histórico enriquecido de lactações com sincronização pontual/transacional
- `PARTO` abre ciclo sem regravar os existentes; `SECAGEM` fecha o ciclo aberto mais recente
- excluir `SECAGEM` reabre o ciclo; excluir `PARTO` preserva a lactação histórica
- filtra `PRENHE + em lactação`, valida datas e ordena por urgência
- mostra “Atrasada há N dias” / “Secar hoje” / “Secar em N dias”
- abre o formulário em Secagem com data de hoje e retorna à mesma fila

## Verificação

- server e client tests green
- TypeScript limpo nos dois workspaces
- build completo aprovado
- E2E em PostgreSQL local com rebanho real importado
- produção, flags e metadados da lactação preservados após secagem

Spec: `docs/superpowers/specs/2026-07-16-rebanho-worklist-a-secar-design.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: um único PR aberto; não mergear automaticamente.

---

## Self-Review

### Cobertura da spec

- Próximos 30 dias + atrasadas, inclusivo: Task 3.
- `PRENHE && del != null`, sem previsão inválida: Task 3.
- Ordem por data + `animalId`: Task 3.
- Texto/tom de urgência: Tasks 3–4.
- Colunas “Secar até”/“Prazo” e ação: Task 4.
- Formulário `SECAGEM` + hoje: Task 5.
- Permanecer na work-list e recarregar: Task 6.
- Erro mantém modal: comportamento existente + E2E Task 7.
- Preservação do histórico enriquecido: Tasks 1–2 e E2E Task 7.
- Transação e HTTP 409: Task 2.
- Excluir SECAGEM reabre; excluir PARTO preserva: Tasks 1–2.
- Sem schema/import/dashboard/lote/configuração de janela: respeitado.

### Consistência de tipos

- `RegistroEventoIntent` é definido/exportado por `ReproducaoTab` e consumido por `RebanhoContent`.
- `EventoFormProps.tipoInicial` usa `EventoPayload["tipo"]` em todas as camadas.
- `WorkList.colunasExtras` reutiliza `Coluna[]`; `HerdDomainView` não conhece o id `secar`.
- `PrazoSecagem.tom` coincide com `pill(..., "warn" | "bad")`.
- `OperacaoLactacao` é definida no cálculo puro e consumida pelo service.
- `ConflitoLactacaoError` é traduzido para `EventoError`, e a rota mapeia conflito para 409.

### Limites explícitos

- A exclusão de `PARTO` preserva a lactação por decisão de produto; não há rollback exato sem proveniência/FK.
- Lactações importadas fechadas não são reabertas por ausência de evento `SECAGEM`.
- A fatia não corrige em lote dados históricos ambíguos; recusa a operação com 409.
