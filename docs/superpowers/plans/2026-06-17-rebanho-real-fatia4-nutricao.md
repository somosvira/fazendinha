# Rebanho Fase Real — Fatia 4: Nutrição (dietas + lotes) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Checkbox steps.

**Goal:** Make **Nutrição** real (lot-level, not per-animal events): CRUD of `Dieta`, assign a diet to each lot (`Grupo`), and a Nutrição tab listing lots (diet, animal count, avg production) with a diet manager. The animal cockpit shows its real diet (its lot's diet).

**Design (autonomous):** Nutrição is lot-centric — no events/recompute. `Dieta` is a recipe; each `Grupo` points at a current `Dieta`. The tab is bespoke (lots + diets), not the `HerdDomainView` pattern. Mirrors the repo's router→service + drawer patterns.

**Tech Stack:** Hono + Zod + Prisma 6 + server Vitest; React+Vite+TS. No new deps.

## Global Constraints
- Server imports end in `.js`; client no extension; PT-BR. Prisma `Decimal`→`Number()` in mappers.
- Schema via `prisma db push`. Branch `feat/rebanho-real-nutricao`. Commit per task.

---

## Task 1: `Dieta` schema + `Grupo.dietaId` + db push
**Files:** Modify `server/prisma/schema.prisma`
- [ ] **Step 1:** Add `Dieta` and a diet FK on `Grupo`:
```prisma
model Dieta {
  id        Int      @id @default(autoincrement())
  nome      String   @unique
  descricao String?
  pb        Decimal? @db.Decimal(4, 1)   // % proteína bruta
  edMcal    Decimal? @db.Decimal(4, 2)   // energia (Mcal/kg)
  ativo     Boolean  @default(true)
  grupos    Grupo[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```
In `model Grupo { ... }` add:
```prisma
  dieta    Dieta? @relation(fields: [dietaId], references: [id])
  dietaId  Int?
```
- [ ] **Step 2:** `pnpm --filter rionovo-server exec prisma db push` → in sync + client generated.
- [ ] **Step 3:** Commit `feat(rebanho): schema Dieta + Grupo.dietaId`.

---

## Task 2: Nutrição service + animal DTO gains `dietaNome`
**Files:** Create `server/src/services/rebanho/nutricao.ts`; modify `server/src/services/rebanho/animais.mappers.ts` and `animais.ts`
- [ ] **Step 1:** `server/src/services/rebanho/nutricao.ts`:
```ts
import { prisma } from "../../db.js";
import { z } from "zod";

export const dietaSchema = z.object({ nome: z.string().min(1).max(60), descricao: z.string().max(200).optional(), pb: z.number().optional(), edMcal: z.number().optional() });
export type DietaInput = z.infer<typeof dietaSchema>;
export class NutricaoError extends Error { constructor(public code: "NAO_ENCONTRADO" | "NOME_DUPLICADO", message: string) { super(message); } }

const dietaDTO = (d: any) => ({ id: d.id, nome: d.nome, descricao: d.descricao ?? null, pb: d.pb != null ? Number(d.pb) : null, edMcal: d.edMcal != null ? Number(d.edMcal) : null, ativo: d.ativo });

export async function listarDietas() { return (await prisma.dieta.findMany({ orderBy: { nome: "asc" } })).map(dietaDTO); }
export async function criarDieta(input: DietaInput) {
  if (await prisma.dieta.findUnique({ where: { nome: input.nome } })) throw new NutricaoError("NOME_DUPLICADO", `dieta ${input.nome} já existe`);
  return dietaDTO(await prisma.dieta.create({ data: { nome: input.nome, descricao: input.descricao, pb: input.pb, edMcal: input.edMcal } }));
}
export async function editarDieta(id: number, input: DietaInput) {
  if (!(await prisma.dieta.findUnique({ where: { id } }))) throw new NutricaoError("NAO_ENCONTRADO", "dieta não encontrada");
  return dietaDTO(await prisma.dieta.update({ where: { id }, data: { nome: input.nome, descricao: input.descricao, pb: input.pb, edMcal: input.edMcal } }));
}
export async function listarLotes() {
  const grupos = await prisma.grupo.findMany({ orderBy: { nome: "asc" }, include: { dieta: true, animais: { where: { status: "ATIVO" }, include: { resumo: true } } } });
  return grupos.map((g) => {
    const prods = g.animais.map((a) => (a.resumo?.producaoMediaDia != null ? Number(a.resumo.producaoMediaDia) : null)).filter((x): x is number => x != null);
    return { id: g.id, nome: g.nome, dietaId: g.dietaId ?? null, dietaNome: g.dieta?.nome ?? null, numAnimais: g.animais.length, producaoMedia: prods.length ? Math.round((prods.reduce((a, b) => a + b, 0) / prods.length) * 10) / 10 : null };
  });
}
export async function atribuirDieta(grupoId: number, dietaId: number | null) {
  if (!(await prisma.grupo.findUnique({ where: { id: grupoId } }))) throw new NutricaoError("NAO_ENCONTRADO", "lote não encontrado");
  if (dietaId != null && !(await prisma.dieta.findUnique({ where: { id: dietaId } }))) throw new NutricaoError("NAO_ENCONTRADO", "dieta não encontrada");
  await prisma.grupo.update({ where: { id: grupoId }, data: { dietaId } });
}
```
- [ ] **Step 2: Animal DTO gains `dietaNome`** — in `animais.ts`, change the shared `include` so `grupo` includes its `dieta`: `grupo: { include: { dieta: true } }` (replace `grupo: true`). In `animais.mappers.ts` `toAnimalDTO`, add `dietaNome: a.grupo?.dieta?.nome ?? null,`. In `server/src/services/rebanho/types.ts`, add `dietaNome: string | null;` to `AnimalDTO`.
- [ ] **Step 3:** Run `pnpm --filter rionovo-server test` (existing pass) + tsc clean. Commit `feat(rebanho): service de nutrição (dietas + lotes) + dietaNome no animal`.

---

## Task 3: Nutrição router + mount + API smoke
**Files:** Create `server/src/routes/rebanho/nutricao.ts`; modify `server/src/index.ts`
- [ ] **Step 1:** `server/src/routes/rebanho/nutricao.ts`:
```ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { dietaSchema } from "../../services/rebanho/nutricao.js";
import * as svc from "../../services/rebanho/nutricao.js";

const err = (e: unknown) => e instanceof svc.NutricaoError ? ({ NAO_ENCONTRADO: 404, NOME_DUPLICADO: 409 } as const)[e.code] : 500;
export const nutricaoRouter = new Hono()
  .get("/rebanho/dietas", async (c) => c.json(await svc.listarDietas()))
  .post("/rebanho/dietas", zValidator("json", dietaSchema), async (c) => { try { return c.json(await svc.criarDieta(c.req.valid("json")), 201); } catch (e) { return c.json({ error: e instanceof Error ? e.message : "erro" }, err(e)); } })
  .patch("/rebanho/dietas/:id", zValidator("json", dietaSchema), async (c) => { try { return c.json(await svc.editarDieta(Number(c.req.param("id")), c.req.valid("json"))); } catch (e) { return c.json({ error: e instanceof Error ? e.message : "erro" }, err(e)); } })
  .get("/rebanho/lotes", async (c) => c.json(await svc.listarLotes()))
  .post("/rebanho/lotes/:id/dieta", zValidator("json", z.object({ dietaId: z.number().int().nullable() })), async (c) => { try { await svc.atribuirDieta(Number(c.req.param("id")), c.req.valid("json").dietaId); return c.json({ ok: true }); } catch (e) { return c.json({ error: e instanceof Error ? e.message : "erro" }, err(e)); } });
```
- [ ] **Step 2:** Mount in `index.ts`: `import { nutricaoRouter } from "./routes/rebanho/nutricao.js";` + `app.route("/api", nutricaoRouter);`.
- [ ] **Step 3: API smoke** — start dev server bg; POST a dieta (`{"nome":"Teste","pb":18}`) → `[201]`; GET `/rebanho/lotes` → lots with numAnimais; POST `/rebanho/lotes/<id>/dieta` `{"dietaId":<the dieta id>}` → `{ok:true}`; GET `/rebanho/lotes` again → that lot's `dietaNome` set; dup dieta name → `[409]`. `kill` server. (Task 4 seed resets.)
- [ ] **Step 4:** Commit `feat(rebanho): rotas de nutrição + mount`.

---

## Task 4: Seed diets + assign to lots
**Files:** Modify `server/prisma/seed-rebanho.ts`
- [ ] **Step 1:** Near the end of `main()`, add (idempotent upsert by nome + assign):
```ts
  const dietas = [
    { nome: "Lactação Alta", descricao: "vacas de alta produção", pb: 18, edMcal: 1.68 },
    { nome: "Lactação Média", descricao: "vacas de média produção", pb: 16, edMcal: 1.55 },
    { nome: "Pré-parto", descricao: "transição", pb: 14, edMcal: 1.45 },
    { nome: "Bezerreiro", descricao: "aleitamento/recria", pb: 20, edMcal: 1.80 },
  ];
  const dietaIdByNome: Record<string, number> = {};
  for (const d of dietas) dietaIdByNome[d.nome] = (await prisma.dieta.upsert({ where: { nome: d.nome }, update: { descricao: d.descricao, pb: d.pb, edMcal: d.edMcal }, create: d })).id;
  const lotesDieta: Record<string, string> = { "Alta Produção": "Lactação Alta", "Média Produção": "Lactação Média", "Bezerreiro": "Bezerreiro" };
  for (const [grupoNome, dietaNome] of Object.entries(lotesDieta)) {
    const g = await prisma.grupo.findUnique({ where: { nome: grupoNome } });
    if (g) await prisma.grupo.update({ where: { id: g.id }, data: { dietaId: dietaIdByNome[dietaNome] } });
  }
```
- [ ] **Step 2:** Run seed twice → idempotent. Verify a lote has a dietaNome (`listarLotes` or query). Commit `feat(rebanho): seed de dietas + atribuição aos lotes`.

---

## Task 5: Client fetchers
**Files:** Modify `client/src/rebanho/api.ts`; `client/src/rebanho/types.ts`
- [ ] **Step 1:** In `types.ts` add `dietaNome?: string | null;` to `Animal`. In `api.ts`:
```ts
export interface DietaDTO { id: number; nome: string; descricao: string | null; pb: number | null; edMcal: number | null; ativo: boolean; }
export interface LoteDTO { id: number; nome: string; dietaId: number | null; dietaNome: string | null; numAnimais: number; producaoMedia: number | null; }
export interface DietaInput { nome: string; descricao?: string; pb?: number; edMcal?: number; }
export const listarDietas = () => req<DietaDTO[]>(`/rebanho/dietas`);
export const criarDieta = (p: DietaInput) => req<DietaDTO>(`/rebanho/dietas`, { method: "POST", body: JSON.stringify(p) });
export const editarDieta = (id: number, p: DietaInput) => req<DietaDTO>(`/rebanho/dietas/${id}`, { method: "PATCH", body: JSON.stringify(p) });
export const listarLotes = () => req<LoteDTO[]>(`/rebanho/lotes`);
export const atribuirDieta = (grupoId: number, dietaId: number | null) => req<{ ok: true }>(`/rebanho/lotes/${grupoId}/dieta`, { method: "POST", body: JSON.stringify({ dietaId }) });
export function useLotes() {
  const [data, setData] = useState<LoteDTO[]>([]); const [loading, setLoading] = useState(true); const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => { setLoading(true); setErro(null); listarLotes().then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => { recarregar(); }, [recarregar]); return { data, loading, erro, recarregar };
}
export function useDietas() {
  const [data, setData] = useState<DietaDTO[]>([]); const recarregar = useCallback(() => { listarDietas().then(setData).catch(() => {}); }, []);
  useEffect(() => { recarregar(); }, [recarregar]); return { data, recarregar };
}
```
- [ ] **Step 2:** tsc clean; commit `feat(rebanho): fetchers de nutrição`.

---

## Task 6: NutricaoTab + DietaForm + cockpit diet + wiring
**Files:** Create `client/src/rebanho/components/NutricaoTab.tsx`, `client/src/rebanho/components/DietaForm.tsx`; modify `client/src/rebanho/components/AnimalCockpit.tsx`, `client/src/rebanho/RebanhoApp.tsx`, `client/src/rebanho/styles/rebanho.css`
- [ ] **Step 1:** `DietaForm.tsx` (drawer, mirror AnimalForm structure):
```tsx
import { useState } from "react";
import { criarDieta, type DietaDTO } from "../api";
export function DietaForm({ onFechar, onSalvo }: { onFechar: () => void; onSalvo: (d: DietaDTO) => void }) {
  const [f, setF] = useState({ nome: "", descricao: "", pb: "", edMcal: "" });
  const [erro, setErro] = useState<string | null>(null); const [salvando, setSalvando] = useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  async function salvar() { setSalvando(true); setErro(null); try { const d = await criarDieta({ nome: f.nome, descricao: f.descricao || undefined, pb: f.pb ? Number(f.pb) : undefined, edMcal: f.edMcal ? Number(f.edMcal) : undefined }); onSalvo(d); } catch (e: any) { setErro(e.message); } finally { setSalvando(false); } }
  return (<><div className="rb-drawer-bg" onClick={onFechar} /><aside className="rb-drawer"><h3>Nova dieta</h3>
    <label className="rb-fld">Nome*<input value={f.nome} onChange={(e) => set("nome", e.target.value)} /></label>
    <label className="rb-fld">Descrição<input value={f.descricao} onChange={(e) => set("descricao", e.target.value)} /></label>
    <label className="rb-fld">% Proteína bruta<input type="number" value={f.pb} onChange={(e) => set("pb", e.target.value)} /></label>
    <label className="rb-fld">Energia (Mcal/kg)<input type="number" value={f.edMcal} onChange={(e) => set("edMcal", e.target.value)} /></label>
    {erro && <p style={{ color: "var(--neg)", fontSize: 13 }}>{erro}</p>}
    <div className="rb-drawer-actions"><button className="rb-btn" onClick={onFechar}>Cancelar</button><button className="rb-btn pri" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</button></div>
  </aside></>); }
```
- [ ] **Step 2:** `NutricaoTab.tsx`:
```tsx
import { useState } from "react";
import { useLotes, useDietas, atribuirDieta } from "../api";
import { DietaForm } from "./DietaForm";
export function NutricaoTab() {
  const { data: lotes, loading, erro, recarregar } = useLotes();
  const { data: dietas, recarregar: recarregarDietas } = useDietas();
  const [novaDieta, setNovaDieta] = useState(false);
  if (loading) return <main className="rb-main"><div className="rb-eyebrow">Rebanho</div><div className="rb-head"><h1>Nutrição</h1></div><p className="rb-sub">Carregando…</p></main>;
  if (erro) return <main className="rb-main"><div className="rb-head"><h1>Nutrição</h1></div><p className="rb-sub" style={{ color: "var(--neg)" }}>Erro: {erro}</p></main>;
  const trocar = async (grupoId: number, dietaId: string) => { await atribuirDieta(grupoId, dietaId ? Number(dietaId) : null); recarregar(); };
  return (
    <main className="rb-main">
      <div className="rb-eyebrow">Rebanho · {lotes.reduce((a, l) => a + l.numAnimais, 0)} animais ativos</div>
      <div className="rb-head"><h1>Nutrição</h1><button className="rb-btn pri" onClick={() => setNovaDieta(true)}>+ Nova dieta</button></div>
      <h2 className="rb-sec-title">Lotes</h2>
      <table className="rb-tbl">
        <thead><tr><th>Lote</th><th>Animais</th><th>Produção média</th><th>Dieta</th></tr></thead>
        <tbody>{lotes.map((l) => (
          <tr key={l.id}><td className="rb-anm">{l.nome}</td><td>{l.numAnimais}</td><td>{l.producaoMedia != null ? `${l.producaoMedia} L/d` : "—"}</td>
            <td><select value={l.dietaId ?? ""} onChange={(e) => trocar(l.id, e.target.value)}><option value="">—</option>{dietas.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}</select></td></tr>
        ))}</tbody>
      </table>
      <h2 className="rb-sec-title" style={{ marginTop: 28 }}>Dietas cadastradas</h2>
      <div className="rb-dcards">{dietas.map((d) => (
        <div className="rb-dcard" key={d.id}><h4>{d.nome}</h4><ul>{d.descricao && <li>{d.descricao}</li>}{d.pb != null && <li>{d.pb}% PB</li>}{d.edMcal != null && <li>{d.edMcal} Mcal/kg</li>}</ul></div>
      ))}</div>
      {novaDieta && <DietaForm onFechar={() => setNovaDieta(false)} onSalvo={() => { setNovaDieta(false); recarregarDietas(); }} />}
    </main>
  );
}
```
(`.rb-dcards`/`.rb-dcard` already exist from the Dashboard; `.rb-tbl` from the herd view.)
- [ ] **Step 3: Cockpit diet line** — in `AnimalCockpit.tsx`, in the "Estado atual" box, add after the Grupo/lote row: `<div className="rb-kv"><span>Dieta</span><b>{a.dietaNome ?? "—"}</b></div>` (uses the new `Animal.dietaNome`).
- [ ] **Step 4: Wire `RebanhoApp.tsx`** — import `NutricaoTab`; add branch `domainKey === "nutricao" ? <NutricaoTab /> :` (before the generic HerdDomainView fallback).
- [ ] **Step 5:** tsc/build/test green; commit `feat(rebanho): aba Nutrição real (lotes + dietas) + dieta na ficha`.

---

## Self-Review
- Coverage: Dieta+Grupo.dietaId→T1; service (dietas/lotes/atribuir) + animal dietaNome→T2; router→T3; seed→T4; client fetchers→T5; tab+form+cockpit+wiring→T6. ✓
- Lot-level (no per-animal events/recompute) — correct for nutrition. Animal cockpit shows its lot's diet. ✓
- Types: `DietaDTO`/`LoteDTO`/`DietaInput` consistent T2(server)→T5(client). `dietaNome` added to AnimalDTO (server types.ts) + Animal (client types.ts). Service names (`listarDietas/criarDieta/editarDieta/listarLotes/atribuirDieta`, `NutricaoError`) consistent T2→T3→T5. ✓
