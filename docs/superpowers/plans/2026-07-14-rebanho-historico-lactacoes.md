# Histórico de Lactações (Rebanho · Fatia 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importar o histórico completo de lactações do Ideagri (335 ciclos), enriquecer o model `Lactacao`, costurar as lactações na timeline do cockpit e exibir uma seção "Lactações" no cockpit do animal.

**Architecture:** Segue o pipeline consagrado do módulo Rebanho: extração Firebird reproduzível (`rebanho-dump.sql` → `build-rebanho-json.mjs` → `rebanho_real.json`) → importador idempotente (`import-rebanho.ts`) → model Prisma → service com cálculo puro isolado (`.calc.ts` testado) → costura na timeline + seção no cockpit React. Tudo aditivo; nenhuma feature existente muda de comportamento.

**Tech Stack:** Prisma 6 (Postgres), Hono, Vitest (server), Node ESM (transformer `.mjs`), React 18 + Vite (client), Firebird isql (extração).

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-14-rebanho-historico-lactacoes-design.md`. Catálogo: `docs/design/ideagri-catalogo-features.md`.
- **ESM server:** imports relativos de `.ts` terminam em `.js` (ex.: `import { prisma } from "../../db.js"`). **Client:** imports relativos sem extensão.
- **Decimal:** valores de produção usam `@db.Decimal` — no import passar número; ao ler, converter com `Number(...)` (padrão dos mappers existentes).
- **Multi-propriedade:** `Lactacao` ganha `propriedadeId Int?` nullable; leituras via `resolverEscopoLeitura(c)`; front usa `comPropriedade()` nos headers (já embutido no `req<T>`/`fetch` do `rebanho/api.ts`).
- **Datas:** `@db.Date`; no import fixar UTC via helper `d(s)` existente (`new Date(\`${s}T00:00:00Z\`)`). No transformer, datas saem `"YYYY-MM-DD"`.
- **db push, não migrate:** prod sincroniza via `prisma db push`; colunas novas nullable/default nascem vazias — o import repopula tudo, sem backfill de SQL necessário.
- **Verificação DB local:** dev aponta para Postgres local `rionovo` (não Neon). `DIRECT_URL` já está no `.env` local.
- **Sem número inventado:** produção por lactação anterior fica `null` na UI (traço "—"), nunca estimada.
- **Working style:** um PR por fatia; testes Vitest passam; browser-verified antes de considerar pronto.

---

## Task 1: Enriquecer o model `Lactacao` no schema Prisma

**Files:**
- Modify: `server/prisma/schema.prisma` (bloco `model Lactacao`, ~linha 531)

**Interfaces:**
- Produces: model `Lactacao` com campos `numero:Int`, `dtInicio:DateTime`, `dtFim:DateTime?`, `motivoSecagem:String?`, `tipoAleitamento:String?`, `induzida:Boolean`, `producaoTotal:Decimal?`, `producao305:Decimal?`, `duracaoDias:Int?`, `propriedadeId:Int?`.

- [ ] **Step 1: Substituir o bloco `model Lactacao`**

Localize (server/prisma/schema.prisma, ~531):

```prisma
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

Substitua por:

```prisma
model Lactacao {
  id              Int       @id @default(autoincrement())
  animal          Animal    @relation(fields: [animalId], references: [id], onDelete: Cascade)
  animalId        Int
  numero          Int       // ordem da lactação (ORDEMLACTACAO ou cronológica)
  dtInicio        DateTime  @db.Date
  dtFim           DateTime? @db.Date   // null = em curso
  motivoSecagem   String?               // MOTIVOSECAGEM.DESCRICAO
  tipoAleitamento String?               // TIPOALEITAMENTO ('A'…)
  induzida        Boolean   @default(false)
  producaoTotal   Decimal?  @db.Decimal(10, 2)  // litros no ciclo (só última hoje)
  producao305     Decimal?  @db.Decimal(10, 2)
  duracaoDias     Int?
  propriedadeId   Int?

  @@index([animalId, numero])
}
```

- [ ] **Step 2: Aplicar o schema no DB local (db push)**

Run: `pnpm --filter rionovo-server exec prisma db push`
Expected: "Your database is now in sync with your Prisma schema." + regenera o client. Sem erros.

- [ ] **Step 3: Verificar que o Prisma Client tem os novos campos**

Run: `pnpm --filter rionovo-server exec tsc --noEmit`
Expected: PASS (o `import-rebanho.ts` atual ainda compila — ele só usa `numero/dtInicio/dtFim`, que continuam existindo).

- [ ] **Step 4: Commit**

```bash
git add server/prisma/schema.prisma
git commit -m "feat(rebanho): enriquece model Lactacao (motivo secagem, produção, propriedadeId)"
```

---

## Task 2: Bloco de dump `@Y@` (LACTACAO) no extrator SQL

**Files:**
- Modify: `scripts/rebanho-dump.sql` (adicionar bloco `@Y@` ao final, antes do `QUIT;` se houver)

**Interfaces:**
- Produces: linhas `@Y@` no dump com 10 campos separados por `~|~`:
  `numeroAnimal ~|~ ordem ~|~ dtInicio ~|~ dtFim ~|~ motivoSecagem ~|~ tipoAleitamento ~|~ induzida ~|~ producaoTotal ~|~ producao305 ~|~ duracaoDias`
  (produção/duração só vêm preenchidas para a lactação corrente do animal via `ANIMALINFO_PRODUCAO`).

- [ ] **Step 1: Adicionar o bloco `@Y@` ao final de `scripts/rebanho-dump.sql`**

Acrescente (seguindo o estilo dos blocos existentes `@W@`/`@M@` — concatenação com `COALESCE`, datas via `CAST(... AS VARCHAR(12))`):

```sql
/* ── LACTAÇÕES (335) — histórico por animal ──────────────────────────────────
 * Produção/duração só existem para a lactação CORRENTE (ANIMALINFO_PRODUCAO,
 * casada por ORDEMLACTACAO); lactações anteriores saem sem produção. */
SELECT '@Y@' || an.NUMERO
  || '~|~' || COALESCE(CAST(ip.ORDEMLACTACAO AS VARCHAR(8)),'')
  || '~|~' || COALESCE(CAST(l.DTINICIO AS VARCHAR(12)),'')
  || '~|~' || COALESCE(CAST(l.DTFIM AS VARCHAR(12)),'')
  || '~|~' || COALESCE(ms.DESCRICAO,'')
  || '~|~' || COALESCE(l.TIPOALEITAMENTO,'')
  || '~|~' || COALESCE(CAST(l.INDUZIDA AS VARCHAR(2)),'0')
  || '~|~' || COALESCE(CAST(ip.PRODUCAOTOTALULTLAC AS VARCHAR(16)),'')
  || '~|~' || COALESCE(CAST(ip.PRODUCAO305ULTLAC AS VARCHAR(16)),'')
  || '~|~' || COALESCE(CAST(ip.DURACAOLACTACAO AS VARCHAR(8)),'')
  AS "LINHA"
FROM LACTACAO l
  JOIN ANIMAL an ON an.CDANIMAL = l.CDANIMAL
  LEFT JOIN MOTIVOSECAGEM ms ON ms.CDMOTIVOSECAGEM = l.CDMOTIVOSECAGEM
  LEFT JOIN ANIMALINFO_PRODUCAO ip ON ip.CDANIMAL = l.CDANIMAL AND ip.DTINICIOULTLAC = l.DTINICIO
WHERE an.TIPOANIMAL='A' AND an.ANIMALREBANHO=1
ORDER BY an.NUMERO, l.DTINICIO;
```

Nota: o `LEFT JOIN ANIMALINFO_PRODUCAO ... AND ip.DTINICIOULTLAC = l.DTINICIO` só casa a lactação corrente (a que começa em `DTINICIOULTLAC`); nas anteriores `ip.*` vem null → produção vazia. Se `ORDEMLACTACAO` não existir para uma linha, o transformer deriva o número por ordem cronológica (Task 3).

- [ ] **Step 2: Rodar a extração e conferir que saem linhas `@Y@`**

Run: `bash scripts/extract-rebanho.sh`
Expected: o script imprime as contagens habituais; o dump gerado contém linhas `@Y@`. Verifique manualmente:

Run: `grep -c '@Y@' /mnt/c/Users/Public/idr_scratch/dump.txt`
Expected: um número em torno de 335 (≥ 300).

> Se `extract-rebanho.sh` falhar por ambiente (isql/FDB indisponível), pule este step de execução — Task 3 valida o parsing com fixtures. A alteração do `.sql` fica commitada de qualquer forma. **Não** commite o `dump.txt` (é artefato de scratch).

- [ ] **Step 3: Commit**

```bash
git add scripts/rebanho-dump.sql
git commit -m "feat(rebanho): bloco @Y@ (LACTACAO) no extrator do Ideagri"
```

---

## Task 3: `parseLactacao` no transformer + `lactacoes[]` no JSON (TDD)

**Files:**
- Modify: `scripts/build-rebanho-json.mjs` (adicionar `parseLactacao`, roteamento `@Y@`, `lactacoes` no `out`)
- Test: `scripts/build-rebanho-json.test.mjs` (adicionar casos)

**Interfaces:**
- Consumes: linha `@Y@` (sem prefixo) com 10 campos delimitados por `SEP` (`~|~`).
- Produces: `parseLactacao(linha) → { numero, ordem, dtInicio, dtFim, motivoSecagem, tipoAleitamento, induzida, producaoTotal, producao305, duracaoDias }` e `out.lactacoes: Lact[]`. Campos vazios → `null` (via helpers `s`/`n` existentes); `induzida` `"1"`→`true`, senão `false`.

- [ ] **Step 1: Escrever o teste que falha**

Em `scripts/build-rebanho-json.test.mjs`, adicione (espelhando os testes de `parsePesagem`/`parseMamite` no mesmo arquivo; importe `parseLactacao` do módulo — confirme que o `import { ... }` no topo do arquivo de teste inclui `parseLactacao`):

```js
test("parseLactacao — lactação encerrada com produção (corrente)", () => {
  const l = parseLactacao("1001~|~3~|~2023-08-29~|~2024-12-13~|~Rotina~|~A~|~0~|~9820.5~|~9105.0~|~471");
  assert.equal(l.numero, "1001");
  assert.equal(l.ordem, 3);
  assert.equal(l.dtInicio, "2023-08-29");
  assert.equal(l.dtFim, "2024-12-13");
  assert.equal(l.motivoSecagem, "Rotina");
  assert.equal(l.tipoAleitamento, "A");
  assert.equal(l.induzida, false);
  assert.equal(l.producaoTotal, 9820.5);
  assert.equal(l.producao305, 9105.0);
  assert.equal(l.duracaoDias, 471);
});

test("parseLactacao — lactação anterior sem produção, campos vazios → null", () => {
  const l = parseLactacao("1001~|~~|~2022-01-10~|~2022-11-01~|~Baixa produção~|~A~|~1~|~~|~~|~");
  assert.equal(l.ordem, null);
  assert.equal(l.dtFim, "2022-11-01");
  assert.equal(l.induzida, true);
  assert.equal(l.producaoTotal, null);
  assert.equal(l.producao305, null);
  assert.equal(l.duracaoDias, null);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `node --test scripts/build-rebanho-json.test.mjs`
Expected: FAIL — `parseLactacao is not a function` (ou import undefined).

- [ ] **Step 3: Implementar `parseLactacao` e o roteamento**

Em `scripts/build-rebanho-json.mjs`, adicione a função (junto das outras `parse*`; use os helpers `s` e `n` já definidos no arquivo):

```js
// @Y@ LACTACAO → histórico de lactação. Produção só na corrente (via ANIMALINFO_PRODUCAO).
export function parseLactacao(linha) {
  const f = linha.split(SEP);
  return {
    numero: f[0],
    ordem: n(f[1]),
    dtInicio: s(f[2]),
    dtFim: s(f[3]),
    motivoSecagem: s(f[4]),
    tipoAleitamento: s(f[5]),
    induzida: f[6] === "1",
    producaoTotal: n(f[7]),
    producao305: n(f[8]),
    duracaoDias: n(f[9]),
  };
}
```

No `main()`, declare o acumulador junto dos outros (`const lactacoes = [];`), adicione o roteamento no loop (junto de `@W@`):

```js
    else if (l.startsWith("@Y@")) lactacoes.push(parseLactacao(l.slice(3)));
```

e inclua `lactacoes` no objeto de saída:

```js
  const out = { geradoEm, animais, controles, eventos, eventosSanitarios, pesagens, lactacoes };
```

Acrescente uma linha ao log final (junto dos `console.error` de contagem):

```js
  console.error(`  lactações=${lactacoes.length}`);
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `node --test scripts/build-rebanho-json.test.mjs`
Expected: PASS (todos, incluindo os 2 novos).

- [ ] **Step 5: Regenerar o `rebanho_real.json` (se a extração de Task 2 rodou)**

Se você executou `bash scripts/extract-rebanho.sh` na Task 2, ele já chamou o transformer e regravou `server/prisma/rebanho_real.json` com o campo `lactacoes`. Confirme:

Run: `node -e "const j=require('./server/prisma/rebanho_real.json'); console.log('lactacoes:', j.lactacoes?.length)"`
Expected: `lactacoes: ` seguido de ~335. Se o ambiente de extração não estava disponível, este número virá `undefined` — nesse caso o `import:rebanho` (Task 4) simplesmente não terá lactações até a próxima extração real; ainda assim os testes garantem o parser.

- [ ] **Step 6: Commit**

```bash
git add scripts/build-rebanho-json.mjs scripts/build-rebanho-json.test.mjs server/prisma/rebanho_real.json
git commit -m "feat(rebanho): parseLactacao + lactacoes[] no JSON do rebanho real (TDD)"
```

---

## Task 4: Importar as lactações (substituindo a lactação-aberta atual)

**Files:**
- Modify: `server/prisma/import-rebanho.ts` (contrato JSON + bloco de import de lactação)

**Interfaces:**
- Consumes: `dados.lactacoes: LactacaoJson[]` do JSON (Task 3).
- Produces: linhas em `prisma.lactacao` com histórico completo por animal (idempotente via cascade de `Animal`).

- [ ] **Step 1: Adicionar a interface `LactacaoJson` e o campo no contrato**

Em `server/prisma/import-rebanho.ts`, adicione junto das outras interfaces (após `PesagemJson`):

```ts
interface LactacaoJson {
  numero: string;
  ordem: number | null;
  dtInicio: string;
  dtFim: string | null;
  motivoSecagem: string | null;
  tipoAleitamento: string | null;
  induzida: boolean;
  producaoTotal: number | null;
  producao305: number | null;
  duracaoDias: number | null;
}
```

e no `interface RebanhoJson` adicione o campo (opcional, para tolerar JSONs antigos):

```ts
  lactacoes?: LactacaoJson[];
```

- [ ] **Step 2: Substituir o bloco de "Lactação aberta" pelo histórico completo**

Localize o bloco atual (linhas ~227–236):

```ts
  // --- Lactação aberta (createMany) — só para quem está em lactação ---------
  const lactacaoRows = dados.animais
    .filter((a) => a.resumo.lactacaoAberta)
    .map((a) => ({
      animalId: idByNumero.get(a.numero)!,
      numero: a.resumo.ordemLactacao ?? 1,
      dtInicio: d(a.resumo.lactacaoAberta!.dtInicio)!,
      dtFim: null,
    }));
  await prisma.lactacao.createMany({ data: lactacaoRows });
```

Substitua por (histórico completo vindo de `dados.lactacoes`, com número derivado quando `ordem` faltar):

```ts
  // --- Lactações (createMany) — histórico completo do Ideagri (LACTACAO) -----
  // Substitui a antiga "lactação aberta" derivada do resumo: agora vem o histórico
  // inteiro. Número = ORDEMLACTACAO quando presente; senão, ordem cronológica por
  // animal (1ª, 2ª…). Produção só existe na lactação corrente.
  const lactPorAnimal = new Map<string, LactacaoJson[]>();
  for (const l of dados.lactacoes ?? []) {
    if (!idByNumero.has(l.numero)) continue;
    const arr = lactPorAnimal.get(l.numero);
    if (arr) arr.push(l);
    else lactPorAnimal.set(l.numero, [l]);
  }
  const lactacaoRows: {
    animalId: number; numero: number; dtInicio: Date; dtFim: Date | null;
    motivoSecagem: string | null; tipoAleitamento: string | null; induzida: boolean;
    producaoTotal: number | null; producao305: number | null; duracaoDias: number | null;
  }[] = [];
  for (const [numero, lacts] of lactPorAnimal) {
    const animalId = idByNumero.get(numero)!;
    const ordenadas = [...lacts].sort((x, y) => x.dtInicio.localeCompare(y.dtInicio));
    ordenadas.forEach((l, i) => {
      lactacaoRows.push({
        animalId,
        numero: l.ordem ?? i + 1,
        dtInicio: d(l.dtInicio)!,
        dtFim: d(l.dtFim),
        motivoSecagem: l.motivoSecagem ?? null,
        tipoAleitamento: l.tipoAleitamento ?? null,
        induzida: l.induzida ?? false,
        producaoTotal: l.producaoTotal ?? null,
        producao305: l.producao305 ?? null,
        duracaoDias: l.duracaoDias ?? null,
      });
    });
  }
  await prisma.lactacao.createMany({ data: lactacaoRows });
  console.log(`Lactações inseridas: ${lactacaoRows.length}.`);
```

- [ ] **Step 3: Verificar compilação**

Run: `pnpm --filter rionovo-server exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Rodar o import e conferir a contagem (idempotência)**

Run: `pnpm --filter rionovo-server run import:rebanho`
Expected: log inclui "Lactações inseridas: N." (N ≈ 335 se a extração real rodou; N pode ser 0 se o JSON ainda não tem `lactacoes` — aceitável até a próxima extração).

Run de novo: `pnpm --filter rionovo-server run import:rebanho`
Expected: mesma contagem N (idempotente — o `animal.deleteMany` no início cascateia as lactações antigas).

- [ ] **Step 5: Commit**

```bash
git add server/prisma/import-rebanho.ts
git commit -m "feat(rebanho): importa histórico completo de lactações (substitui lactação-aberta)"
```

---

## Task 5: Cálculo puro `resumoLactacoes` (TDD)

**Files:**
- Create: `server/src/services/rebanho/lactacoes.calc.ts`
- Test: `server/src/services/rebanho/lactacoes.calc.test.ts`

**Interfaces:**
- Consumes: array de `LactacaoRow` (subset do model: `{ numero:number; dtInicio:Date; dtFim:Date|null; motivoSecagem:string|null; producaoTotal:unknown; producao305:unknown; duracaoDias:number|null }`) + `hoje: Date`.
- Produces:
  - `duracaoLactacao(l, hoje) → number` (dias entre `dtInicio` e `dtFim`, ou `dtInicio` e `hoje` se aberta).
  - `resumoLactacoes(lacts, hoje) → { total:number; emCurso:boolean; delAtual:number|null; vidaProdutivaDias:number; producaoMediaCiclo:number|null }` — `producaoMediaCiclo` = média de `producaoTotal` das que têm valor (senão `null`); `vidaProdutivaDias` = Σ durações; `delAtual` = duração da lactação aberta (a de `dtFim=null`).

- [ ] **Step 1: Escrever o teste que falha**

Crie `server/src/services/rebanho/lactacoes.calc.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { duracaoLactacao, resumoLactacoes } from "./lactacoes.calc.js";

const D = (s: string) => new Date(`${s}T00:00:00Z`);
const hoje = D("2026-05-28");

describe("duracaoLactacao", () => {
  it("encerrada: dias entre início e fim", () => {
    expect(duracaoLactacao({ dtInicio: D("2023-08-29"), dtFim: D("2024-12-13") } as any, hoje)).toBe(472);
  });
  it("aberta: dias entre início e hoje", () => {
    expect(duracaoLactacao({ dtInicio: D("2026-05-01"), dtFim: null } as any, hoje)).toBe(27);
  });
});

describe("resumoLactacoes", () => {
  it("agrega total, vida produtiva, DEL da aberta e média das que têm produção", () => {
    const r = resumoLactacoes(
      [
        { numero: 1, dtInicio: D("2022-01-01"), dtFim: D("2022-11-01"), producaoTotal: 8000, producao305: 7000, duracaoDias: 304, motivoSecagem: "Rotina" },
        { numero: 2, dtInicio: D("2023-01-01"), dtFim: D("2023-11-01"), producaoTotal: null, producao305: null, duracaoDias: null, motivoSecagem: "Baixa produção" },
        { numero: 3, dtInicio: D("2026-05-01"), dtFim: null, producaoTotal: null, producao305: null, duracaoDias: null, motivoSecagem: null },
      ] as any,
      hoje,
    );
    expect(r.total).toBe(3);
    expect(r.emCurso).toBe(true);
    expect(r.delAtual).toBe(27);
    // vida produtiva = 304 (enc.1) + 304 (enc.2: 2023-01-01→2023-11-01) + 27 (aberta) = 635
    expect(r.vidaProdutivaDias).toBe(635);
    expect(r.producaoMediaCiclo).toBe(8000); // só a lactação 1 tem produção
  });

  it("sem produção em nenhuma → producaoMediaCiclo null", () => {
    const r = resumoLactacoes(
      [{ numero: 1, dtInicio: D("2022-01-01"), dtFim: D("2022-11-01"), producaoTotal: null, producao305: null, duracaoDias: null, motivoSecagem: null }] as any,
      hoje,
    );
    expect(r.producaoMediaCiclo).toBeNull();
    expect(r.emCurso).toBe(false);
    expect(r.delAtual).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm --filter rionovo-server exec vitest run src/services/rebanho/lactacoes.calc.test.ts`
Expected: FAIL — módulo `./lactacoes.calc.js` não existe.

- [ ] **Step 3: Implementar o cálculo puro**

Crie `server/src/services/rebanho/lactacoes.calc.ts`:

```ts
// Cálculo puro sobre o histórico de lactações — sem I/O, testável isoladamente.
export interface LactacaoRow {
  numero: number;
  dtInicio: Date;
  dtFim: Date | null;
  motivoSecagem: string | null;
  producaoTotal: unknown; // Prisma.Decimal | number | null
  producao305: unknown;
  duracaoDias: number | null;
}

const DIA_MS = 86_400_000;
const dias = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DIA_MS);
const num = (v: unknown): number | null => (v == null ? null : Number(v));

/** Duração em dias: início→fim se encerrada, senão início→hoje. */
export function duracaoLactacao(l: Pick<LactacaoRow, "dtInicio" | "dtFim">, hoje: Date): number {
  return dias(l.dtInicio, l.dtFim ?? hoje);
}

export interface ResumoLactacoes {
  total: number;
  emCurso: boolean;
  delAtual: number | null;
  vidaProdutivaDias: number;
  producaoMediaCiclo: number | null;
}

export function resumoLactacoes(lacts: LactacaoRow[], hoje: Date): ResumoLactacoes {
  const aberta = lacts.find((l) => l.dtFim == null) ?? null;
  const vidaProdutivaDias = lacts.reduce((s, l) => s + duracaoLactacao(l, hoje), 0);
  const comProducao = lacts.map((l) => num(l.producaoTotal)).filter((v): v is number => v != null);
  const producaoMediaCiclo = comProducao.length
    ? Math.round(comProducao.reduce((s, v) => s + v, 0) / comProducao.length)
    : null;
  return {
    total: lacts.length,
    emCurso: aberta != null,
    delAtual: aberta ? duracaoLactacao(aberta, hoje) : null,
    vidaProdutivaDias,
    producaoMediaCiclo,
  };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `pnpm --filter rionovo-server exec vitest run src/services/rebanho/lactacoes.calc.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add server/src/services/rebanho/lactacoes.calc.ts server/src/services/rebanho/lactacoes.calc.test.ts
git commit -m "feat(rebanho): cálculo puro resumoLactacoes (DEL, vida produtiva, média/ciclo) — TDD"
```

---

## Task 6: Service `listarLactacoes` + mapper de timeline

**Files:**
- Create: `server/src/services/rebanho/lactacoes.ts`
- Test: `server/src/services/rebanho/lactacoes.test.ts`
- Modify: `server/src/services/rebanho/producao.mappers.ts` (adicionar `toTimelineLactacao*`)
- Modify: `server/src/services/rebanho/timeline.ts` (costurar lactações)

**Interfaces:**
- Consumes: `prisma.lactacao`, `resumoLactacoes`/`duracaoLactacao`/`LactacaoRow` (Task 5), `EventoTimelineDTO` de `producao.mappers.ts`.
- Produces:
  - `listarLactacoes(animalId, hoje?) → Promise<{ lactacoes: LactacaoDTO[]; resumo: ResumoLactacoes }>` onde `LactacaoDTO = { id:number; numero:number; dtInicio:string; dtFim:string|null; duracaoDias:number|null; motivoSecagem:string|null; producaoTotal:number|null; producao305:number|null; emCurso:boolean }`.
  - `toTimelineLactacaoInicio(l)` e `toTimelineLactacaoSecagem(l)` → `EventoTimelineDTO` (domínio `"producao"`); a de secagem retorna `null` para lactação aberta.

- [ ] **Step 1: Escrever o teste dos mappers (que falha)**

Crie `server/src/services/rebanho/lactacoes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { toTimelineLactacaoInicio, toTimelineLactacaoSecagem } from "./producao.mappers.js";

const base = { id: 7, animalId: 42, numero: 2, dtInicio: new Date("2023-08-29T00:00:00Z"), dtFim: new Date("2024-12-13T00:00:00Z"), motivoSecagem: "Rotina" };

describe("mappers de lactação → timeline", () => {
  it("início de lactação vira evento de produção", () => {
    const e = toTimelineLactacaoInicio(base as any);
    expect(e.dominio).toBe("producao");
    expect(e.data).toBe("2023-08-29");
    expect(e.titulo).toContain("Início da 2ª lactação");
  });
  it("secagem só quando há dtFim, com o motivo", () => {
    const e = toTimelineLactacaoSecagem(base as any);
    expect(e).not.toBeNull();
    expect(e!.data).toBe("2024-12-13");
    expect(e!.titulo).toBe("Secagem");
    expect(e!.detalhe).toBe("Rotina");
  });
  it("secagem é null para lactação aberta", () => {
    expect(toTimelineLactacaoSecagem({ ...base, dtFim: null } as any)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter rionovo-server exec vitest run src/services/rebanho/lactacoes.test.ts`
Expected: FAIL — `toTimelineLactacaoInicio` não existe em `producao.mappers.ts`.

- [ ] **Step 3: Adicionar os mappers em `producao.mappers.ts`**

Ao final de `server/src/services/rebanho/producao.mappers.ts` (o `EventoTimelineDTO` de lá já aceita `dominio: "producao" | "nutricao"`, e `iso` já está definido no topo do arquivo):

```ts
const ordinal = (n: number) => `${n}ª`;

// Início de lactação → timeline (domínio produção).
export function toTimelineLactacaoInicio(l: any): EventoTimelineDTO {
  return {
    id: `lactacao-inicio-${l.id}`,
    animalId: String(l.animalId),
    data: iso(l.dtInicio),
    dominio: "producao",
    titulo: `Início da ${ordinal(l.numero)} lactação`,
    detalhe: l.induzida ? "induzida" : undefined,
    alerta: false,
    marcador: undefined,
  };
}

// Secagem → timeline; null quando a lactação ainda está aberta.
export function toTimelineLactacaoSecagem(l: any): EventoTimelineDTO | null {
  if (l.dtFim == null) return null;
  return {
    id: `lactacao-secagem-${l.id}`,
    animalId: String(l.animalId),
    data: iso(l.dtFim),
    dominio: "producao",
    titulo: "Secagem",
    detalhe: l.motivoSecagem ?? undefined,
    alerta: false,
    marcador: undefined,
  };
}
```

- [ ] **Step 4: Rodar o teste dos mappers e confirmar que passa**

Run: `pnpm --filter rionovo-server exec vitest run src/services/rebanho/lactacoes.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Criar o service `listarLactacoes`**

Crie `server/src/services/rebanho/lactacoes.ts`:

```ts
import { prisma } from "../../db.js";
import { resumoLactacoes, duracaoLactacao, type LactacaoRow } from "./lactacoes.calc.js";

const iso = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const num = (v: unknown): number | null => (v == null ? null : Number(v));

export interface LactacaoDTO {
  id: number;
  numero: number;
  dtInicio: string;
  dtFim: string | null;
  duracaoDias: number | null;
  motivoSecagem: string | null;
  producaoTotal: number | null;
  producao305: number | null;
  emCurso: boolean;
}

export async function listarLactacoes(animalId: number, hoje: Date = new Date()) {
  const rows = await prisma.lactacao.findMany({
    where: { animalId },
    orderBy: { numero: "desc" },
  });
  const resumo = resumoLactacoes(rows as unknown as LactacaoRow[], hoje);
  const lactacoes: LactacaoDTO[] = rows.map((l) => ({
    id: l.id,
    numero: l.numero,
    dtInicio: iso(l.dtInicio)!,
    dtFim: iso(l.dtFim),
    // duração até fim quando encerrada; DEL até hoje quando aberta (mesma fórmula)
    duracaoDias: duracaoLactacao(l as unknown as LactacaoRow, hoje),
    motivoSecagem: l.motivoSecagem,
    producaoTotal: num(l.producaoTotal),
    producao305: num(l.producao305),
    emCurso: l.dtFim == null,
  }));
  return { lactacoes, resumo };
}
```

- [ ] **Step 6: Costurar lactações na timeline (`timeline.ts`)**

Substitua o conteúdo de `server/src/services/rebanho/timeline.ts` por:

```ts
import { prisma } from "../../db.js";
import { toTimeline as toRepro } from "./eventos.mappers.js";
import { toTimeline as toSan } from "./eventos-sanidade.mappers.js";
import { toTimelineControle, toTimelinePesagem, toTimelineLactacaoInicio, toTimelineLactacaoSecagem } from "./producao.mappers.js";
export async function montarTimeline(animalId: number) {
  const [r, s, p, w, l] = await Promise.all([
    prisma.eventoReprodutivo.findMany({ where: { animalId } }),
    prisma.eventoSanitario.findMany({ where: { animalId } }),
    prisma.controleLeiteiro.findMany({ where: { animalId } }),
    prisma.pesagem.findMany({ where: { animalId } }),
    prisma.lactacao.findMany({ where: { animalId } }),
  ]);
  const lactEventos = [
    ...l.map(toTimelineLactacaoInicio),
    ...l.map(toTimelineLactacaoSecagem).filter((e): e is NonNullable<typeof e> => e != null),
  ];
  return [...r.map(toRepro), ...s.map(toSan), ...p.map(toTimelineControle), ...w.map(toTimelinePesagem), ...lactEventos].sort(
    (a, b) => Date.parse(b.data) - Date.parse(a.data),
  );
}
```

- [ ] **Step 7: Verificar compilação e a suíte inteira do server**

Run: `pnpm --filter rionovo-server exec tsc --noEmit`
Expected: PASS.

Run: `pnpm --filter rionovo-server run test`
Expected: PASS (suíte inteira, incluindo os novos testes de lactação).

- [ ] **Step 8: Commit**

```bash
git add server/src/services/rebanho/lactacoes.ts server/src/services/rebanho/lactacoes.test.ts server/src/services/rebanho/producao.mappers.ts server/src/services/rebanho/timeline.ts
git commit -m "feat(rebanho): service listarLactacoes + lactações na timeline do cockpit"
```

---

## Task 7: Rota `GET /rebanho/animais/:id/lactacoes`

**Files:**
- Modify: `server/src/routes/rebanho/animais.ts` (adicionar a rota no router encadeado)

**Interfaces:**
- Consumes: `listarLactacoes` (Task 6), `resolverEscopoLeitura` (já importado no arquivo, linha 6).
- Produces: `GET /api/rebanho/animais/:id/lactacoes` → `{ lactacoes: LactacaoDTO[]; resumo: ResumoLactacoes }`. `:id` não-numérico → 400.

- [ ] **Step 1: Importar o service no topo de `animais.ts`**

Após `import * as svc from "../../services/rebanho/animais.js";` adicione:

```ts
import { listarLactacoes } from "../../services/rebanho/lactacoes.js";
```

- [ ] **Step 2: Adicionar a rota (junto das outras `GET /rebanho/animais/:id/*`)**

Logo após a rota `.get("/rebanho/animais/:id/insights", ...)` (mantendo o encadeamento `.get(...)`), adicione:

```ts
  .get("/rebanho/animais/:id/lactacoes", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) return c.json({ error: "id inválido" }, 400);
    await resolverEscopoLeitura(c); // mantém o padrão de escopo do módulo
    return c.json(await listarLactacoes(id));
  })
```

- [ ] **Step 3: Verificar compilação**

Run: `pnpm --filter rionovo-server exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Testar a rota manualmente (server rodando)**

Suba o server (`pnpm dev:server`, porta 41873) e, usando um `id` real da lista `GET /api/rebanho/animais`:

Run: `curl -s "http://localhost:41873/api/rebanho/animais/1/lactacoes" | head -c 400`
Expected: JSON `{"lactacoes":[...],"resumo":{"total":...}}` (HTTP 200). Um `:id` inexistente retorna `{"lactacoes":[],"resumo":{"total":0,...}}`.

Run: `curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:41873/api/rebanho/animais/abc/lactacoes"`
Expected: `400`.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/rebanho/animais.ts
git commit -m "feat(rebanho): rota GET /rebanho/animais/:id/lactacoes"
```

---

## Task 8: Fetch + hook no cliente (`rebanho/api.ts`)

**Files:**
- Modify: `client/src/rebanho/api.ts` (tipos + `listarLactacoes` + `useLactacoes`)

**Interfaces:**
- Consumes: helper `req<T>` e `useState/useEffect/useCallback` (já importados no arquivo).
- Produces: `useLactacoes(id: string | null) → { data: LactacoesResp | null; loading; erro; recarregar }` onde `LactacoesResp = { lactacoes: LactacaoDTO[]; resumo: ResumoLactacoesDTO }`.

- [ ] **Step 1: Adicionar os tipos e o fetch**

Em `client/src/rebanho/api.ts`, junto dos outros tipos/fetchers (após o bloco de `useTimeline`), adicione:

```ts
export interface LactacaoDTO {
  id: number;
  numero: number;
  dtInicio: string;
  dtFim: string | null;
  duracaoDias: number | null;
  motivoSecagem: string | null;
  producaoTotal: number | null;
  producao305: number | null;
  emCurso: boolean;
}
export interface ResumoLactacoesDTO {
  total: number;
  emCurso: boolean;
  delAtual: number | null;
  vidaProdutivaDias: number;
  producaoMediaCiclo: number | null;
}
export interface LactacoesResp { lactacoes: LactacaoDTO[]; resumo: ResumoLactacoesDTO; }

export const listarLactacoes = (id: string) => req<LactacoesResp>(`/rebanho/animais/${id}/lactacoes`);

export function useLactacoes(id: string | null) {
  const [data, setData] = useState<LactacoesResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    if (!id) { setData(null); setLoading(false); return; }
    setLoading(true); setErro(null);
    listarLactacoes(id).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}
```

- [ ] **Step 2: Verificar o typecheck do client**

Run: `pnpm --filter rionovo-client exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add client/src/rebanho/api.ts
git commit -m "feat(rebanho): useLactacoes no client (fetch do histórico de lactações)"
```

---

## Task 9: Seção "Lactações" no cockpit (`AnimalCockpit.tsx`)

**Files:**
- Create: `client/src/rebanho/components/LactacoesSection.tsx`
- Modify: `client/src/rebanho/components/AnimalCockpit.tsx` (importar + renderizar a seção)

**Interfaces:**
- Consumes: `useLactacoes` (Task 8).
- Produces: componente `<LactacoesSection animalId={...} />`.

- [ ] **Step 1: Criar o componente da seção**

Crie `client/src/rebanho/components/LactacoesSection.tsx` (segue o estilo Tailwind/tipografia dos cards do cockpit — cabeçalho `font-serif`, listas com `border-b border-dashed`; as classes `text-ink-1/2` e `--rule-soft` já são usadas no cockpit):

```tsx
import { useLactacoes } from "../api";

const fmtL = (v: number | null) => (v == null ? "—" : `${v.toLocaleString("pt-BR")} L`);
const fmtDias = (v: number | null) => (v == null ? "—" : `${v} d`);

export function LactacoesSection({ animalId }: { animalId: string }) {
  const { data, loading } = useLactacoes(animalId);
  if (loading) return null;
  const lacts = data?.lactacoes ?? [];
  if (lacts.length === 0) return null;
  const r = data!.resumo;

  return (
    <div className="mt-4 rounded-lg border border-[color:var(--rule-soft)] p-4">
      <h3 className="mb-3 font-serif text-xl font-medium">Lactações</h3>
      <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-2">
        <span><b className="font-semibold text-ink-1">{r.total}</b> lactações</span>
        <span>vida produtiva <b className="font-semibold text-ink-1">{fmtDias(r.vidaProdutivaDias)}</b></span>
        <span>média/ciclo <b className="font-semibold text-ink-1">{fmtL(r.producaoMediaCiclo)}</b></span>
        {r.emCurso && <span>em curso · DEL <b className="font-semibold text-ink-1">{fmtDias(r.delAtual)}</b></span>}
      </div>
      <div className="flex flex-col">
        {lacts.map((l) => (
          <div key={l.id} className="flex items-baseline justify-between gap-3 border-b border-dashed border-[color:var(--rule-soft)] py-[6px] text-sm last:border-0">
            <span className="shrink-0 font-semibold">{l.numero}ª{l.emCurso ? " · em curso" : ""}</span>
            <span className="flex-1 text-ink-2">
              {l.dtInicio} → {l.dtFim ?? "hoje"} · {fmtDias(l.duracaoDias)}
              {l.motivoSecagem ? ` · ${l.motivoSecagem}` : ""}
            </span>
            <span className="shrink-0 text-right text-ink-2">
              {l.producaoTotal != null ? `${fmtL(l.producaoTotal)}${l.producao305 != null ? ` · 305d ${fmtL(l.producao305)}` : ""}` : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Renderizar a seção no cockpit**

Em `client/src/rebanho/components/AnimalCockpit.tsx`:

(a) adicione o import junto dos outros de `./`:

```tsx
import { LactacoesSection } from "./LactacoesSection";
```

(b) renderize a seção logo após a `Genealogia` (linha ~227), dentro do mesmo container:

```tsx
          {insights && <Genealogia g={insights.genealogia} onAbrirAnimal={onAbrirAnimal} />}
          <LactacoesSection animalId={animalId} />
```

- [ ] **Step 3: Verificar o typecheck e o build do client**

Run: `pnpm --filter rionovo-client exec tsc --noEmit`
Expected: PASS.

Run: `pnpm --filter rionovo-client run build`
Expected: build OK (vite).

- [ ] **Step 4: Verificação no browser**

Com `pnpm dev` rodando: abrir o app (porta 41875) → Rebanho → Animal → abrir o cockpit de uma **vaca multípara** (ex.: CATARINA/CAROLINA, várias lactações). Conferir:
- Seção "Lactações" aparece abaixo de Genealogia com N ciclos, motivo de secagem real (ex.: "Rotina", "Baixa produção"), e a lactação em curso destacada.
- A linha do tempo (Timeline) agora intercala "Início da Nª lactação" e "Secagem — motivo" entre parto/controles/pesagens.
- Uma vaca **sem** lactações (bezerra) não mostra a seção (retorna null).

- [ ] **Step 5: Commit**

```bash
git add client/src/rebanho/components/LactacoesSection.tsx client/src/rebanho/components/AnimalCockpit.tsx
git commit -m "feat(rebanho): seção Lactações no cockpit do animal"
```

---

## Task 10: Verificação final e QA da fatia

**Files:** nenhum (apenas verificação).

- [ ] **Step 1: Suíte completa do server**

Run: `pnpm --filter rionovo-server run test`
Expected: PASS (todos, incl. `lactacoes.calc` e `lactacoes` mappers).

- [ ] **Step 2: Suíte do client + build**

Run: `pnpm --filter rionovo-client run test`
Expected: PASS.
Run: `pnpm --filter rionovo-client run build`
Expected: OK.

- [ ] **Step 3: Idempotência do import (novamente)**

Run: `pnpm --filter rionovo-server run import:rebanho` (2×)
Expected: mesma contagem de lactações nas duas execuções; sem erro.

- [ ] **Step 4: tsc limpo nos dois workspaces**

Run: `pnpm --filter rionovo-server exec tsc --noEmit && pnpm --filter rionovo-client exec tsc --noEmit`
Expected: PASS nos dois.

- [ ] **Step 5: Abrir PR**

```bash
git push -u origin HEAD
gh pr create --title "feat(rebanho): histórico de lactações (Fatia 1 do catálogo Ideagri)" --body "$(cat <<'EOF'
## Fatia 1 — Histórico de Lactações

Importa o histórico completo de lactações do Ideagri (`LACTACAO`, ~335 ciclos, 173 animais), enriquece o model `Lactacao` (antes anêmico e não-lido), costura as lactações na timeline do cockpit e adiciona a seção "Lactações" no cockpit do animal.

Spec: `docs/superpowers/specs/2026-07-14-rebanho-historico-lactacoes-design.md`
Catálogo/roadmap: `docs/design/ideagri-catalogo-features.md`

- Model `Lactacao` +motivoSecagem/tipoAleitamento/induzida/producaoTotal/producao305/duracaoDias/propriedadeId
- Pipeline: bloco `@Y@` no dump + `parseLactacao` (TDD) + `lactacoes[]` no JSON
- Import substitui a "lactação aberta" derivada pelo histórico completo (idempotente)
- Cálculo puro `resumoLactacoes` (DEL, vida produtiva, média/ciclo) — TDD
- Rota `GET /rebanho/animais/:id/lactacoes`; hook `useLactacoes`; seção no cockpit
- Produção por lactação anterior fica como débito explícito (só a corrente tem produção no Ideagri)

Server + client tests green, tsc limpo, browser-verified (cockpit de vaca multípara).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR criado. **Não** faz merge — aguarda review (working style do módulo: usuário decide o merge).

---

## Self-Review (feito na escrita)

**Cobertura da spec:**
- Enriquecer `Lactacao` → Task 1 ✅
- Pipeline de extração (dump + transformer) → Tasks 2–3 ✅
- Import (substituindo lactação-aberta) → Task 4 ✅
- Cálculo puro (DEL/duração/vida produtiva) → Task 5 ✅
- Service + timeline + rota → Tasks 6–7 ✅
- Front (api + seção cockpit) → Tasks 8–9 ✅
- Débito "produção por lactação anterior" tratado (null na UI) → Tasks 4/5/9 ✅
- Multi-propriedade (`propriedadeId` + escopo) → Tasks 1/7 ✅

**Consistência de tipos:** `LactacaoDTO`/`ResumoLactacoes(DTO)` idênticos entre service (Task 6), rota (Task 7) e client (Task 8). `toTimelineLactacaoInicio`/`toTimelineLactacaoSecagem` mesmos nomes em producao.mappers (Task 6) e timeline (Task 6). `resumoLactacoes`/`duracaoLactacao`/`LactacaoRow` consistentes entre calc (Task 5) e service (Task 6).

**Placeholders:** nenhum — todo passo tem código/comando/expected reais.
