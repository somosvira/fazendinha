# Rebanho Fase Real — Fatia 3: Sanidade + timeline unificada — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make **Sanidade** real (ocorrência/aplicação c/ carência+lote/exame-CCS/mastite/vacina), recompute the CCS resumo fields from exams, and upgrade the cockpit to a **unified cross-domain timeline** (reprodução + sanidade woven together).

**Design (autonomous — same pattern as Reprodução):** one slim `EventoSanitario` table (`tipo` discriminated) + a pure CCS recompute + a unified timeline service that merges all per-domain events. Mirrors the committed Reprodução files (`server/src/services/rebanho/eventos.*`, `routes/rebanho/eventos.ts`, client `EventoForm`/`ReproducaoTab`/`api.ts`) — use them as templates.

**Tech Stack:** Hono + Zod + Prisma 6 + server Vitest; React+Vite+TS. No new deps.

## Global Constraints
- Server imports end in `.js`; client no extension; PT-BR. Prisma `Decimal`→`Number()` in mappers.
- The sanidade recompute writes ONLY `ccs` + `ccsTendencia`; it must NOT touch reproductive/production fields.
- Schema via `prisma db push`. Branch `feat/rebanho-real-sanidade`. Commit per task.
- `EventoTimelineDTO = { id, animalId, data, dominio, titulo, detalhe?, alerta?, marcador? }` (same as repro; `dominio: "sanidade"` here).

---

## Task 1: `EventoSanitario` schema + db push
**Files:** Modify `server/prisma/schema.prisma`
- [ ] **Step 1:** Add (and add inverse relation `eventosSanitarios EventoSanitario[]` to `model Animal`):
```prisma
enum TipoEventoSanitario {
  OCORRENCIA
  APLICACAO
  EXAME
  MASTITE
  VACINA
}

model EventoSanitario {
  id            Int                 @id @default(autoincrement())
  animal        Animal              @relation(fields: [animalId], references: [id], onDelete: Cascade)
  animalId      Int
  tipo          TipoEventoSanitario
  data          DateTime            @db.Date
  observacao    String?
  doenca        String?
  dtFim         DateTime?           @db.Date
  diasTratamento Int?
  produto       String?
  dose          String?
  carencia      Int?
  loteProduto   String?
  ccs           Int?
  gordura       Decimal?            @db.Decimal(4, 2)
  proteina      Decimal?            @db.Decimal(4, 2)
  quarto        String?
  severidade    String?
  resultadoCultivo String?
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt
  @@index([animalId, data])
}
```
- [ ] **Step 2:** `pnpm --filter rionovo-server exec prisma db push` → "in sync" + client generated.
- [ ] **Step 3:** Commit `feat(rebanho): schema EventoSanitario`.

---

## Task 2: CCS recompute (pure) — TDD
**Files:** Create `server/src/services/rebanho/sanidade.recompute.ts` (+ `.test.ts`)
- [ ] **Step 1: Failing test** (`sanidade.recompute.test.ts`):
```ts
import { describe, it, expect } from "vitest";
import { recomputarResumoSanidade } from "./sanidade.recompute.js";
const ex = (data: string, ccs: number) => ({ tipo: "EXAME" as const, data, ccs });
describe("recomputarResumoSanidade", () => {
  it("CCS subindo (3 controles crescentes)", () => {
    const r = recomputarResumoSanidade([ex("2026-03-12", 245), ex("2026-04-12", 389), ex("2026-05-12", 512)]);
    expect(r.ccs).toBe(512);
    expect(r.ccsTendencia).toBe("subindo");
  });
  it("CCS caindo", () => {
    expect(recomputarResumoSanidade([ex("2026-03-01", 400), ex("2026-04-01", 200), ex("2026-05-01", 120)]).ccsTendencia).toBe("caindo");
  });
  it("estável quando oscila", () => {
    expect(recomputarResumoSanidade([ex("2026-03-01", 200), ex("2026-04-01", 350), ex("2026-05-01", 300)]).ccsTendencia).toBe("estavel");
  });
  it("sem exames → nulls; ignora eventos não-EXAME", () => {
    const r = recomputarResumoSanidade([{ tipo: "MASTITE", data: "2026-04-01" } as any]);
    expect(r).toEqual({ ccs: null, ccsTendencia: null });
  });
});
```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** `sanidade.recompute.ts`:
```ts
export interface EvtSan { tipo: "OCORRENCIA" | "APLICACAO" | "EXAME" | "MASTITE" | "VACINA"; data: string; ccs?: number | null; }
export interface ResumoSan { ccs: number | null; ccsTendencia: "subindo" | "estavel" | "caindo" | null; }

export function recomputarResumoSanidade(eventos: EvtSan[]): ResumoSan {
  const exames = eventos.filter((e) => e.tipo === "EXAME" && e.ccs != null).slice().sort((a, b) => Date.parse(a.data) - Date.parse(b.data));
  if (!exames.length) return { ccs: null, ccsTendencia: null };
  const ccs = exames[exames.length - 1].ccs!;
  const ult = exames.slice(-3).map((e) => e.ccs!);
  let ccsTendencia: ResumoSan["ccsTendencia"] = "estavel";
  if (ult.length >= 2) {
    const cresc = ult.every((v, i) => i === 0 || v > ult[i - 1]);
    const decr = ult.every((v, i) => i === 0 || v < ult[i - 1]);
    ccsTendencia = cresc ? "subindo" : decr ? "caindo" : "estavel";
  }
  return { ccs, ccsTendencia };
}
```
- [ ] **Step 4:** Run → PASS. - [ ] **Step 5:** Commit `feat(rebanho): recálculo de CCS (puro, TDD)`.

---

## Task 3: Zod (discriminated) + `toTimeline` sanidade — TDD
**Files:** Create `eventos-sanidade.schemas.ts` (+test), `eventos-sanidade.mappers.ts` (+test)
- [ ] **Step 1: Failing tests** — `eventos-sanidade.schemas.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { criarEventoSanitarioSchema as S } from "./eventos-sanidade.schemas.js";
describe("criarEventoSanitarioSchema", () => {
  it("EXAME exige ccs", () => { expect(S.safeParse({ tipo: "EXAME", data: "2026-05-12", ccs: 512 }).success).toBe(true); expect(S.safeParse({ tipo: "EXAME", data: "2026-05-12" }).success).toBe(false); });
  it("APLICACAO exige produto", () => { expect(S.safeParse({ tipo: "APLICACAO", data: "2026-04-14", produto: "Mastijet", carencia: 96, loteProduto: "MAST-2231" }).success).toBe(true); expect(S.safeParse({ tipo: "APLICACAO", data: "2026-04-14" }).success).toBe(false); });
  it("OCORRENCIA exige doenca", () => { expect(S.safeParse({ tipo: "OCORRENCIA", data: "2026-04-14", doenca: "Mastite clínica" }).success).toBe(true); });
});
```
`eventos-sanidade.mappers.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { toTimeline } from "./eventos-sanidade.mappers.js";
const b = { id: 9, animalId: 7 };
describe("toTimeline (sanidade)", () => {
  it("EXAME CCS alto marca alerta", () => { const t = toTimeline({ ...b, tipo: "EXAME", data: new Date("2026-05-12"), ccs: 512 } as any); expect(t.dominio).toBe("sanidade"); expect(t.titulo).toContain("512"); expect(t.alerta).toBe(true); });
  it("APLICACAO mostra carência e lote", () => { const t = toTimeline({ ...b, tipo: "APLICACAO", data: new Date("2026-04-14"), produto: "Mastijet", carencia: 96, loteProduto: "MAST-2231" } as any); expect(t.detalhe).toContain("carência 96h"); expect(t.detalhe).toContain("MAST-2231"); });
  it("MASTITE alerta", () => { expect(toTimeline({ ...b, tipo: "MASTITE", data: new Date("2026-04-14"), quarto: "PD" } as any).alerta).toBe(true); });
});
```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** `eventos-sanidade.schemas.ts`:
```ts
import { z } from "zod";
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD");
const comum = { data: isoDate, observacao: z.string().max(200).optional() };
export const criarEventoSanitarioSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("OCORRENCIA"), ...comum, doenca: z.string().min(1).max(60), dtFim: isoDate.optional(), diasTratamento: z.number().int().min(0).optional() }),
  z.object({ tipo: z.literal("APLICACAO"), ...comum, produto: z.string().min(1).max(60), dose: z.string().max(20).optional(), carencia: z.number().int().min(0).optional(), loteProduto: z.string().max(40).optional() }),
  z.object({ tipo: z.literal("EXAME"), ...comum, ccs: z.number().int().min(0), gordura: z.number().optional(), proteina: z.number().optional() }),
  z.object({ tipo: z.literal("MASTITE"), ...comum, quarto: z.string().max(4).optional(), severidade: z.string().max(20).optional(), resultadoCultivo: z.string().max(60).optional() }),
  z.object({ tipo: z.literal("VACINA"), ...comum, produto: z.string().min(1).max(60) }),
]);
export type CriarEventoSanitarioInput = z.infer<typeof criarEventoSanitarioSchema>;
```
`eventos-sanidade.mappers.ts`:
```ts
export interface EventoTimelineDTO { id: string; animalId: string; data: string; dominio: "sanidade"; titulo: string; detalhe?: string; alerta?: boolean; }
const iso = (d: Date) => new Date(d).toISOString().slice(0, 10);
export function toTimeline(e: any): EventoTimelineDTO {
  const base = { id: String(e.id), animalId: String(e.animalId), data: iso(e.data), dominio: "sanidade" as const };
  switch (e.tipo) {
    case "OCORRENCIA": return { ...base, titulo: `Ocorrência — ${e.doenca}`, detalhe: e.diasTratamento ? `${e.diasTratamento} dias de tratamento` : undefined, alerta: true };
    case "APLICACAO": return { ...base, titulo: `Aplicação — ${e.produto}`, detalhe: [e.dose && `dose ${e.dose}`, e.carencia != null && `carência ${e.carencia}h`, e.loteProduto && `lote ${e.loteProduto}`].filter(Boolean).join(" · ") || undefined };
    case "EXAME": return { ...base, titulo: `Controle leiteiro — CCS ${e.ccs} mil`, detalhe: [e.gordura != null && `gordura ${Number(e.gordura)}%`, e.proteina != null && `proteína ${Number(e.proteina)}%`].filter(Boolean).join(" · ") || undefined, alerta: e.ccs >= 400 };
    case "MASTITE": return { ...base, titulo: `Mastite${e.quarto ? ` — quarto ${e.quarto}` : ""}`, detalhe: [e.severidade, e.resultadoCultivo].filter(Boolean).join(" · ") || undefined, alerta: true };
    case "VACINA": return { ...base, titulo: `Vacinação — ${e.produto}`, detalhe: e.observacao ?? undefined };
    default: return { ...base, titulo: "Evento sanitário" };
  }
}
```
- [ ] **Step 4:** Run → PASS; tsc clean. - [ ] **Step 5:** Commit `feat(rebanho): zod + toTimeline da sanidade (TDD)`.

---

## Task 4: Sanidade service + recompute
**Files:** Create `server/src/services/rebanho/eventos-sanidade.ts`. **Template:** mirror `server/src/services/rebanho/eventos.ts` (read it), swapping the model to `eventoSanitario`, the schema/mapper to the sanidade ones, and the recompute to write only `{ ccs, ccsTendencia }`.
- [ ] **Step 1: Implement** `eventos-sanidade.ts`:
```ts
import { prisma } from "../../db.js";
import { toTimeline, type EventoTimelineDTO } from "./eventos-sanidade.mappers.js";
import type { CriarEventoSanitarioInput } from "./eventos-sanidade.schemas.js";
import { recomputarResumoSanidade, type EvtSan } from "./sanidade.recompute.js";

export class EventoSanError extends Error { constructor(public code: "NAO_ENCONTRADO", message: string) { super(message); } }
const iso = (x: Date | null) => (x ? new Date(x).toISOString().slice(0, 10) : null);

export async function recomputarSanidade(animalId: number): Promise<void> {
  const exs = await prisma.eventoSanitario.findMany({ where: { animalId } });
  const evs: EvtSan[] = exs.map((e) => ({ tipo: e.tipo, data: iso(e.data)!, ccs: e.ccs }));
  const r = recomputarResumoSanidade(evs);
  await prisma.resumoAnimal.upsert({
    where: { animalId },
    create: { animalId, ccs: r.ccs, ccsTendencia: r.ccsTendencia },
    update: { ccs: r.ccs, ccsTendencia: r.ccsTendencia },
  });
}
export async function listarSanidade(animalId: number): Promise<EventoTimelineDTO[]> {
  return (await prisma.eventoSanitario.findMany({ where: { animalId }, orderBy: { data: "desc" } })).map(toTimeline);
}
export async function registrarSanidade(animalId: number, input: CriarEventoSanitarioInput): Promise<EventoTimelineDTO> {
  if (!(await prisma.animal.findUnique({ where: { id: animalId } }))) throw new EventoSanError("NAO_ENCONTRADO", "animal não encontrado");
  const e = await prisma.eventoSanitario.create({ data: { animalId, ...(input as any), data: new Date(input.data), dtFim: (input as any).dtFim ? new Date((input as any).dtFim) : undefined } });
  await recomputarSanidade(animalId);
  return toTimeline(e);
}
export async function excluirSanidade(eventoId: number): Promise<void> {
  const e = await prisma.eventoSanitario.findUnique({ where: { id: eventoId } });
  if (!e) throw new EventoSanError("NAO_ENCONTRADO", "evento não encontrado");
  await prisma.eventoSanitario.delete({ where: { id: eventoId } });
  await recomputarSanidade(e.animalId);
}
```
> Note: the `create` spread `...(input as any)` includes `tipo` and the type-specific fields; `data`/`dtFim` are overridden to `Date`. The discriminated input has no extra keys beyond the model columns, so the spread is safe.
- [ ] **Step 2:** tsc clean. - [ ] **Step 3:** Commit `feat(rebanho): service de sanidade + recompute de CCS`.

---

## Task 5: Unified timeline + sanidade router + mount + API smoke
**Files:** Create `server/src/services/rebanho/timeline.ts`, `server/src/routes/rebanho/sanidade.ts`; modify `server/src/index.ts`
- [ ] **Step 1:** `server/src/services/rebanho/timeline.ts`:
```ts
import { prisma } from "../../db.js";
import { toTimeline as toRepro } from "./eventos.mappers.js";
import { toTimeline as toSan } from "./eventos-sanidade.mappers.js";
export async function montarTimeline(animalId: number) {
  const [r, s] = await Promise.all([
    prisma.eventoReprodutivo.findMany({ where: { animalId } }),
    prisma.eventoSanitario.findMany({ where: { animalId } }),
  ]);
  return [...r.map(toRepro), ...s.map(toSan)].sort((a, b) => Date.parse(b.data) - Date.parse(a.data));
}
```
- [ ] **Step 2:** `server/src/routes/rebanho/sanidade.ts` (mirror `routes/rebanho/eventos.ts`):
```ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { criarEventoSanitarioSchema } from "../../services/rebanho/eventos-sanidade.schemas.js";
import * as svc from "../../services/rebanho/eventos-sanidade.js";
import { montarTimeline } from "../../services/rebanho/timeline.js";

export const sanidadeRouter = new Hono()
  .get("/rebanho/animais/:id/timeline", async (c) => c.json(await montarTimeline(Number(c.req.param("id")))))
  .get("/rebanho/animais/:id/sanidade", async (c) => c.json(await svc.listarSanidade(Number(c.req.param("id")))))
  .post("/rebanho/animais/:id/sanidade", zValidator("json", criarEventoSanitarioSchema), async (c) => {
    try { return c.json(await svc.registrarSanidade(Number(c.req.param("id")), c.req.valid("json")), 201); }
    catch (e) { if (e instanceof svc.EventoSanError) return c.json({ error: e.message }, 404); return c.json({ error: e instanceof Error ? e.message : "erro" }, 500); }
  })
  .delete("/rebanho/sanidade/:id", async (c) => {
    try { await svc.excluirSanidade(Number(c.req.param("id"))); return c.json({ ok: true }); }
    catch (e) { if (e instanceof svc.EventoSanError) return c.json({ error: e.message }, 404); return c.json({ error: e instanceof Error ? e.message : "erro" }, 500); }
  });
```
- [ ] **Step 3:** Mount in `server/src/index.ts`: `import { sanidadeRouter } from "./routes/rebanho/sanidade.js";` + `app.route("/api", sanidadeRouter);`.
- [ ] **Step 4: API smoke** — start dev server bg, find Jurema's id, POST an EXAME (`{"tipo":"EXAME","data":"2026-05-12","ccs":512}`) → `[201]`; GET `/timeline` → shows BOTH reproducao and sanidade events; GET the animal → `resumo.ccs` recomputed; invalid APLICACAO (no produto) → `[400]`. `kill` the server.
- [ ] **Step 5:** Commit `feat(rebanho): rotas de sanidade + timeline unificada + mount`.

---

## Task 6: Seed sanidade events
**Files:** Modify `server/prisma/seed-rebanho.ts`
- [ ] **Step 1:** After the reproductive events block, add a global `await prisma.eventoSanitario.deleteMany({});` then per-animal sanidade events. For **Jurema (#1234)**: 3 monthly CCS exams (245 @ 2026-03-12, 389 @ 2026-04-12, 512 @ 2026-05-12) + a MASTITE (2026-04-14, quarto "PD") + an APLICACAO (2026-04-14, produto "Mastijet", carencia 96, loteProduto "MAST-2231"). For #1305 (Cravina): exams 280→300 (subindo). Others: one recent exam each (Aurora 180, Bonita 240, Dália 150, Jandira 130, Estrela 210). After creating, call `recomputarResumoSanidade` (import from the service-recompute module) per animal and `prisma.resumoAnimal.update` with `{ ccs, ccsTendencia }` (DON'T re-set the production/reprodutive fields).
```ts
  await prisma.eventoSanitario.deleteMany({});
  const { recomputarResumoSanidade } = await import("../src/services/rebanho/sanidade.recompute.js");
  const sanPorAnimal: Record<string, any[]> = {
    "1234": [ { tipo: "EXAME", data: new Date("2026-03-12"), ccs: 245 }, { tipo: "EXAME", data: new Date("2026-04-12"), ccs: 389 }, { tipo: "EXAME", data: new Date("2026-05-12"), ccs: 512 }, { tipo: "MASTITE", data: new Date("2026-04-14"), quarto: "PD", severidade: "clínica" }, { tipo: "APLICACAO", data: new Date("2026-04-14"), produto: "Mastijet", dose: "1 bisnaga", carencia: 96, loteProduto: "MAST-2231" } ],
    "1305": [ { tipo: "EXAME", data: new Date("2026-04-01"), ccs: 280 }, { tipo: "EXAME", data: new Date("2026-05-01"), ccs: 300 } ],
    "1188": [ { tipo: "EXAME", data: new Date("2026-05-10"), ccs: 180 } ],
    "0942": [ { tipo: "EXAME", data: new Date("2026-05-10"), ccs: 240 } ],
    "0877": [ { tipo: "EXAME", data: new Date("2026-05-10"), ccs: 150 } ],
    "0871": [ { tipo: "EXAME", data: new Date("2026-05-10"), ccs: 130 } ],
    "1421": [ { tipo: "EXAME", data: new Date("2026-05-10"), ccs: 210 } ],
  };
  const isoS = (d: Date) => d.toISOString().slice(0, 10);
  for (const [numero, evs] of Object.entries(sanPorAnimal)) {
    const a = await prisma.animal.findUnique({ where: { numero } });
    if (!a) continue;
    for (const e of evs) await prisma.eventoSanitario.create({ data: { animalId: a.id, ...e } });
    const r = recomputarResumoSanidade(evs.map((e: any) => ({ tipo: e.tipo, data: isoS(e.data), ccs: e.ccs ?? null })));
    await prisma.resumoAnimal.update({ where: { animalId: a.id }, data: { ccs: r.ccs, ccsTendencia: r.ccsTendencia } });
  }
```
> This REPLACES the old hardcoded `ccs`/`ccsTendencia` production-block values for these animals (now computed from exams). Keep the `producaoMediaDia`/`producao305` lines in the production block.
- [ ] **Step 2:** Run seed twice (idempotent — the global deleteMany makes it so). Verify Jurema `resumo.ccs === 512`, `ccsTendencia === "subindo"`.
- [ ] **Step 3:** Commit `feat(rebanho): seed de eventos sanitários (CCS/mastite)`.

---

## Task 7: Client fetchers (unified timeline + sanidade)
**Files:** Modify `client/src/rebanho/api.ts`
- [ ] **Step 1:** Add (reuse `req`):
```ts
export interface EventoSanidadePayload { tipo: "OCORRENCIA" | "APLICACAO" | "EXAME" | "MASTITE" | "VACINA"; data: string; observacao?: string; doenca?: string; diasTratamento?: number; produto?: string; dose?: string; carencia?: number; loteProduto?: string; ccs?: number; gordura?: number; proteina?: number; quarto?: string; severidade?: string; resultadoCultivo?: string; }
export const montarTimeline = (id: string) => req<EventoTimeline[]>(`/rebanho/animais/${id}/timeline`);
export const registrarEventoSanidade = (id: string, p: EventoSanidadePayload) => req<EventoTimeline>(`/rebanho/animais/${id}/sanidade`, { method: "POST", body: JSON.stringify(p) });
export function useTimeline(id: string | null) {
  const [data, setData] = useState<EventoTimeline[]>([]); const [loading, setLoading] = useState(true); const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => { if (!id) { setData([]); setLoading(false); return; } setLoading(true); setErro(null); montarTimeline(id).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false)); }, [id]);
  useEffect(() => { recarregar(); }, [recarregar]); return { data, loading, erro, recarregar };
}
```
- [ ] **Step 2:** tsc clean; commit `feat(rebanho): fetchers de timeline unificada + sanidade`.

---

## Task 8: EventoForm — domain selector (Reprodução + Sanidade)
**Files:** Modify `client/src/rebanho/components/EventoForm.tsx`
- [ ] **Step 1:** Add a top "Domínio" select (Reprodução / Sanidade). When Reprodução, keep the existing repro tipos/fields and POST via `registrarEvento`. When Sanidade, show sanidade tipos (Ocorrência/Aplicação/Exame/Mastite/Vacina) and their fields, POST via `registrarEventoSanidade`. Concretely: add `const [dominio, setDominio] = useState<"reproducao"|"sanidade">("reproducao");` and branch the tipo `<select>` options + the per-tipo field blocks + the `salvar()` payload/endpoint on `dominio`. Sanidade field blocks:
  - EXAME: `ccs` (number, obrigatório), `gordura`/`proteina` (number, opcional).
  - APLICACAO: `produto` (obrigatório), `dose`, `carencia` (number), `loteProduto`.
  - OCORRENCIA: `doenca` (obrigatório), `diasTratamento` (number).
  - MASTITE: `quarto`, `severidade`, `resultadoCultivo`.
  - VACINA: `produto` (obrigatório).
  Use the same `.rb-fld` markup. Numbers: send `Number(...)` only when filled.
- [ ] **Step 2:** tsc clean; build ok; commit `feat(rebanho): registrar evento de sanidade (seletor de domínio)`.

---

## Task 9: Cockpit uses the unified timeline
**Files:** Modify `client/src/rebanho/components/AnimalCockpit.tsx`
- [ ] **Step 1:** Swap `useEventos(animalId)` → `useTimeline(animalId)` (import from `../api`). The `<Timeline>` now shows repro + sanidade woven (it already colors by `dominio`). The `onSalvo` of `EventoForm` still calls the timeline reloader + `recarregar` (animal). No other change.
- [ ] **Step 2:** tsc/build/test green; commit `feat(rebanho): ficha usa timeline unificada (todos os domínios)`.

---

## Task 10: Real Sanidade herd tab
**Files:** Create `client/src/rebanho/components/SanidadeTab.tsx`; modify `client/src/rebanho/domains.tsx`, `client/src/rebanho/RebanhoApp.tsx`
- [ ] **Step 1:** `SanidadeTab.tsx` — mirror `ReproducaoTab.tsx` exactly but `config={DOMAINS.sanidade}` and `insightDoRebanho("sanidade")`.
- [ ] **Step 2:** In `domains.tsx`, replace `sanidade.kpis` with values computed from real resumos:
```tsx
  kpis: (rs) => {
    const altos = rs.filter((r) => (r.ccs ?? 0) >= 400).length;
    const subindo = rs.filter((r) => r.ccsTendencia === "subindo").length;
    const comCcs = rs.filter((r) => typeof r.ccs === "number");
    const media = comCcs.length ? Math.round(comCcs.reduce((a, r) => a + (r.ccs ?? 0), 0) / comCcs.length) : 0;
    return [
      { lab: "CCS alto", val: String(altos), d: "≥ 400 mil", tom: "up" },
      { lab: "CCS subindo", val: String(subindo), tom: "up" },
      { lab: "CCS médio", val: String(media), sufixo: "mil" },
    ];
  },
```
- [ ] **Step 3:** In `RebanhoApp.tsx`, route `sanidade → <SanidadeTab onAbrirAnimal={nav.abrirAnimal}/>` (add a branch like reproducao).
- [ ] **Step 4:** tsc/build/test green; commit `feat(rebanho): aba Sanidade real (CCS dos resumos)`.

---

## Self-Review
- Coverage: schema→T1; CCS recompute→T2; zod/mapper→T3; service→T4; unified timeline+router→T5; seed→T6; client fetchers→T7; form→T8; cockpit unified→T9; tab→T10. ✓
- The sanidade recompute writes only `ccs`/`ccsTendencia` (T4 upsert) — does not clobber reproductive/production. ✓ Repro `/eventos` endpoint stays; cockpit now reads `/timeline` (merged). ✓
- Types: `EvtSan`/`ResumoSan` (T2) consumed by T4/T6; `EventoTimelineDTO` sanidade == repro shape == client `EventoTimeline`. `montarTimeline` merges both mappers. Service names (`recomputarSanidade/listarSanidade/registrarSanidade/excluirSanidade`, `EventoSanError`) consistent T4→T5→T7. ✓
