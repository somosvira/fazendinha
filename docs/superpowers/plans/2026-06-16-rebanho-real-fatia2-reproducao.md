# Rebanho Fase Real — Fatia 2: Reprodução ponta a ponta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make **Reprodução** real: record events (cio/IA/DG/parto/secagem) that build a real cockpit timeline AND drive a **recompute engine** that derives the reproductive `ResumoAnimal` (status, DEL, lactation order, last DG, gestation days, expected calving/dry-off, IEP).

**Architecture:** Follows Fatia 1 (Hono router→service, Prisma `db push`, client fetchers/hooks + drawer). The recompute logic is a **pure function** (`recomputarResumoReproducao` + `reconstruirLactacoes`), Prisma-free and heavily TDD'd. The service writes the event, rebuilds `Lactacao`, runs the pure engine, and writes the reproductive fields of `ResumoAnimal` (production/CCS fields untouched). "Hoje" = the server's real `new Date()`.

**Tech Stack:** Hono + @hono/zod-validator + Zod + Prisma 6 + server Vitest; React 18 + Vite + TS. No new deps.

## Global Constraints

- pnpm: `pnpm --filter rionovo-server` / `pnpm --filter rionovo-client` from repo root.
- Server relative imports end in `.js`; client imports no extension. PT-BR domain/copy.
- Prisma `Decimal`→`Number()` in mappers (only `producaoMediaDia` exists; this slice doesn't touch it).
- Schema → DB via `prisma db push` (no migrate). DB is a local Postgres in this env.
- Recompute constants: `PEV_DIAS = 60`, `GESTACAO_DIAS = 283`, `SECAGEM_ANTECEDENCIA_DIAS = 60`.
- The recompute writes ONLY the reproductive resumo fields: `statusReprodutivo, del, ordemLactacao, ultimoDgData, ultimoDgResultado, ultimaInseminacao, diasGestacao, iepProjetado, previsaoSecagem`. It must NOT overwrite `producaoMediaDia/producao305/ccs/ccsTendencia`.
- Branch: `feat/rebanho-real-reproducao` (checked out). Commit per task.
- Existing patterns to mirror (already in repo): backend `server/src/services/rebanho/animais.{schemas,mappers,ts}` + `routes/rebanho/animais.ts`; client `client/src/rebanho/components/{AnimalForm,AnimalTab,AnimalCockpit}.tsx` + `api.ts`.

## Event timeline DTO (the cockpit `<Timeline>` already consumes this — `client/src/rebanho/types.ts`)
`EventoTimeline = { id: string; animalId: string; data: string /*ISO*/; dominio: "reproducao"; titulo: string; detalhe?: string; alerta?: boolean; marcador?: string }`

---

## File Structure

```
server/
  prisma/schema.prisma                                   [modify] — EventoReprodutivo, Lactacao, Animal.numPartosEntrada + inverse rels
  prisma/seed-rebanho.ts                                 [modify] — eventos + numPartosEntrada + recompute no seed
  src/services/rebanho/reproducao.recompute.ts            [create] — pure engine (reconstruirLactacoes + recomputarResumoReproducao)
  src/services/rebanho/reproducao.recompute.test.ts       [create]
  src/services/rebanho/eventos.schemas.ts                 [create] — Zod discriminado por tipo
  src/services/rebanho/eventos.schemas.test.ts            [create]
  src/services/rebanho/eventos.mappers.ts                 [create] — toTimeline(evento)
  src/services/rebanho/eventos.mappers.test.ts            [create]
  src/services/rebanho/eventos.ts                         [create] — service (Prisma + recompute)
  src/routes/rebanho/eventos.ts                           [create] — router
  src/index.ts                                            [modify] — mount eventosRouter
client/
  src/rebanho/api.ts                                      [modify] — eventos fetchers + useEventos
  src/rebanho/components/EventoForm.tsx                    [create] — drawer (tipo selector + per-type fields)
  src/rebanho/components/AnimalCockpit.tsx                 [modify] — real timeline + "+ Registrar evento"
  src/rebanho/components/ReproducaoTab.tsx                 [create] — real herd view (like AnimalTab)
  src/rebanho/domains.tsx                                  [modify] — reproducao KPIs from real resumos
  src/rebanho/RebanhoApp.tsx                               [modify] — reproducao tab → <ReproducaoTab/>; pass form state
```

---

## Task 1: Schema (events + lactation + numPartosEntrada) + db push

**Files:** Modify `server/prisma/schema.prisma`

**Interfaces:** Produces models `EventoReprodutivo`, `Lactacao`, enum `TipoEventoReprodutivo`, and `Animal.numPartosEntrada Int @default(0)` + inverse relations.

- [ ] **Step 1: Add to `server/prisma/schema.prisma`** (after the existing models). Also add `numPartosEntrada Int @default(0)` and the two inverse relations to the existing `Animal` model.
```prisma
enum TipoEventoReprodutivo { CIO INSEMINACAO DIAGNOSTICO PARTO SECAGEM }

model EventoReprodutivo {
  id              Int                   @id @default(autoincrement())
  animal          Animal                @relation(fields: [animalId], references: [id], onDelete: Cascade)
  animalId        Int
  tipo            TipoEventoReprodutivo
  data            DateTime              @db.Date
  observacao      String?
  reprodutor      String?
  protocolo       String?
  resultado       String?
  dtPartoPrevista DateTime?             @db.Date
  tipoParto       String?
  numCrias        Int?
  sexoCria        String?
  motivoSecagem   String?
  createdAt       DateTime              @default(now())
  updatedAt       DateTime              @updatedAt
  @@index([animalId, data])
}

model Lactacao {
  id       Int       @id @default(autoincrement())
  animal   Animal    @relation(fields: [animalId], references: [id], onDelete: Cascade)
  animalId Int
  numero   Int
  dtInicio DateTime  @db.Date
  dtFim    DateTime? @db.Date
  @@index([animalId])
}
```
In `model Animal { ... }` add these three lines (near the other fields/relations):
```prisma
  numPartosEntrada    Int                 @default(0)
  eventosReprodutivos EventoReprodutivo[]
  lactacoes           Lactacao[]
```

- [ ] **Step 2: Push + generate** — Run: `pnpm --filter rionovo-server exec prisma db push` — Expected: "in sync" + "Generated Prisma Client". (Adds 2 tables + 1 column; existing data preserved.)

- [ ] **Step 3: Commit**
```bash
git add server/prisma/schema.prisma
git commit -m "feat(rebanho): schema EventoReprodutivo + Lactacao + numPartosEntrada"
```

---

## Task 2: Recompute engine (pure) — TDD

The heart. Pure, Prisma-free.

**Files:** Create `server/src/services/rebanho/reproducao.recompute.ts` (+ `.test.ts`)

**Interfaces:**
- Produces:
  - `reconstruirLactacoes(eventos: EvtRepro[], numPartosEntrada: number): Lact[]`
  - `recomputarResumoReproducao(eventos: EvtRepro[], lactacoes: Lact[], numPartosEntrada: number, hojeISO: string): ResumoRepro`
  - types `EvtRepro`, `Lact`, `ResumoRepro` (exported).

- [ ] **Step 1: Write the failing test** — `server/src/services/rebanho/reproducao.recompute.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { reconstruirLactacoes, recomputarResumoReproducao } from "./reproducao.recompute.js";

const HOJE = "2026-06-16";
const ev = (tipo: any, data: string, extra: any = {}) => ({ tipo, data, ...extra });

describe("reconstruirLactacoes", () => {
  it("parto abre, secagem fecha, numero parte de numPartosEntrada", () => {
    const ls = reconstruirLactacoes([ev("PARTO", "2026-01-22"), ev("SECAGEM", "2025-12-18")], 2);
    // só o parto de 2026-01-22 abre lactação; a secagem é anterior e não fecha nada (lact da 2ª não está nos eventos)
    expect(ls).toHaveLength(1);
    expect(ls[0]).toMatchObject({ numero: 3, dtInicio: "2026-01-22", dtFim: null });
  });
  it("parto seguido de secagem fecha a lactação", () => {
    const ls = reconstruirLactacoes([ev("PARTO", "2024-01-10"), ev("SECAGEM", "2024-11-10"), ev("PARTO", "2025-02-01")], 0);
    expect(ls.map((l) => [l.numero, l.dtFim])).toEqual([[1, "2024-11-10"], [2, null]]);
  });
});

describe("recomputarResumoReproducao", () => {
  it("prenhe: status, DEL, ordem, gestação, prev. secagem, IEP", () => {
    const eventos = [ev("PARTO", "2026-01-22"), ev("INSEMINACAO", "2026-04-28", { reprodutor: "Lance 884" }), ev("DIAGNOSTICO", "2026-05-28", { resultado: "positivo", dtPartoPrevista: "2027-02-22" })];
    const lacts = reconstruirLactacoes(eventos, 2);
    const r = recomputarResumoReproducao(eventos, lacts, 2, HOJE);
    expect(r.statusReprodutivo).toBe("PRENHE");
    expect(r.ordemLactacao).toBe(3);
    expect(r.del).toBe(145);                          // 2026-01-22 → 2026-06-16
    expect(r.ultimoDgResultado).toBe("positivo");
    expect(r.diasGestacao).toBe(49);                  // IA 2026-04-28 → hoje
    expect(r.previsaoSecagem).toBe("2026-12-24");     // 2027-02-22 − 60d
    expect(r.iepProjetado).toBe(396);                 // 2026-01-22 → 2027-02-22
  });
  it("vazia pós-PEV: DG negativo deixa VAZIA", () => {
    const eventos = [ev("PARTO", "2026-02-01"), ev("INSEMINACAO", "2026-04-20"), ev("DIAGNOSTICO", "2026-05-14", { resultado: "negativo" })];
    const r = recomputarResumoReproducao(eventos, reconstruirLactacoes(eventos, 2), 2, HOJE);
    expect(r.statusReprodutivo).toBe("VAZIA");
    expect(r.del).toBe(135);
    expect(r.diasGestacao).toBeNull();
  });
  it("recém-parida dentro do PEV", () => {
    const eventos = [ev("PARTO", "2026-05-20")];
    const r = recomputarResumoReproducao(eventos, reconstruirLactacoes(eventos, 1), 1, HOJE);
    expect(r.statusReprodutivo).toBe("PEV");          // DEL 27 < 60
  });
  it("inseminada aguardando DG", () => {
    const eventos = [ev("PARTO", "2026-01-10"), ev("INSEMINACAO", "2026-06-01")];
    const r = recomputarResumoReproducao(eventos, reconstruirLactacoes(eventos, 1), 1, HOJE);
    expect(r.statusReprodutivo).toBe("INSEMINADA");
    expect(r.ultimaInseminacao).toBe("2026-06-01");
  });
  it("novilha sem eventos: VAZIA, DEL null", () => {
    const r = recomputarResumoReproducao([], [], 0, HOJE);
    expect(r.statusReprodutivo).toBe("VAZIA");
    expect(r.del).toBeNull();
    expect(r.ordemLactacao).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails** — Run: `pnpm --filter rionovo-server test` — Expected: FAIL (module missing).

- [ ] **Step 3: Implement `server/src/services/rebanho/reproducao.recompute.ts`**
```ts
export type TipoEvt = "CIO" | "INSEMINACAO" | "DIAGNOSTICO" | "PARTO" | "SECAGEM";
export interface EvtRepro { tipo: TipoEvt; data: string; resultado?: string | null; dtPartoPrevista?: string | null; reprodutor?: string | null; }
export interface Lact { numero: number; dtInicio: string; dtFim: string | null; }
export interface ResumoRepro {
  statusReprodutivo: "PEV" | "VAZIA" | "INSEMINADA" | "PRENHE";
  del: number | null; ordemLactacao: number | null;
  ultimoDgData: string | null; ultimoDgResultado: string | null; ultimaInseminacao: string | null;
  diasGestacao: number | null; iepProjetado: number | null; previsaoSecagem: string | null;
}

const PEV_DIAS = 60, GESTACAO_DIAS = 283, SECAGEM_ANTEC = 60, MS = 86_400_000;
const diff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / MS);
const addDias = (iso: string, n: number) => new Date(Date.parse(iso) + n * MS).toISOString().slice(0, 10);

export function reconstruirLactacoes(eventos: EvtRepro[], numPartosEntrada: number): Lact[] {
  const ps = eventos.filter((e) => e.tipo === "PARTO" || e.tipo === "SECAGEM").slice().sort((a, b) => Date.parse(a.data) - Date.parse(b.data));
  const lacts: Lact[] = [];
  for (const e of ps) {
    if (e.tipo === "PARTO") lacts.push({ numero: numPartosEntrada + lacts.length + 1, dtInicio: e.data, dtFim: null });
    else { const aberta = [...lacts].reverse().find((l) => l.dtFim === null); if (aberta) aberta.dtFim = e.data; }
  }
  return lacts;
}

export function recomputarResumoReproducao(eventos: EvtRepro[], lactacoes: Lact[], numPartosEntrada: number, hoje: string): ResumoRepro {
  const evs = eventos.slice().sort((a, b) => Date.parse(a.data) - Date.parse(b.data));
  const ultimo = (t: TipoEvt) => [...evs].reverse().find((e) => e.tipo === t) ?? null;
  const partos = evs.filter((e) => e.tipo === "PARTO");
  const ultimoParto = partos[partos.length - 1] ?? null;
  const lactAberta = lactacoes.find((l) => l.dtFim === null) ?? null;
  const ordemLactacao = lactacoes.length ? Math.max(...lactacoes.map((l) => l.numero)) : (numPartosEntrada || null);
  const del = lactAberta ? diff(lactAberta.dtInicio, hoje) : null;

  const ultimoDg = ultimo("DIAGNOSTICO");
  const ultimaIa = ultimo("INSEMINACAO");
  const partoAposDg = !!(ultimoDg && ultimoParto && Date.parse(ultimoParto.data) > Date.parse(ultimoDg.data));

  let status: ResumoRepro["statusReprodutivo"];
  if (ultimoDg && ultimoDg.resultado === "positivo" && !partoAposDg) status = "PRENHE";
  else if (ultimaIa && (!ultimoDg || Date.parse(ultimaIa.data) > Date.parse(ultimoDg.data))) status = "INSEMINADA";
  else if (del !== null && del < PEV_DIAS) status = "PEV";
  else status = "VAZIA";

  let diasGestacao: number | null = null, previsaoSecagem: string | null = null, iepProjetado: number | null = null;
  if (status === "PRENHE") {
    const iaConcep = [...evs].reverse().find((e) => e.tipo === "INSEMINACAO" && Date.parse(e.data) <= Date.parse(ultimoDg!.data));
    const dtConcepcao = iaConcep?.data ?? addDias(ultimoDg!.data, -30);
    diasGestacao = diff(dtConcepcao, hoje);
    const dtPartoPrev = ultimoDg!.dtPartoPrevista ?? addDias(dtConcepcao, GESTACAO_DIAS);
    previsaoSecagem = addDias(dtPartoPrev, -SECAGEM_ANTEC);
    iepProjetado = ultimoParto ? diff(ultimoParto.data, dtPartoPrev) : null;
  } else if (partos.length >= 2) {
    const intervals = partos.slice(1).map((p, i) => diff(partos[i].data, p.data));
    iepProjetado = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
  }

  return {
    statusReprodutivo: status, del, ordemLactacao,
    ultimoDgData: ultimoDg?.data ?? null, ultimoDgResultado: ultimoDg?.resultado ?? null,
    ultimaInseminacao: ultimaIa?.data ?? null, diasGestacao, iepProjetado, previsaoSecagem,
  };
}
```

- [ ] **Step 4: Run to verify all pass** — Run: `pnpm --filter rionovo-server test` — Expected: the recompute suite PASSES (5 cases). If `del`/`diasGestacao`/`previsaoSecagem`/`iepProjetado` assertions are off by the exact integer, recompute the expected values from the dates and fix the **test** expectations to the engine's correct output (don't fudge the engine) — they were derived by hand here.

- [ ] **Step 5: Commit**
```bash
git add server/src/services/rebanho/reproducao.recompute.ts server/src/services/rebanho/reproducao.recompute.test.ts
git commit -m "feat(rebanho): motor de recálculo reprodutivo (puro, TDD)"
```

---

## Task 3: Event Zod schemas (discriminated) + timeline mapper — TDD

**Files:** Create `eventos.schemas.ts` (+test), `eventos.mappers.ts` (+test) under `server/src/services/rebanho/`

**Interfaces:**
- Produces: `criarEventoSchema` (Zod discriminated union on `tipo`) + `CriarEventoInput`; `toTimeline(e): EventoTimelineDTO` where `EventoTimelineDTO = { id, animalId, data, dominio:"reproducao", titulo, detalhe?, alerta?, marcador? }`.

- [ ] **Step 1: Write the failing tests** — `server/src/services/rebanho/eventos.schemas.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { criarEventoSchema } from "./eventos.schemas.js";

describe("criarEventoSchema", () => {
  it("DIAGNOSTICO exige resultado válido", () => {
    expect(criarEventoSchema.safeParse({ tipo: "DIAGNOSTICO", data: "2026-05-28", resultado: "positivo" }).success).toBe(true);
    expect(criarEventoSchema.safeParse({ tipo: "DIAGNOSTICO", data: "2026-05-28", resultado: "talvez" }).success).toBe(false);
  });
  it("INSEMINACAO exige reprodutor", () => {
    expect(criarEventoSchema.safeParse({ tipo: "INSEMINACAO", data: "2026-04-28" }).success).toBe(false);
    expect(criarEventoSchema.safeParse({ tipo: "INSEMINACAO", data: "2026-04-28", reprodutor: "Lance 884" }).success).toBe(true);
  });
  it("PARTO exige numCrias >= 1", () => {
    expect(criarEventoSchema.safeParse({ tipo: "PARTO", data: "2026-01-22", numCrias: 1 }).success).toBe(true);
    expect(criarEventoSchema.safeParse({ tipo: "PARTO", data: "2026-01-22", numCrias: 0 }).success).toBe(false);
  });
  it("CIO só precisa de data", () => {
    expect(criarEventoSchema.safeParse({ tipo: "CIO", data: "2026-04-01" }).success).toBe(true);
  });
});
```
And `eventos.mappers.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { toTimeline } from "./eventos.mappers.js";

const base = { id: 5, animalId: 7 };
describe("toTimeline", () => {
  it("DG positivo", () => {
    const t = toTimeline({ ...base, tipo: "DIAGNOSTICO", data: new Date("2026-05-28"), resultado: "positivo", dtPartoPrevista: new Date("2027-02-22") } as any);
    expect(t).toMatchObject({ id: "5", animalId: "7", data: "2026-05-28", dominio: "reproducao" });
    expect(t.titulo).toContain("POSITIVO");
  });
  it("parto recebe marcador de lactação", () => {
    const t = toTimeline({ ...base, tipo: "PARTO", data: new Date("2026-01-22"), numCrias: 1, sexoCria: "F" } as any);
    expect(t.titulo).toContain("Parto");
    expect(t.marcador).toContain("lactação");
  });
  it("DG negativo marca alerta", () => {
    const t = toTimeline({ ...base, tipo: "DIAGNOSTICO", data: new Date("2026-05-14"), resultado: "negativo" } as any);
    expect(t.alerta).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify fail** — Run: `pnpm --filter rionovo-server test` — Expected: FAIL.

- [ ] **Step 3: Implement `server/src/services/rebanho/eventos.schemas.ts`**
```ts
import { z } from "zod";
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD");
const comum = { data: isoDate, observacao: z.string().max(200).optional() };

export const criarEventoSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("CIO"), ...comum }),
  z.object({ tipo: z.literal("INSEMINACAO"), ...comum, reprodutor: z.string().min(1, "reprodutor é obrigatório").max(60), protocolo: z.string().max(40).optional() }),
  z.object({ tipo: z.literal("DIAGNOSTICO"), ...comum, resultado: z.enum(["positivo", "negativo"]), dtPartoPrevista: isoDate.optional() }),
  z.object({ tipo: z.literal("PARTO"), ...comum, numCrias: z.number().int().min(1).max(3), sexoCria: z.string().max(2).optional(), tipoParto: z.string().max(20).optional() }),
  z.object({ tipo: z.literal("SECAGEM"), ...comum, motivoSecagem: z.string().max(40).optional() }),
]);
export type CriarEventoInput = z.infer<typeof criarEventoSchema>;
```

- [ ] **Step 4: Implement `server/src/services/rebanho/eventos.mappers.ts`**
```ts
export interface EventoTimelineDTO { id: string; animalId: string; data: string; dominio: "reproducao"; titulo: string; detalhe?: string; alerta?: boolean; marcador?: string; }
const iso = (d: Date) => new Date(d).toISOString().slice(0, 10);

export function toTimeline(e: any): EventoTimelineDTO {
  const base = { id: String(e.id), animalId: String(e.animalId), data: iso(e.data), dominio: "reproducao" as const };
  switch (e.tipo) {
    case "CIO":
      return { ...base, titulo: "Cio detectado", detalhe: e.observacao ?? undefined };
    case "INSEMINACAO":
      return { ...base, titulo: "Inseminação artificial", detalhe: [e.reprodutor && `reprodutor ${e.reprodutor}`, e.protocolo].filter(Boolean).join(" · ") || undefined };
    case "DIAGNOSTICO":
      return { ...base, titulo: `Diagnóstico de gestação — ${String(e.resultado).toUpperCase()}`, detalhe: e.dtPartoPrevista ? `parto previsto ${iso(e.dtPartoPrevista)}` : undefined, alerta: e.resultado === "negativo" };
    case "PARTO":
      return { ...base, titulo: `Parto — ${e.numCrias ?? 1} cria(s)${e.sexoCria ? ` ${e.sexoCria}` : ""}`, detalhe: e.tipoParto ?? undefined, marcador: "início da lactação" };
    case "SECAGEM":
      return { ...base, titulo: "Secagem", detalhe: e.motivoSecagem ?? undefined };
    default:
      return { ...base, titulo: "Evento" };
  }
}
```

- [ ] **Step 5: Run to verify pass** — Run: `pnpm --filter rionovo-server test` — Expected: all PASS. `tsc -p tsconfig.json --noEmit` clean.

- [ ] **Step 6: Commit**
```bash
git add server/src/services/rebanho/eventos.schemas.ts server/src/services/rebanho/eventos.schemas.test.ts server/src/services/rebanho/eventos.mappers.ts server/src/services/rebanho/eventos.mappers.test.ts
git commit -m "feat(rebanho): zod discriminado + toTimeline dos eventos (TDD)"
```

---

## Task 4: Event service (Prisma + recompute)

**Files:** Create `server/src/services/rebanho/eventos.ts`

**Interfaces:**
- Consumes: `prisma`, `criarEventoSchema`/`CriarEventoInput`, `toTimeline`, `reconstruirLactacoes`/`recomputarResumoReproducao`.
- Produces: `listarEventos(animalId): Promise<EventoTimelineDTO[]>`, `registrarEvento(animalId, input): Promise<EventoTimelineDTO>`, `excluirEvento(eventoId): Promise<void>`, `recomputarAnimal(animalId): Promise<void>`. Throws `EventoError` (`code: "NAO_ENCONTRADO"`).

- [ ] **Step 1: Implement `server/src/services/rebanho/eventos.ts`**
```ts
import { prisma } from "../../db.js";
import { toTimeline, type EventoTimelineDTO } from "./eventos.mappers.js";
import type { CriarEventoInput } from "./eventos.schemas.js";
import { reconstruirLactacoes, recomputarResumoReproducao, type EvtRepro } from "./reproducao.recompute.js";

export class EventoError extends Error {
  constructor(public code: "NAO_ENCONTRADO", message: string) { super(message); }
}
const d = (s?: string) => (s ? new Date(s) : undefined);
const iso = (x: Date | null) => (x ? new Date(x).toISOString().slice(0, 10) : null);

export async function recomputarAnimal(animalId: number): Promise<void> {
  const animal = await prisma.animal.findUnique({ where: { id: animalId }, include: { eventosReprodutivos: true } });
  if (!animal) return;
  const evs: EvtRepro[] = animal.eventosReprodutivos.map((e) => ({ tipo: e.tipo, data: iso(e.data)!, resultado: e.resultado, dtPartoPrevista: iso(e.dtPartoPrevista), reprodutor: e.reprodutor }));
  const lacts = reconstruirLactacoes(evs, animal.numPartosEntrada);
  // rebuild Lactacao rows
  await prisma.lactacao.deleteMany({ where: { animalId } });
  if (lacts.length) await prisma.lactacao.createMany({ data: lacts.map((l) => ({ animalId, numero: l.numero, dtInicio: new Date(l.dtInicio), dtFim: l.dtFim ? new Date(l.dtFim) : null })) });
  const r = recomputarResumoReproducao(evs, lacts, animal.numPartosEntrada, new Date().toISOString().slice(0, 10));
  await prisma.resumoAnimal.upsert({
    where: { animalId },
    create: { animalId, statusReprodutivo: r.statusReprodutivo, del: r.del, ordemLactacao: r.ordemLactacao, ultimoDgData: d(r.ultimoDgData ?? undefined), ultimoDgResultado: r.ultimoDgResultado, ultimaInseminacao: d(r.ultimaInseminacao ?? undefined), diasGestacao: r.diasGestacao, iepProjetado: r.iepProjetado, previsaoSecagem: d(r.previsaoSecagem ?? undefined) },
    update: { statusReprodutivo: r.statusReprodutivo, del: r.del, ordemLactacao: r.ordemLactacao, ultimoDgData: d(r.ultimoDgData ?? undefined) ?? null, ultimoDgResultado: r.ultimoDgResultado, ultimaInseminacao: d(r.ultimaInseminacao ?? undefined) ?? null, diasGestacao: r.diasGestacao, iepProjetado: r.iepProjetado, previsaoSecagem: d(r.previsaoSecagem ?? undefined) ?? null },
  });
}

export async function listarEventos(animalId: number): Promise<EventoTimelineDTO[]> {
  const evs = await prisma.eventoReprodutivo.findMany({ where: { animalId }, orderBy: { data: "desc" } });
  return evs.map(toTimeline);
}

export async function registrarEvento(animalId: number, input: CriarEventoInput): Promise<EventoTimelineDTO> {
  if (!(await prisma.animal.findUnique({ where: { id: animalId } }))) throw new EventoError("NAO_ENCONTRADO", "animal não encontrado");
  const e = await prisma.eventoReprodutivo.create({
    data: {
      animalId, tipo: input.tipo, data: new Date(input.data), observacao: (input as any).observacao,
      reprodutor: (input as any).reprodutor, protocolo: (input as any).protocolo,
      resultado: (input as any).resultado, dtPartoPrevista: d((input as any).dtPartoPrevista),
      tipoParto: (input as any).tipoParto, numCrias: (input as any).numCrias, sexoCria: (input as any).sexoCria,
      motivoSecagem: (input as any).motivoSecagem,
    },
  });
  await recomputarAnimal(animalId);
  return toTimeline(e);
}

export async function excluirEvento(eventoId: number): Promise<void> {
  const e = await prisma.eventoReprodutivo.findUnique({ where: { id: eventoId } });
  if (!e) throw new EventoError("NAO_ENCONTRADO", "evento não encontrado");
  await prisma.eventoReprodutivo.delete({ where: { id: eventoId } });
  await recomputarAnimal(e.animalId);
}
```

- [ ] **Step 2: Typecheck** — Run: `pnpm --filter rionovo-server exec tsc -p tsconfig.json --noEmit` — Expected: clean.

- [ ] **Step 3: Commit**
```bash
git add server/src/services/rebanho/eventos.ts
git commit -m "feat(rebanho): service de eventos + recompute do resumo"
```

---

## Task 5: Event router + mount + API smoke

**Files:** Create `server/src/routes/rebanho/eventos.ts`; modify `server/src/index.ts`

- [ ] **Step 1: Create `server/src/routes/rebanho/eventos.ts`**
```ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { criarEventoSchema } from "../../services/rebanho/eventos.schemas.js";
import * as svc from "../../services/rebanho/eventos.js";

export const eventosRouter = new Hono()
  .get("/rebanho/animais/:id/eventos", async (c) => c.json(await svc.listarEventos(Number(c.req.param("id")))))
  .post("/rebanho/animais/:id/eventos", zValidator("json", criarEventoSchema), async (c) => {
    try { return c.json(await svc.registrarEvento(Number(c.req.param("id")), c.req.valid("json")), 201); }
    catch (e) { if (e instanceof svc.EventoError) return c.json({ error: e.message }, 404); return c.json({ error: e instanceof Error ? e.message : "erro" }, 500); }
  })
  .delete("/rebanho/eventos/:id", async (c) => {
    try { await svc.excluirEvento(Number(c.req.param("id"))); return c.json({ ok: true }); }
    catch (e) { if (e instanceof svc.EventoError) return c.json({ error: e.message }, 404); return c.json({ error: e instanceof Error ? e.message : "erro" }, 500); }
  });
```

- [ ] **Step 2: Mount** — in `server/src/index.ts` add `import { eventosRouter } from "./routes/rebanho/eventos.js";` and `app.route("/api", eventosRouter);` after the animais mount.

- [ ] **Step 3: API smoke**
```bash
pnpm --filter rionovo-server dev &
sleep 3
ID=$(curl -s 'http://localhost:41873/api/rebanho/animais' | sed -E 's/.*"id":"([0-9]+)".*/\1/')
echo "--- registrar parto ---"; curl -s -X POST "http://localhost:41873/api/rebanho/animais/$ID/eventos" -H 'content-type: application/json' -d '{"tipo":"PARTO","data":"2026-01-22","numCrias":1,"sexoCria":"F"}' -w '\n[%{http_code}]\n'
echo "--- timeline ---"; curl -s "http://localhost:41873/api/rebanho/animais/$ID/eventos" | head -c 300; echo
echo "--- resumo recomputado ---"; curl -s "http://localhost:41873/api/rebanho/animais/$ID" | sed -E 's/.*"resumo":(\{[^}]*\}).*/\1/' | head -c 300; echo
echo "--- payload inválido ---"; curl -s -X POST "http://localhost:41873/api/rebanho/animais/$ID/eventos" -H 'content-type: application/json' -d '{"tipo":"INSEMINACAO","data":"2026-04-28"}' -w '\n[%{http_code}]\n'
kill %1
```
Expected: parto → `[201]`; timeline shows the parto with `"dominio":"reproducao"`; the animal's `resumo` now has a computed `ordemLactacao`/`del`; invalid IA (no reprodutor) → `[400]`. (This mutates a seeded animal — Task 6's seed re-runs idempotently to restore a known state, so it's fine.)

- [ ] **Step 4: Commit**
```bash
git add server/src/routes/rebanho/eventos.ts server/src/index.ts
git commit -m "feat(rebanho): rotas de eventos + mount"
```

---

## Task 6: Seed events + recompute in seed

**Files:** Modify `server/prisma/seed-rebanho.ts`

**Interfaces:** Consumes the recompute engine. Produces seeded events for the animals + recomputed resumos, so the timeline and reproductive state are real (no longer hand-set).

- [ ] **Step 1: Extend `server/prisma/seed-rebanho.ts`** — after the existing animal/resumo upserts, add per-animal events + `numPartosEntrada`, then recompute. Replace the existing `ResumoAnimal` seeding block (the `resumos` array) with **events** that produce the state via the engine. Add near the end of `main()`:
```ts
  // numPartosEntrada (partos antes do registro) — define a ordem de lactação
  const partosEntrada: Record<string, number> = { "1234": 2, "0871": 3, "0942": 2, "1305": 1, "1188": 1, "0877": 3, "1421": 0 };
  for (const [numero, n] of Object.entries(partosEntrada)) await prisma.animal.update({ where: { numero }, data: { numPartosEntrada: n } });

  // Eventos por animal (idempotente: limpa e recria) — hoje ~ 2026-06-16
  const hoje = new Date("2026-06-16");
  const ddmm = (offsetDias: number) => new Date(hoje.getTime() - offsetDias * 86_400_000);
  const eventosPorAnimal: Record<string, any[]> = {
    "1234": [ // Jurema — prenhe, 3ª lactação
      { tipo: "SECAGEM", data: new Date("2025-12-18"), motivoSecagem: "fim de ciclo" },
      { tipo: "PARTO", data: new Date("2026-01-22"), numCrias: 1, sexoCria: "F", tipoParto: "normal" },
      { tipo: "INSEMINACAO", data: new Date("2026-04-28"), reprodutor: "Lance 884", protocolo: "IATF 11d" },
      { tipo: "DIAGNOSTICO", data: new Date("2026-05-28"), resultado: "positivo", dtPartoPrevista: new Date("2027-02-22") },
    ],
    "0871": [ { tipo: "PARTO", data: ddmm(210), numCrias: 1, sexoCria: "M" }, { tipo: "INSEMINACAO", data: ddmm(115), reprodutor: "Lance 612" }, { tipo: "DIAGNOSTICO", data: ddmm(85), resultado: "positivo" } ],
    "0942": [ { tipo: "PARTO", data: ddmm(96), numCrias: 1, sexoCria: "F" }, { tipo: "INSEMINACAO", data: ddmm(45), reprodutor: "Lance 884" }, { tipo: "DIAGNOSTICO", data: ddmm(33), resultado: "negativo" } ],
    "1305": [ { tipo: "PARTO", data: ddmm(110), numCrias: 1, sexoCria: "F" }, { tipo: "DIAGNOSTICO", data: ddmm(45), resultado: "negativo" } ],
    "1188": [ { tipo: "PARTO", data: ddmm(72), numCrias: 1, sexoCria: "M" } ],
    "0877": [ { tipo: "PARTO", data: ddmm(68), numCrias: 1, sexoCria: "F" } ],
    "1421": [ { tipo: "PARTO", data: ddmm(83), numCrias: 1, sexoCria: "F" }, { tipo: "DIAGNOSTICO", data: ddmm(27), resultado: "negativo" } ],
  };
  const { reconstruirLactacoes, recomputarResumoReproducao } = await import("../src/services/rebanho/reproducao.recompute.js");
  const isoStr = (d: Date) => d.toISOString().slice(0, 10);
  for (const [numero, evs] of Object.entries(eventosPorAnimal)) {
    const a = await prisma.animal.findUnique({ where: { numero } });
    if (!a) continue;
    await prisma.eventoReprodutivo.deleteMany({ where: { animalId: a.id } });
    for (const e of evs) await prisma.eventoReprodutivo.create({ data: { animalId: a.id, ...e } });
    const evRepro = evs.map((e) => ({ tipo: e.tipo, data: isoStr(e.data), resultado: e.resultado ?? null, dtPartoPrevista: e.dtPartoPrevista ? isoStr(e.dtPartoPrevista) : null, reprodutor: e.reprodutor ?? null }));
    const lacts = reconstruirLactacoes(evRepro as any, a.numPartosEntrada);
    await prisma.lactacao.deleteMany({ where: { animalId: a.id } });
    if (lacts.length) await prisma.lactacao.createMany({ data: lacts.map((l) => ({ animalId: a.id, numero: l.numero, dtInicio: new Date(l.dtInicio), dtFim: l.dtFim ? new Date(l.dtFim) : null })) });
    const r = recomputarResumoReproducao(evRepro as any, lacts, a.numPartosEntrada, "2026-06-16");
    await prisma.resumoAnimal.upsert({ where: { animalId: a.id }, create: { animalId: a.id, ...stripNull(r) }, update: stripNull(r) });
  }
  function stripNull(r: any) {
    return { statusReprodutivo: r.statusReprodutivo, del: r.del, ordemLactacao: r.ordemLactacao, ultimoDgData: r.ultimoDgData ? new Date(r.ultimoDgData) : null, ultimoDgResultado: r.ultimoDgResultado, ultimaInseminacao: r.ultimaInseminacao ? new Date(r.ultimaInseminacao) : null, diasGestacao: r.diasGestacao, iepProjetado: r.iepProjetado, previsaoSecagem: r.previsaoSecagem ? new Date(r.previsaoSecagem) : null };
  }
```
Keep the existing CCS/produção fields in the resumo? They were in the old `resumos` block being replaced — the `producaoMediaDia`/`ccs` etc. are NOT set by the recompute. To preserve the production demo values, after the recompute upsert, also set them: append a `prisma.resumoAnimal.update` per animal with the production/ccs numbers from the OLD `resumos` array (keep that array, but only for the production/ccs fields). Simplest: keep the old `resumos` array and apply ONLY its production/ccs fields in a follow-up update, leaving the reproductive fields to the engine.

- [ ] **Step 2: Run the seed (twice — idempotent)** — Run: `pnpm --filter rionovo-server run seed:rebanho` twice — Expected: "Seed rebanho ok: 8 animais." both times; no duplicate-key errors. Then verify via node: Jurema's resumo `statusReprodutivo === "PRENHE"`, `ordemLactacao === 3`.

- [ ] **Step 3: Commit**
```bash
git add server/prisma/seed-rebanho.ts
git commit -m "feat(rebanho): seed de eventos reprodutivos + recompute no seed"
```

---

## Task 7: Client event fetchers + hook

**Files:** Modify `client/src/rebanho/api.ts`

**Interfaces:** Produces `listarEventos(id)`, `registrarEvento(id, payload)`, `excluirEvento(eventoId)` and `useEventos(id)` → `{ data: EventoTimeline[], loading, erro, recarregar }`.

- [ ] **Step 1: Add to `client/src/rebanho/api.ts`** (reuse the existing `req` helper):
```ts
import type { EventoTimeline } from "./types";
// ... existing imports/exports ...

export interface EventoPayload {
  tipo: "CIO" | "INSEMINACAO" | "DIAGNOSTICO" | "PARTO" | "SECAGEM";
  data: string; observacao?: string;
  reprodutor?: string; protocolo?: string;
  resultado?: "positivo" | "negativo"; dtPartoPrevista?: string;
  numCrias?: number; sexoCria?: string; tipoParto?: string; motivoSecagem?: string;
}
export const listarEventos = (id: string) => req<EventoTimeline[]>(`/rebanho/animais/${id}/eventos`);
export const registrarEvento = (id: string, p: EventoPayload) => req<EventoTimeline>(`/rebanho/animais/${id}/eventos`, { method: "POST", body: JSON.stringify(p) });
export const excluirEvento = (eventoId: string) => req<{ ok: true }>(`/rebanho/eventos/${eventoId}`, { method: "DELETE" });

export function useEventos(id: string | null) {
  const [data, setData] = useState<EventoTimeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    if (!id) { setData([]); setLoading(false); return; }
    setLoading(true); setErro(null);
    listarEventos(id).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}
```

- [ ] **Step 2: Typecheck & commit** — Run: `pnpm --filter rionovo-client exec tsc -b --noEmit` clean.
```bash
git add client/src/rebanho/api.ts
git commit -m "feat(rebanho): client fetchers/hook de eventos"
```

---

## Task 8: Evento form drawer

Mirror the structure of the existing `client/src/rebanho/components/AnimalForm.tsx` (drawer + `.rb-fld` styles already exist).

**Files:** Create `client/src/rebanho/components/EventoForm.tsx`

**Interfaces:** Produces `<EventoForm animalId onFechar onSalvo />`.

- [ ] **Step 1: Create `client/src/rebanho/components/EventoForm.tsx`**
```tsx
import { useState } from "react";
import { registrarEvento, type EventoPayload } from "../api";

const TIPOS: { v: EventoPayload["tipo"]; label: string }[] = [
  { v: "CIO", label: "Cio" }, { v: "INSEMINACAO", label: "Inseminação" }, { v: "DIAGNOSTICO", label: "Diagnóstico" }, { v: "PARTO", label: "Parto" }, { v: "SECAGEM", label: "Secagem" },
];

export function EventoForm({ animalId, onFechar, onSalvo }: { animalId: string; onFechar: () => void; onSalvo: () => void }) {
  const [tipo, setTipo] = useState<EventoPayload["tipo"]>("INSEMINACAO");
  const [f, setF] = useState<any>({ data: "", reprodutor: "", protocolo: "", resultado: "positivo", dtPartoPrevista: "", numCrias: "1", sexoCria: "F", tipoParto: "normal", motivoSecagem: "", observacao: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const set = (k: string, v: string) => setF((s: any) => ({ ...s, [k]: v }));

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      const p: EventoPayload = { tipo, data: f.data, observacao: f.observacao || undefined };
      if (tipo === "INSEMINACAO") { p.reprodutor = f.reprodutor; p.protocolo = f.protocolo || undefined; }
      if (tipo === "DIAGNOSTICO") { p.resultado = f.resultado; p.dtPartoPrevista = f.dtPartoPrevista || undefined; }
      if (tipo === "PARTO") { p.numCrias = Number(f.numCrias); p.sexoCria = f.sexoCria; p.tipoParto = f.tipoParto; }
      if (tipo === "SECAGEM") p.motivoSecagem = f.motivoSecagem || undefined;
      await registrarEvento(animalId, p);
      onSalvo();
    } catch (e: any) { setErro(e.message); } finally { setSalvando(false); }
  }

  return (
    <>
      <div className="rb-drawer-bg" onClick={onFechar} />
      <aside className="rb-drawer">
        <h3>Registrar evento</h3>
        <label className="rb-fld">Tipo<select value={tipo} onChange={(e) => setTipo(e.target.value as any)}>{TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select></label>
        <label className="rb-fld">Data*<input type="date" value={f.data} onChange={(e) => set("data", e.target.value)} /></label>
        {tipo === "INSEMINACAO" && <>
          <label className="rb-fld">Reprodutor / sêmen*<input value={f.reprodutor} onChange={(e) => set("reprodutor", e.target.value)} /></label>
          <label className="rb-fld">Protocolo<input value={f.protocolo} onChange={(e) => set("protocolo", e.target.value)} placeholder="IATF 11d" /></label>
        </>}
        {tipo === "DIAGNOSTICO" && <>
          <label className="rb-fld">Resultado<select value={f.resultado} onChange={(e) => set("resultado", e.target.value)}><option value="positivo">Positivo</option><option value="negativo">Negativo</option></select></label>
          <label className="rb-fld">Parto previsto<input type="date" value={f.dtPartoPrevista} onChange={(e) => set("dtPartoPrevista", e.target.value)} /></label>
        </>}
        {tipo === "PARTO" && <>
          <label className="rb-fld">Nº de crias<input type="number" min={1} max={3} value={f.numCrias} onChange={(e) => set("numCrias", e.target.value)} /></label>
          <label className="rb-fld">Sexo da cria<select value={f.sexoCria} onChange={(e) => set("sexoCria", e.target.value)}><option value="F">Fêmea</option><option value="M">Macho</option><option value="FM">Gemelar</option></select></label>
          <label className="rb-fld">Tipo de parto<select value={f.tipoParto} onChange={(e) => set("tipoParto", e.target.value)}><option value="normal">Normal</option><option value="distocia">Distocia</option><option value="cesarea">Cesárea</option></select></label>
        </>}
        {tipo === "SECAGEM" && <label className="rb-fld">Motivo<input value={f.motivoSecagem} onChange={(e) => set("motivoSecagem", e.target.value)} placeholder="fim de ciclo" /></label>}
        <label className="rb-fld">Observação<input value={f.observacao} onChange={(e) => set("observacao", e.target.value)} /></label>
        {erro && <p style={{ color: "var(--neg)", fontSize: 13 }}>{erro}</p>}
        <div className="rb-drawer-actions">
          <button className="rb-btn" onClick={onFechar}>Cancelar</button>
          <button className="rb-btn pri" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</button>
        </div>
      </aside>
    </>
  );
}
```

- [ ] **Step 2: Typecheck & commit** — `pnpm --filter rionovo-client exec tsc -b --noEmit` clean.
```bash
git add client/src/rebanho/components/EventoForm.tsx
git commit -m "feat(rebanho): formulário de registrar evento (drawer)"
```

---

## Task 9: Real cockpit timeline + "+ Registrar evento"

**Files:** Modify `client/src/rebanho/components/AnimalCockpit.tsx`

**Interfaces:** Consumes `useEventos(id)`, `EventoForm`.

- [ ] **Step 1: In `AnimalCockpit.tsx`** — import `useEventos` from `../api`, `Timeline` from `./Timeline`, `EventoForm` from `./EventoForm`, and `useState` from react. Inside the component (after `useAnimal`): `const { data: eventos, recarregar: recarregarEventos } = useEventos(animalId);` and `const [registrando, setRegistrando] = useState(false);`.
  - Replace the empty-state block (`<div className="rb-empty">…</div>`) with:
    ```tsx
    {eventos.length === 0
      ? <div className="rb-empty">Nenhum lançamento ainda. Registre o primeiro evento reprodutivo.</div>
      : <Timeline eventos={eventos} />}
    ```
  - In the header actions row, add (before Editar): `<button className="rb-btn pri" onClick={() => setRegistrando(true)}>+ Registrar evento</button>`.
  - Before the closing tag of the component's root, render the drawer:
    ```tsx
    {registrando && <EventoForm animalId={animalId} onFechar={() => setRegistrando(false)} onSalvo={() => { setRegistrando(false); recarregarEventos(); recarregar(); }} />}
    ```
    (`recarregar` is the `useAnimal` reloader — refetches the animal so the recomputed resumo/stat-strip updates.)

- [ ] **Step 2: Verify** — `tsc -b --noEmit` clean; `pnpm --filter rionovo-client build` ok; `pnpm --filter rionovo-client test` green.

- [ ] **Step 3: Commit**
```bash
git add client/src/rebanho/components/AnimalCockpit.tsx
git commit -m "feat(rebanho): timeline real na ficha + registrar evento"
```

---

## Task 10: Real Reprodução herd tab

**Files:** Create `client/src/rebanho/components/ReproducaoTab.tsx`; modify `client/src/rebanho/domains.tsx`, `client/src/rebanho/RebanhoApp.tsx`

**Interfaces:** Consumes `useAnimais`, `HerdDomainView`, `DOMAINS.reproducao`.

- [ ] **Step 1: Create `client/src/rebanho/components/ReproducaoTab.tsx`** (mirrors `AnimalTab.tsx`, no "novo" button):
```tsx
import { useAnimais } from "../api";
import { HerdDomainView } from "./HerdDomainView";
import { DOMAINS } from "../domains";
import { insightDoRebanho } from "../mock";
import type { ResumoAnimal } from "../types";

export function ReproducaoTab({ onAbrirAnimal }: { onAbrirAnimal: (id: string) => void }) {
  const { data, loading, erro } = useAnimais({ status: "ATIVO" });
  if (loading) return <main className="rb-main"><div className="rb-eyebrow">Rebanho</div><div className="rb-head"><h1>Reprodução</h1></div><p className="rb-sub">Carregando…</p></main>;
  if (erro) return <main className="rb-main"><div className="rb-head"><h1>Reprodução</h1></div><p className="rb-sub" style={{ color: "var(--neg)" }}>Erro: {erro}</p></main>;
  const resumos: ResumoAnimal[] = data.map((a) => ({ ...(a.resumo ?? { statusReprodutivo: "VAZIA" }), animalId: a.id }) as ResumoAnimal);
  const nomes = Object.fromEntries(data.map((a) => [a.id, { nome: a.nome, numero: a.numero }]));
  return <HerdDomainView key="reproducao" config={DOMAINS.reproducao} resumos={resumos} insight={insightDoRebanho("reproducao")} nomes={nomes} onAbrirAnimal={onAbrirAnimal} />;
}
```

- [ ] **Step 2: Make the Reprodução KPIs compute from real resumos** — in `client/src/rebanho/domains.tsx`, the `reproducao.kpis` currently hardcodes some values. Replace the `kpis` function with one computed from `rs`:
```tsx
  kpis: (rs) => {
    const n = rs.length || 1;
    const prenhes = rs.filter((r) => r.statusReprodutivo === "PRENHE").length;
    const vazias = rs.filter((r) => r.statusReprodutivo === "VAZIA").length;
    const servidas = rs.filter((r) => r.statusReprodutivo === "INSEMINADA").length;
    const aptas = rs.filter((r) => r.statusReprodutivo === "PEV").length;
    const ieps = rs.map((r) => r.iepProjetado).filter((x): x is number => typeof x === "number");
    const iepMedio = ieps.length ? Math.round(ieps.reduce((a, b) => a + b, 0) / ieps.length) : null;
    return [
      { lab: "Aptas", val: String(aptas), d: "no PEV" },
      { lab: "Servidas", val: String(servidas), d: "aguardando DG" },
      { lab: "Gestantes", val: String(prenhes), d: "prenhes" },
      { lab: "Vazias", val: String(vazias), tom: "up" },
      { lab: "Taxa prenhez", val: String(Math.round((prenhes / n) * 100)), sufixo: "%" },
      { lab: "IEP médio", val: iepMedio ? String(iepMedio) : "—", sufixo: iepMedio ? "d" : undefined },
    ];
  },
```

- [ ] **Step 3: Wire `RebanhoApp.tsx`** — import `ReproducaoTab`; in the domain branch, route `reproducao` to it (like `animal`):
```tsx
        : domainKey === "animal"
          ? <AnimalTab onAbrirAnimal={nav.abrirAnimal} onNovo={() => setForm({ modo: "novo" })} />
          : domainKey === "reproducao"
            ? <ReproducaoTab onAbrirAnimal={nav.abrirAnimal} />
            : domainKey
              ? <HerdDomainView key={domainKey} config={DOMAINS[domainKey]} resumos={resumos} insight={insightDoRebanho(domainKey)} onAbrirAnimal={nav.abrirAnimal} />
```

- [ ] **Step 4: Verify** — `tsc -b --noEmit` clean; `pnpm --filter rionovo-client build` ok; `test` green.

- [ ] **Step 5: Commit**
```bash
git add client/src/rebanho/components/ReproducaoTab.tsx client/src/rebanho/domains.tsx client/src/rebanho/RebanhoApp.tsx
git commit -m "feat(rebanho): aba Reprodução real (work-lists/KPIs dos resumos)"
```

---

## Self-Review

**Spec coverage:** §4 schema→T1; §5 motor→T2; §6 API (schemas/mappers→T3, service→T4, router→T5); §7 client (fetchers→T7, form→T8, cockpit timeline→T9, herd tab→T10); §8 seed→T6; §9 validation→T3/T4; §10 tests→T2/T3 (TDD) + T5 (API smoke). ✓ Production/CCS resumo fields preserved (T4 updates only reproductive fields; T6 reapplies production values). ✓

**Placeholder scan:** No TBD/TODO. T6 Step 1 references keeping the old `resumos` array for production/ccs fields — that's a concrete instruction (apply only prod/ccs fields after recompute), not a placeholder; the implementer keeps the array and applies those columns.

**Type consistency:** `EvtRepro`/`Lact`/`ResumoRepro` defined in T2 and consumed by T4/T6. `EventoTimelineDTO` (T3 mapper) == client `EventoTimeline` shape. Service signatures (`listarEventos/registrarEvento/excluirEvento/recomputarAnimal`, `EventoError`) match T4(def)→T5(router)→T7(client paths). `criarEventoSchema` discriminated union (T3) consumed by T5 zValidator. Ids strings end-to-end. Recompute writes only reproductive fields (Global Constraint) — enforced in T4's upsert field list.

**Engine self-check (Jurema):** parto 2026-01-22 + numPartosEntrada 2 → ordemLactacao 3, DEL 145 (to 2026-06-16); IA 2026-04-28 + DG+ → PRENHE; diasGestacao = 2026-04-28→2026-06-16 = 49; previsaoSecagem = 2027-02-22 − 60d = 2026-12-24; iepProjetado = 2026-01-22→2027-02-22 = 396. Matches the T2 test expectations.
