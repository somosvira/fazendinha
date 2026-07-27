# Reprodução Bloco C — Sêmen e genética estruturados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans para implementar este plano tarefa a tarefa. Os passos usam checkbox (`- [ ]`).

**Goal:** Fechar a linha *Reprodutor/sêmen/genética* do contrato de paridade IDEAGRI: catálogo genético flexível e gerenciável (indicadores N:N, marcadores, caseínas, pedigree), estoque de sêmen com baixa opcional-com-aviso na IA (reversível no estorno), e import fail-closed com fixture — sem reimplementar os Blocos A/B.

**Architecture:** Mesmo pipeline do módulo — rota fina (`routes/rebanho/`) → service (`services/rebanho/`) → cálculo puro (`*.calc.ts`) + schemas (`*.schemas.ts`), cada cálculo com TDD. Dicionários genéticos (`IndicadorGenetico`, `MarcadorGenetico`, `Caseina`, `TipoSemen`) são compartilhados (sem `propriedadeId`); `EstoqueSemen` é fato de sítio (`propriedadeId Int?`). PTAs legados convivem com o catálogo N:N via **espelho** (abordagem A): as colunas `ptaLeite/ptaGordura/ptaProteina/tpi` ficam em `Reprodutor` e `IndicadorGenetico.colunaLegada` projeta o valor de volta na gravação/import — `reprodutor.calc`, `acasalamento.calc` e a UI de ranking atual **não mudam**.

**Tech Stack:** Hono + @hono/zod-validator + Zod + Prisma 6 + Vitest (server); React 18 + Vite + TypeScript + Vitest (client); parser puro em `scripts/build-rebanho-json.mjs` testado com `node --test`. Sem dependências novas.

## Global Constraints

- Comandos por workspace a partir da raiz; **não existe** target `test` na raiz — rodar via `--filter`.
- Server: imports relativos de `.ts` terminam em `.js`; client: sem extensão. Domínio e mensagens em **PT-BR**.
- Escopo de propriedade em toda leitura/escrita via `resolverEscopoLeitura/Escrita(c)`. Fatos de sítio (`EstoqueSemen`) levam `propriedadeId Int?`; dicionários (`IndicadorGenetico`, `MarcadorGenetico`, `Caseina`, `TipoSemen`) são compartilhados (`propriedadeId` ausente de propósito). Acesso cruzado retorna `NAO_ENCONTRADO`. Catálogo compartilhado com escopo de sítio usa `OR: [{ propriedadeId }, { propriedadeId: null }]` (helper `catalogoNoEscopo`, já existente em `reprodutores.ts`).
- Identidade de origem `ideagri<Entidade>Id Int? @unique` → import idempotente (upsert por origem); sigla/código inválido no import **aborta** (`main()` fail-closed via `null`), nunca colapsa em outro tipo.
- Decimal via Prisma Decimal → `Number()` só na borda (mappers). Datas `@db.Date` gravadas de `new Date("YYYY-MM-DDT00:00:00Z")`.
- Migration aditiva **idempotente**: `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` / `CREATE [UNIQUE] INDEX IF NOT EXISTS`; `CREATE TYPE` guardado por `pg_type`; FKs guardadas por `pg_constraint`. Depois `pnpm prisma:generate`. Sync real em prod é `db push`.
- Operações compostas em transação (IA + baixa de dose; import): conflito estrutural aborta tudo (padrão `EventoError("CONFLITO", …)` / `ConflitoLactacaoError`).
- Commits terminam com `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- **Fonte de dados = parser + fixture agora, reconciliar depois.** Sem seed-semente inventado; a biblioteca opera com o que o usuário cadastrar até a reextração do `DADOS777.FDB`. A reconciliação 67/271/20/15/3 é pendência da máquina, registrada em `docs/reproducao-teste-na-maquina-ideagri.md`.
- **Fora de escopo (não fazer neste bloco):** migrar `acasalamento`/`recomendar` para indicadores+pedigree (Bloco D); coleta FIV/TE (Bloco E); relatórios e reconciliação final (Bloco F); import real do `DADOS777.FDB`.

## File Structure

**Schema/migration (Task 1)**
- Modify `server/prisma/schema.prisma` — 8 models novos + `Reprodutor.ideagriId` + `EventoReprodutivo.estoqueSemenId Int?`/`estoqueSemenDoseBaixada Boolean` + inversos em `Reprodutor`/`Propriedade`.
- Create `server/prisma/migrations/20260727120000_genetica_semen/migration.sql`.

**Cálculo puro (Tasks 2–4, TDD)**
- Create `server/src/services/rebanho/semen-baixa.calc.ts` (+ `.test.ts`) — baixa/devolução de dose.
- Create `server/src/services/rebanho/genetica-espelho.calc.ts` (+ `.test.ts`) — projeção de colunas legadas.
- Create `server/src/services/rebanho/ranking-reprodutor.calc.ts` (+ `.test.ts`) — ranking configurável por indicador.

**Services + rotas (Tasks 5–7)**
- Create `server/src/services/rebanho/genetica.ts` (+ `.schemas.ts`, + `.test.ts`) e `server/src/routes/rebanho/genetica.ts`.
- Create `server/src/services/rebanho/semen.ts` (+ `.schemas.ts`, + `.test.ts`) e `server/src/routes/rebanho/semen.ts`.
- Modify `server/src/services/rebanho/eventos.ts` (+ `.schemas.ts`) — IA aceita `estoqueSemenId?`; baixa transacional; estorno devolve.
- Modify `server/src/services/rebanho/iatf.ts` — etapa terminal com lote aplica a mesma baixa (cobre `iatf.ts` e `iatf-lote.ts` via `atualizarExecucaoNaTransacao`).
- Modify `server/src/index.ts` — montar `geneticaRouter`, `semenRouter`.

**Import/parsers (Tasks 8–9)**
- Modify `scripts/build-rebanho-json.mjs` (+ `scripts/build-rebanho-json.test.mjs`) — parsers dos blocos genéticos/sêmen.
- Create `server/src/services/rebanho/import-genetica.ts` (+ `.test.ts`); Modify `server/prisma/import-rebanho.ts`.

**UI (Tasks 10–11)**
- Modify `client/src/rebanho/api.ts` — DTOs + fetchers.
- Create `client/src/rebanho/components/IndicadoresGeneticosSection.tsx` (CRUD do catálogo, montado no `CadastrosView`).
- Modify `client/src/rebanho/components/ReprodutoresSection.tsx` — ficha com valores/marcadores/caseína/pedigree + ranking configurável + estoque de sêmen.
- Modify `client/src/rebanho/components/EventoForm.tsx` (+ `EventoForm.payload.ts`/`.test.ts`) — seletor opcional de lote na IA.

**Doc/gate (Task 12)**
- Modify `docs/reproducao-teste-na-maquina-ideagri.md` — contrato dos novos prefixos + reconciliação 67/271/20/15/3.

---

### Task 1: Schema — genética, sêmen e vínculo de dose no evento

**Files:**
- Modify: `server/prisma/schema.prisma`
- Create: `server/prisma/migrations/20260727120000_genetica_semen/migration.sql`

**Interfaces:**
- Produces: models `IndicadorGenetico`, `ValorIndicadorReprodutor`, `MarcadorGenetico`, `ValorMarcadorReprodutor`, `Caseina`, `ValorCaseinaReprodutor`, `PedigreeReprodutor`, `TipoSemen`, `EstoqueSemen`; `Reprodutor.ideagriId Int? @unique` (identidade de origem p/ o import resolver o touro); `EventoReprodutivo.estoqueSemenId Int?` (FK `onDelete: SetNull`) + `EventoReprodutivo.estoqueSemenDoseBaixada Boolean @default(false)` (registra se a dose foi de fato consumida → estorno só devolve quando `true`); inversos em `Reprodutor` (`valoresIndicador`, `valoresMarcador`, `valoresCaseina`, `pedigree`, `estoquesSemen`) e `Propriedade` (`estoquesSemen`).

- [ ] **Step 1: Adicionar `ideagriId` e os inversos em `Reprodutor`**

Em `model Reprodutor { … }` (mantendo as colunas legadas `ptaLeite/ptaGordura/ptaProteina/tpi` intactas), acrescentar:
```prisma
  ideagriId        Int?                       @unique
  valoresIndicador ValorIndicadorReprodutor[]
  valoresMarcador  ValorMarcadorReprodutor[]
  valoresCaseina   ValorCaseinaReprodutor[]
  pedigree         PedigreeReprodutor?
  estoquesSemen    EstoqueSemen[]
```
Em `model Propriedade { … }` acrescentar o inverso `estoquesSemen EstoqueSemen[]`.
Em `model EventoReprodutivo { … }` acrescentar (perto de `origemExecucaoId`):
```prisma
  // IA: lote de sêmen consumido (baixa opcional-com-aviso). Nullable — IA por texto livre não referencia lote.
  estoqueSemen             EstoqueSemen? @relation(fields: [estoqueSemenId], references: [id], onDelete: SetNull)
  estoqueSemenId           Int?
  // true só quando a baixa efetivamente decrementou o estoque (saldo ≥ 1). Estorno devolve a dose sse true.
  estoqueSemenDoseBaixada  Boolean       @default(false)
```

- [ ] **Step 2: Adicionar os models novos**

Após `model Reprodutor`:
```prisma
// Catálogo genético flexível (GENCATALOGOINDICADOR do IDEAGRI, 271). Compartilhado entre
// propriedades. `colunaLegada` espelha siglas conhecidas nas colunas PTA de Reprodutor (retrocompat).
model IndicadorGenetico {
  id           Int                        @id @default(autoincrement())
  ideagriId    Int?                       @unique
  sigla        String                     @unique
  nome         String
  unidade      String?
  direcao      String                     @default("maior_melhor") // maior_melhor | menor_melhor
  colunaLegada String? // ptaLeite | ptaGordura | ptaProteina | tpi | null
  ranking      Boolean                    @default(false)
  ativo        Boolean                    @default(true)
  valores      ValorIndicadorReprodutor[]
  createdAt    DateTime                   @default(now())
  updatedAt    DateTime                   @updatedAt
}

model ValorIndicadorReprodutor {
  id           Int               @id @default(autoincrement())
  reprodutor   Reprodutor        @relation(fields: [reprodutorId], references: [id], onDelete: Cascade)
  reprodutorId Int
  indicador    IndicadorGenetico @relation(fields: [indicadorId], references: [id], onDelete: Cascade)
  indicadorId  Int
  valor        Decimal           @db.Decimal(12, 3)

  @@unique([reprodutorId, indicadorId])
  @@index([indicadorId])
}

// Dicionário de marcadores genéticos (20). Compartilhado. Resultado por touro é texto (ex.: TT/TC/CC).
model MarcadorGenetico {
  id        Int                       @id @default(autoincrement())
  ideagriId Int?                      @unique
  sigla     String                    @unique
  nome      String
  valores   ValorMarcadorReprodutor[]
}

model ValorMarcadorReprodutor {
  id           Int              @id @default(autoincrement())
  reprodutor   Reprodutor       @relation(fields: [reprodutorId], references: [id], onDelete: Cascade)
  reprodutorId Int
  marcador     MarcadorGenetico @relation(fields: [marcadorId], references: [id], onDelete: Cascade)
  marcadorId   Int
  resultado    String

  @@unique([reprodutorId, marcadorId])
  @@index([marcadorId])
}

// Dicionário de variantes de caseína (15). Compartilhado. Genótipo por touro é texto (ex.: A2A2).
model Caseina {
  id        Int                      @id @default(autoincrement())
  ideagriId Int?                     @unique
  sigla     String                   @unique
  nome      String
  valores   ValorCaseinaReprodutor[]
}

model ValorCaseinaReprodutor {
  id           Int        @id @default(autoincrement())
  reprodutor   Reprodutor @relation(fields: [reprodutorId], references: [id], onDelete: Cascade)
  reprodutorId Int
  caseina      Caseina    @relation(fields: [caseinaId], references: [id], onDelete: Cascade)
  caseinaId    Int
  genotipo     String

  @@unique([reprodutorId, caseinaId])
  @@index([caseinaId])
}

// Pedigree do reprodutor (1:1). Genealogia textual (pai/mãe/avós), sem FK a Animal.
model PedigreeReprodutor {
  id               Int        @id @default(autoincrement())
  reprodutor       Reprodutor @relation(fields: [reprodutorId], references: [id], onDelete: Cascade)
  reprodutorId     Int        @unique
  ideagriId        Int?       @unique
  paiNome          String?
  paiCodigo        String?
  maeNome          String?
  maeCodigo        String?
  avoMaternoNome   String?
  avoMaternoCodigo String?
  avoPaternoNome   String?
  avoPaternoCodigo String?
}

// Dicionário de tipos de sêmen (3: convencional/sexado/etc.). Compartilhado.
model TipoSemen {
  id        Int            @id @default(autoincrement())
  ideagriId Int?           @unique
  sigla     String         @unique
  nome      String
  estoques  EstoqueSemen[]
}

// Estoque de doses de sêmen por reprodutor (fato de sítio). `dosesDisponiveis` nunca fica negativo.
model EstoqueSemen {
  id               Int                 @id @default(autoincrement())
  reprodutor       Reprodutor          @relation(fields: [reprodutorId], references: [id], onDelete: Cascade)
  reprodutorId     Int
  tipoSemen        TipoSemen?          @relation(fields: [tipoSemenId], references: [id])
  tipoSemenId      Int?
  lote             String?
  localizacao      String?
  dosesDisponiveis Int                 @default(0)
  ideagriId        Int?                @unique
  propriedade      Propriedade?        @relation(fields: [propriedadeId], references: [id])
  propriedadeId    Int?
  eventos          EventoReprodutivo[]
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt

  @@index([reprodutorId])
  @@index([propriedadeId])
}
```

- [ ] **Step 3: Criar a migration aditiva idempotente**

`server/prisma/migrations/20260727120000_genetica_semen/migration.sql` — 8 `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE "Reprodutor" ADD COLUMN IF NOT EXISTS "ideagriId" INTEGER;` (+ unique index), `ALTER TABLE "EventoReprodutivo" ADD COLUMN IF NOT EXISTS "estoqueSemenId" INTEGER, ADD COLUMN IF NOT EXISTS "estoqueSemenDoseBaixada" BOOLEAN NOT NULL DEFAULT false;`, os índices `IF NOT EXISTS` (unique de cada `ideagriId`/`sigla`, os `@@unique` compostos e os `@@index`) e todas as FKs guardadas por `pg_constraint` (mesmo estilo de `20260726140000_ciclo_reprodutivo/migration.sql`). Exemplo de tabela + coluna + FK guardada:
```sql
CREATE TABLE IF NOT EXISTS "IndicadorGenetico" (
  "id" SERIAL NOT NULL,
  "ideagriId" INTEGER,
  "sigla" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "unidade" TEXT,
  "direcao" TEXT NOT NULL DEFAULT 'maior_melhor',
  "colunaLegada" TEXT,
  "ranking" BOOLEAN NOT NULL DEFAULT false,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IndicadorGenetico_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "IndicadorGenetico_ideagriId_key" ON "IndicadorGenetico"("ideagriId");
CREATE UNIQUE INDEX IF NOT EXISTS "IndicadorGenetico_sigla_key" ON "IndicadorGenetico"("sigla");
CREATE UNIQUE INDEX IF NOT EXISTS "ValorIndicadorReprodutor_reprodutorId_indicadorId_key" ON "ValorIndicadorReprodutor"("reprodutorId", "indicadorId");
CREATE INDEX IF NOT EXISTS "ValorIndicadorReprodutor_indicadorId_idx" ON "ValorIndicadorReprodutor"("indicadorId");

ALTER TABLE "Reprodutor" ADD COLUMN IF NOT EXISTS "ideagriId" INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS "Reprodutor_ideagriId_key" ON "Reprodutor"("ideagriId");
ALTER TABLE "EventoReprodutivo"
  ADD COLUMN IF NOT EXISTS "estoqueSemenId" INTEGER,
  ADD COLUMN IF NOT EXISTS "estoqueSemenDoseBaixada" BOOLEAN NOT NULL DEFAULT false;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventoReprodutivo_estoqueSemenId_fkey') THEN
    ALTER TABLE "EventoReprodutivo" ADD CONSTRAINT "EventoReprodutivo_estoqueSemenId_fkey"
      FOREIGN KEY ("estoqueSemenId") REFERENCES "EstoqueSemen"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
```
(Repetir tabela/índices/FK para `ValorIndicadorReprodutor`, `MarcadorGenetico`, `ValorMarcadorReprodutor`, `Caseina`, `ValorCaseinaReprodutor`, `PedigreeReprodutor`, `TipoSemen`, `EstoqueSemen`, com `onDelete: Cascade` nas relações a `Reprodutor`/dicionário e `SET NULL` em `EstoqueSemen.tipoSemenId`/`EstoqueSemen.propriedadeId`.)

- [ ] **Step 4: Gerar o Prisma Client**

Run: `pnpm prisma:generate`
Expected: `Generated Prisma Client`.

- [ ] **Step 5: Commit**
```bash
git add server/prisma/schema.prisma server/prisma/migrations/20260727120000_genetica_semen/
git commit -m "$(printf 'feat(rebanho): schema de genética estruturada e estoque de sêmen\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>')"
```

---

### Task 2: Cálculo puro — baixa/devolução de dose de sêmen (TDD)

**Files:**
- Create: `server/src/services/rebanho/semen-baixa.calc.ts`
- Test: `server/src/services/rebanho/semen-baixa.calc.test.ts`

**Interfaces:**
- Produces:
```ts
export interface PlanoBaixaDose { consumir: boolean; novoSaldo: number; aviso: string | null }
export function planejarBaixaDose(input: { estoqueSemenId: number | null | undefined; dosesDisponiveis: number }): PlanoBaixaDose;
export function planejarDevolucaoDose(input: { doseBaixada: boolean; dosesDisponiveis: number }): { devolver: boolean; novoSaldo: number };
```

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { planejarBaixaDose, planejarDevolucaoDose } from "./semen-baixa.calc.js";

describe("planejarBaixaDose", () => {
  it("sem lote → não consome nem avisa", () => {
    expect(planejarBaixaDose({ estoqueSemenId: null, dosesDisponiveis: 5 }))
      .toEqual({ consumir: false, novoSaldo: 5, aviso: null });
  });
  it("com lote e saldo ≥ 1 → decrementa 1, sem aviso", () => {
    expect(planejarBaixaDose({ estoqueSemenId: 7, dosesDisponiveis: 3 }))
      .toEqual({ consumir: true, novoSaldo: 2, aviso: null });
  });
  it("com lote e saldo 0 → registra sem consumir e avisa (nunca negativo)", () => {
    const r = planejarBaixaDose({ estoqueSemenId: 7, dosesDisponiveis: 0 });
    expect(r.consumir).toBe(false);
    expect(r.novoSaldo).toBe(0);
    expect(r.aviso).toMatch(/estoque zerado/i);
  });
});

describe("planejarDevolucaoDose", () => {
  it("dose não baixada → não devolve", () => {
    expect(planejarDevolucaoDose({ doseBaixada: false, dosesDisponiveis: 4 }))
      .toEqual({ devolver: false, novoSaldo: 4 });
  });
  it("dose baixada → +1", () => {
    expect(planejarDevolucaoDose({ doseBaixada: true, dosesDisponiveis: 2 }))
      .toEqual({ devolver: true, novoSaldo: 3 });
  });
});
```

- [ ] **Step 2: Rodar e confirmar RED**

Run: `pnpm --filter rionovo-server exec vitest run src/services/rebanho/semen-baixa.calc.test.ts`
Expected: FAIL por módulo inexistente.

- [ ] **Step 3: Implementar o cálculo mínimo**

```ts
export interface PlanoBaixaDose { consumir: boolean; novoSaldo: number; aviso: string | null }

// Baixa opcional-com-aviso: sem lote não consome; com lote e saldo ≥ 1 tira uma dose;
// com lote e saldo 0 registra o vínculo mesmo assim e avisa — o saldo nunca fica negativo.
export function planejarBaixaDose(input: {
  estoqueSemenId: number | null | undefined;
  dosesDisponiveis: number;
}): PlanoBaixaDose {
  if (input.estoqueSemenId == null) return { consumir: false, novoSaldo: input.dosesDisponiveis, aviso: null };
  if (input.dosesDisponiveis <= 0) {
    return { consumir: false, novoSaldo: 0, aviso: "estoque zerado: dose registrada sem baixa" };
  }
  return { consumir: true, novoSaldo: input.dosesDisponiveis - 1, aviso: null };
}

// Inverso da baixa (estorno/exclusão da IA): só devolve quando a dose foi de fato consumida.
export function planejarDevolucaoDose(input: {
  doseBaixada: boolean;
  dosesDisponiveis: number;
}): { devolver: boolean; novoSaldo: number } {
  if (!input.doseBaixada) return { devolver: false, novoSaldo: input.dosesDisponiveis };
  return { devolver: true, novoSaldo: input.dosesDisponiveis + 1 };
}
```

- [ ] **Step 4: Rodar e confirmar GREEN**

Run: `pnpm --filter rionovo-server exec vitest run src/services/rebanho/semen-baixa.calc.test.ts`
Expected: 5 testes PASS.

- [ ] **Step 5: Commit**
```bash
git add server/src/services/rebanho/semen-baixa.calc.ts server/src/services/rebanho/semen-baixa.calc.test.ts
git commit -m "$(printf 'feat(rebanho): cálculo puro da baixa opcional-com-aviso de dose de sêmen\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>')"
```

---

### Task 3: Cálculo puro — espelho de colunas legadas (TDD)

**Files:**
- Create: `server/src/services/rebanho/genetica-espelho.calc.ts`
- Test: `server/src/services/rebanho/genetica-espelho.calc.test.ts`

**Interfaces:**
- Produces:
```ts
export type ColunaLegada = "ptaLeite" | "ptaGordura" | "ptaProteina" | "tpi";
export interface ValorIndicadorEspelho { indicadorId: number; valor: number }
export interface IndicadorEspelho { id: number; colunaLegada: ColunaLegada | null }
export function projetarColunasLegadas(
  valores: readonly ValorIndicadorEspelho[],
  indicadoresPorId: ReadonlyMap<number, IndicadorEspelho>,
): Partial<Record<ColunaLegada, number>>;
```

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { projetarColunasLegadas, type IndicadorEspelho } from "./genetica-espelho.calc.js";

const cat = new Map<number, IndicadorEspelho>([
  [1, { id: 1, colunaLegada: "ptaLeite" }],
  [2, { id: 2, colunaLegada: "ptaGordura" }],
  [3, { id: 3, colunaLegada: "ptaProteina" }],
  [4, { id: 4, colunaLegada: "tpi" }],
  [5, { id: 5, colunaLegada: null }], // indicador sem coluna → ignorado
]);

describe("projetarColunasLegadas", () => {
  it("projeta cada coluna conhecida a partir do indicador com colunaLegada", () => {
    const proj = projetarColunasLegadas(
      [{ indicadorId: 1, valor: 900 }, { indicadorId: 2, valor: 42.5 }, { indicadorId: 3, valor: 30 }, { indicadorId: 4, valor: 2800 }],
      cat,
    );
    expect(proj).toEqual({ ptaLeite: 900, ptaGordura: 42.5, ptaProteina: 30, tpi: 2800 });
  });
  it("ignora indicador sem colunaLegada e indicador ausente do catálogo", () => {
    expect(projetarColunasLegadas([{ indicadorId: 5, valor: 99 }, { indicadorId: 99, valor: 1 }], cat)).toEqual({});
  });
});
```

- [ ] **Step 2: Rodar e confirmar RED**

Run: `pnpm --filter rionovo-server exec vitest run src/services/rebanho/genetica-espelho.calc.test.ts`
Expected: FAIL por módulo inexistente.

- [ ] **Step 3: Implementar o cálculo mínimo**

```ts
export type ColunaLegada = "ptaLeite" | "ptaGordura" | "ptaProteina" | "tpi";
export interface ValorIndicadorEspelho { indicadorId: number; valor: number }
export interface IndicadorEspelho { id: number; colunaLegada: ColunaLegada | null }

const COLUNAS: readonly ColunaLegada[] = ["ptaLeite", "ptaGordura", "ptaProteina", "tpi"];

// Projeta os valores de indicadores com `colunaLegada` de volta nas colunas PTA do Reprodutor,
// para manter reprodutor.calc/acasalamento.calc/UI de ranking atuais sem reescrita.
export function projetarColunasLegadas(
  valores: readonly ValorIndicadorEspelho[],
  indicadoresPorId: ReadonlyMap<number, IndicadorEspelho>,
): Partial<Record<ColunaLegada, number>> {
  const out: Partial<Record<ColunaLegada, number>> = {};
  for (const v of valores) {
    const ind = indicadoresPorId.get(v.indicadorId);
    const col = ind?.colunaLegada;
    if (col && COLUNAS.includes(col)) out[col] = v.valor;
  }
  return out;
}
```

- [ ] **Step 4: Rodar e confirmar GREEN**

Run: `pnpm --filter rionovo-server exec vitest run src/services/rebanho/genetica-espelho.calc.test.ts`
Expected: 2 testes PASS.

- [ ] **Step 5: Commit**
```bash
git add server/src/services/rebanho/genetica-espelho.calc.ts server/src/services/rebanho/genetica-espelho.calc.test.ts
git commit -m "$(printf 'feat(rebanho): espelho de indicadores genéticos nas colunas PTA legadas\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>')"
```

---

### Task 4: Cálculo puro — ranking configurável por indicador (TDD)

**Files:**
- Create: `server/src/services/rebanho/ranking-reprodutor.calc.ts`
- Test: `server/src/services/rebanho/ranking-reprodutor.calc.test.ts`

**Interfaces:**
- Produces:
```ts
export type DirecaoRanking = "maior_melhor" | "menor_melhor";
export interface ReprodutorRankItem { id: number; valorIndicador: number | null }
export function ranquearPorIndicador<T extends ReprodutorRankItem>(reprodutores: readonly T[], direcao: DirecaoRanking): T[];
```
(A leitura do valor do indicador escolhido e o *default* — que delega a `resumoIndices` de `reprodutor.calc.ts` — vivem no service da Task 5; aqui só o ordenamento puro dado o valor já resolvido por reprodutor.)

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { ranquearPorIndicador } from "./ranking-reprodutor.calc.js";

const rep = (id: number, valorIndicador: number | null) => ({ id, valorIndicador });

describe("ranquearPorIndicador", () => {
  it("maior_melhor ordena desc e joga ausentes para o fim", () => {
    expect(ranquearPorIndicador([rep(1, 10), rep(2, null), rep(3, 30)], "maior_melhor").map((r) => r.id))
      .toEqual([3, 1, 2]);
  });
  it("menor_melhor ordena asc e joga ausentes para o fim", () => {
    expect(ranquearPorIndicador([rep(1, 10), rep(2, null), rep(3, 30)], "menor_melhor").map((r) => r.id))
      .toEqual([1, 3, 2]);
  });
  it("desempata por id quando os valores empatam", () => {
    expect(ranquearPorIndicador([rep(5, 10), rep(2, 10)], "maior_melhor").map((r) => r.id)).toEqual([2, 5]);
  });
});
```

- [ ] **Step 2: Rodar e confirmar RED**

Run: `pnpm --filter rionovo-server exec vitest run src/services/rebanho/ranking-reprodutor.calc.test.ts`
Expected: FAIL por módulo inexistente.

- [ ] **Step 3: Implementar o cálculo mínimo**

```ts
export type DirecaoRanking = "maior_melhor" | "menor_melhor";
export interface ReprodutorRankItem { id: number; valorIndicador: number | null }

// Ordena reprodutores pelo valor de um indicador. Ausentes (null) vão sempre ao fim;
// empate desempata por id crescente (estável e determinístico).
export function ranquearPorIndicador<T extends ReprodutorRankItem>(
  reprodutores: readonly T[],
  direcao: DirecaoRanking,
): T[] {
  const sinal = direcao === "menor_melhor" ? -1 : 1;
  return [...reprodutores].sort((a, b) => {
    if (a.valorIndicador == null && b.valorIndicador == null) return a.id - b.id;
    if (a.valorIndicador == null) return 1;
    if (b.valorIndicador == null) return -1;
    if (a.valorIndicador !== b.valorIndicador) return (b.valorIndicador - a.valorIndicador) * sinal;
    return a.id - b.id;
  });
}
```

- [ ] **Step 4: Rodar e confirmar GREEN**

Run: `pnpm --filter rionovo-server exec vitest run src/services/rebanho/ranking-reprodutor.calc.test.ts`
Expected: 3 testes PASS.

- [ ] **Step 5: Commit**
```bash
git add server/src/services/rebanho/ranking-reprodutor.calc.ts server/src/services/rebanho/ranking-reprodutor.calc.test.ts
git commit -m "$(printf 'feat(rebanho): ranking configurável de reprodutores por indicador\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>')"
```

---

### Task 5: Service + rota — catálogo genético e ficha do reprodutor

**Files:**
- Create: `server/src/services/rebanho/genetica.schemas.ts`
- Create: `server/src/services/rebanho/genetica.ts`
- Create: `server/src/services/rebanho/genetica.test.ts`
- Create: `server/src/routes/rebanho/genetica.ts`
- Modify: `server/src/index.ts` (montar `geneticaRouter`)

**Interfaces:**
- Consumes: `projetarColunasLegadas` (Task 3), `ranquearPorIndicador` (Task 4), `resumoIndices` + `ReprodutorIndices` (`reprodutor.calc.ts`), helper `catalogoNoEscopo` (copiar de `reprodutores.ts`).
- Produces:
```ts
export class GeneticaError extends Error { constructor(public code: "NAO_ENCONTRADO" | "CONFLITO", message: string) }
// Dicionários compartilhados:
export interface IndicadorDTO { id: number; sigla: string; nome: string; unidade: string | null; direcao: "maior_melhor" | "menor_melhor"; colunaLegada: string | null; ranking: boolean; ativo: boolean }
export function listarIndicadores(): Promise<IndicadorDTO[]>;
export function criarIndicador(input: CriarIndicadorInput): Promise<IndicadorDTO>;
export function atualizarIndicador(id: number, input: AtualizarIndicadorInput): Promise<IndicadorDTO>;
export function excluirIndicador(id: number): Promise<void>;   // inativa se em uso
export function listarMarcadores(): Promise<{ id: number; sigla: string; nome: string }[]>;
export function criarMarcador(input: { sigla: string; nome: string }): Promise<{ id: number; sigla: string; nome: string }>;
export function listarCaseinas(): Promise<{ id: number; sigla: string; nome: string }[]>;
export function criarCaseina(input: { sigla: string; nome: string }): Promise<{ id: number; sigla: string; nome: string }>;
// Ficha por reprodutor (escopo de sítio via reprodutor):
export interface PedigreeDTO { paiNome: string | null; paiCodigo: string | null; maeNome: string | null; maeCodigo: string | null; avoMaternoNome: string | null; avoMaternoCodigo: string | null; avoPaternoNome: string | null; avoPaternoCodigo: string | null }
export interface FichaGeneticaDTO { valoresIndicador: { indicadorId: number; valor: number }[]; valoresMarcador: { marcadorId: number; resultado: string }[]; valoresCaseina: { caseinaId: number; genotipo: string }[]; pedigree: PedigreeDTO | null }
export function obterFichaGenetica(reprodutorId: number, propriedadeId: number | null): Promise<FichaGeneticaDTO>;
export function salvarFichaGenetica(reprodutorId: number, input: SalvarFichaInput, propriedadeId: number | null): Promise<FichaGeneticaDTO>;
// Ranking configurável:
export function rankingReprodutores(indicadorId: number | null, propriedadeId: number | null): Promise<{ ordem: number[]; indicadorId: number | null }>;
```
- Rotas (finas, escopo resolvido no handler):
  - `GET/POST /api/rebanho/genetica/indicadores`, `PATCH/DELETE /api/rebanho/genetica/indicadores/:id`
  - `GET/POST /api/rebanho/genetica/marcadores`, `GET/POST /api/rebanho/genetica/caseinas`
  - `GET /api/rebanho/reprodutores/:id/genetica`, `PUT /api/rebanho/reprodutores/:id/genetica`
  - `GET /api/rebanho/reprodutores/ranking?indicadorId=`

- [ ] **Step 1: Escrever os schemas**

`genetica.schemas.ts`: `criarIndicadorSchema` (`sigla` `.min(1).max(40)`, `nome` `.min(1).max(120)`, `unidade` nullable optional, `direcao: z.enum(["maior_melhor","menor_melhor"]).optional()`, `colunaLegada: z.enum(["ptaLeite","ptaGordura","ptaProteina","tpi"]).nullable().optional()`, `ranking?`, `ativo?`), `atualizarIndicadorSchema = criarIndicadorSchema.partial()`, `criarDicionarioSchema` (`sigla`, `nome`), `salvarFichaSchema` (`valoresIndicador: z.array(z.object({ indicadorId: int().positive(), valor: number() }))`, `valoresMarcador`, `valoresCaseina`, `pedigree?`). Exportar os `type` inferidos.

- [ ] **Step 2: Escrever os testes de service (RED)**

`genetica.test.ts` (mock Prisma no estilo `import-iatf.test.ts`):
  - `salvarFichaGenetica` grava os N:N e, ao gravar um `ValorIndicadorReprodutor` de indicador com `colunaLegada`, **espelha** a coluna em `Reprodutor` na mesma transação (asserta `reprodutor.update` com `{ ptaLeite: … }` via `projetarColunasLegadas`).
  - `obterFichaGenetica` de reprodutor de outro sítio → `GeneticaError("NAO_ENCONTRADO")`.
  - `criarIndicador` duplicando `sigla` → mapeia erro Prisma P2002 para `GeneticaError("CONFLITO")`.
  - `rankingReprodutores(null, …)` retorna a ordem do `resumoIndices` atual (default); com `indicadorId` usa `ranquearPorIndicador` + `direcao` do indicador.

Run: `pnpm --filter rionovo-server exec vitest run src/services/rebanho/genetica.test.ts`
Expected: FAIL por service inexistente.

- [ ] **Step 3: Implementar o service (GREEN)**

- Dicionários compartilhados: `findMany`/`create`/`update` sem `propriedadeId`; `excluirIndicador` **inativa** quando há `ValorIndicadorReprodutor` referenciando (preserva histórico), senão deleta. `try/catch` de `P2002` → `GeneticaError("CONFLITO", "sigla já cadastrada")`.
- `obterFichaGenetica`/`salvarFichaGenetica`: valida reprodutor no escopo (`reprodutor.findFirst` com `{ id, ...catalogoNoEscopo(propriedadeId) }`), senão `NAO_ENCONTRADO`. Em `prisma.$transaction`: `deleteMany` + `createMany` dos três N:N; carregar o catálogo de indicadores (`Map<id, { id, colunaLegada }>`), chamar `projetarColunasLegadas`, e `reprodutor.update` com as colunas projetadas + `pedigreeReprodutor.upsert`.
- `rankingReprodutores`: sem `indicadorId`, monta `ReprodutorIndices[]` e retorna a ordem de `resumoIndices`/melhor-por (mantém o comportamento atual); com `indicadorId`, resolve `valorIndicador` por reprodutor (via `valoresIndicador`) e chama `ranquearPorIndicador` com a `direcao` do indicador.

Run: `pnpm --filter rionovo-server exec vitest run src/services/rebanho/genetica.test.ts`
Expected: PASS.

- [ ] **Step 4: Rota + mount + typecheck**

`routes/rebanho/genetica.ts` no estilo `reprodutores.ts` (`fail(e)` mapeando `GeneticaError` → 404/409). Montar em `server/src/index.ts` (`import { geneticaRouter } … app.route("/api", geneticaRouter);` junto de `reprodutoresRouter`).

Run: `pnpm --filter rionovo-server exec tsc -p tsconfig.json --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit**
```bash
git add server/src/services/rebanho/genetica.ts server/src/services/rebanho/genetica.schemas.ts server/src/services/rebanho/genetica.test.ts server/src/routes/rebanho/genetica.ts server/src/index.ts
git commit -m "$(printf 'feat(rebanho): catálogo genético gerenciável e ficha do reprodutor com espelho legado\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>')"
```

---

### Task 6: Service + rota — estoque de sêmen e tipos de sêmen

**Files:**
- Create: `server/src/services/rebanho/semen.schemas.ts`
- Create: `server/src/services/rebanho/semen.ts`
- Create: `server/src/services/rebanho/semen.test.ts`
- Create: `server/src/routes/rebanho/semen.ts`
- Modify: `server/src/index.ts` (montar `semenRouter`)

**Interfaces:**
- Produces:
```ts
export class SemenError extends Error { constructor(public code: "NAO_ENCONTRADO" | "CONFLITO", message: string) }
export interface TipoSemenDTO { id: number; sigla: string; nome: string }
export function listarTiposSemen(): Promise<TipoSemenDTO[]>;              // dicionário compartilhado
export function criarTipoSemen(input: { sigla: string; nome: string }): Promise<TipoSemenDTO>;
export interface EstoqueSemenDTO { id: number; reprodutorId: number; tipoSemenId: number | null; tipoSemenNome: string | null; lote: string | null; localizacao: string | null; dosesDisponiveis: number }
export function listarEstoqueSemen(reprodutorId: number, propriedadeId: number | null): Promise<EstoqueSemenDTO[]>;
export function criarLoteSemen(reprodutorId: number, input: CriarLoteInput, propriedadeId: number | null): Promise<EstoqueSemenDTO>;
export function ajustarDoses(estoqueSemenId: number, input: { delta: number }, propriedadeId: number | null): Promise<EstoqueSemenDTO>; // saldo nunca negativo
```
- Rotas: `GET/POST /api/rebanho/semen/tipos`; `GET /api/rebanho/reprodutores/:id/semen`, `POST /api/rebanho/reprodutores/:id/semen`, `PATCH /api/rebanho/semen/:id/doses`.

- [ ] **Step 1: Schemas** — `criarLoteSchema` (`tipoSemenId?` int positive nullable, `lote?`, `localizacao?`, `dosesDisponiveis: z.number().int().min(0)`), `ajustarDosesSchema` (`delta: z.number().int()`), `criarTipoSemenSchema` (`sigla`, `nome`).

- [ ] **Step 2: Testes de service (RED)** — `criarLoteSemen`/`listarEstoqueSemen` recusam reprodutor de outro sítio → `NAO_ENCONTRADO`; `ajustarDoses` com `delta` que levaria a negativo trava em 0 (asserta `update` com `dosesDisponiveis: 0`); lote nasce com `propriedadeId` do escopo; `ajustarDoses` recusa estoque de outro sítio.

Run: `pnpm --filter rionovo-server exec vitest run src/services/rebanho/semen.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar o service (GREEN)** — tipos compartilhados; estoque valida reprodutor no escopo (`reprodutor.findFirst` com `catalogoNoEscopo`) e grava `propriedadeId`; `listarEstoqueSemen`/`ajustarDoses` filtram por `{ reprodutor: { … } }`/`propriedadeId`; `ajustarDoses` faz `Math.max(0, saldo + delta)`.

Run: `pnpm --filter rionovo-server exec vitest run src/services/rebanho/semen.test.ts`
Expected: PASS.

- [ ] **Step 4: Rota + mount + typecheck** — `routes/rebanho/semen.ts` (padrão `fail`), montar `semenRouter` em `index.ts`.

Run: `pnpm --filter rionovo-server exec tsc -p tsconfig.json --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit**
```bash
git add server/src/services/rebanho/semen.ts server/src/services/rebanho/semen.schemas.ts server/src/services/rebanho/semen.test.ts server/src/routes/rebanho/semen.ts server/src/index.ts
git commit -m "$(printf 'feat(rebanho): estoque de sêmen por reprodutor e tipos de sêmen\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>')"
```

---

### Task 7: Baixa de dose transacional na IA (evento + IATF terminal) (TDD)

**Files:**
- Modify: `server/src/services/rebanho/eventos.schemas.ts` — `INSEMINACAO` aceita `estoqueSemenId?`
- Modify: `server/src/services/rebanho/eventos.ts` — baixa na criação, devolução na exclusão
- Create: `server/src/services/rebanho/eventos.semen.test.ts`
- Modify: `server/src/services/rebanho/iatf.schemas.ts` — `executarEtapaSchema` aceita `estoqueSemenId?`
- Modify: `server/src/services/rebanho/iatf.ts` — `atualizarExecucaoNaTransacao` aplica a mesma baixa (cobre `iatf.ts` e `iatf-lote.ts`)
- Create: `server/src/services/rebanho/iatf.semen.test.ts`

**Interfaces:**
- Consumes: `planejarBaixaDose`/`planejarDevolucaoDose` (Task 2), `EstoqueSemen` model + `EventoReprodutivo.estoqueSemenId`/`estoqueSemenDoseBaixada` (Task 1).
- Produces: `registrarEvento` grava `estoqueSemenId` + `estoqueSemenDoseBaixada` e decrementa doses na transação quando `consumir`; `excluirEvento` devolve a dose apenas se `estoqueSemenDoseBaixada`; `atualizarExecucaoNaTransacao` aplica a mesma baixa quando a execução informar `estoqueSemenId`. O `aviso` (estoque zerado) é devolvido pelo service e propagado à rota como campo opcional na resposta.

- [ ] **Step 1: Schemas — `estoqueSemenId?` na IA e na execução IATF**

`eventos.schemas.ts`, membro `INSEMINACAO` do `discriminatedUnion`: adicionar `estoqueSemenId: z.number().int().positive().optional()`. `iatf.schemas.ts`, `executarEtapaSchema`: adicionar `estoqueSemenId: z.number().int().positive().optional()`.

- [ ] **Step 2: Testes RED (eventos)**

`eventos.semen.test.ts` (mock Prisma/`$transaction`):
  - IA com `estoqueSemenId` e saldo ≥ 1 → cria evento com `estoqueSemenId` + `estoqueSemenDoseBaixada: true` e `estoqueSemen.update({ dosesDisponiveis: saldo-1 })`.
  - IA com `estoqueSemenId` e saldo 0 → cria evento com o vínculo + `estoqueSemenDoseBaixada: false`, **sem** update de doses, e a resposta traz `aviso`.
  - `estoqueSemenId` de outro sítio → `NAO_ENCONTRADO` (nada gravado).
  - `excluirEvento` de IA com `estoqueSemenDoseBaixada: true` → `estoqueSemen.update({ dosesDisponiveis: saldo+1 })`; com `false` → sem update.

Run: `pnpm --filter rionovo-server exec vitest run src/services/rebanho/eventos.semen.test.ts`
Expected: FAIL.

- [ ] **Step 3: GREEN (eventos.ts)**

Em `registrarEvento`: quando `input.tipo === "INSEMINACAO"` e `estoqueSemenId != null`, buscar o lote no escopo (`estoqueSemen.findFirst` via `reprodutor`/`propriedadeId`) → `NAO_ENCONTRADO` se ausente; dentro da `$transaction`, `planejarBaixaDose`, gravar `estoqueSemenId` + `estoqueSemenDoseBaixada = plano.consumir` no evento e `estoqueSemen.update` quando `consumir`. Guardar `aviso` para o retorno. Em `excluirEvento`: se o evento tinha `estoqueSemenId`, `planejarDevolucaoDose({ doseBaixada: e.estoqueSemenDoseBaixada, … })` + `estoqueSemen.update` na transação da exclusão.

Run: `pnpm --filter rionovo-server exec vitest run src/services/rebanho/eventos.semen.test.ts`
Expected: PASS.

- [ ] **Step 4: IATF terminal — mesma baixa (RED→GREEN)**

`iatf.semen.test.ts`: concluir a etapa terminal de um protocolo IATF informando `estoqueSemenId` decrementa a dose e grava `estoqueSemenId` + `estoqueSemenDoseBaixada` no evento `INSEMINACAO` upsertado; reabrir/pular a etapa devolve a dose (quando havia baixado). Implementar em `atualizarExecucaoNaTransacao` reaproveitando `planejarBaixaDose`/`planejarDevolucaoDose` no ramo terminal — sem quebrar a idempotência do `upsert` por `origemExecucaoId`.

Run: `pnpm --filter rionovo-server exec vitest run src/services/rebanho/iatf.semen.test.ts src/services/rebanho/iatf.idempotente.test.ts`
Expected: PASS (idempotência preservada).

- [ ] **Step 5: Commit**
```bash
git add server/src/services/rebanho/eventos.ts server/src/services/rebanho/eventos.schemas.ts server/src/services/rebanho/eventos.semen.test.ts server/src/services/rebanho/iatf.ts server/src/services/rebanho/iatf.schemas.ts server/src/services/rebanho/iatf.semen.test.ts
git commit -m "$(printf 'feat(rebanho): baixa opcional-com-aviso de dose na IA e IATF terminal, reversível no estorno\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>')"
```

---

### Task 8: Parsers do import genético/sêmen (fail-closed + fixture) (TDD)

**Files:**
- Modify: `scripts/build-rebanho-json.mjs`
- Test: `scripts/build-rebanho-json.test.mjs`

**Interfaces:**
- Produces parsers puros exportados (cada um: fixture válida + rejeição de linha inválida → `null` → `main()` aborta e reporta amostra). Delimitador `~|~`:
  - `parseReprodutorGenetico` (`@REPRODUTOR@`: ideagriId · nome · codigo · racaSigla · centralSigla) — identidade de origem do touro.
  - `parseIndicadorGenetico` (`@INDICADOR@`: ideagriId · sigla · nome · unidade · direcao · colunaLegada · ranking)
  - `parseValorIndicador` (`@VALORIND@`: reprodutorIdeagriId · indicadorSigla · valor)
  - `parseMarcador` (`@MARCADOR@`: ideagriId · sigla · nome) / `parseValorMarcador` (`@VALORMARC@`: reprodutorIdeagriId · marcadorSigla · resultado)
  - `parseCaseina` (`@CASEINA@`: ideagriId · sigla · nome) / `parseValorCaseina` (`@VALORCAS@`: reprodutorIdeagriId · caseinaSigla · genotipo)
  - `parseTipoSemen` (`@TIPOSEMEN@`: ideagriId · sigla · nome)
  - `parseEstoqueSemen` (`@ESTSEMEN@`: ideagriId · reprodutorIdeagriId · tipoSemenSigla · lote · localizacao · doses)
  - `parsePedigree` (`@PEDIGREE@`: reprodutorIdeagriId · paiNome · paiCodigo · maeNome · maeCodigo · avoMaternoNome · avoMaternoCodigo · avoPaternoNome · avoPaternoCodigo)

- [ ] **Step 1: Escrever os testes com fixtures sintéticas (RED)**

```js
test("parseIndicadorGenetico preserva identidade/direção/colunaLegada e rejeita sigla vazia/direção inválida", () => {
  assert.deepEqual(parseIndicadorGenetico("42~|~PTAL~|~PTA Leite~|~kg~|~maior_melhor~|~ptaLeite~|~1"), {
    ideagriId: 42, sigla: "PTAL", nome: "PTA Leite", unidade: "kg", direcao: "maior_melhor", colunaLegada: "ptaLeite", ranking: true,
  });
  assert.equal(parseIndicadorGenetico("42~|~~|~Sem sigla~|~~|~maior_melhor~|~~|~0"), null);
  assert.equal(parseIndicadorGenetico("42~|~X~|~Y~|~~|~torto~|~~|~0"), null);      // direção inválida
  assert.equal(parseIndicadorGenetico("42~|~X~|~Y~|~~|~maior_melhor~|~naoExiste~|~0"), null); // colunaLegada inválida
});
test("parseValorIndicador exige reprodutor/sigla e número", () => {
  assert.deepEqual(parseValorIndicador("100~|~PTAL~|~900.5"), { reprodutorIdeagriId: 100, indicadorSigla: "PTAL", valor: 900.5 });
  assert.equal(parseValorIndicador("100~|~PTAL~|~abc"), null);
  assert.equal(parseValorIndicador("~|~PTAL~|~9"), null);
});
test("parseEstoqueSemen preserva doses e rejeita reprodutor ausente", () => {
  assert.deepEqual(parseEstoqueSemen("7~|~100~|~SEX~|~L-22~|~Botijão 1~|~12"), {
    ideagriId: 7, reprodutorIdeagriId: 100, tipoSemenSigla: "SEX", lote: "L-22", localizacao: "Botijão 1", doses: 12,
  });
  assert.equal(parseEstoqueSemen("7~|~~|~SEX~|~L-22~|~~|~12"), null);
});
```
(Cobrir também `parseReprodutorGenetico`, `parseMarcador`/`parseValorMarcador`, `parseCaseina`/`parseValorCaseina`, `parseTipoSemen`, `parsePedigree`, cada um com uma fixture válida e uma rejeição.) Importar os novos parsers no topo de `build-rebanho-json.test.mjs`.

Run: `pnpm exec node --test scripts/build-rebanho-json.test.mjs`
Expected: FAIL por parsers inexistentes.

- [ ] **Step 2: Implementar os parsers (GREEN)**

Em `build-rebanho-json.mjs`, exportar os parsers acima (validam campos obrigatórios; `direcao` restrita a `maior_melhor|menor_melhor`; `colunaLegada` restrita a `ptaLeite|ptaGordura|ptaProteina|tpi|null`; números via `n()`; `null` quando inválido). No `main()`, adicionar os `else if (l.startsWith("@…@"))` que empurram para os arrays novos ou para uma lista `geneticaInvalidos`, e um bloco `if (geneticaInvalidos.length) { console.error(...); process.exit(1); }` (mesmo padrão de `resultadosGinecologicosInvalidos`). Emitir os novos arrays no objeto `out` e nas contagens do rodapé.

Run: `pnpm exec node --test scripts/build-rebanho-json.test.mjs`
Expected: todos PASS.

- [ ] **Step 3: Commit**
```bash
git add scripts/build-rebanho-json.mjs scripts/build-rebanho-json.test.mjs
git commit -m "$(printf 'feat(rebanho): parsers fail-closed dos blocos genéticos e de sêmen do IDEAGRI\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>')"
```

---

### Task 9: Importador idempotente da genética/sêmen (TDD)

**Files:**
- Create: `server/src/services/rebanho/import-genetica.ts`
- Test: `server/src/services/rebanho/import-genetica.test.ts`
- Modify: `server/prisma/import-rebanho.ts`

**Interfaces:**
- Consumes: os arrays do JSON (Task 8), `projetarColunasLegadas` (Task 3).
- Produces:
```ts
export interface DadosGeneticaLegado {
  reprodutoresGeneticos?: { ideagriId: number; nome: string; codigo: string | null; racaSigla: string | null; centralSigla: string | null }[];
  indicadores?: { ideagriId: number; sigla: string; nome: string; unidade: string | null; direcao: string; colunaLegada: string | null; ranking: boolean }[];
  valoresIndicador?: { reprodutorIdeagriId: number; indicadorSigla: string; valor: number }[];
  marcadores?: { ideagriId: number; sigla: string; nome: string }[];
  valoresMarcador?: { reprodutorIdeagriId: number; marcadorSigla: string; resultado: string }[];
  caseinas?: { ideagriId: number; sigla: string; nome: string }[];
  valoresCaseina?: { reprodutorIdeagriId: number; caseinaSigla: string; genotipo: string }[];
  tiposSemen?: { ideagriId: number; sigla: string; nome: string }[];
  estoquesSemen?: { ideagriId: number; reprodutorIdeagriId: number; tipoSemenSigla: string | null; lote: string | null; localizacao: string | null; doses: number }[];
  pedigrees?: { reprodutorIdeagriId: number; paiNome: string | null; paiCodigo: string | null; maeNome: string | null; maeCodigo: string | null; avoMaternoNome: string | null; avoMaternoCodigo: string | null; avoPaternoNome: string | null; avoPaternoCodigo: string | null }[];
}
export interface ResultadoImportGenetica { reprodutores: number; indicadores: number; valores: number; marcadores: number; caseinas: number; tiposSemen: number; estoques: number; pedigrees: number }
export function importarGeneticaLegado(db: DbGenetica, dados: DadosGeneticaLegado): Promise<ResultadoImportGenetica>;
```
(O `import-genetica.ts` resolve o próprio `reprodutorIdPorIdeagri` upsertando `reprodutoresGeneticos` por `ideagriId` — a identidade adicionada em Task 1 — e reusa esse mapa para valores/estoques/pedigree.)

- [ ] **Step 1: Testes de service (RED)** — mock Prisma no estilo `import-iatf.test.ts`:
  - Upsert idempotente de `Reprodutor` (por `ideagriId`), `IndicadorGenetico`/`MarcadorGenetico`/`Caseina`/`TipoSemen` por `ideagriId`; execução 2× converge (asserta `upsert` com `where: { ideagriId }`).
  - `ValorIndicadorReprodutor` de indicador com `colunaLegada` **espelha** a coluna em `Reprodutor` (asserta `reprodutor.update({ where:{id}, data:{ ptaLeite: … } })` via `projetarColunasLegadas`).
  - `estoquesSemen` upsert por `ideagriId`; `reprodutorIdeagriId` ausente do mapa → **aborta** (`throw`), nada gravado depois.
  - Sem nenhum bloco genético → no-op retrocompatível (`{ reprodutores: 0, indicadores: 0, … }`).

Run: `pnpm --filter rionovo-server exec vitest run src/services/rebanho/import-genetica.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implementar o import (GREEN)** — upsert de `reprodutoresGeneticos` por `ideagriId` → montar `reprodutorIdPorIdeagri`; upsert dos dicionários por `ideagriId` → mapas `sigla→id`; gravar N:N por reprodutor (resolvendo sigla + reprodutor via mapas) e, ao gravar valores de indicadores com `colunaLegada`, projetar as colunas com `projetarColunasLegadas` e `reprodutor.update`; upsert de `estoquesSemen`/`pedigrees` por origem. Referência quebrada (sigla/reprodutor ausente) aborta com `throw`.

Run: `pnpm --filter rionovo-server exec vitest run src/services/rebanho/import-genetica.test.ts`
Expected: PASS.

- [ ] **Step 3: Ligar no `import-rebanho.ts`** — estender `RebanhoJson` com `DadosGeneticaLegado`; após o import IATF/ginecológico, chamar `importarGeneticaLegado(prisma, dados)` quando algum array existir; logar as contagens. Typecheck.

Run: `pnpm --filter rionovo-server exec tsc -p tsconfig.json --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**
```bash
git add server/src/services/rebanho/import-genetica.ts server/src/services/rebanho/import-genetica.test.ts server/prisma/import-rebanho.ts
git commit -m "$(printf 'feat(rebanho): importador idempotente de genética e sêmen com espelho legado\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>')"
```

---

### Task 10: Client — API tipada + cadastro de indicadores + ficha do reprodutor

**Files:**
- Modify: `client/src/rebanho/api.ts`
- Create: `client/src/rebanho/api.genetica.test.ts`
- Create: `client/src/rebanho/components/IndicadoresGeneticosSection.tsx`
- Modify: `client/src/rebanho/components/CadastrosView.tsx` (nova sub-aba "Indicadores")
- Modify: `client/src/rebanho/components/ReprodutoresSection.tsx` (ficha genética + estoque + ranking)

**Interfaces:**
- Consumes: rotas das Tasks 5/6.
- Produces (api.ts): `IndicadorGeneticoDTO`, `listarIndicadores`/`criarIndicador`/`atualizarIndicador`/`excluirIndicador`; `listarMarcadores`/`criarMarcador`; `listarCaseinas`/`criarCaseina`; `FichaGeneticaDTO`, `obterFichaGenetica`/`salvarFichaGenetica`; `EstoqueSemenDTO`, `listarTiposSemen`/`criarTipoSemen`, `listarEstoqueSemen`/`criarLoteSemen`/`ajustarDoses`; `rankingReprodutores(indicadorId?)`. Todos via `req<T>` (headers já injetam `comPropriedade`).

- [ ] **Step 1: DTOs + fetchers + teste de path/método (RED→GREEN)**

`api.genetica.test.ts` no estilo `api.aptidao.test.ts` (stub `fetch`, assertar path e `{ method, body }`) para `criarIndicador`, `salvarFichaGenetica`, `criarLoteSemen`, `ajustarDoses`, `rankingReprodutores`. Implementar os fetchers em `api.ts`.

Run: `pnpm --filter rionovo-client exec vitest run src/rebanho/api.genetica.test.ts`
Expected: PASS.

- [ ] **Step 2: `IndicadoresGeneticosSection.tsx`** — CRUD do catálogo (sigla/nome/unidade/direção/colunaLegada/flag "de ranking") com `RebTable`/`RebButton`, no padrão de `CadastrosView`. Montar como nova sub-aba "Indicadores" no `CadastrosView` (`sub` union `"produtos" | "fornecedores" | "indicadores"` + botão + branch de render).

- [ ] **Step 3: Ficha do reprodutor** — expandir `ReprodutoresSection` com um painel por reprodutor: valores por indicador, marcadores, caseína, pedigree (form → `salvarFichaGenetica`), tabela dos indicadores importados; seletor "ordenar por" (default = PTA leite/TPI atuais → `rankingReprodutores()`); bloco de estoque de sêmen (dose/lote/localização + entrada de doses via `criarLoteSemen`/`ajustarDoses`) com `RebTable`/`RebBox`. Reusar `fmt*` de `components/charts` e cores via `var()`.

- [ ] **Step 4: Verificar client**

Run: `pnpm --filter rionovo-client exec tsc -b --noEmit && pnpm --filter rionovo-client run test`
Expected: typecheck e testes verdes.

- [ ] **Step 5: Commit**
```bash
git add client/src/rebanho/api.ts client/src/rebanho/api.genetica.test.ts client/src/rebanho/components/IndicadoresGeneticosSection.tsx client/src/rebanho/components/CadastrosView.tsx client/src/rebanho/components/ReprodutoresSection.tsx
git commit -m "$(printf 'feat(rebanho): UI de indicadores genéticos, ficha do reprodutor e estoque de sêmen\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>')"
```

---

### Task 11: Client — seletor opcional de lote na IA (EventoForm) (TDD)

**Files:**
- Modify: `client/src/rebanho/components/EventoForm.payload.ts`
- Modify: `client/src/rebanho/components/EventoForm.payload.test.ts`
- Modify: `client/src/rebanho/components/EventoForm.tsx`
- Modify: `client/src/rebanho/components/EventoForm.test.tsx`
- Modify: `client/src/rebanho/api.ts` (`EventoPayload.estoqueSemenId?`)

**Interfaces:**
- Consumes: `listarEstoqueSemen` (Task 10), reprodutor selecionado.
- Produces: `camposInseminacao(form)` (helper puro) devolve `{ reprodutor, protocolo, estoqueSemenId? }`; `EventoPayload` ganha `estoqueSemenId?: number`.

- [ ] **Step 1: Teste de payload (RED)**

Em `EventoForm.payload.test.ts`, cobrir `camposInseminacao`: com lote selecionado (`estoqueSemenId` string preenchida) → inclui `estoqueSemenId: N`; sem lote → sem a chave; mantém `reprodutor`/`protocolo` como hoje. Extrair a montagem da IA do `EventoForm.tsx` para o helper puro (o `reprodutor` continua vindo de `montarRacaDisplay`, então o helper recebe `reprodutor`/`protocolo` já resolvidos + o `estoqueSemenId` string do form).

Run: `pnpm --filter rionovo-client exec vitest run src/rebanho/components/EventoForm.payload.test.ts`
Expected: FAIL.

- [ ] **Step 2: Helper + UI (GREEN)**

`EventoForm.payload.ts`: `camposInseminacao`. `EventoForm.tsx`: quando `tipo === "INSEMINACAO"`, carregar `listarEstoqueSemen` do reprodutor selecionado e oferecer um `RebSelect` opcional "Lote de sêmen" com `saldo` por opção; exibir aviso "estoque zerado" quando o lote escolhido tiver `dosesDisponiveis === 0`; enviar `estoqueSemenId` via `camposInseminacao`. `EventoForm.test.tsx`: `renderToString` mostra o rótulo do seletor de lote ao iniciar em `INSEMINACAO`.

Run: `pnpm --filter rionovo-client exec vitest run src/rebanho/components/EventoForm.payload.test.ts src/rebanho/components/EventoForm.test.tsx`
Expected: PASS.

- [ ] **Step 3: Verificar client**

Run: `pnpm --filter rionovo-client exec tsc -b --noEmit && pnpm --filter rionovo-client run test`
Expected: typecheck e testes verdes.

- [ ] **Step 4: Commit**
```bash
git add client/src/rebanho/components/EventoForm.tsx client/src/rebanho/components/EventoForm.payload.ts client/src/rebanho/components/EventoForm.payload.test.ts client/src/rebanho/components/EventoForm.test.tsx client/src/rebanho/api.ts
git commit -m "$(printf 'feat(rebanho): seletor opcional de lote de sêmen na inseminação\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>')"
```

---

### Task 12: Gate do Bloco C + doc de reconciliação

**Files:**
- Modify: `docs/reproducao-teste-na-maquina-ideagri.md`

- [ ] **Step 1: Testes focados server**

Run: `pnpm --filter rionovo-server exec vitest run src/services/rebanho/semen-baixa.calc.test.ts src/services/rebanho/genetica-espelho.calc.test.ts src/services/rebanho/ranking-reprodutor.calc.test.ts src/services/rebanho/genetica.test.ts src/services/rebanho/semen.test.ts src/services/rebanho/eventos.semen.test.ts src/services/rebanho/iatf.semen.test.ts src/services/rebanho/import-genetica.test.ts`
Expected: todos PASS.

- [ ] **Step 2: Suíte server completa + parser**

Run: `pnpm --filter rionovo-server run test && pnpm exec node --test scripts/build-rebanho-json.test.mjs`
Expected: verde (sem regressão nos ~942 do Bloco B) e parser verde.

- [ ] **Step 3: Client**

Run: `pnpm --filter rionovo-client run test`
Expected: verde.

- [ ] **Step 4: Build completo**

Run: `pnpm build`
Expected: server + client exit 0.

- [ ] **Step 5: Doc de reconciliação (contrato dos novos prefixos)**

Em `docs/reproducao-teste-na-maquina-ideagri.md`, acrescentar a tabela do contrato intermediário dos novos prefixos (`@REPRODUTOR@`, `@INDICADOR@`, `@VALORIND@`, `@MARCADOR@`, `@VALORMARC@`, `@CASEINA@`, `@VALORCAS@`, `@TIPOSEMEN@`, `@ESTSEMEN@`, `@PEDIGREE@`) com origem IDEAGRI (`ANIMALINFO_REPRODUTOR`, `GENCATALOGOINDICADOR`, `GENVALORIND`, `GENCATALOGOMARCADOR`, `GENCATALOGOCASEINA`, `TIPOSEMEN`, estoque de sêmen, `GENPEDIGREE`), e registrar a reconciliação pendente na máquina: **67** `ANIMALINFO_REPRODUTOR` · **271** `GENCATALOGOINDICADOR` · **20** marcadores · **15** caseínas · **3** tipos de sêmen (+ valores por touro). Deixar explícito que a fonte não existe nesta máquina e que a biblioteca opera com o que o usuário cadastrar até a reextração do `DADOS777.FDB`.

- [ ] **Step 6: Commit**
```bash
git add docs/reproducao-teste-na-maquina-ideagri.md
git commit -m "$(printf 'docs(rebanho): contrato de import e reconciliação pendente da genética/sêmen (Bloco C)\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>')"
```

---

## Self-Review

**1. Cobertura da spec:**
- §2.1 baixa opcional-com-aviso reversível → Task 2 (calc) + Task 7 (evento/IATF, devolução no estorno via `estoqueSemenDoseBaixada`).
- §2.2 genética operacional + catálogo gerenciado → Task 5 (CRUD dicionários + ficha) + Task 10 (UI).
- §2.3/§4 espelho abordagem A (colunas legadas intactas, `colunaLegada` projeta) → Task 1 (schema mantém colunas) + Task 3 (calc) + Tasks 5/9 (grava/import projetam).
- §2.4 parser + fixture, reconciliação depois → Tasks 8/9 + Task 12 (doc).
- §4 schema (8 models + `estoqueSemenId`) → Task 1 (+ `Reprodutor.ideagriId` e `estoqueSemenDoseBaixada` como suporte técnico do import/estorno).
- §5 três cálculos puros → Tasks 2/3/4.
- §6 parsers + `import-genetica.ts` → Tasks 8/9.
- §7 services/rotas (genetica, semen, eventos estendido, iatf) → Tasks 5/6/7.
- §8 UI (cadastro de indicadores, ficha, ranking configurável, estoque, seletor de lote na IA) → Tasks 10/11.
- §9 testes e gate → cada task tem TDD; Task 12 fecha o gate (server+client vitest, `node --test`, `pnpm build`, migration idempotente + `prisma:generate`, doc atualizado).
- §10 interfaces entre blocos → `ValorIndicadorReprodutor`/`PedigreeReprodutor`/`EstoqueSemen` nascem aqui (Task 1) para C→D/C→E; retrocompat garantida por não tocar `reprodutor.calc`/`acasalamento.calc`/ranking atuais (espelho).
- §11 fora de escopo respeitado (sem migrar `recomendar`, sem FIV/TE, sem relatórios, sem import real).

**2. Placeholder scan:** as únicas dependências externas (contagens 67/271/20/15/3 e dados reais) estão explicitamente bloqueadas por falta da fonte e falham fechado; não há campo IDEAGRI inventado nem seed-semente. Todos os passos de código trazem o código real; a migration reusa o padrão idempotente já commitado. Os campos técnicos adicionados além da spec (`Reprodutor.ideagriId`, `EventoReprodutivo.estoqueSemenDoseBaixada`) existem só para viabilizar o import idempotente por origem (a spec exige "resolve reprodutor por `ideagriId`") e o estorno correto (devolver a dose só quando ela foi consumida) — não alteram nenhuma decisão de produto.

**3. Consistência de tipos:** `ColunaLegada` (Task 3) = enum de `colunaLegada` no schema (Task 1) e usado em Tasks 5/9. `PlanoBaixaDose`/`planejarBaixaDose`/`planejarDevolucaoDose` (Task 2) consumidos em Task 7; `planejarDevolucaoDose` recebe `doseBaixada` = `EventoReprodutivo.estoqueSemenDoseBaixada` (Task 1). `DirecaoRanking` (Task 4) = `direcao` do `IndicadorGenetico` (Task 1) usado em Task 5. `EstoqueSemenDTO` (Task 6) = shape usado no client (Tasks 10/11). `estoqueSemenId` é `Int?` no schema (Task 1), opcional nos schemas Zod (Task 7) e no `EventoPayload` (Task 11). Nomes de rota consistentes entre service/rota (Tasks 5/6/7) e fetchers do client (Tasks 10/11).
