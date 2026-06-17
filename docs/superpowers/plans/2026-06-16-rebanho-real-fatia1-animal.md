# Rebanho Fase Real — Fatia 1: Backend + Animal (ponta a ponta) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the **Animal** tab real and usable — persisted in Neon Postgres, served by a Hono API, with create/edit/baixa forms — replacing the Animal mock while the other tabs stay mock.

**Architecture:** Follow the repo's existing pattern: thin Hono **router → service**, Prisma 6 singleton, Zod validation. Pure logic (Zod schemas + DTO mappers) is split into Prisma-free files and **TDD'd with Vitest**; the Prisma-touching service + router are verified by an **API smoke** (curl). The client adds typed fetchers + simple fetch hooks; **API DTOs are shaped to match the existing `client/src/rebanho/types.ts`** so the UI is a data-source swap, not a rewrite.

**Tech Stack:** Hono + @hono/zod-validator + Zod + Prisma 6 (Neon Postgres, pooled) on the server; React 18 + Vite + TS on the client. Adds **Vitest** to the server workspace. No other new deps.

## Global Constraints

- pnpm workspaces: server is `rionovo-server`, client is `rionovo-client`. Run as `pnpm --filter <ws> ...` from repo root.
- **Server** relative imports MUST end in `.js` (Node ESM). **Client** relative imports carry **no** extension.
- Identifiers/domain/UI copy in **PT-BR**.
- Prisma `Decimal` is never treated as a JS number directly — convert with `.toNumber()` in the mapper layer.
- Schema goes to the DB via **`prisma db push`** (no `migrate dev`, no `DIRECT_URL`). Formal migration is deferred.
- `server/.env` already has a valid pooled `DATABASE_URL` (the financial `/api/dashboard` works against it).
- Branch: `feat/rebanho-real-animal` (already checked out). Commit per task.

## Canonical DTO shapes (used by server mappers AND client types)

These mirror the existing `client/src/rebanho/types.ts` so the UI barely changes. `id` is the DB integer **as a string**.

```ts
// Animal (lista e ficha)
interface AnimalDTO {
  id: string; numero: string; nome: string;
  sexo: "F" | "M";
  categoria: "BEZERRA" | "NOVILHA" | "VACA" | "BEZERRO" | "TOURO";
  raca: string | null; grauSangue: string | null;
  dataNascimento: string | null; dataEntrada: string;   // ISO "YYYY-MM-DD"
  brincoEletronico: string | null; sisbov: string | null;
  maeId: string | null; maeNome: string | null; maeNumero: string | null;
  paiNome: string | null;
  grupoId: number | null; grupoNome: string | null; setor: string | null;
  ativo: boolean; dataBaixa: string | null; motivoBaixa: string | null;
  resumo: ResumoDTO | null;
}
interface ResumoDTO {
  statusReprodutivo: "PEV" | "VAZIA" | "INSEMINADA" | "PRENHE";
  del: number | null; ordemLactacao: number | null;
  producaoMediaDia: number | null; producao305: number | null;
  ccs: number | null; ccsTendencia: string | null;
  ultimoDgData: string | null; ultimoDgResultado: string | null;
  iepProjetado: number | null; diasGestacao: number | null; previsaoSecagem: string | null;
}
interface RacaDTO { id: number; nome: string }
interface GrupoDTO { id: number; nome: string }
```

---

## File Structure

```
server/
  prisma/schema.prisma                         [modify] — add enums + Animal/Raca/Grupo/ResumoAnimal
  prisma/seed-rebanho.ts                        [create] — idempotent seed (Raca/Grupo/Animal/ResumoAnimal)
  package.json                                  [modify] — add vitest devDep + "test" + "seed:rebanho" scripts
  vitest.config.ts                              [create]
  src/services/rebanho/animais.schemas.ts       [create] — Zod (criar/editar/baixa/filtros) + inferred types
  src/services/rebanho/animais.schemas.test.ts  [create]
  src/services/rebanho/animais.mappers.ts       [create] — Prisma row -> AnimalDTO/ResumoDTO (pure)
  src/services/rebanho/animais.mappers.test.ts  [create]
  src/services/rebanho/animais.ts               [create] — service (Prisma + schemas + mappers)
  src/routes/rebanho/animais.ts                 [create] — Hono router
  src/index.ts                                  [modify] — mount animaisRouter
client/
  src/rebanho/api.ts                            [create] — fetchers + hooks
  src/rebanho/types.ts                          [modify] — extend Animal with maeNome/maeNumero/grupoId/etc.
  src/rebanho/components/AnimalTab.tsx           [create] — real list container (fetch) + "Novo animal"
  src/rebanho/components/AnimalForm.tsx          [create] — drawer create/edit/baixa
  src/rebanho/components/AnimalCockpit.tsx       [modify] — fetch by id; empty timeline state; editar/baixa
  src/rebanho/RebanhoApp.tsx                     [modify] — animal tab -> <AnimalTab/>; pass nav to cockpit
  src/rebanho/styles/rebanho.css                [modify] — drawer + form + empty-state styles
```

---

## Task 1: Prisma schema + push to Neon

**Files:**
- Modify: `server/prisma/schema.prisma`

**Interfaces:**
- Produces: Prisma models `Animal`, `Raca`, `Grupo`, `ResumoAnimal` and enums `SexoAnimal`, `CategoriaAnimal`, `StatusAnimal`, `StatusReprodutivo`; the generated `@prisma/client` types for them.

- [ ] **Step 1: Append to `server/prisma/schema.prisma`** (after the existing models):
```prisma
enum SexoAnimal { F M }
enum CategoriaAnimal { BEZERRA NOVILHA VACA BEZERRO TOURO }
enum StatusAnimal { ATIVO BAIXADO }
enum StatusReprodutivo { PEV VAZIA INSEMINADA PRENHE }

model Raca {
  id      Int      @id @default(autoincrement())
  nome    String   @unique
  animais Animal[]
}

model Grupo {
  id      Int      @id @default(autoincrement())
  nome    String   @unique
  animais Animal[]
}

model Animal {
  id               Int             @id @default(autoincrement())
  numero           String          @unique
  nome             String?
  sexo             SexoAnimal
  categoria        CategoriaAnimal
  raca             Raca?           @relation(fields: [racaId], references: [id])
  racaId           Int?
  grauSangue       String?
  dataNascimento   DateTime?       @db.Date
  dataEntrada      DateTime        @db.Date
  brincoEletronico String?
  sisbov           String?
  mae              Animal?         @relation("Maternidade", fields: [maeId], references: [id])
  maeId            Int?
  pai              Animal?         @relation("Paternidade", fields: [paiId], references: [id])
  paiId            Int?
  paiNome          String?
  filhosMae        Animal[]        @relation("Maternidade")
  filhosPai        Animal[]        @relation("Paternidade")
  grupo            Grupo?          @relation(fields: [grupoId], references: [id])
  grupoId          Int?
  setor            String?
  status           StatusAnimal    @default(ATIVO)
  dataBaixa        DateTime?       @db.Date
  motivoBaixa      String?
  resumo           ResumoAnimal?
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  @@index([status])
  @@index([grupoId])
}

model ResumoAnimal {
  animal            Animal            @relation(fields: [animalId], references: [id], onDelete: Cascade)
  animalId          Int               @id
  statusReprodutivo StatusReprodutivo @default(VAZIA)
  del               Int?
  ordemLactacao     Int?
  producaoMediaDia  Decimal?          @db.Decimal(6, 2)
  producao305       Int?
  ccs               Int?
  ccsTendencia      String?
  ultimoDgData      DateTime?         @db.Date
  ultimoDgResultado String?
  iepProjetado      Int?
  diasGestacao      Int?
  previsaoSecagem   DateTime?         @db.Date
  atualizadoEm      DateTime          @updatedAt
}
```
> Note: `paiNome` is a plain string (touros externos não têm registro de animal); `mae`/`pai` self-relations are for animals born on-farm.

- [ ] **Step 2: Push schema to the DB and regenerate the client**

Run: `pnpm --filter rionovo-server exec prisma db push`
Expected: "Your database is now in sync with your Prisma schema." and "Generated Prisma Client". The financial tables are untouched (only the 4 new tables are added).

- [ ] **Step 3: Verify the tables exist**

Run: `pnpm --filter rionovo-server exec prisma db execute --stdin <<< 'SELECT count(*) FROM "Animal";'`
Expected: succeeds returning 0 (table exists, empty).

- [ ] **Step 4: Commit**
```bash
git add server/prisma/schema.prisma
git commit -m "feat(rebanho): schema Animal/Raca/Grupo/ResumoAnimal (db push)"
```

---

## Task 2: Seed script

**Files:**
- Create: `server/prisma/seed-rebanho.ts`
- Modify: `server/package.json`

**Interfaces:**
- Consumes: the Prisma client from Task 1.
- Produces: a runnable, idempotent seed populating 2 grupos, ~5 raças, 8 animais + their resumos. After running, `Animal` has 8 rows.

- [ ] **Step 1: Add a script** to `server/package.json` `scripts`: `"seed:rebanho": "tsx --env-file=.env prisma/seed-rebanho.ts"`.

- [ ] **Step 2: Create `server/prisma/seed-rebanho.ts`**
```ts
import { PrismaClient, SexoAnimal, CategoriaAnimal, StatusReprodutivo } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const grupos = ["Alta Produção", "Média Produção", "Bezerreiro"];
  const racas = ["Girolando 5/8", "Girolando 1/2", "Girolando 3/4", "Girolando 9/16", "Holandês"];
  const grupoId: Record<string, number> = {};
  const racaId: Record<string, number> = {};
  for (const nome of grupos) grupoId[nome] = (await prisma.grupo.upsert({ where: { nome }, update: {}, create: { nome } })).id;
  for (const nome of racas) racaId[nome] = (await prisma.raca.upsert({ where: { nome }, update: {}, create: { nome } })).id;

  // (numero, nome, sexo, categoria, raca, grauSangue, nasc, entrada, brinco, grupo, setor, paiNome)
  const animais = [
    { numero: "1234", nome: "Jurema", sexo: "F", categoria: "VACA", raca: "Girolando 5/8", grauSangue: "Girolando 5/8", nasc: "2020-03-12", grupo: "Alta Produção", setor: "Galpão 2", brinco: "982000123456789", paiNome: "Lance 612" },
    { numero: "1188", nome: "Aurora", sexo: "F", categoria: "VACA", raca: "Girolando 1/2", grauSangue: "Girolando 1/2", nasc: "2021-06-02", grupo: "Alta Produção", setor: null, brinco: null, paiNome: null },
    { numero: "0942", nome: "Bonita", sexo: "F", categoria: "VACA", raca: "Holandês", grauSangue: "Holandês", nasc: "2020-09-18", grupo: "Média Produção", setor: null, brinco: null, paiNome: null },
    { numero: "1305", nome: "Cravina", sexo: "F", categoria: "VACA", raca: "Girolando 3/4", grauSangue: "Girolando 3/4", nasc: "2021-01-05", grupo: "Média Produção", setor: null, brinco: null, paiNome: null },
    { numero: "0877", nome: "Dália", sexo: "F", categoria: "VACA", raca: "Girolando 5/8", grauSangue: "Girolando 5/8", nasc: "2020-04-22", grupo: "Alta Produção", setor: null, brinco: null, paiNome: null },
    { numero: "1421", nome: "Estrela", sexo: "F", categoria: "VACA", raca: "Holandês", grauSangue: "Holandês", nasc: "2021-08-30", grupo: "Média Produção", setor: null, brinco: null, paiNome: null },
    { numero: "0871", nome: "Jandira", sexo: "F", categoria: "VACA", raca: "Girolando 5/8", grauSangue: "Girolando 5/8", nasc: "2018-02-10", grupo: "Alta Produção", setor: null, brinco: null, paiNome: null },
    { numero: "1442", nome: "Bezerra 1442", sexo: "F", categoria: "BEZERRA", raca: "Girolando 9/16", grauSangue: "Girolando 9/16", nasc: "2026-01-22", grupo: "Bezerreiro", setor: null, brinco: null, paiNome: "Lance 884" },
  ] as const;

  const idByNumero: Record<string, number> = {};
  for (const a of animais) {
    const row = await prisma.animal.upsert({
      where: { numero: a.numero },
      update: {},
      create: {
        numero: a.numero, nome: a.nome, sexo: a.sexo as SexoAnimal, categoria: a.categoria as CategoriaAnimal,
        racaId: racaId[a.raca], grauSangue: a.grauSangue, dataNascimento: new Date(a.nasc), dataEntrada: new Date(a.nasc),
        brincoEletronico: a.brinco, grupoId: grupoId[a.grupo], setor: a.setor, paiNome: a.paiNome,
      },
    });
    idByNumero[a.numero] = row.id;
  }
  // Jurema é mãe da Bezerra 1442
  await prisma.animal.update({ where: { numero: "1442" }, data: { maeId: idByNumero["1234"] } });

  // ResumoAnimal (mesmos números dos mocks atuais)
  const resumos: { numero: string; r: any }[] = [
    { numero: "1234", r: { statusReprodutivo: "PRENHE", del: 145, ordemLactacao: 3, producaoMediaDia: 28, producao305: 8900, ccs: 512, ccsTendencia: "subindo", ultimoDgData: new Date("2026-05-28"), ultimoDgResultado: "positivo", iepProjetado: 395, diasGestacao: 30, previsaoSecagem: new Date("2026-12-12") } },
    { numero: "1188", r: { statusReprodutivo: "PEV", del: 72, ordemLactacao: 2, producaoMediaDia: 31, ccs: 180, ccsTendencia: "estavel" } },
    { numero: "0942", r: { statusReprodutivo: "VAZIA", del: 96, ordemLactacao: 3, producaoMediaDia: 24, ccs: 240, ccsTendencia: "estavel", ultimoDgData: new Date("2026-05-14"), ultimoDgResultado: "negativo" } },
    { numero: "1305", r: { statusReprodutivo: "VAZIA", del: 110, ordemLactacao: 2, producaoMediaDia: 22, ccs: 300, ccsTendencia: "subindo", ultimoDgData: new Date("2026-05-02"), ultimoDgResultado: "negativo" } },
    { numero: "0877", r: { statusReprodutivo: "PEV", del: 68, ordemLactacao: 4, producaoMediaDia: 33, ccs: 150, ccsTendencia: "estavel" } },
    { numero: "1421", r: { statusReprodutivo: "VAZIA", del: 83, ordemLactacao: 1, producaoMediaDia: 26, ccs: 210, ccsTendencia: "estavel", ultimoDgData: new Date("2026-05-20"), ultimoDgResultado: "negativo" } },
    { numero: "0871", r: { statusReprodutivo: "PRENHE", del: 210, ordemLactacao: 4, producaoMediaDia: 21, ccs: 130, ccsTendencia: "estavel", iepProjetado: 402, diasGestacao: 95, previsaoSecagem: new Date("2026-09-30") } },
  ];
  for (const { numero, r } of resumos) {
    const animalId = idByNumero[numero];
    await prisma.resumoAnimal.upsert({ where: { animalId }, update: r, create: { animalId, ...r } });
  }
  console.log(`Seed rebanho ok: ${animais.length} animais.`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
```

- [ ] **Step 3: Run the seed (idempotent)**

Run: `pnpm --filter rionovo-server run seed:rebanho`
Expected: "Seed rebanho ok: 8 animais." Run it a **second time** — same output, no duplicate-key error (upserts).

- [ ] **Step 4: Commit**
```bash
git add server/prisma/seed-rebanho.ts server/package.json
git commit -m "feat(rebanho): seed idempotente (raças, grupos, 8 animais + resumos)"
```

---

## Task 3: Zod schemas + DTO mappers (TDD)

Pure, Prisma-free — this is where automated tests pay off.

**Files:**
- Create: `server/vitest.config.ts`, `server/src/services/rebanho/animais.schemas.ts` (+ `.test.ts`), `server/src/services/rebanho/animais.mappers.ts` (+ `.test.ts`)
- Modify: `server/package.json`

**Interfaces:**
- Produces:
  - `criarAnimalSchema`, `editarAnimalSchema`, `baixaSchema`, `listFiltrosSchema` (Zod) + `CriarAnimalInput`, `EditarAnimalInput`, `BaixaInput`, `ListFiltros` (inferred types).
  - `toAnimalDTO(row): AnimalDTO` and `toResumoDTO(r): ResumoDTO | null` where `row` is a Prisma Animal with `raca`, `grupo`, `mae`, `resumo` included.

- [ ] **Step 1: Add Vitest** — in `server/package.json` add devDep `"vitest": "^2.1.8"` and scripts `"test": "vitest run"`, `"test:watch": "vitest"`. Create `server/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", include: ["src/**/*.test.ts"] } });
```
Run `pnpm install`.

- [ ] **Step 2: Write the failing tests** — `server/src/services/rebanho/animais.schemas.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { criarAnimalSchema, baixaSchema } from "./animais.schemas.js";

describe("criarAnimalSchema", () => {
  it("aceita um animal mínimo válido", () => {
    const r = criarAnimalSchema.safeParse({ numero: "1500", sexo: "F", categoria: "NOVILHA", dataEntrada: "2026-06-01" });
    expect(r.success).toBe(true);
  });
  it("rejeita numero vazio", () => {
    expect(criarAnimalSchema.safeParse({ numero: "", sexo: "F", categoria: "VACA", dataEntrada: "2026-06-01" }).success).toBe(false);
  });
  it("rejeita categoria inválida", () => {
    expect(criarAnimalSchema.safeParse({ numero: "9", sexo: "F", categoria: "ALIEN", dataEntrada: "2026-06-01" }).success).toBe(false);
  });
});

describe("baixaSchema", () => {
  it("exige motivo", () => {
    expect(baixaSchema.safeParse({ motivo: "" }).success).toBe(false);
    expect(baixaSchema.safeParse({ motivo: "venda", data: "2026-06-10" }).success).toBe(true);
  });
});
```

- [ ] **Step 3: Run to verify it fails** — Run: `pnpm --filter rionovo-server test` — Expected: FAIL (module missing).

- [ ] **Step 4: Implement `server/src/services/rebanho/animais.schemas.ts`**
```ts
import { z } from "zod";

const sexo = z.enum(["F", "M"]);
const categoria = z.enum(["BEZERRA", "NOVILHA", "VACA", "BEZERRO", "TOURO"]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD");

export const criarAnimalSchema = z.object({
  numero: z.string().min(1, "número é obrigatório").max(20),
  nome: z.string().max(60).optional(),
  sexo,
  categoria,
  racaId: z.number().int().positive().optional(),
  grauSangue: z.string().max(30).optional(),
  dataNascimento: isoDate.optional(),
  dataEntrada: isoDate,
  brincoEletronico: z.string().max(20).optional(),
  sisbov: z.string().max(20).optional(),
  maeId: z.number().int().positive().optional(),
  paiNome: z.string().max(60).optional(),
  grupoId: z.number().int().positive().optional(),
  setor: z.string().max(40).optional(),
});

export const editarAnimalSchema = criarAnimalSchema.partial();

export const baixaSchema = z.object({
  motivo: z.string().min(1, "motivo é obrigatório").max(60),
  data: isoDate.optional(),
});

export const listFiltrosSchema = z.object({
  status: z.enum(["ATIVO", "BAIXADO", "TODOS"]).default("ATIVO"),
  grupoId: z.coerce.number().int().positive().optional(),
  q: z.string().max(40).optional(),
});

export type CriarAnimalInput = z.infer<typeof criarAnimalSchema>;
export type EditarAnimalInput = z.infer<typeof editarAnimalSchema>;
export type BaixaInput = z.infer<typeof baixaSchema>;
export type ListFiltros = z.infer<typeof listFiltrosSchema>;
```

- [ ] **Step 5: Run to verify schemas pass** — Run: `pnpm --filter rionovo-server test` — Expected: schema suite PASS.

- [ ] **Step 6: Write the failing mapper test** — `server/src/services/rebanho/animais.mappers.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { toAnimalDTO } from "./animais.mappers.js";

const row: any = {
  id: 7, numero: "1234", nome: "Jurema", sexo: "F", categoria: "VACA",
  raca: { id: 1, nome: "Girolando 5/8" }, grauSangue: "Girolando 5/8",
  dataNascimento: new Date("2020-03-12"), dataEntrada: new Date("2020-03-12"),
  brincoEletronico: "982", sisbov: null,
  mae: { id: 3, numero: "0871", nome: "Jandira" }, maeId: 3, paiNome: "Lance 612",
  grupo: { id: 1, nome: "Alta Produção" }, grupoId: 1, setor: "Galpão 2",
  status: "ATIVO", dataBaixa: null, motivoBaixa: null,
  resumo: { statusReprodutivo: "PRENHE", del: 145, ordemLactacao: 3, producaoMediaDia: new Prisma.Decimal("28.00"), producao305: 8900, ccs: 512, ccsTendencia: "subindo", ultimoDgData: new Date("2026-05-28"), ultimoDgResultado: "positivo", iepProjetado: 395, diasGestacao: 30, previsaoSecagem: new Date("2026-12-12") },
};

describe("toAnimalDTO", () => {
  it("serializa ids como string, datas como ISO e Decimal como number", () => {
    const dto = toAnimalDTO(row);
    expect(dto.id).toBe("7");
    expect(dto.raca).toBe("Girolando 5/8");
    expect(dto.maeId).toBe("3");
    expect(dto.maeNumero).toBe("0871");
    expect(dto.grupoNome).toBe("Alta Produção");
    expect(dto.ativo).toBe(true);
    expect(dto.dataNascimento).toBe("2020-03-12");
    expect(dto.resumo?.producaoMediaDia).toBe(28);
    expect(typeof dto.resumo?.producaoMediaDia).toBe("number");
  });
  it("lida com relações nulas", () => {
    const dto = toAnimalDTO({ ...row, raca: null, grupo: null, mae: null, maeId: null, resumo: null, status: "BAIXADO", dataBaixa: new Date("2026-06-01"), motivoBaixa: "venda" });
    expect(dto.raca).toBeNull();
    expect(dto.grupoNome).toBeNull();
    expect(dto.maeId).toBeNull();
    expect(dto.ativo).toBe(false);
    expect(dto.dataBaixa).toBe("2026-06-01");
    expect(dto.resumo).toBeNull();
  });
});
```

- [ ] **Step 7: Run to verify it fails** — Run: `pnpm --filter rionovo-server test` — Expected: FAIL (mapper missing).

- [ ] **Step 8: Implement `server/src/services/rebanho/animais.mappers.ts`**
```ts
import type { AnimalDTO, ResumoDTO } from "./types.js";

function iso(d: Date | null | undefined): string | null {
  return d ? new Date(d).toISOString().slice(0, 10) : null;
}

export function toResumoDTO(r: any | null | undefined): ResumoDTO | null {
  if (!r) return null;
  return {
    statusReprodutivo: r.statusReprodutivo,
    del: r.del ?? null,
    ordemLactacao: r.ordemLactacao ?? null,
    producaoMediaDia: r.producaoMediaDia != null ? Number(r.producaoMediaDia) : null,
    producao305: r.producao305 ?? null,
    ccs: r.ccs ?? null,
    ccsTendencia: r.ccsTendencia ?? null,
    ultimoDgData: iso(r.ultimoDgData),
    ultimoDgResultado: r.ultimoDgResultado ?? null,
    iepProjetado: r.iepProjetado ?? null,
    diasGestacao: r.diasGestacao ?? null,
    previsaoSecagem: iso(r.previsaoSecagem),
  };
}

export function toAnimalDTO(a: any): AnimalDTO {
  return {
    id: String(a.id),
    numero: a.numero,
    nome: a.nome ?? "",
    sexo: a.sexo,
    categoria: a.categoria,
    raca: a.raca?.nome ?? null,
    grauSangue: a.grauSangue ?? null,
    dataNascimento: iso(a.dataNascimento),
    dataEntrada: iso(a.dataEntrada)!,
    brincoEletronico: a.brincoEletronico ?? null,
    sisbov: a.sisbov ?? null,
    maeId: a.maeId != null ? String(a.maeId) : null,
    maeNome: a.mae?.nome ?? null,
    maeNumero: a.mae?.numero ?? null,
    paiNome: a.paiNome ?? null,
    grupoId: a.grupoId ?? null,
    grupoNome: a.grupo?.nome ?? null,
    setor: a.setor ?? null,
    ativo: a.status === "ATIVO",
    dataBaixa: iso(a.dataBaixa),
    motivoBaixa: a.motivoBaixa ?? null,
    resumo: toResumoDTO(a.resumo),
  };
}
```
Also create `server/src/services/rebanho/types.ts` with the `AnimalDTO`/`ResumoDTO`/`RacaDTO`/`GrupoDTO` interfaces from the "Canonical DTO shapes" section above (copy them verbatim, exported).

- [ ] **Step 9: Run to verify all pass** — Run: `pnpm --filter rionovo-server test` — Expected: all PASS. Also `pnpm --filter rionovo-server exec tsc -p tsconfig.json --noEmit` clean.

- [ ] **Step 10: Commit**
```bash
git add server/vitest.config.ts server/package.json server/src/services/rebanho/animais.schemas.ts server/src/services/rebanho/animais.schemas.test.ts server/src/services/rebanho/animais.mappers.ts server/src/services/rebanho/animais.mappers.test.ts server/src/services/rebanho/types.ts
git commit -m "feat(rebanho): zod schemas + DTO mappers do animal (TDD)"
```

---

## Task 4: Animal service (Prisma)

**Files:**
- Create: `server/src/services/rebanho/animais.ts`

**Interfaces:**
- Consumes: `prisma` (from `../../db.js`), the schemas' inferred types, and `toAnimalDTO` (Task 3).
- Produces: `listarAnimais(f: ListFiltros): Promise<AnimalDTO[]>`, `obterAnimal(id: number): Promise<AnimalDTO | null>`, `criarAnimal(input: CriarAnimalInput): Promise<AnimalDTO>`, `editarAnimal(id, input: EditarAnimalInput): Promise<AnimalDTO>`, `darBaixa(id, input: BaixaInput): Promise<AnimalDTO>`, `listarGrupos(): Promise<GrupoDTO[]>`, `listarRacas(): Promise<RacaDTO[]>`. Throws `AnimalError` with `.code` of `"NAO_ENCONTRADO" | "NUMERO_DUPLICADO" | "REF_INVALIDA"`.

- [ ] **Step 1: Implement `server/src/services/rebanho/animais.ts`**
```ts
import { prisma } from "../../db.js";
import { toAnimalDTO } from "./animais.mappers.js";
import type { AnimalDTO, GrupoDTO, RacaDTO } from "./types.js";
import type { CriarAnimalInput, EditarAnimalInput, BaixaInput, ListFiltros } from "./animais.schemas.js";

export class AnimalError extends Error {
  constructor(public code: "NAO_ENCONTRADO" | "NUMERO_DUPLICADO" | "REF_INVALIDA", message: string) {
    super(message);
  }
}

const include = { raca: true, grupo: true, mae: true, resumo: true } as const;
const d = (s?: string) => (s ? new Date(s) : undefined);

export async function listarAnimais(f: ListFiltros): Promise<AnimalDTO[]> {
  const where: any = {};
  if (f.status !== "TODOS") where.status = f.status;
  if (f.grupoId) where.grupoId = f.grupoId;
  if (f.q) where.OR = [{ numero: { contains: f.q, mode: "insensitive" } }, { nome: { contains: f.q, mode: "insensitive" } }];
  const rows = await prisma.animal.findMany({ where, include, orderBy: { numero: "asc" } });
  return rows.map(toAnimalDTO);
}

export async function obterAnimal(id: number): Promise<AnimalDTO | null> {
  const row = await prisma.animal.findUnique({ where: { id }, include });
  return row ? toAnimalDTO(row) : null;
}

async function assertRefs(input: { racaId?: number; grupoId?: number; maeId?: number }) {
  if (input.racaId && !(await prisma.raca.findUnique({ where: { id: input.racaId } }))) throw new AnimalError("REF_INVALIDA", "raça inexistente");
  if (input.grupoId && !(await prisma.grupo.findUnique({ where: { id: input.grupoId } }))) throw new AnimalError("REF_INVALIDA", "grupo inexistente");
  if (input.maeId && !(await prisma.animal.findUnique({ where: { id: input.maeId } }))) throw new AnimalError("REF_INVALIDA", "mãe inexistente");
}

export async function criarAnimal(input: CriarAnimalInput): Promise<AnimalDTO> {
  if (await prisma.animal.findUnique({ where: { numero: input.numero } })) throw new AnimalError("NUMERO_DUPLICADO", `número ${input.numero} já existe`);
  await assertRefs(input);
  const row = await prisma.animal.create({
    data: {
      numero: input.numero, nome: input.nome, sexo: input.sexo, categoria: input.categoria,
      racaId: input.racaId, grauSangue: input.grauSangue,
      dataNascimento: d(input.dataNascimento), dataEntrada: new Date(input.dataEntrada),
      brincoEletronico: input.brincoEletronico, sisbov: input.sisbov,
      maeId: input.maeId, paiNome: input.paiNome, grupoId: input.grupoId, setor: input.setor,
      resumo: { create: { statusReprodutivo: "VAZIA" } },
    },
    include,
  });
  return toAnimalDTO(row);
}

export async function editarAnimal(id: number, input: EditarAnimalInput): Promise<AnimalDTO> {
  const existing = await prisma.animal.findUnique({ where: { id } });
  if (!existing) throw new AnimalError("NAO_ENCONTRADO", "animal não encontrado");
  if (input.numero && input.numero !== existing.numero && (await prisma.animal.findUnique({ where: { numero: input.numero } }))) throw new AnimalError("NUMERO_DUPLICADO", `número ${input.numero} já existe`);
  await assertRefs(input);
  const row = await prisma.animal.update({
    where: { id },
    data: {
      numero: input.numero, nome: input.nome, sexo: input.sexo, categoria: input.categoria,
      racaId: input.racaId, grauSangue: input.grauSangue,
      dataNascimento: d(input.dataNascimento), dataEntrada: d(input.dataEntrada),
      brincoEletronico: input.brincoEletronico, sisbov: input.sisbov,
      maeId: input.maeId, paiNome: input.paiNome, grupoId: input.grupoId, setor: input.setor,
    },
    include,
  });
  return toAnimalDTO(row);
}

export async function darBaixa(id: number, input: BaixaInput): Promise<AnimalDTO> {
  if (!(await prisma.animal.findUnique({ where: { id } }))) throw new AnimalError("NAO_ENCONTRADO", "animal não encontrado");
  const row = await prisma.animal.update({
    where: { id },
    data: { status: "BAIXADO", dataBaixa: input.data ? new Date(input.data) : new Date(), motivoBaixa: input.motivo },
    include,
  });
  return toAnimalDTO(row);
}

export async function listarGrupos(): Promise<GrupoDTO[]> {
  return prisma.grupo.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } });
}
export async function listarRacas(): Promise<RacaDTO[]> {
  return prisma.raca.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } });
}
```

- [ ] **Step 2: Typecheck** — Run: `pnpm --filter rionovo-server exec tsc -p tsconfig.json --noEmit` — Expected: clean.

- [ ] **Step 3: Commit**
```bash
git add server/src/services/rebanho/animais.ts
git commit -m "feat(rebanho): service do animal (CRUD + baixa) sobre Prisma"
```

---

## Task 5: Animal router + mount + API smoke

**Files:**
- Create: `server/src/routes/rebanho/animais.ts`
- Modify: `server/src/index.ts`

**Interfaces:**
- Consumes: the service (Task 4) and schemas (Task 3).
- Produces: REST endpoints under `/api/rebanho/...`.

- [ ] **Step 1: Create `server/src/routes/rebanho/animais.ts`**
```ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { criarAnimalSchema, editarAnimalSchema, baixaSchema, listFiltrosSchema } from "../../services/rebanho/animais.schemas.js";
import * as svc from "../../services/rebanho/animais.js";

function handle(err: unknown): { status: 404 | 409 | 400 | 500; body: { error: string } } {
  if (err instanceof svc.AnimalError) {
    const map = { NAO_ENCONTRADO: 404, NUMERO_DUPLICADO: 409, REF_INVALIDA: 400 } as const;
    return { status: map[err.code], body: { error: err.message } };
  }
  return { status: 500, body: { error: err instanceof Error ? err.message : "erro" } };
}

export const animaisRouter = new Hono()
  .get("/rebanho/grupos", async (c) => c.json(await svc.listarGrupos()))
  .get("/rebanho/racas", async (c) => c.json(await svc.listarRacas()))
  .get("/rebanho/animais", zValidator("query", listFiltrosSchema), async (c) => c.json(await svc.listarAnimais(c.req.valid("query"))))
  .get("/rebanho/animais/:id", async (c) => {
    const dto = await svc.obterAnimal(Number(c.req.param("id")));
    return dto ? c.json(dto) : c.json({ error: "animal não encontrado" }, 404);
  })
  .post("/rebanho/animais", zValidator("json", criarAnimalSchema), async (c) => {
    try { return c.json(await svc.criarAnimal(c.req.valid("json")), 201); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .patch("/rebanho/animais/:id", zValidator("json", editarAnimalSchema), async (c) => {
    try { return c.json(await svc.editarAnimal(Number(c.req.param("id")), c.req.valid("json"))); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  })
  .post("/rebanho/animais/:id/baixa", zValidator("json", baixaSchema), async (c) => {
    try { return c.json(await svc.darBaixa(Number(c.req.param("id")), c.req.valid("json"))); }
    catch (e) { const { status, body } = handle(e); return c.json(body, status); }
  });
```

- [ ] **Step 2: Mount it** — in `server/src/index.ts`, add `import { animaisRouter } from "./routes/rebanho/animais.js";` and `app.route("/api", animaisRouter);` after the existing `app.route` lines.

- [ ] **Step 3: API smoke** — start the server and exercise every endpoint.

Run (one shell):
```bash
pnpm --filter rionovo-server dev &  # starts on :41873
sleep 3
echo "--- list ---";   curl -s "http://localhost:41873/api/rebanho/animais" | head -c 400; echo
echo "--- get 1 ---";  curl -s "http://localhost:41873/api/rebanho/animais/$(curl -s 'http://localhost:41873/api/rebanho/animais' | sed -E 's/.*"id":"([0-9]+)".*/\1/')" | head -c 400; echo
echo "--- create ---"; curl -s -X POST "http://localhost:41873/api/rebanho/animais" -H 'content-type: application/json' -d '{"numero":"TST-1","sexo":"F","categoria":"NOVILHA","dataEntrada":"2026-06-01"}' -w '\n[%{http_code}]\n'
echo "--- dup ---";    curl -s -X POST "http://localhost:41873/api/rebanho/animais" -H 'content-type: application/json' -d '{"numero":"TST-1","sexo":"F","categoria":"NOVILHA","dataEntrada":"2026-06-01"}' -w '\n[%{http_code}]\n'
echo "--- racas/grupos ---"; curl -s "http://localhost:41873/api/rebanho/racas"; echo; curl -s "http://localhost:41873/api/rebanho/grupos"; echo
kill %1
```
Expected: list returns the 8 seeded animals (JSON with `"id":"…","numero":"…","resumo":{…}`); get returns one; create returns `[201]` with the new animal; dup returns `[409]`; racas/grupos return arrays. If all good, delete the test row: `pnpm --filter rionovo-server exec prisma db execute --stdin <<< $'DELETE FROM "Animal" WHERE numero = \'TST-1\';'`

- [ ] **Step 4: Commit**
```bash
git add server/src/routes/rebanho/animais.ts server/src/index.ts
git commit -m "feat(rebanho): rotas /api/rebanho/animais + mount"
```

---

## Task 6: Client fetchers + hooks

**Files:**
- Create: `client/src/rebanho/api.ts`
- Modify: `client/src/rebanho/types.ts`

**Interfaces:**
- Produces: `listarAnimais(f?)`, `obterAnimal(id)`, `criarAnimal(input)`, `editarAnimal(id, input)`, `darBaixa(id, input)`, `listarGrupos()`, `listarRacas()` (all returning the DTO types), plus hooks `useAnimais(f?)` and `useAnimal(id)` returning `{ data, loading, erro, recarregar }`.

- [ ] **Step 1: Extend `client/src/rebanho/types.ts`** — add fields to `Animal` so it matches `AnimalDTO`: change `raca: string` to `raca: string | null`, add `grauSangue?: string | null; maeNome?: string | null; maeNumero?: string | null; grupoId?: number | null; grupoNome?: string | null; dataBaixa?: string | null; motivoBaixa?: string | null; resumo?: ResumoAnimal | null;`. Keep existing fields. (Do not remove fields other code uses.)

- [ ] **Step 2: Create `client/src/rebanho/api.ts`**
```ts
import { useEffect, useState, useCallback } from "react";
import type { Animal, ResumoAnimal } from "./types";

export interface RacaDTO { id: number; nome: string }
export interface GrupoDTO { id: number; nome: string }
export interface AnimalForm {
  numero: string; nome?: string; sexo: "F" | "M"; categoria: Animal["categoria"];
  racaId?: number; grauSangue?: string; dataNascimento?: string; dataEntrada: string;
  brincoEletronico?: string; sisbov?: string; maeId?: number; paiNome?: string; grupoId?: number; setor?: string;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, init?.body ? { ...init, headers: { "content-type": "application/json", ...(init.headers || {}) } } : init);
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error((b as any).error || `HTTP ${res.status}`); }
  return res.json();
}

export const listarAnimais = (f?: { status?: string; grupoId?: number; q?: string }) => {
  const p = new URLSearchParams();
  if (f?.status) p.set("status", f.status);
  if (f?.grupoId) p.set("grupoId", String(f.grupoId));
  if (f?.q) p.set("q", f.q);
  const qs = p.toString();
  return req<Animal[]>(`/rebanho/animais${qs ? `?${qs}` : ""}`);
};
export const obterAnimal = (id: string) => req<Animal>(`/rebanho/animais/${id}`);
export const criarAnimal = (input: AnimalForm) => req<Animal>(`/rebanho/animais`, { method: "POST", body: JSON.stringify(input) });
export const editarAnimal = (id: string, input: Partial<AnimalForm>) => req<Animal>(`/rebanho/animais/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const darBaixa = (id: string, input: { motivo: string; data?: string }) => req<Animal>(`/rebanho/animais/${id}/baixa`, { method: "POST", body: JSON.stringify(input) });
export const listarGrupos = () => req<GrupoDTO[]>(`/rebanho/grupos`);
export const listarRacas = () => req<RacaDTO[]>(`/rebanho/racas`);

export function useAnimais(f?: { status?: string; grupoId?: number; q?: string }) {
  const [data, setData] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const key = JSON.stringify(f ?? {});
  const recarregar = useCallback(() => {
    setLoading(true); setErro(null);
    listarAnimais(f).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

export function useAnimal(id: string | null) {
  const [data, setData] = useState<Animal | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    if (!id) return;
    setLoading(true); setErro(null);
    obterAnimal(id).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

export type { ResumoAnimal };
```

- [ ] **Step 3: Typecheck & commit**

Run: `pnpm --filter rionovo-client exec tsc -b --noEmit` — Expected: clean.
```bash
git add client/src/rebanho/api.ts client/src/rebanho/types.ts
git commit -m "feat(rebanho): client fetchers + hooks do animal"
```

---

## Task 7: Real Animal tab (list) + empty/loading/error

**Files:**
- Create: `client/src/rebanho/components/AnimalTab.tsx`
- Modify: `client/src/rebanho/RebanhoApp.tsx`, `client/src/rebanho/styles/rebanho.css`

**Interfaces:**
- Consumes: `useAnimais` (Task 6), `HerdDomainView` (existing), `DOMAINS.animal` (existing config).
- Produces: `<AnimalTab onAbrirAnimal onNovo />` rendering the real list.

- [ ] **Step 1: Create `client/src/rebanho/components/AnimalTab.tsx`**
```tsx
import { useAnimais } from "../api";
import { HerdDomainView } from "./HerdDomainView";
import { DOMAINS } from "../domains";
import type { ResumoAnimal } from "../types";

export function AnimalTab({ onAbrirAnimal, onNovo }: { onAbrirAnimal: (id: string) => void; onNovo: () => void }) {
  const { data, loading, erro } = useAnimais({ status: "ATIVO" });
  if (loading) return <main className="rb-main"><div className="rb-eyebrow">Rebanho</div><div className="rb-head"><h1>Animal</h1></div><p className="rb-sub">Carregando…</p></main>;
  if (erro) return <main className="rb-main"><div className="rb-head"><h1>Animal</h1></div><p className="rb-sub" style={{ color: "var(--neg)" }}>Erro: {erro}</p></main>;
  // ResumoAnimal[] que o HerdDomainView consome — cada animal traz seu resumo embutido.
  const resumos: ResumoAnimal[] = data.map((a) => ({ animalId: a.id, ...(a.resumo ?? { statusReprodutivo: "VAZIA" }) }) as ResumoAnimal);
  return (
    <div style={{ position: "relative" }}>
      <button className="rb-btn pri" style={{ position: "absolute", right: 40, top: 30, zIndex: 2 }} onClick={onNovo}>+ Novo animal</button>
      <HerdDomainView config={DOMAINS.animal} resumos={resumos} onAbrirAnimal={onAbrirAnimal} />
    </div>
  );
}
```
> `HerdDomainView` looks up names via `getAnimal(r.animalId)` from the mock. Since the real ids (e.g. "7") won't be in the mock, **Task 7 Step 2** fixes the lookup.

- [ ] **Step 2: Make `HerdDomainView` name-lookup tolerant** — in `client/src/rebanho/components/HerdDomainView.tsx`, the row renders `getAnimal(r.animalId)`. Replace the mock lookup with the resumo-carried identity. Change the `resumos` type to allow optional identity and read it: in `AnimalTab` the resumo objects already carry the animal; simplest fix — pass an optional `nomes?: Record<string,{nome:string;numero:string}>` prop to `HerdDomainView` and prefer it over `getAnimal`. Apply:
  - In `HerdDomainView.tsx`, add prop `nomes?: Record<string, { nome: string; numero: string }>`; where it does `const a = getAnimal(r.animalId)`, replace with `const a = nomes?.[r.animalId] ?? getAnimal(r.animalId);`.
  - In `AnimalTab.tsx`, build `const nomes = Object.fromEntries(data.map((a) => [a.id, { nome: a.nome, numero: a.numero }]));` and pass `nomes={nomes}` to `<HerdDomainView>`.

- [ ] **Step 3: Wire into `RebanhoApp.tsx`** — import `AnimalTab`; add cockpit/form nav state is handled in Task 8/9. For now, when `nav.tab === "animal"` and no `animalId`, render `<AnimalTab onAbrirAnimal={nav.abrirAnimal} onNovo={() => {}} />` instead of the generic `HerdDomainView` for the animal domain. Keep the other domains on the mock `HerdDomainView`. (The `onNovo` is wired in Task 9.) Concretely, change the `domainKey` branch:
```tsx
        : domainKey === "animal"
          ? <AnimalTab onAbrirAnimal={nav.abrirAnimal} onNovo={() => {}} />
          : domainKey
            ? <HerdDomainView key={domainKey} config={DOMAINS[domainKey]} resumos={resumos} insight={insightDoRebanho(domainKey)} onAbrirAnimal={nav.abrirAnimal} />
```

- [ ] **Step 4: Verify** — `pnpm --filter rionovo-client exec tsc -b --noEmit` clean; `pnpm --filter rionovo-client build` ok; existing tests still pass (`pnpm --filter rionovo-client test`).

- [ ] **Step 5: Commit**
```bash
git add client/src/rebanho/components/AnimalTab.tsx client/src/rebanho/components/HerdDomainView.tsx client/src/rebanho/RebanhoApp.tsx
git commit -m "feat(rebanho): aba Animal lendo da API (lista real)"
```

---

## Task 8: Real cockpit (fetch by id) + empty timeline

**Files:**
- Modify: `client/src/rebanho/components/AnimalCockpit.tsx`, `client/src/rebanho/styles/rebanho.css`

**Interfaces:**
- Consumes: `useAnimal(id)` (Task 6).
- Produces: cockpit that renders real identity/resumo/genealogy and an **empty-state timeline**; exposes `onEditar`/`onBaixa` callbacks (wired in Task 9).

- [ ] **Step 1: Rewrite the data source of `AnimalCockpit.tsx`** — replace the mock reads (`getAnimal/getResumo/buildTimeline/insightDoAnimal`) with `useAnimal(id)`. Keep the existing JSX/layout, sourcing fields from the fetched `Animal` + `Animal.resumo`. Specifically:
  - Add props: `{ animalId: string; onVoltar: () => void; onAbrirAnimal: (id: string) => void; onEditar: (a: Animal) => void; onBaixa: (a: Animal) => void }`.
  - `const { data: a, loading, erro } = useAnimal(animalId);` — render loading/erro/not-found guards.
  - Identity from `a` (`a.nome`, `a.numero`, `a.grauSangue`, `a.brincoEletronico`, `a.dataNascimento`), chips from `a.resumo`.
  - Stat strip from `a.resumo` (guard each with `a.resumo?.…`).
  - **Timeline → empty state** (no events in Fatia 1): replace `<Timeline eventos={tl} />` with:
    ```tsx
    <div className="rb-empty">Nenhum lançamento ainda. Os eventos (cio, IA, parto, sanidade…) aparecem aqui quando você registrar na aba Reprodução — em breve.</div>
    ```
  - Remove the IA insight card (deferred). 
  - Sidebar genealogia: `a.maeId` → button `onClick={() => onAbrirAnimal(a.maeId!)}` showing `a.maeNome #a.maeNumero`; pai shows `a.paiNome`.
  - Add a header action row with two buttons: `<button className="rb-btn" onClick={() => onEditar(a)}>Editar</button>` and `<button className="rb-btn" onClick={() => onBaixa(a)}>Dar baixa</button>` (only when `a.ativo`).
  - Drop the now-unused imports (`buildTimeline`, `Timeline`, `getAnimal`, `getResumo`, `insightDoAnimal`, `IaInsightCard`). Keep `idadeMeses` for the age line (compute from `a.dataNascimento` when present).

- [ ] **Step 2: Add styles** to the END of `client/src/rebanho/styles/rebanho.css`:
```css
.rb-empty { border: 1px dashed var(--rule); border-radius: 10px; padding: 22px; color: var(--ink-3); font-size: 13.5px; background: var(--bg-card-2); }
.rb-head-actions { display: flex; gap: 8px; }
```

- [ ] **Step 3: Verify** — `tsc -b --noEmit` clean; `pnpm --filter rionovo-client build` ok. Note: the render smoke test `__smoke__/render.test.ts` renders `AnimalCockpit` with a mock id and now needs a fetch — **update that test** to no longer import/Exercise AnimalCockpit directly (it now requires the API); keep the RebanhoApp + Dashboard + IaView smokes. Remove the AnimalCockpit case from the smoke file (it's covered by the live app instead). Run `pnpm --filter rionovo-client test` → green.

- [ ] **Step 4: Commit**
```bash
git add client/src/rebanho/components/AnimalCockpit.tsx client/src/rebanho/styles/rebanho.css client/src/rebanho/__smoke__/render.test.ts
git commit -m "feat(rebanho): ficha do animal lendo da API + timeline em estado vazio"
```

---

## Task 9: Animal form drawer (novo/editar/baixa) + wiring

**Files:**
- Create: `client/src/rebanho/components/AnimalForm.tsx`
- Modify: `client/src/rebanho/RebanhoApp.tsx`, `client/src/rebanho/styles/rebanho.css`

**Interfaces:**
- Consumes: `criarAnimal`, `editarAnimal`, `darBaixa`, `listarRacas`, `listarGrupos` (Task 6).
- Produces: `<AnimalForm modo="novo"|"editar"|"baixa" animal? onFechar onSalvo />`.

- [ ] **Step 1: Create `client/src/rebanho/components/AnimalForm.tsx`**
```tsx
import { useEffect, useState } from "react";
import type { Animal } from "../types";
import { criarAnimal, editarAnimal, darBaixa, listarRacas, listarGrupos, type RacaDTO, type GrupoDTO } from "../api";

type Modo = "novo" | "editar" | "baixa";

export function AnimalForm({ modo, animal, onFechar, onSalvo }: { modo: Modo; animal?: Animal; onFechar: () => void; onSalvo: () => void }) {
  const [racas, setRacas] = useState<RacaDTO[]>([]);
  const [grupos, setGrupos] = useState<GrupoDTO[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [f, setF] = useState({
    numero: animal?.numero ?? "", nome: animal?.nome ?? "", sexo: animal?.sexo ?? "F",
    categoria: animal?.categoria ?? "NOVILHA", grauSangue: animal?.grauSangue ?? "",
    dataNascimento: animal?.dataNascimento ?? "", dataEntrada: animal?.dataEntrada ?? "",
    brincoEletronico: animal?.brincoEletronico ?? "", grupoId: animal?.grupoId ?? "", racaId: "",
    motivo: "",
  });
  useEffect(() => { listarRacas().then(setRacas); listarGrupos().then(setGrupos); }, []);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      if (modo === "baixa" && animal) await darBaixa(animal.id, { motivo: f.motivo });
      else {
        const payload: any = { numero: f.numero, nome: f.nome || undefined, sexo: f.sexo, categoria: f.categoria, grauSangue: f.grauSangue || undefined, dataNascimento: f.dataNascimento || undefined, dataEntrada: f.dataEntrada, brincoEletronico: f.brincoEletronico || undefined, grupoId: f.grupoId ? Number(f.grupoId) : undefined, racaId: f.racaId ? Number(f.racaId) : undefined };
        if (modo === "novo") await criarAnimal(payload);
        else if (animal) await editarAnimal(animal.id, payload);
      }
      onSalvo();
    } catch (e: any) { setErro(e.message); } finally { setSalvando(false); }
  }

  const titulo = modo === "novo" ? "Novo animal" : modo === "editar" ? `Editar ${animal?.nome ?? animal?.numero}` : `Dar baixa — ${animal?.nome ?? animal?.numero}`;
  return (
    <>
      <div className="rb-drawer-bg" onClick={onFechar} />
      <aside className="rb-drawer">
        <h3>{titulo}</h3>
        {modo === "baixa" ? (
          <label className="rb-fld">Motivo da baixa<input value={f.motivo} onChange={(e) => set("motivo", e.target.value)} placeholder="venda, morte, descarte…" /></label>
        ) : (
          <>
            <label className="rb-fld">Número*<input value={f.numero} onChange={(e) => set("numero", e.target.value)} /></label>
            <label className="rb-fld">Nome<input value={f.nome} onChange={(e) => set("nome", e.target.value)} /></label>
            <label className="rb-fld">Sexo<select value={f.sexo} onChange={(e) => set("sexo", e.target.value)}><option value="F">Fêmea</option><option value="M">Macho</option></select></label>
            <label className="rb-fld">Categoria<select value={f.categoria} onChange={(e) => set("categoria", e.target.value)}>{["BEZERRA","NOVILHA","VACA","BEZERRO","TOURO"].map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
            <label className="rb-fld">Raça<select value={f.racaId} onChange={(e) => set("racaId", e.target.value)}><option value="">—</option>{racas.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}</select></label>
            <label className="rb-fld">Grau de sangue<input value={f.grauSangue} onChange={(e) => set("grauSangue", e.target.value)} placeholder="Girolando 5/8" /></label>
            <label className="rb-fld">Grupo<select value={f.grupoId} onChange={(e) => set("grupoId", e.target.value)}><option value="">—</option>{grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}</select></label>
            <label className="rb-fld">Nascimento<input type="date" value={f.dataNascimento} onChange={(e) => set("dataNascimento", e.target.value)} /></label>
            <label className="rb-fld">Entrada*<input type="date" value={f.dataEntrada} onChange={(e) => set("dataEntrada", e.target.value)} /></label>
            <label className="rb-fld">Brinco eletrônico<input value={f.brincoEletronico} onChange={(e) => set("brincoEletronico", e.target.value)} /></label>
          </>
        )}
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

- [ ] **Step 2: Add drawer styles** to the END of `client/src/rebanho/styles/rebanho.css`:
```css
.rb-drawer-bg { position: fixed; inset: 0; background: rgba(14,19,17,.35); z-index: 10; }
.rb-drawer { position: fixed; top: 0; right: 0; bottom: 0; width: 380px; background: var(--bg); border-left: 1px solid var(--rule); z-index: 11; padding: 24px; overflow-y: auto; box-shadow: -8px 0 30px rgba(0,0,0,.12); }
.rb-drawer h3 { font-family: var(--serif); font-weight: 500; font-size: 22px; margin: 0 0 16px; }
.rb-fld { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--ink-3); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 12px; }
.rb-fld input, .rb-fld select { font-family: var(--sans); font-size: 14px; text-transform: none; letter-spacing: 0; color: var(--ink); border: 1px solid var(--rule); border-radius: 8px; padding: 9px 11px; background: var(--bg-card); }
.rb-drawer-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 18px; }
```

- [ ] **Step 3: Wire form state into `RebanhoApp.tsx`** — add local state for the drawer and re-render lists on save. Add near the top of the component:
```tsx
  const [form, setForm] = useState<{ modo: "novo" | "editar" | "baixa"; animal?: import("./types").Animal } | null>(null);
  const [recarga, setRecarga] = useState(0);
```
Pass `onNovo={() => setForm({ modo: "novo" })}` to `<AnimalTab key={recarga} …/>`; pass `onEditar`/`onBaixa` to the cockpit (`<AnimalCockpit key={recarga} … onEditar={(a) => setForm({ modo: "editar", animal: a })} onBaixa={(a) => setForm({ modo: "baixa", animal: a })} />`). At the end of the returned JSX (inside the `.rb` div), render the drawer:
```tsx
      {form && <AnimalForm modo={form.modo} animal={form.animal} onFechar={() => setForm(null)} onSalvo={() => { setForm(null); setRecarga((n) => n + 1); }} />}
```
Import `AnimalForm` and `useState`. The `key={recarga}` forces AnimalTab/cockpit to refetch after a save.

- [ ] **Step 4: Verify (build + live)** — `tsc -b --noEmit` clean; `pnpm --filter rionovo-client build` ok; `pnpm --filter rionovo-client test` green.

- [ ] **Step 5: Commit**
```bash
git add client/src/rebanho/components/AnimalForm.tsx client/src/rebanho/RebanhoApp.tsx client/src/rebanho/styles/rebanho.css
git commit -m "feat(rebanho): formulário (novo/editar/baixa) do animal + wiring"
```

---

## Self-Review

**Spec coverage:**
- §4 schema → Task 1. §7 seed → Task 2. §5 API → Tasks 4–5. §6 client/form → Tasks 6–9. §8 validation (zod, numero único 409, baixa não delete) → Tasks 3/4/5. §9 testing (server vitest pure + API smoke; client smokes) → Tasks 3/5/7-9. §6 cockpit empty timeline → Task 8. ✓
- Decisões deferidas (eventos, resumo computado, multi-fazenda, auth, IA) → explicitly NOT built. ✓

**Placeholder scan:** No TBD/TODO. The only `onNovo={() => {}}` no-op (Task 7 Step 3) is explicitly replaced in Task 9 Step 3 — flagged inline, not a dangling placeholder.

**Type consistency:** `AnimalDTO`/`ResumoDTO` defined once (Canonical DTO shapes) and reused in server `types.ts` (Task 3) and client `types.ts` (Task 6). Service signatures (`listarAnimais/obterAnimal/criarAnimal/editarAnimal/darBaixa/listarGrupos/listarRacas`, `AnimalError.code`) match between Task 4 (def), Task 5 (router consumes), Task 6 (client mirrors paths). `useAnimais/useAnimal` shape (`{data,loading,erro,recarregar}`) consistent across Tasks 6–8. Ids are strings end-to-end (`String(a.id)` in mapper → client `Animal.id: string` → `obterAnimal(id: string)`).

**Note (Decimal):** `producaoMediaDia` is `Decimal` in Prisma and converted to `number` in `toResumoDTO` (Task 3) — tested. Client treats it as `number`.
