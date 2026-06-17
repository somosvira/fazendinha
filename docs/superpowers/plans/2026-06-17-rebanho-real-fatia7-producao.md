# Fatia 7 — Configurações + Produção (3 modos) Implementation Plan

> **For agentic workers:** SUB-SKILL OBRIGATÓRIA: superpowers:subagent-driven-development. Passos usam checkbox (`- [ ]`).

**Goal:** Tornar a **Produção** real nos 3 modos de medição (controle por ordenha · total diário · tanque/lote), escolhidos numa **aba Configurações**, alimentando o `ResumoAnimal` (hoje mock) via motor de recálculo puro.

**Architecture:** Padrão do repo: Hono router→service + Prisma (`db push`) + Zod; client fetchers/hooks + drawers. Motor de recálculo **puro** (testável, sem Prisma). O recálculo de produção de um animal depende do `producaoModo` ativo (lido da tabela `Configuracao`).

**Tech Stack:** Hono, Prisma 6, Zod, `@hono/zod-validator`, React 18 + Vite + TS, Vitest.

## Global Constraints

- ESM: imports relativos `.ts` no **server** terminam em `.js`; no **client** sem extensão.
- PT-BR em identificadores e mensagens. Decimal do Prisma → `Number(...)` antes de cálculo/serialização; datas → ISO `YYYY-MM-DD`.
- Schema via `prisma db push` (sem migrations). Enums **multi-linha** (Prisma 6 rejeita single-line).
- Motor de recálculo **puro** (Prisma-free, testado). Grava **só** os campos de produção do `ResumoAnimal` (`producaoMediaDia`, `producao305`, `producaoTendencia`) — nunca os de reprodução/CCS.
- Cores CSS via `var(--...)`. Sidebar: o item Configurações entra no **rodapé** do `AppSidebar` (perto de Acessos).
- Modelo Claude / IA: não se aplica a esta fatia.

## Padrões a espelhar (ler antes)
- Service mutate→recompute→upsert: [eventos.ts](server/src/services/rebanho/eventos.ts) (`recomputarAnimal`).
- Motor puro + teste: [reproducao.recompute.ts](server/src/services/rebanho/reproducao.recompute.ts) + `.test.ts`; [sanidade.recompute.ts](server/src/services/rebanho/sanidade.recompute.ts).
- Timeline costurada: [timeline.ts](server/src/services/rebanho/timeline.ts).
- Grupo + animais ativos (p/ rateio e aba): [nutricao.ts](server/src/services/rebanho/nutricao.ts) (`listarLotes`).
- Rota + mount: [routes/rebanho/eventos.ts](server/src/routes/rebanho/eventos.ts) + [index.ts](server/src/index.ts).
- Client fetch/hook: [api.ts](client/src/rebanho/api.ts). Sidebar: [AppSidebar.tsx](client/src/components/AppSidebar.tsx). Aba que se adapta: [ReproducaoTab.tsx](client/src/rebanho/components/ReproducaoTab.tsx). Form drawer: [EventoForm.tsx](client/src/rebanho/components/EventoForm.tsx).

---

## PARTE A — BACKEND

### Task 1: Schema (Config + Produção) + serviço de Config

**Files:** Modify `server/prisma/schema.prisma`; Create `server/src/services/rebanho/config.ts`.

- [ ] **Step 1: Schema.** Adicionar ao `schema.prisma`:
```prisma
enum ModoProducao {
  ORDENHA
  TOTAL_DIARIO
  TANQUE_LOTE
}

model Configuracao {
  id           Int          @id @default(1)
  producaoModo ModoProducao @default(ORDENHA)
  atualizadoEm DateTime     @updatedAt
}

model ControleLeiteiro {
  id        Int      @id @default(autoincrement())
  animal    Animal   @relation(fields: [animalId], references: [id], onDelete: Cascade)
  animalId  Int
  data      DateTime @db.Date
  peso1     Decimal? @db.Decimal(6, 2)
  peso2     Decimal? @db.Decimal(6, 2)
  peso3     Decimal? @db.Decimal(6, 2)
  pesoTotal Decimal  @db.Decimal(6, 2)
  origem    String   @default("manual")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([animalId, data])
}

model ProducaoLote {
  id        Int      @id @default(autoincrement())
  grupo     Grupo?   @relation(fields: [grupoId], references: [id])
  grupoId   Int?
  data      DateTime @db.Date
  litros    Decimal  @db.Decimal(10, 2)
  origem    String   @default("manual")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([grupoId, data])
  @@index([data])
}
```
Em `model Animal` adicionar `controlesLeiteiros ControleLeiteiro[]`. Em `model Grupo` adicionar `producoesLote ProducaoLote[]`. Em `model ResumoAnimal` adicionar `producaoTendencia String?`.

- [ ] **Step 2: db push + generate.** `cd server && pnpm db:push && pnpm prisma:generate` (carrega `.env` sozinho). Esperado: sucesso, client regenerado.

- [ ] **Step 3: Serviço de Config** `config.ts`:
```ts
import { prisma } from "../../db.js";
import type { ModoProducao } from "@prisma/client";
export async function obterConfig(): Promise<{ producaoModo: ModoProducao }> {
  const c = await prisma.configuracao.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  return { producaoModo: c.producaoModo };
}
export async function salvarConfig(producaoModo: ModoProducao): Promise<{ producaoModo: ModoProducao }> {
  const c = await prisma.configuracao.upsert({ where: { id: 1 }, create: { id: 1, producaoModo }, update: { producaoModo } });
  return { producaoModo: c.producaoModo };
}
```

- [ ] **Step 4: Commit** — `feat(rebanho): schema Configuração + Produção (controle/lote) + serviço de config`.

### Task 2: Motor de recálculo de produção (puro, TDD)

**Files:** Create `server/src/services/rebanho/producao.recompute.ts` + `.test.ts`.

**Produces:**
```ts
export interface ControleIn { data: string; pesoTotal: number }   // ordenado ou não
export interface ResumoProducao { producaoMediaDia: number | null; producao305: number | null; producaoTendencia: string | null }
export function recomputarProducaoAnimal(controles: ControleIn[], temLactacaoAberta: boolean): ResumoProducao;
export function ratearProducao(litros: number, vacasEmLactacao: number): number | null;
export function producao305De(mediaDia: number | null, temLactacaoAberta: boolean): number | null;
```

Constantes: `JANELA_CONTROLES = 3`, `DIAS_LACTACAO = 305`.
Regras:
- `recomputarProducaoAnimal`: ordena por `data` desc. `producaoMediaDia` = média de `pesoTotal` dos primeiros `JANELA_CONTROLES` (1 casa decimal); `null` se vazio. `producaoTendencia` = se ≥2 controles: compara média dos 2 mais recentes vs os 2 anteriores (ou o restante) → `"subindo"` se +; `"descendo"` se −; `"estavel"` se igual/sem base; `null` se <2. `producao305` = `producao305De(producaoMediaDia, temLactacaoAberta)`.
- `producao305De`: `temLactacaoAberta && mediaDia != null` → `Math.round(mediaDia * DIAS_LACTACAO)`; senão `null`.
- `ratearProducao`: `vacasEmLactacao > 0` → `Math.round((litros / vacasEmLactacao) * 10) / 10`; senão `null`.

- [ ] **Step 1: Testes que falham** (`producao.recompute.test.ts`):
  - `[]` → `{null,null,null}`.
  - 1 controle pesoTotal 28, lactação aberta → media 28, 305 = 8540, tendência null.
  - 3 controles `[2026-06-15:30, 2026-06-08:28, 2026-06-01:26]`, lactação aberta → media (30+28+26)/3=28, tendência "subindo" (recentes 29 vs anteriores 26), 305=8540.
  - lactação fechada (`temLactacaoAberta=false`) → producao305 null mesmo com média.
  - `ratearProducao(900, 30)` = 30; `ratearProducao(900, 0)` = null.
- [ ] **Step 2: Rodar e ver falhar** — `pnpm --filter rionovo-server test -- producao.recompute` → FAIL.
- [ ] **Step 3: Implementar** `producao.recompute.ts`.
- [ ] **Step 4: Rodar e ver passar** — PASS.
- [ ] **Step 5: Commit** — `feat(rebanho): motor de recálculo de produção (TDD)`.

### Task 3: Serviços + rotas (config, produção/animal, produção/lote, agregado, timeline)

**Files:** Create `server/src/services/rebanho/producao.ts`, `server/src/services/rebanho/producao.mappers.ts`, `server/src/services/rebanho/producao.schemas.ts`, `server/src/routes/rebanho/producao.ts`, `server/src/routes/rebanho/config.ts`; Modify `server/src/services/rebanho/timeline.ts`, `server/src/index.ts`.

**Interfaces consumidas:** Task 1 (`obterConfig`/`salvarConfig`), Task 2 (motor).

- [ ] **Step 1: `producao.ts` — recálculo por modo.**
```ts
import { prisma } from "../../db.js";
import { obterConfig } from "./config.js";
import { recomputarProducaoAnimal, ratearProducao, producao305De, type ControleIn } from "./producao.recompute.js";
const iso = (x: Date) => x.toISOString().slice(0, 10);

export async function recomputarProducaoDoAnimal(animalId: number): Promise<void> {
  const animal = await prisma.animal.findUnique({ where: { id: animalId }, include: { lactacoes: true } });
  if (!animal) return;
  const temLact = animal.lactacoes.some((l) => l.dtFim == null);
  const { producaoModo } = await obterConfig();
  let r;
  if (producaoModo === "TANQUE_LOTE") {
    // último ProducaoLote do grupo do animal; senão da fazenda (grupoId null)
    const doGrupo = animal.grupoId != null ? await prisma.producaoLote.findFirst({ where: { grupoId: animal.grupoId }, orderBy: { data: "desc" } }) : null;
    const lote = doGrupo ?? await prisma.producaoLote.findFirst({ where: { grupoId: null }, orderBy: { data: "desc" } });
    let media: number | null = null;
    if (lote) {
      const escopo = lote.grupoId != null ? { grupoId: lote.grupoId } : {};
      const vacas = await prisma.animal.count({ where: { status: "ATIVO", ...escopo, resumo: { del: { not: null } } } });
      media = ratearProducao(Number(lote.litros), vacas);
    }
    r = { producaoMediaDia: media, producao305: producao305De(media, temLact), producaoTendencia: null };
  } else {
    const ctrls = await prisma.controleLeiteiro.findMany({ where: { animalId }, orderBy: { data: "desc" } });
    const arr: ControleIn[] = ctrls.map((c) => ({ data: iso(c.data), pesoTotal: Number(c.pesoTotal) }));
    r = recomputarProducaoAnimal(arr, temLact);
  }
  await prisma.resumoAnimal.upsert({
    where: { animalId },
    create: { animalId, producaoMediaDia: r.producaoMediaDia, producao305: r.producao305, producaoTendencia: r.producaoTendencia },
    update: { producaoMediaDia: r.producaoMediaDia, producao305: r.producao305, producaoTendencia: r.producaoTendencia },
  });
}
export async function recomputarProducaoTodos(): Promise<void> {
  const ids = (await prisma.animal.findMany({ where: { status: "ATIVO" }, select: { id: true } })).map((a) => a.id);
  for (const id of ids) await recomputarProducaoDoAnimal(id);
}
```
> Nota: o `del` (lactação) já é mantido pelo recálculo de reprodução; usá-lo para contar vacas em lactação é coerente. A criação do resumo via `upsert` com só os campos de produção é segura (os demais ficam no default/preservados em update).

- [ ] **Step 2: `producao.schemas.ts`** — Zod discriminado:
```ts
import { z } from "zod";
const dataNaoFutura = z.string().refine((s) => new Date(s) <= new Date(), "data não pode ser futura");
export const controleSchema = z.object({
  data: dataNaoFutura,
  peso1: z.number().positive().optional(), peso2: z.number().positive().optional(), peso3: z.number().positive().optional(),
  pesoTotal: z.number().positive().optional(), observacao: z.string().max(200).optional(),
}).refine((v) => (v.peso1 ?? v.peso2 ?? v.peso3 ?? v.pesoTotal) != null, "informe ao menos um peso");
export type ControleInput = z.infer<typeof controleSchema>;
export const producaoLoteSchema = z.object({ grupoId: z.number().int().optional(), data: dataNaoFutura, litros: z.number().positive() });
export type ProducaoLoteInput = z.infer<typeof producaoLoteSchema>;
export const configSchema = z.object({ producaoModo: z.enum(["ORDENHA", "TOTAL_DIARIO", "TANQUE_LOTE"]) });
```

- [ ] **Step 3: `producao.ts` — CRUD + agregado.** Acrescentar:
```ts
import { controleSchema, type ControleInput, type ProducaoLoteInput } from "./producao.schemas.js";
import { toTimelineControle } from "./producao.mappers.js";
export class ProducaoError extends Error { constructor(public code: "NAO_ENCONTRADO", m: string) { super(m); } }

export async function registrarControle(animalId: number, input: ControleInput) {
  if (!(await prisma.animal.findUnique({ where: { id: animalId } }))) throw new ProducaoError("NAO_ENCONTRADO", "animal não encontrado");
  const total = input.pesoTotal ?? (Number(input.peso1 ?? 0) + Number(input.peso2 ?? 0) + Number(input.peso3 ?? 0));
  const c = await prisma.controleLeiteiro.create({ data: { animalId, data: new Date(input.data), peso1: input.peso1, peso2: input.peso2, peso3: input.peso3, pesoTotal: total } });
  await recomputarProducaoDoAnimal(animalId);
  return toTimelineControle(c);
}
export async function excluirControle(id: number) {
  const c = await prisma.controleLeiteiro.findUnique({ where: { id } });
  if (!c) throw new ProducaoError("NAO_ENCONTRADO", "controle não encontrado");
  await prisma.controleLeiteiro.delete({ where: { id } });
  await recomputarProducaoDoAnimal(c.animalId);
}
export async function registrarProducaoLote(input: ProducaoLoteInput) {
  const l = await prisma.producaoLote.create({ data: { grupoId: input.grupoId ?? null, data: new Date(input.data), litros: input.litros } });
  // recomputa os animais afetados
  const where = l.grupoId != null ? { status: "ATIVO" as const, grupoId: l.grupoId } : { status: "ATIVO" as const };
  for (const a of await prisma.animal.findMany({ where, select: { id: true } })) await recomputarProducaoDoAnimal(a.id);
  return { id: l.id };
}
export async function excluirProducaoLote(id: number) {
  const l = await prisma.producaoLote.findUnique({ where: { id } });
  if (!l) throw new ProducaoError("NAO_ENCONTRADO", "produção de lote não encontrada");
  await prisma.producaoLote.delete({ where: { id } });
  const where = l.grupoId != null ? { status: "ATIVO" as const, grupoId: l.grupoId } : { status: "ATIVO" as const };
  for (const a of await prisma.animal.findMany({ where, select: { id: true } })) await recomputarProducaoDoAnimal(a.id);
}
export async function agregarProducao() {
  const { producaoModo } = await obterConfig();
  const animais = await prisma.animal.findMany({ where: { status: "ATIVO" }, include: { resumo: true } });
  const emLact = animais.filter((a) => a.resumo?.del != null);
  const totalDia = Math.round(emLact.reduce((s, a) => s + (a.resumo?.producaoMediaDia != null ? Number(a.resumo.producaoMediaDia) : 0), 0) * 10) / 10;
  const mediaVaca = emLact.length ? Math.round((totalDia / emLact.length) * 10) / 10 : null;
  if (producaoModo === "TANQUE_LOTE") {
    const grupos = await prisma.grupo.findMany({ include: { animais: { where: { status: "ATIVO" }, include: { resumo: true } } } });
    const lotes = await Promise.all(grupos.map(async (g) => {
      const ult = await prisma.producaoLote.findFirst({ where: { grupoId: g.id }, orderBy: { data: "desc" } });
      const vacas = g.animais.filter((a) => a.resumo?.del != null).length;
      return { grupo: g.nome, litros: ult ? Number(ult.litros) : null, vacas, rateio: ult && vacas ? Math.round((Number(ult.litros) / vacas) * 10) / 10 : null };
    }));
    return { modo: producaoModo, totalDia, emLactacao: emLact.length, lotes };
  }
  const ranking = emLact
    .map((a) => ({ numero: a.numero, nome: a.nome, litros: a.resumo?.producaoMediaDia != null ? Number(a.resumo.producaoMediaDia) : 0 }))
    .sort((x, y) => y.litros - x.litros);
  return { modo: producaoModo, totalDia, mediaVaca, emLactacao: emLact.length, ranking };
}
```

- [ ] **Step 4: `producao.mappers.ts`** — `toTimelineControle(c)` → `{ id:String(c.id), animalId:String(c.animalId), data: iso(c.data), dominio:"producao", titulo:"Controle leiteiro — "+Number(c.pesoTotal)+" L/dia", detalhe: <ordenhas se houver>, marcador:null, alerta:false }` (mesma forma do `EventoTimelineDTO` usado pelos outros mappers — conferir em [eventos.mappers.ts](server/src/services/rebanho/eventos.mappers.ts)).

- [ ] **Step 5: Timeline.** Em `timeline.ts`, incluir os controles:
```ts
import { toTimelineControle } from "./producao.mappers.js";
// ... buscar prisma.controleLeiteiro.findMany({ where: { animalId } }) no Promise.all
// e concatenar ...c.map(toTimelineControle) antes do sort.
```

- [ ] **Step 6: Rotas.** `routes/rebanho/config.ts`:
```ts
import { Hono } from "hono"; import { zValidator } from "@hono/zod-validator";
import { obterConfig, salvarConfig } from "../../services/rebanho/config.js";
import { recomputarProducaoTodos } from "../../services/rebanho/producao.js";
import { configSchema } from "../../services/rebanho/producao.schemas.js";
export const configRouter = new Hono()
  .get("/rebanho/config", async (c) => c.json(await obterConfig()))
  .patch("/rebanho/config", zValidator("json", configSchema), async (c) => { const r = await salvarConfig(c.req.valid("json").producaoModo); await recomputarProducaoTodos(); return c.json(r); });
```
`routes/rebanho/producao.ts`: `POST /rebanho/animais/:id/producao` (controleSchema → registrarControle), `DELETE /rebanho/producao/:id` (excluirControle), `POST /rebanho/producao-lote` (producaoLoteSchema → registrarProducaoLote), `DELETE /rebanho/producao-lote/:id`, `GET /rebanho/producao` (agregarProducao). Tratar `ProducaoError` → 404. Espelhar a forma de [routes/rebanho/eventos.ts](server/src/routes/rebanho/eventos.ts).
Montar ambos em `index.ts` (`app.route("/api", configRouter)`, `app.route("/api", producaoRouter)`).

- [ ] **Step 7: Smoke de API.** Build + subir (`PORT=41902 node --env-file=.env dist/index.js &`): PATCH config p/ ORDENHA; POST controle na Jurema (id real) com peso1/2/3 → GET `/rebanho/producao` (ranking) e GET animal (resumo.producaoMediaDia real); PATCH p/ TANQUE_LOTE; POST producao-lote; GET `/rebanho/producao` (lotes); confirmar recomputo. Documentar saída. Matar o server.

- [ ] **Step 8: Commit** — `feat(rebanho): endpoints de produção (config/controle/lote/agregado) + timeline`.

### Task 4: Seed de produção

**Files:** Modify `server/prisma/seed-rebanho.ts`.

- [ ] **Step 1:** Acrescentar, de forma idempotente (`controleLeiteiro.deleteMany({})` no início da seção), 3–4 controles recentes por vaca em lactação coerentes com o cockpit (Jurema #1234: ~26→28→30 subindo; demais próximos dos números atuais). Garantir `Configuracao` em `ORDENHA`. Ao final, chamar o recálculo de produção de todos (ou inline). Não mexer nos eventos de reprodução/sanidade já semeados.
- [ ] **Step 2:** `pnpm --filter rionovo-server run seed:rebanho` roda sem erro; conferir que a Jurema fica com `producaoMediaDia ≈ 28`, subindo.
- [ ] **Step 3: Commit** — `feat(rebanho): seed de controles leiteiros`.

---

## PARTE B — CLIENT

### Task 5: api.ts + aba Configurações + item no sidebar

**Files:** Modify `client/src/rebanho/api.ts`, `client/src/components/AppSidebar.tsx`, `client/src/App.tsx`; Create `client/src/rebanho/components/ConfiguracoesView.tsx`.

- [ ] **Step 1: api.ts** — tipos + fetchers + hooks:
```ts
export type ModoProducao = "ORDENHA" | "TOTAL_DIARIO" | "TANQUE_LOTE";
export const obterConfig = () => req<{ producaoModo: ModoProducao }>(`/rebanho/config`);
export const salvarConfig = (producaoModo: ModoProducao) => req<{ producaoModo: ModoProducao }>(`/rebanho/config`, { method: "PATCH", body: JSON.stringify({ producaoModo }) });
export function useConfig() { /* mesmo shape de useDashboard: data/loading/erro + recarregar */ }
export interface ControlePayload { data: string; peso1?: number; peso2?: number; peso3?: number; pesoTotal?: number }
export const registrarControle = (animalId: string, p: ControlePayload) => req<EventoTimeline>(`/rebanho/animais/${animalId}/producao`, { method: "POST", body: JSON.stringify(p) });
export const excluirControle = (id: string) => req<{ ok: true }>(`/rebanho/producao/${id}`, { method: "DELETE" });
export const registrarProducaoLote = (p: { grupoId?: number; data: string; litros: number }) => req<{ id: number }>(`/rebanho/producao-lote`, { method: "POST", body: JSON.stringify(p) });
export interface ProducaoAgg { modo: ModoProducao; totalDia: number; mediaVaca?: number | null; emLactacao: number; ranking?: { numero: string; nome: string | null; litros: number }[]; lotes?: { grupo: string; litros: number | null; vacas: number; rateio: number | null }[]; }
export const obterProducao = () => req<ProducaoAgg>(`/rebanho/producao`);
export function useProducao() { /* data/loading/erro */ }
```

- [ ] **Step 2: `ConfiguracoesView.tsx`** — lê `useConfig`; mostra "Como a fazenda mede o leite?" com 3 cards/radios (Controle leiteiro · Total diário · Tanque/lote, com 1 linha de descrição cada); ao escolher, `salvarConfig` e refetch; estado salvando + feedback. Usar classes `.rb`/existentes (sem hex hardcoded).

- [ ] **Step 3: Sidebar + App.** Em `AppSidebar.tsx`: adicionar a chave `"config"` ao mapa de ícones (engrenagem) e renderizar um `<Item id="config" label="Configurações">` no rodapé, **antes** do `acessos` (ou ao lado). Estender a união `Tab` em `Shell.tsx` com `"config"`. Em `App.tsx`: rotear `tab === "config"` → `<ConfiguracoesView/>` (dentro do `.app-main`); o effect de redirecionamento deve early-return em `"config"` também.

- [ ] **Step 4: Verificar** — `pnpm --filter rionovo-client build` e `test` verdes (adicionar smoke de `ConfiguracoesView`). 
- [ ] **Step 5: Commit** — `feat(rebanho): aba Configurações (modo de produção) + item no sidebar`.

### Task 6: Aba Produção + ControleForm no cockpit

**Files:** Create `client/src/rebanho/components/ProducaoTab.tsx`, `client/src/rebanho/components/ControleForm.tsx`; Modify `client/src/rebanho/RebanhoContent.tsx`, `client/src/rebanho/components/AnimalCockpit.tsx`, `client/src/rebanho/components/AppSidebar`/nav (item Produção), `client/src/rebanho/__smoke__/render.test.ts`.

- [ ] **Step 1: Item Produção no rebanho.** O sidebar do rebanho (grupo REBANHO em `AppSidebar.tsx`) ganha **Produção** (chave `reb-producao`) entre Nutrição e IA. Estender `Tab`/`REB` map/`RebSub` em `Shell.tsx`/`RebanhoContent.tsx` com `producao`.

- [ ] **Step 2: `ProducaoTab.tsx`** — `useConfig` + `useProducao`. KPIs (produção total/dia, média/vaca, nº em lactação). Se `modo !== "TANQUE_LOTE"`: tabela **ranking** (vaca · L/d, ordenado). Se `TANQUE_LOTE`: tabela de **lotes** (lote · litros · vacas · rateio) + um pequeno form "registrar produção do lote/tanque" (`registrarProducaoLote` → refetch). Loading/erro shells como nas outras abas.

- [ ] **Step 3: `ControleForm.tsx`** (drawer, espelha `EventoForm`) — recebe `modo` + `animalId`; modo ORDENHA → 3 campos (peso1/2/3); modo TOTAL_DIARIO → 1 campo (pesoTotal); data (default hoje). Salva via `registrarControle` → callback de refetch.

- [ ] **Step 4: Cockpit.** Em `AnimalCockpit.tsx`: a timeline já vem de `useTimeline` (agora inclui produção — backend pronto). Adicionar botão **"+ Registrar controle"** (abre `ControleForm` com o `modo` de `useConfig`) quando `modo !== "TANQUE_LOTE"`; quando `TANQUE_LOTE`, mostrar no card de estado "produção estimada por rateio do lote". Refetch ao salvar.

- [ ] **Step 5: RebanhoContent.** Rotear `aba === "producao"` → `<ProducaoTab/>`.

- [ ] **Step 6: Smoke + verificação** — atualizar `render.test.ts` (caso `ProducaoTab` loading shell). `pnpm --filter rionovo-client build` + `test` verdes; `pnpm --filter rionovo-server test` verde.
- [ ] **Step 7: Commit** — `feat(rebanho): aba Produção + registro de controle leiteiro no cockpit`.

---

## Verificação final (controller, navegador)
- Configurações: trocar modo → persiste; aba Produção e cockpit se adaptam.
- Modo ORDENHA: registrar controle na Jurema → cockpit mostra produção real; ranking na aba.
- Modo TANQUE_LOTE: registrar produção de lote → rateio aparece no cockpit ("estimado") e a aba mostra os lotes.
- Trocar modo recomputa todos (números mudam coerentemente).
- Sidebar: itens **Produção** (grupo Rebanho) e **Configurações** (rodapé).

## Self-review (feito)
- **Cobertura:** Config (T1/T5), motor 3 modos (T2/T3), endpoints+timeline (T3), seed (T4), aba Config (T5), aba Produção + cockpit (T6). ✓
- **Placeholders:** os trechos "mesmo shape de useDashboard"/"espelhar X" apontam para arquivos concretos do repo — não são TODO de lógica.
- **Tipos:** `ResumoProducao`, `ControleInput`, `ProducaoLoteInput`, `ProducaoAgg`, `ModoProducao`, `RebSub`+`producao` consistentes entre tasks.

## Decisões deferidas
- Multi-tenant/por-fazenda · importação por integração · curva de lactação 305 corrigida · curva na aba Produção · edição de controle.
