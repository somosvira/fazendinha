# Custo de Safra — Milho: Data Model + Motores (Fase 1a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a subárvore de dados `cultivo` (milho) e os motores puros de custo/silo com recompute, deixando o backend do módulo pronto para as rotas (plano seguinte).

**Architecture:** Espelha o padrão do corte — modelos Prisma novos + função **pura** (sem DB, testável) `calcularResumoSafra` + **wrapper** `recomputarResumoSafra` que faz I/O e upsert do read-model `ResumoSafraCultivo`; mesma forma para o saldo de silo. Nenhum modelo existente é alterado.

**Tech Stack:** Prisma 6 (Postgres/Neon), TypeScript ESM (imports `.ts`→`.js`), Vitest (test runner do server — ver arquivos `*.test.ts` existentes), `Prisma.Decimal`.

## Global Constraints

- Cálculo financeiro em `Prisma.Decimal`; conversão para `number` **só na borda** (mappers/DTO). A função pura recebe `number` já convertido e devolve `number`; a conversão Decimal→number acontece no wrapper.
- ESM server: todo import relativo de `.ts` termina em `.js` (ex.: `import { calcularResumoSafra } from "./resumo.recompute.js"`).
- Divisão por zero nunca retorna `NaN`/`Infinity` → retornar `null`.
- Migrations novas: `prisma migrate dev` exige `DIRECT_URL` no `server/.env` (shadow db); a `DATABASE_URL` pooled não serve para `migrate dev`.
- `classe` custeio/investimento REUSA o enum existente `ClassificacaoCategoria { CUSTEIO, INVESTIMENTO }` — não criar enum novo.
- Spec de referência: `docs/superpowers/specs/2026-07-01-custo-safra-cafe-milho-design.md` (regras §5.1 e §5.2).

## File Structure

- **Modify** `server/prisma/schema.prisma` — enums `Cultura`, `TipoCustoCultivo`, `TipoProducao`, `UnidadeProducao`, `DestinoProducao`, `TipoSilo`, `TipoMovimentoSilo`, `OrigemMovimentoSilo`; models `SafraCultivo`, `AreaCultivo`, `LancamentoCusto`, `ProducaoCultivo`, `Silo`, `MovimentoSilo`, `ResumoSafraCultivo`.
- **Create** `server/prisma/migrations/<ts>_cultivo_milho/migration.sql` — via `migrate dev`.
- **Create** `server/src/services/cultivo/resumo.recompute.ts` — pura `calcularResumoSafra` + wrapper `recomputarResumoSafra`.
- **Create** `server/src/services/cultivo/resumo.recompute.test.ts` — testes da pura.
- **Create** `server/src/services/cultivo/silo.ts` — pura `calcularSaldoSilo` + wrapper `recomputarSaldoSilo`.
- **Create** `server/src/services/cultivo/silo.test.ts` — testes da pura.

---

### Task 1: Schema Prisma + migration da subárvore `cultivo`

**Files:**
- Modify: `server/prisma/schema.prisma` (append ao final, após o último model)
- Create: `server/prisma/migrations/<timestamp>_cultivo_milho/migration.sql` (gerado)

**Interfaces:**
- Produces: modelos Prisma `SafraCultivo`, `AreaCultivo`, `LancamentoCusto`, `ProducaoCultivo`, `Silo`, `MovimentoSilo`, `ResumoSafraCultivo` no `PrismaClient` (`prisma.safraCultivo`, etc.), consumidos pelas Tasks 3/4 e pelo plano de rotas.

- [ ] **Step 1: Append enums + models ao schema**

Adicionar ao final de `server/prisma/schema.prisma`:

```prisma
// =============================================================================
// MÓDULO CULTIVO — culturas anuais (milho primeiro). Custo de safra operacional
// com duas saídas (grão/silagem) e silos. Crop-agnostic via `cultura`.
// =============================================================================

enum Cultura {
  MILHO
}

enum TipoCustoCultivo {
  ADUBACAO
  PREPARO_SOLO
  PLANTIO
  TRATOS
  COLHEITA
  TRANSPORTE
  MAO_DE_OBRA
  MAQUINA
  OUTRO
}

enum TipoProducao {
  GRAO
  SILAGEM
}

enum UnidadeProducao {
  SC
  TON
}

enum DestinoProducao {
  VENDA
  SILO
}

enum TipoSilo {
  GRAO
  SILAGEM
}

enum TipoMovimentoSilo {
  ENTRADA
  SAIDA
}

enum OrigemMovimentoSilo {
  COLHEITA
  NUTRICAO
  VENDA
  AJUSTE
}

model SafraCultivo {
  id          Int                 @id @default(autoincrement())
  cultura     Cultura
  nome        String
  ano         Int
  dataInicio  DateTime            @db.Date
  dataFim     DateTime?           @db.Date
  areaHaTotal Decimal?            @db.Decimal(10, 2) // usado quando não há AreaCultivo
  fechada     Boolean             @default(false)
  observacao  String?
  areas       AreaCultivo[]
  custos      LancamentoCusto[]
  producoes   ProducaoCultivo[]
  resumo      ResumoSafraCultivo?
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt

  @@index([cultura, ano])
}

model AreaCultivo {
  id             Int               @id @default(autoincrement())
  safraCultivo   SafraCultivo      @relation(fields: [safraCultivoId], references: [id], onDelete: Cascade)
  safraCultivoId Int
  codigo         String
  nome           String?
  areaHa         Decimal           @db.Decimal(10, 2)
  custos         LancamentoCusto[]
  producoes      ProducaoCultivo[]
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  @@unique([safraCultivoId, codigo])
}

model LancamentoCusto {
  id             Int                    @id @default(autoincrement())
  safraCultivo   SafraCultivo           @relation(fields: [safraCultivoId], references: [id], onDelete: Cascade)
  safraCultivoId Int
  area           AreaCultivo?           @relation(fields: [areaCultivoId], references: [id])
  areaCultivoId  Int?
  tipo           TipoCustoCultivo
  classe         ClassificacaoCategoria @default(CUSTEIO)
  data           DateTime               @db.Date
  descricao      String
  valor          Decimal                @db.Decimal(14, 2)
  qtd            Decimal?               @db.Decimal(12, 3)
  unidade        String?
  horasMaquina   Decimal?               @db.Decimal(8, 2)
  numMaquinas    Int?
  numCaminhoes   Int?
  lancamentoId   Int?                   @unique // ponte financeira opcional (soft ref)
  observacao     String?
  createdAt      DateTime               @default(now())
  updatedAt      DateTime               @updatedAt

  @@index([safraCultivoId, data])
  @@index([classe])
}

model ProducaoCultivo {
  id             Int             @id @default(autoincrement())
  safraCultivo   SafraCultivo    @relation(fields: [safraCultivoId], references: [id], onDelete: Cascade)
  safraCultivoId Int
  area           AreaCultivo?    @relation(fields: [areaCultivoId], references: [id])
  areaCultivoId  Int?
  data           DateTime        @db.Date
  tipo           TipoProducao
  quantidade     Decimal         @db.Decimal(12, 3)
  unidade        UnidadeProducao
  destino        DestinoProducao?
  silo           Silo?           @relation(fields: [siloId], references: [id])
  siloId         Int?
  observacao     String?
  movimentos     MovimentoSilo[]
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  @@index([safraCultivoId, data])
}

model Silo {
  id         Int               @id @default(autoincrement())
  nome       String
  tipo       TipoSilo
  capacidade Decimal?          @db.Decimal(12, 3)
  unidade    String
  saldoAtual Decimal           @default(0) @db.Decimal(12, 3)
  ativo      Boolean           @default(true)
  movimentos MovimentoSilo[]
  producoes  ProducaoCultivo[]
  createdAt  DateTime          @default(now())
  updatedAt  DateTime          @updatedAt
}

model MovimentoSilo {
  id                Int                 @id @default(autoincrement())
  silo              Silo                @relation(fields: [siloId], references: [id], onDelete: Cascade)
  siloId            Int
  data              DateTime            @db.Date
  tipo              TipoMovimentoSilo
  quantidade        Decimal             @db.Decimal(12, 3)
  origem            OrigemMovimentoSilo
  producaoCultivo   ProducaoCultivo?    @relation(fields: [producaoCultivoId], references: [id])
  producaoCultivoId Int?
  observacao        String?
  createdAt         DateTime            @default(now())

  @@index([siloId, data])
}

model ResumoSafraCultivo {
  id                 Int          @id @default(autoincrement())
  safraCultivo       SafraCultivo @relation(fields: [safraCultivoId], references: [id], onDelete: Cascade)
  safraCultivoId     Int          @unique
  custeioTotal       Decimal      @default(0) @db.Decimal(14, 2)
  investimentoTotal  Decimal      @default(0) @db.Decimal(14, 2)
  areaHa             Decimal      @default(0) @db.Decimal(10, 2)
  producaoGraoSc     Decimal      @default(0) @db.Decimal(12, 3)
  producaoSilagemTon Decimal      @default(0) @db.Decimal(12, 3)
  custoHa            Decimal?     @db.Decimal(14, 2)
  custoSaca          Decimal?     @db.Decimal(14, 2)
  custoTonelada      Decimal?     @db.Decimal(14, 2)
  horasMaquinaTotal  Decimal      @default(0) @db.Decimal(10, 2)
  atualizadoEm       DateTime     @updatedAt
}
```

- [ ] **Step 2: Validar o schema**

Run: `cd server && pnpm exec prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 3: Criar a migration (requer DIRECT_URL)**

Run: `cd server && pnpm exec prisma migrate dev --name cultivo_milho`
Expected: migration criada em `prisma/migrations/<ts>_cultivo_milho/`, aplicada, e "Your database is now in sync". Se falhar por falta de `DIRECT_URL`, adicionar a URL direct do Neon em `server/.env` e repetir.

- [ ] **Step 4: Gerar o client**

Run: `cd server && pnpm exec prisma generate`
Expected: "Generated Prisma Client".

- [ ] **Step 5: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations/
git commit -m "feat(cultivo): schema e migration da subárvore de milho (custo de safra + silos)"
```

---

### Task 2: Função pura `calcularResumoSafra` + testes

**Files:**
- Create: `server/src/services/cultivo/resumo.recompute.ts`
- Test: `server/src/services/cultivo/resumo.recompute.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type LinhaCusto = { classe: "CUSTEIO" | "INVESTIMENTO"; valor: number; horasMaquina?: number | null; areaCultivoId?: number | null };
  export type LinhaProducao = { tipo: "GRAO" | "SILAGEM"; quantidade: number; areaCultivoId?: number | null };
  export type ResumoInput = { areaHaTotal: number; areas: { id: number; areaHa: number }[]; custos: LinhaCusto[]; producoes: LinhaProducao[] };
  export type ResumoCalc = { custeioTotal: number; investimentoTotal: number; areaHa: number; producaoGraoSc: number; producaoSilagemTon: number; custoHa: number | null; custoSaca: number | null; custoTonelada: number | null; horasMaquinaTotal: number; nota: string | null };
  export function calcularResumoSafra(input: ResumoInput): ResumoCalc;
  ```
- Consumes: nada (pura).

- [ ] **Step 1: Escrever os testes que falham**

Criar `server/src/services/cultivo/resumo.recompute.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { calcularResumoSafra } from "./resumo.recompute.js";

const base = { areaHaTotal: 0, areas: [], custos: [], producoes: [] };

describe("calcularResumoSafra", () => {
  it("soma custeio e investimento separados e horas de máquina", () => {
    const r = calcularResumoSafra({
      ...base,
      areaHaTotal: 100,
      custos: [
        { classe: "CUSTEIO", valor: 3000, horasMaquina: 10 },
        { classe: "CUSTEIO", valor: 2000, horasMaquina: 5 },
        { classe: "INVESTIMENTO", valor: 8000 },
      ],
    });
    expect(r.custeioTotal).toBe(5000);
    expect(r.investimentoTotal).toBe(8000);
    expect(r.horasMaquinaTotal).toBe(15);
    expect(r.areaHa).toBe(100);
    expect(r.custoHa).toBe(50); // 5000/100
  });

  it("custoHa null quando área é zero", () => {
    const r = calcularResumoSafra({ ...base, areaHaTotal: 0, custos: [{ classe: "CUSTEIO", valor: 100 }] });
    expect(r.custoHa).toBeNull();
  });

  it("nível-safra, saída única grão: custoSaca = custeio/sacas, custoTonelada null", () => {
    const r = calcularResumoSafra({
      ...base,
      areaHaTotal: 50,
      custos: [{ classe: "CUSTEIO", valor: 10000 }],
      producoes: [{ tipo: "GRAO", quantidade: 500 }],
    });
    expect(r.producaoGraoSc).toBe(500);
    expect(r.custoSaca).toBe(20); // 10000/500
    expect(r.custoTonelada).toBeNull();
    expect(r.nota).toBeNull();
  });

  it("nível-safra, saída mista sem áreas: custoSaca e custoTonelada null + nota", () => {
    const r = calcularResumoSafra({
      ...base,
      areaHaTotal: 100,
      custos: [{ classe: "CUSTEIO", valor: 10000 }],
      producoes: [
        { tipo: "GRAO", quantidade: 500 },
        { tipo: "SILAGEM", quantidade: 200 },
      ],
    });
    expect(r.custoSaca).toBeNull();
    expect(r.custoTonelada).toBeNull();
    expect(r.custoHa).toBe(100); // custoHa sempre válido
    expect(r.nota).toMatch(/mista/i);
  });

  it("com áreas: rateia custeio por saída da área", () => {
    // área 1 (grão): custeio 6000, 300 sacas → 20/sc
    // área 2 (silagem): custeio 4000, 100 ton → 40/ton
    const r = calcularResumoSafra({
      areaHaTotal: 0,
      areas: [{ id: 1, areaHa: 60 }, { id: 2, areaHa: 40 }],
      custos: [
        { classe: "CUSTEIO", valor: 6000, areaCultivoId: 1 },
        { classe: "CUSTEIO", valor: 4000, areaCultivoId: 2 },
      ],
      producoes: [
        { tipo: "GRAO", quantidade: 300, areaCultivoId: 1 },
        { tipo: "SILAGEM", quantidade: 100, areaCultivoId: 2 },
      ],
    });
    expect(r.areaHa).toBe(100); // soma das áreas
    expect(r.custoSaca).toBe(20);
    expect(r.custoTonelada).toBe(40);
    expect(r.nota).toBeNull();
  });

  it("sem produção: custos por unidade null, sem NaN", () => {
    const r = calcularResumoSafra({ ...base, areaHaTotal: 10, custos: [{ classe: "CUSTEIO", valor: 100 }] });
    expect(r.custoSaca).toBeNull();
    expect(r.custoTonelada).toBeNull();
    expect(Number.isNaN(r.custoHa as number)).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd server && pnpm exec vitest run src/services/cultivo/resumo.recompute.test.ts`
Expected: FAIL — "Cannot find module './resumo.recompute.js'".

- [ ] **Step 3: Implementar a função pura**

Criar `server/src/services/cultivo/resumo.recompute.ts`:

```ts
export type LinhaCusto = { classe: "CUSTEIO" | "INVESTIMENTO"; valor: number; horasMaquina?: number | null; areaCultivoId?: number | null };
export type LinhaProducao = { tipo: "GRAO" | "SILAGEM"; quantidade: number; areaCultivoId?: number | null };
export type ResumoInput = { areaHaTotal: number; areas: { id: number; areaHa: number }[]; custos: LinhaCusto[]; producoes: LinhaProducao[] };
export type ResumoCalc = {
  custeioTotal: number; investimentoTotal: number; areaHa: number;
  producaoGraoSc: number; producaoSilagemTon: number;
  custoHa: number | null; custoSaca: number | null; custoTonelada: number | null;
  horasMaquinaTotal: number; nota: string | null;
};

const soma = (ns: number[]) => ns.reduce((a, b) => a + b, 0);
const div = (a: number, b: number): number | null => (b > 0 ? a / b : null);

export function calcularResumoSafra(input: ResumoInput): ResumoCalc {
  const { areas, custos, producoes } = input;

  const custeioTotal = soma(custos.filter((c) => c.classe === "CUSTEIO").map((c) => c.valor));
  const investimentoTotal = soma(custos.filter((c) => c.classe === "INVESTIMENTO").map((c) => c.valor));
  const horasMaquinaTotal = soma(custos.map((c) => c.horasMaquina ?? 0));
  const areaHa = areas.length > 0 ? soma(areas.map((a) => a.areaHa)) : input.areaHaTotal;
  const producaoGraoSc = soma(producoes.filter((p) => p.tipo === "GRAO").map((p) => p.quantidade));
  const producaoSilagemTon = soma(producoes.filter((p) => p.tipo === "SILAGEM").map((p) => p.quantidade));

  const custoHa = div(custeioTotal, areaHa);

  let custoSaca: number | null = null;
  let custoTonelada: number | null = null;
  let nota: string | null = null;

  if (areas.length > 0) {
    // Áreas que produzem cada saída (uma área pode aparecer só num bucket).
    const areasGrao = new Set(producoes.filter((p) => p.tipo === "GRAO").map((p) => p.areaCultivoId));
    const areasSilagem = new Set(producoes.filter((p) => p.tipo === "SILAGEM").map((p) => p.areaCultivoId));
    const custeioAreas = (set: Set<number | null | undefined>) =>
      soma(custos.filter((c) => c.classe === "CUSTEIO" && set.has(c.areaCultivoId)).map((c) => c.valor));
    custoSaca = div(custeioAreas(areasGrao), producaoGraoSc);
    custoTonelada = div(custeioAreas(areasSilagem), producaoSilagemTon);
  } else {
    const temGrao = producaoGraoSc > 0;
    const temSilagem = producaoSilagemTon > 0;
    if (temGrao && temSilagem) {
      nota = "Safra mista (grão + silagem) sem áreas — cadastre áreas para custo por unidade.";
    } else if (temGrao) {
      custoSaca = div(custeioTotal, producaoGraoSc);
    } else if (temSilagem) {
      custoTonelada = div(custeioTotal, producaoSilagemTon);
    }
  }

  return { custeioTotal, investimentoTotal, areaHa, producaoGraoSc, producaoSilagemTon, custoHa, custoSaca, custoTonelada, horasMaquinaTotal, nota };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd server && pnpm exec vitest run src/services/cultivo/resumo.recompute.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add server/src/services/cultivo/resumo.recompute.ts server/src/services/cultivo/resumo.recompute.test.ts
git commit -m "feat(cultivo): função pura calcularResumoSafra (custeio/investimento, grão+silagem, §5.1)"
```

---

### Task 3: Wrapper `recomputarResumoSafra` (I/O + upsert)

**Files:**
- Modify: `server/src/services/cultivo/resumo.recompute.ts` (append o wrapper)

**Interfaces:**
- Consumes: `calcularResumoSafra` (Task 2); `prisma` de `../../db.js`; modelos da Task 1.
- Produces: `export async function recomputarResumoSafra(safraCultivoId: number): Promise<void>` — usado pelas rotas de custos/produção (plano seguinte) após qualquer mutação.

- [ ] **Step 1: Implementar o wrapper**

Append em `server/src/services/cultivo/resumo.recompute.ts`:

```ts
import { prisma } from "../../db.js";
import { Prisma } from "@prisma/client";

const n = (d: Prisma.Decimal | null | undefined): number => (d == null ? 0 : Number(d));
const dec = (x: number | null): Prisma.Decimal | null => (x == null ? null : new Prisma.Decimal(x.toFixed(2)));
const dec3 = (x: number): Prisma.Decimal => new Prisma.Decimal(x.toFixed(3));

export async function recomputarResumoSafra(safraCultivoId: number): Promise<void> {
  const safra = await prisma.safraCultivo.findUnique({
    where: { id: safraCultivoId },
    include: { areas: true, custos: true, producoes: true },
  });
  if (!safra) return;

  const calc = calcularResumoSafra({
    areaHaTotal: n(safra.areaHaTotal),
    areas: safra.areas.map((a) => ({ id: a.id, areaHa: n(a.areaHa) })),
    custos: safra.custos.map((c) => ({
      classe: c.classe as "CUSTEIO" | "INVESTIMENTO",
      valor: n(c.valor),
      horasMaquina: n(c.horasMaquina),
      areaCultivoId: c.areaCultivoId,
    })),
    producoes: safra.producoes.map((p) => ({
      tipo: p.tipo as "GRAO" | "SILAGEM",
      quantidade: n(p.quantidade),
      areaCultivoId: p.areaCultivoId,
    })),
  });

  const dados = {
    custeioTotal: new Prisma.Decimal(calc.custeioTotal.toFixed(2)),
    investimentoTotal: new Prisma.Decimal(calc.investimentoTotal.toFixed(2)),
    areaHa: new Prisma.Decimal(calc.areaHa.toFixed(2)),
    producaoGraoSc: dec3(calc.producaoGraoSc),
    producaoSilagemTon: dec3(calc.producaoSilagemTon),
    custoHa: dec(calc.custoHa),
    custoSaca: dec(calc.custoSaca),
    custoTonelada: dec(calc.custoTonelada),
    horasMaquinaTotal: new Prisma.Decimal(calc.horasMaquinaTotal.toFixed(2)),
  };

  await prisma.resumoSafraCultivo.upsert({
    where: { safraCultivoId },
    create: { safraCultivoId, ...dados },
    update: dados,
  });
}
```

- [ ] **Step 2: Verificar tipos (build do server)**

Run: `cd server && pnpm exec tsc --noEmit`
Expected: sem erros (exit 0).

- [ ] **Step 3: Rodar os testes da pura de novo (garantir que o import do wrapper não quebrou nada)**

Run: `cd server && pnpm exec vitest run src/services/cultivo/resumo.recompute.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/src/services/cultivo/resumo.recompute.ts
git commit -m "feat(cultivo): wrapper recomputarResumoSafra (upsert ResumoSafraCultivo)"
```

---

### Task 4: Motor de saldo de silo (pura + wrapper) + testes

**Files:**
- Create: `server/src/services/cultivo/silo.ts`
- Test: `server/src/services/cultivo/silo.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type MovimentoSaldo = { tipo: "ENTRADA" | "SAIDA"; quantidade: number };
  export function calcularSaldoSilo(movimentos: MovimentoSaldo[]): number;
  export async function recomputarSaldoSilo(siloId: number): Promise<void>;
  ```
- Consumes: `prisma` de `../../db.js`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `server/src/services/cultivo/silo.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { calcularSaldoSilo } from "./silo.js";

describe("calcularSaldoSilo", () => {
  it("saldo = entradas - saídas", () => {
    expect(calcularSaldoSilo([
      { tipo: "ENTRADA", quantidade: 100 },
      { tipo: "ENTRADA", quantidade: 50 },
      { tipo: "SAIDA", quantidade: 30 },
    ])).toBe(120);
  });

  it("silo vazio → 0", () => {
    expect(calcularSaldoSilo([])).toBe(0);
  });

  it("não fica negativo silenciosamente — reflete o razão real", () => {
    expect(calcularSaldoSilo([{ tipo: "SAIDA", quantidade: 10 }])).toBe(-10);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd server && pnpm exec vitest run src/services/cultivo/silo.test.ts`
Expected: FAIL — "Cannot find module './silo.js'".

- [ ] **Step 3: Implementar**

Criar `server/src/services/cultivo/silo.ts`:

```ts
import { prisma } from "../../db.js";
import { Prisma } from "@prisma/client";

export type MovimentoSaldo = { tipo: "ENTRADA" | "SAIDA"; quantidade: number };

export function calcularSaldoSilo(movimentos: MovimentoSaldo[]): number {
  return movimentos.reduce((acc, m) => acc + (m.tipo === "ENTRADA" ? m.quantidade : -m.quantidade), 0);
}

export async function recomputarSaldoSilo(siloId: number): Promise<void> {
  const movs = await prisma.movimentoSilo.findMany({ where: { siloId } });
  const saldo = calcularSaldoSilo(movs.map((m) => ({ tipo: m.tipo as "ENTRADA" | "SAIDA", quantidade: Number(m.quantidade) })));
  await prisma.silo.update({ where: { id: siloId }, data: { saldoAtual: new Prisma.Decimal(saldo.toFixed(3)) } });
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd server && pnpm exec vitest run src/services/cultivo/silo.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Verificar tipos**

Run: `cd server && pnpm exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add server/src/services/cultivo/silo.ts server/src/services/cultivo/silo.test.ts
git commit -m "feat(cultivo): motor de saldo de silo (pura calcularSaldoSilo + wrapper recomputarSaldoSilo)"
```

---

## Self-Review

- **Cobertura do spec (parte backend-engine):** §4.2 modelos → Task 1; §5.1 custo por unidade (todas as ramificações) → Task 2; recompute do read-model → Task 3; §5.2 saldo de silo → Task 4. Rotas, fechamento, café operacional, toggle e frontend ficam para os planos seguintes (abaixo).
- **Placeholders:** nenhum — todo passo tem código/comando real.
- **Consistência de tipos:** `calcularResumoSafra`/`ResumoInput`/`ResumoCalc` usados igual na Task 2 e 3; `calcularSaldoSilo`/`MovimentoSaldo` na Task 4; `classe` sempre `ClassificacaoCategoria`.

## Planos seguintes (Fase 1, ainda a escrever)

1. **Milho — rotas** (`routes/cultivo/*`): CRUD `SafraCultivo`/`AreaCultivo`/`LancamentoCusto`/`ProducaoCultivo`/`Silo`+`MovimentoSilo`, guard de `fechada` (409), disparo de `recomputarResumoSafra`/`recomputarSaldoSilo`, `?classe=`, registro no `index.ts`; + `schemas.ts` (Zod) e `mappers.ts`.
2. **Café — custo operacional** (`services/plantio/custo-operacional.ts` + rota + `?classe=` no financeiro).
3. **Frontend Milho** (`client/src/cultivo/*` + integração no `App.tsx`/`searchIndex`/`CommandPalette`) e **`<ClasseToggle>`** nas abas Custo de café e milho.
4. **Fase 2** — toggle cross-módulo (rebanho + corte expõem `investimentoTotal`).
