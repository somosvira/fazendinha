# Reprodução Bloco A — IATF/TETF operacional completo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) para implementar tarefa a tarefa. Passos usam checkbox (`- [ ]`).

**Goal:** Fechar as linhas *Protocolo/programação IATF/TETF* e *Execução/sincronização IATF* do contrato de paridade, entregando execução coletiva de lote, formulário operacional completo, progresso real do lote, evento terminal idempotente e finalidade TETF sobre dado criado no app; o adaptador legado é guiado pelo inventário e falha fechado sem a fonte.

**Architecture:** Rota fina (`routes/rebanho/`) → service (`services/rebanho/`) → cálculo puro (`*.calc.ts`) + schemas (`*.schemas.ts`), com TDD. O snapshot por aplicação (`ExecucaoEtapaIATF`) continua sendo a fonte do status; lote apenas agrega e despacha mudanças, sem manter um segundo estado.

**Tech Stack:** Hono + @hono/zod-validator + Zod + Prisma 6 + Vitest; React 18 + Vite + TypeScript. Sem dependências novas.

## Global Constraints

- Comandos por workspace a partir da raiz; não existe target `test` na raiz.
- Server: imports relativos terminam em `.js`; client: sem extensão. Domínio e mensagens em PT-BR.
- Escopo de propriedade em toda leitura/escrita via `resolverEscopoLeitura/Escrita(c)`; catálogo compartilhado usa `OR: [{ propriedadeId }, { propriedadeId: null }]`.
- Datas civis são `YYYY-MM-DD`; `@db.Date` é gravado em UTC meia-noite.
- `hoje` é argumento em cálculo puro; nunca chamar relógio dentro dele.
- Schema novo recebe migration aditiva idempotente e `pnpm prisma:generate`.
- Cada mutação composta usa transação; acesso cruzado retorna `NAO_ENCONTRADO`.
- Commits terminam com `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- O inventário de colunas e o `DADOS777.FDB` não existem nesta máquina. Import legado aborta se o inventário não estiver disponível; não inventar campos.

---

### Task 1: Finalidade e identidades de origem no schema

**Files:**
- Modify: `server/prisma/schema.prisma`
- Create: `server/prisma/migrations/20260726120000_iatf_finalidade_origem/migration.sql`

**Interfaces:**
- Produces: `FinalidadeIATF { IATF TETF }`; `ProtocoloIATF.finalidade`; `ProtocoloIATF.ideagriId`; `ProgramacaoIATFLote.ideagriId`; `AplicacaoProtocoloIATF.ideagriId`; `EventoReprodutivo.origemExecucaoId` (todos IDs de origem opcionais e únicos).

- [ ] **Step 1: Adicionar enum e campos ao schema**

Antes de `model ProtocoloIATF`:
```prisma
enum FinalidadeIATF {
  IATF
  TETF
}
```
Em `ProtocoloIATF`:
```prisma
  finalidade        FinalidadeIATF @default(IATF)
  ideagriId         Int?           @unique
```
Em `ProgramacaoIATFLote` e `AplicacaoProtocoloIATF`, respectivamente:
```prisma
  ideagriId         Int?           @unique
```
Em `EventoReprodutivo`:
```prisma
  origemExecucaoId  Int?           @unique
```

- [ ] **Step 2: Criar migration aditiva**

```sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FinalidadeIATF') THEN
    CREATE TYPE "FinalidadeIATF" AS ENUM ('IATF', 'TETF');
  END IF;
END $$;
ALTER TABLE "ProtocoloIATF"
  ADD COLUMN IF NOT EXISTS "finalidade" "FinalidadeIATF" NOT NULL DEFAULT 'IATF',
  ADD COLUMN IF NOT EXISTS "ideagriId" INTEGER;
ALTER TABLE "ProgramacaoIATFLote" ADD COLUMN IF NOT EXISTS "ideagriId" INTEGER;
ALTER TABLE "AplicacaoProtocoloIATF" ADD COLUMN IF NOT EXISTS "ideagriId" INTEGER;
ALTER TABLE "EventoReprodutivo" ADD COLUMN IF NOT EXISTS "origemExecucaoId" INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS "ProtocoloIATF_ideagriId_key" ON "ProtocoloIATF"("ideagriId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProgramacaoIATFLote_ideagriId_key" ON "ProgramacaoIATFLote"("ideagriId");
CREATE UNIQUE INDEX IF NOT EXISTS "AplicacaoProtocoloIATF_ideagriId_key" ON "AplicacaoProtocoloIATF"("ideagriId");
CREATE UNIQUE INDEX IF NOT EXISTS "EventoReprodutivo_origemExecucaoId_key" ON "EventoReprodutivo"("origemExecucaoId");
```

- [ ] **Step 3: Gerar Prisma**

Run: `pnpm prisma:generate`
Expected: `Generated Prisma Client`.

- [ ] **Step 4: Commit**
```bash
git add server/prisma/schema.prisma server/prisma/migrations/20260726120000_iatf_finalidade_origem/
git commit -m "$(printf 'feat(rebanho): finalidade IATF/TETF e identidades de origem\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>')"
```

---

### Task 2: Cálculo puro de execução coletiva e resumo real (TDD)

**Files:**
- Create: `server/src/services/rebanho/iatf-lote-exec.calc.ts`
- Test: `server/src/services/rebanho/iatf-lote-exec.calc.test.ts`

**Interfaces:**
- Produces:
```ts
export interface ExecLote { id: number; dia: number; ordem: number; status: StatusExecucao; dataPlanejada: string }
export interface AplicacaoLoteExec { aplicacaoId: number; animalId: number; execucoes: ExecLote[] }
export interface AlvoEtapa { dia: number; ordem: number }
export function planejarExecucaoColetiva(apps: readonly AplicacaoLoteExec[], alvo: AlvoEtapa, status: StatusExecucao, excecoesAnimalIds: readonly number[]): PlanoExecucao[];
export function agregarStatusLote(apps: readonly AplicacaoLoteExec[], hoje: string): ResumoLoteExec;
```

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { planejarExecucaoColetiva, agregarStatusLote, type AplicacaoLoteExec } from "./iatf-lote-exec.calc.js";

const apps: AplicacaoLoteExec[] = [
  { aplicacaoId: 1, animalId: 101, execucoes: [
    { id: 11, dia: 0, ordem: 0, status: "PENDENTE", dataPlanejada: "2026-07-06" },
    { id: 12, dia: 7, ordem: 0, status: "PENDENTE", dataPlanejada: "2026-07-13" },
  ]},
  { aplicacaoId: 2, animalId: 102, execucoes: [
    { id: 21, dia: 0, ordem: 0, status: "CONCLUIDA", dataPlanejada: "2026-07-06" },
    { id: 22, dia: 7, ordem: 0, status: "PENDENTE", dataPlanejada: "2026-07-13" },
  ]},
];

describe("planejarExecucaoColetiva", () => {
  it("seleciona dia+ordem para cada animal e respeita exceções", () => {
    expect(planejarExecucaoColetiva(apps, { dia: 7, ordem: 0 }, "CONCLUIDA", [101]))
      .toEqual([{ execucaoId: 22, aplicacaoId: 2, animalId: 102, status: "CONCLUIDA" }]);
  });
});

describe("agregarStatusLote", () => {
  it("agrega status/atraso e aponta a primeira etapa pendente", () => {
    const r = agregarStatusLote(apps, "2026-07-14");
    expect(r.totalAnimais).toBe(2);
    expect(r.porEtapa.find((e) => e.dia === 0)).toMatchObject({ concluidas: 1, pendentes: 1, atrasadas: 1 });
    expect(r.porEtapa.find((e) => e.dia === 7)).toMatchObject({ pendentes: 2, atrasadas: 2 });
    expect(r.proximaEtapa).toEqual({ dia: 0, ordem: 0 });
    expect(r.concluido).toBe(false);
  });
  it("conclui somente quando não há pendência", () => {
    const done: AplicacaoLoteExec[] = [{ aplicacaoId: 9, animalId: 109, execucoes: [
      { id: 91, dia: 0, ordem: 0, status: "CONCLUIDA", dataPlanejada: "2026-07-06" },
      { id: 92, dia: 7, ordem: 0, status: "PULADA", dataPlanejada: "2026-07-13" },
    ]}];
    expect(agregarStatusLote(done, "2026-07-20")).toMatchObject({ concluido: true, proximaEtapa: null });
  });
});
```

- [ ] **Step 2: Rodar e confirmar RED**

Run: `pnpm --filter rionovo-server exec vitest run src/services/rebanho/iatf-lote-exec.calc.test.ts`
Expected: FAIL por módulo inexistente.

- [ ] **Step 3: Implementar o cálculo mínimo**

```ts
import type { StatusExecucao } from "./iatf.calc.js";
export interface ExecLote { id: number; dia: number; ordem: number; status: StatusExecucao; dataPlanejada: string }
export interface AplicacaoLoteExec { aplicacaoId: number; animalId: number; execucoes: ExecLote[] }
export interface AlvoEtapa { dia: number; ordem: number }
export interface PlanoExecucao extends AlvoEtapa { execucaoId: number; aplicacaoId: number; animalId: number; status: StatusExecucao }
export interface EtapaResumoLote extends AlvoEtapa { concluidas: number; puladas: number; pendentes: number; atrasadas: number }
export interface ResumoLoteExec { totalAnimais: number; porEtapa: EtapaResumoLote[]; proximaEtapa: AlvoEtapa | null; concluido: boolean }

export function planejarExecucaoColetiva(apps: readonly AplicacaoLoteExec[], alvo: AlvoEtapa, status: StatusExecucao, excecoesAnimalIds: readonly number[]): PlanoExecucao[] {
  const excecoes = new Set(excecoesAnimalIds);
  return apps.flatMap((a) => {
    if (excecoes.has(a.animalId)) return [];
    const e = a.execucoes.find((x) => x.dia === alvo.dia && x.ordem === alvo.ordem);
    return e ? [{ execucaoId: e.id, aplicacaoId: a.aplicacaoId, animalId: a.animalId, dia: alvo.dia, ordem: alvo.ordem, status }] : [];
  });
}

export function agregarStatusLote(apps: readonly AplicacaoLoteExec[], hoje: string): ResumoLoteExec {
  const m = new Map<string, EtapaResumoLote>();
  for (const a of apps) for (const e of a.execucoes) {
    const k = `${e.dia}:${e.ordem}`;
    const r = m.get(k) ?? { dia: e.dia, ordem: e.ordem, concluidas: 0, puladas: 0, pendentes: 0, atrasadas: 0 };
    if (e.status === "CONCLUIDA") r.concluidas++;
    else if (e.status === "PULADA") r.puladas++;
    else { r.pendentes++; if (e.dataPlanejada < hoje) r.atrasadas++; }
    m.set(k, r);
  }
  const porEtapa = [...m.values()].sort((a, b) => a.dia - b.dia || a.ordem - b.ordem);
  const p = porEtapa.find((e) => e.pendentes > 0) ?? null;
  return { totalAnimais: apps.length, porEtapa, proximaEtapa: p ? { dia: p.dia, ordem: p.ordem } : null, concluido: porEtapa.length > 0 && !p };
}
```

- [ ] **Step 4: Rodar e confirmar GREEN**

Run: `pnpm --filter rionovo-server exec vitest run src/services/rebanho/iatf-lote-exec.calc.test.ts`
Expected: 3 testes PASS.

- [ ] **Step 5: Commit**
```bash
git add server/src/services/rebanho/iatf-lote-exec.calc.ts server/src/services/rebanho/iatf-lote-exec.calc.test.ts
git commit -m "$(printf 'feat(rebanho): cálculo puro do status real de lote IATF\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>')"
```

---

### Task 3: Schemas/DTOs para finalidade, campos operacionais e lote

**Files:**
- Modify: `server/src/services/rebanho/iatf.schemas.ts`
- Modify: `server/src/services/rebanho/iatf-lote.schemas.ts`
- Modify: `server/src/services/rebanho/iatf.ts`

**Interfaces:**
- Produces `executarEtapaLoteSchema`/`ExecutarEtapaLoteInput` e propaga `finalidade` no CRUD do protocolo.

- [ ] **Step 1: Adicionar `finalidade` aos schemas de protocolo**

Nos objetos de criação/atualização:
```ts
  finalidade: z.enum(["IATF", "TETF"]).optional(),
```

- [ ] **Step 2: Adicionar schema coletivo**

Ao fim de `iatf-lote.schemas.ts`:
```ts
export const executarEtapaLoteSchema = z.object({
  dia: z.number().int().min(0).max(365),
  ordem: z.number().int().min(0).max(99),
  status: z.enum(["CONCLUIDA", "PULADA", "PENDENTE"]),
  dataExecucao: dataISO.optional(),
  excecoesAnimalIds: z.array(z.number().int().positive()).max(500).optional(),
  produto: z.string().max(120).nullable().optional(),
  dose: z.string().max(40).nullable().optional(),
  observacao: z.string().max(500).nullable().optional(),
});
export type ExecutarEtapaLoteInput = z.infer<typeof executarEtapaLoteSchema>;
```

- [ ] **Step 3: Propagar `finalidade` pelo service**

`ProtocoloDTO`/`ProtocoloRow` ganham `finalidade: "IATF" | "TETF"`; `protocoloDTO` retorna o campo; `criarProtocolo` usa `input.finalidade ?? "IATF"`; `atualizarProtocolo` inclui `finalidade` quando fornecida.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter rionovo-server exec tsc -p tsconfig.json --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit**
```bash
git add server/src/services/rebanho/iatf.schemas.ts server/src/services/rebanho/iatf-lote.schemas.ts server/src/services/rebanho/iatf.ts
git commit -m "$(printf 'feat(rebanho): finalidade e payload operacional completo do IATF/TETF\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>')"
```

---

### Task 4: Evento terminal idempotente na execução individual (TDD)

**Files:**
- Modify: `server/src/services/rebanho/iatf.ts`
- Test: `server/src/services/rebanho/iatf.idempotente.test.ts`

**Interfaces:**
- Produces: ao concluir a etapa terminal, IATF cria/upserta `INSEMINACAO`; TETF cria/upserta `TRANSFERENCIA_EMBRIAO`; reabrir/pular remove o evento vinculado. Chave: `origemExecucaoId`.

- [ ] **Step 1: Escrever testes de idempotência**

Cobrir três casos com mock Prisma: (a) concluir terminal IATF faz `upsert({where:{origemExecucaoId}})`; (b) reconcluir chama o mesmo upsert e não `create`; (c) reabrir/pular faz `deleteMany({where:{origemExecucaoId}})`; (d) etapa não terminal não cria evento; (e) TETF usa `TRANSFERENCIA_EMBRIAO`.

Teste central:
```ts
expect(eventoUpsert).toHaveBeenCalledWith(expect.objectContaining({
  where: { origemExecucaoId: 52 },
  create: expect.objectContaining({ animalId: 7, tipo: "INSEMINACAO", origemExecucaoId: 52 }),
}));
```

- [ ] **Step 2: Rodar e confirmar RED**

Run: `pnpm --filter rionovo-server exec vitest run src/services/rebanho/iatf.idempotente.test.ts`
Expected: FAIL por comportamento ausente.

- [ ] **Step 3: Extrair helper transacional**

Em `iatf.ts`, implementar:
```ts
async function reconciliarEventoTerminal(
  tx: Prisma.TransactionClient,
  ex: { id: number; dia: number; dataPlanejada: Date; produto: string | null },
  app: AplicacaoRow,
  status: StatusExecucao,
  dataExecucao: Date | null,
): Promise<void> {
  const terminal = Math.max(...app.protocolo.etapas.map((e) => e.dia));
  if (ex.dia !== terminal) return;
  if (status !== "CONCLUIDA") {
    await tx.eventoReprodutivo.deleteMany({ where: { origemExecucaoId: ex.id } });
    return;
  }
  const tipo = app.protocolo.finalidade === "TETF" ? "TRANSFERENCIA_EMBRIAO" : "INSEMINACAO";
  await tx.eventoReprodutivo.upsert({
    where: { origemExecucaoId: ex.id },
    create: {
      animalId: app.animalId,
      tipo,
      data: dataExecucao ?? ex.dataPlanejada,
      protocolo: app.protocolo.nome,
      reprodutor: ex.produto ?? (tipo === "INSEMINACAO" ? "IATF" : null),
      origemExecucaoId: ex.id,
    },
    update: { data: dataExecucao ?? ex.dataPlanejada, protocolo: app.protocolo.nome },
  });
}
```
`executarEtapa` passa a executar update + helper dentro de uma transação. Após a transação, chamar `recomputarAnimal` em transação separada somente quando a etapa era terminal (o helper é idempotente; a recomputação não duplica fatos).

- [ ] **Step 4: Rodar e confirmar GREEN**

Run: `pnpm --filter rionovo-server exec vitest run src/services/rebanho/iatf.idempotente.test.ts src/services/rebanho/iatf.calc.test.ts`
Expected: todos PASS.

- [ ] **Step 5: Commit**
```bash
git add server/src/services/rebanho/iatf.ts server/src/services/rebanho/iatf.idempotente.test.ts
git commit -m "$(printf 'feat(rebanho): evento terminal idempotente na execução IATF/TETF\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>')"
```

---

### Task 5: Service e rota de execução coletiva com resumo real (TDD)

**Files:**
- Modify: `server/src/services/rebanho/iatf-lote.ts`
- Test: `server/src/services/rebanho/iatf-lote.exec.test.ts`
- Modify: `server/src/routes/rebanho/iatf-lote.ts`

**Interfaces:**
- Produces:
```ts
export function executarEtapaLote(programacaoId: number, input: ExecutarEtapaLoteInput, propriedadeId: number|null): Promise<{aplicados:number; ignorados:number; resumo:ResumoLoteExec}>;
```
- Rota: `PATCH /api/rebanho/iatf/programacoes/:id/execucoes`.
- `ProgramacaoDetalheDTO` ganha `resumoExec: ResumoLoteExec`.

- [ ] **Step 1: Escrever testes de service**

Mockar programação no escopo, duas aplicações com execuções e exceção de um animal. Assertar: só a execução elegível é atualizada; `aplicados=1`, `ignorados=1`; outro sítio resulta `NAO_ENCONTRADO`; o detalhe agrega o estado real e não infere por data.

- [ ] **Step 2: Rodar e confirmar RED**

Run: `pnpm --filter rionovo-server exec vitest run src/services/rebanho/iatf-lote.exec.test.ts`
Expected: FAIL por função/DTO ausente.

- [ ] **Step 3: Implementar service**

- Buscar programação com `registroNoEscopo`.
- Buscar aplicações com `animalId`, `protocolo.finalidade`, etapas e execuções.
- Converter para `AplicacaoLoteExec`; chamar `planejarExecucaoColetiva`.
- Em uma `prisma.$transaction`, atualizar cada execução do plano, chamar o mesmo helper de reconciliação terminal exportado pela Task 4 e recomputar os animais afetados; erro aborta o lote inteiro.
- Rebuscar as aplicações e retornar `agregarStatusLote(atualizadas, hojeUTC())`.
- Em `detalheProgramacao`, incluir execuções reais e retornar `resumoExec`.

Núcleo da seleção:
```ts
const plano = planejarExecucaoColetiva(aplicacoes, { dia: input.dia, ordem: input.ordem }, input.status, input.excecoesAnimalIds ?? []);
if (!plano.length) return { aplicados: 0, ignorados: aplicacoes.length, resumo: agregarStatusLote(aplicacoes, hojeUTC()) };
```

- [ ] **Step 4: Expor a rota**

Adicionar import de `executarEtapaLoteSchema` e encadear:
```ts
.patch("/rebanho/iatf/programacoes/:id/execucoes", zValidator("json", executarEtapaLoteSchema), async (c) => {
  try {
    const propriedadeId = await resolverEscopoEscrita(c);
    return c.json(await svc.executarEtapaLote(Number(c.req.param("id")), c.req.valid("json"), propriedadeId));
  } catch (e) { const { status, body } = fail(e); return c.json(body, status); }
})
```

- [ ] **Step 5: Rodar e confirmar GREEN + typecheck**

Run: `pnpm --filter rionovo-server exec vitest run src/services/rebanho/iatf-lote.exec.test.ts src/services/rebanho/iatf-lote-exec.calc.test.ts && pnpm --filter rionovo-server exec tsc -p tsconfig.json --noEmit`
Expected: testes PASS, typecheck sem erro.

- [ ] **Step 6: Commit**
```bash
git add server/src/services/rebanho/iatf-lote.ts server/src/services/rebanho/iatf-lote.exec.test.ts server/src/routes/rebanho/iatf-lote.ts
git commit -m "$(printf 'feat(rebanho): execução coletiva e progresso real do lote IATF/TETF\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>')"
```

---

### Task 6: Client — campos operacionais e execução coletiva

**Files:**
- Modify: `client/src/rebanho/api.ts`
- Modify: `client/src/rebanho/components/IatfSection.tsx`
- Modify: `client/src/rebanho/components/ProgramacaoIatfLote.tsx`

**Interfaces:**
- DTOs adicionam `finalidade`, `ResumoLoteExecDTO` e `executarEtapaLoteIatf`.

- [ ] **Step 1: Estender API tipada**

```ts
export interface EtapaResumoLoteDTO { dia:number; ordem:number; concluidas:number; puladas:number; pendentes:number; atrasadas:number }
export interface ResumoLoteExecDTO { totalAnimais:number; porEtapa:EtapaResumoLoteDTO[]; proximaEtapa:{dia:number;ordem:number}|null; concluido:boolean }
export const executarEtapaLoteIatf = (id:number, body:{dia:number;ordem:number;status:"CONCLUIDA"|"PULADA"|"PENDENTE";dataExecucao?:string;excecoesAnimalIds?:number[];produto?:string|null;dose?:string|null;observacao?:string|null}) =>
  req<{aplicados:number;ignorados:number;resumo:ResumoLoteExecDTO}>(`/rebanho/iatf/programacoes/${id}/execucoes`, { method:"PATCH", body:JSON.stringify(body) });
```
`ProtocoloIatfDTO`/input ganham `finalidade`; `aplicarProtocoloIatf` aceita `usoCidr`, `estimulo`, `perdaImplante`; detalhe de programação ganha `resumoExec`.

- [ ] **Step 2: Completar IatfSection**

Adicionar controles `CIDR`, `estímulo`, `perda de implante` à aplicação. Ao editar uma etapa, exibir inputs `produto`, `dose`, `observação`; enviar todos em `executarEtapaIatf`. Manter os botões rápidos feita/pular/reabrir.

- [ ] **Step 3: Completar ProgramacaoIatfLote**

Card expansível busca `detalheProgramacaoIatf`; mostra por etapa `concluídas/puladas/pendentes/atrasadas`; oferece feita/pular/reabrir coletivamente e checkboxes de exceção por animal.

- [ ] **Step 4: Verificar client**

Run: `pnpm --filter rionovo-client exec tsc -b --noEmit && pnpm --filter rionovo-client run test`
Expected: typecheck e testes verdes.

- [ ] **Step 5: Commit**
```bash
git add client/src/rebanho/api.ts client/src/rebanho/components/IatfSection.tsx client/src/rebanho/components/ProgramacaoIatfLote.tsx
git commit -m "$(printf 'feat(rebanho): operação completa e execução coletiva na UI IATF/TETF\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>')"
```

---

### Task 7: Adaptador de import legado guiado por inventário (TDD)

**Files:**
- Modify: `scripts/build-rebanho-json.mjs`
- Test: `scripts/build-rebanho-json.test.mjs`
- Modify: `server/prisma/import-rebanho.ts`

**Interfaces:**
- Produces parsers `parseProtocoloIatf`, `parseProtocoloPrincipio`, `parseProgramacaoIatf`, `parseProgramacaoAssociacao` e import idempotente por `ideagriId`.

- [ ] **Step 1: Escrever testes com fixtures sintéticos**

```js
test("parseProtocoloIatf preserva id/nome/finalidade e rejeita tipo desconhecido", () => {
  assert.deepEqual(parseProtocoloIatf("10~|~IATF 11 dias~|~IATF"), { ideagriId:10, nome:"IATF 11 dias", finalidade:"IATF" });
  assert.equal(parseProtocoloIatf("11~|~X~|~ZZZ"), null);
});
test("parseProgramacaoAssociacao preserva animal/programação/CIDR/estímulo/perda", () => {
  assert.deepEqual(parseProgramacaoAssociacao("1234~|~500~|~700~|~1~|~eCG~|~0"), {
    numero:"1234", ideagriId:500, programacaoIdeagriId:700, usoCidr:true, estimulo:"eCG", perdaImplante:false,
  });
});
```

- [ ] **Step 2: Rodar e confirmar RED**

Run: `pnpm exec node --test scripts/build-rebanho-json.test.mjs`
Expected: FAIL por parsers inexistentes.

- [ ] **Step 3: Implementar parsers fail-closed**

Implementar seções sintéticas `@PROTOIATF@`, `@PROTOPRIN@`, `@PROGIATF@`, `@PROGASSOC@`; finalidade fora de `IATF|TETF`, ID ausente ou referência quebrada retorna `null`, e o `main()` aborta como já faz com tipo reprodutivo desconhecido.

- [ ] **Step 4: Import idempotente**

Se os arrays existirem no JSON, fazer `upsert` de protocolos/programações/aplicações por `ideagriId`; se ausentes, no-op. Nunca inventar dados para preencher 5/31/74/466.

- [ ] **Step 5: Rodar e confirmar GREEN**

Run: `pnpm exec node --test scripts/build-rebanho-json.test.mjs`
Expected: todos PASS.

- [ ] **Step 6: Commit**
```bash
git add scripts/build-rebanho-json.mjs scripts/build-rebanho-json.test.mjs server/prisma/import-rebanho.ts
git commit -m "$(printf 'feat(rebanho): adaptador idempotente para dados IATF do IDEAGRI\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>')"
```

---

### Task 8: Gate do Bloco A

**Files:** verificação apenas.

- [ ] **Step 1: Testes focados server**

Run: `pnpm --filter rionovo-server exec vitest run src/services/rebanho/iatf.calc.test.ts src/services/rebanho/iatf-lote-exec.calc.test.ts src/services/rebanho/iatf.idempotente.test.ts src/services/rebanho/iatf-lote.exec.test.ts src/services/rebanho/reproducao.propriedade.test.ts`
Expected: todos PASS.

- [ ] **Step 2: Testes do extrator**

Run: `pnpm exec node --test scripts/build-rebanho-json.test.mjs`
Expected: todos PASS.

- [ ] **Step 3: Build completo**

Run: `pnpm build`
Expected: server/client exit 0.

- [ ] **Step 4: Registrar limitação de reconciliação real**

No resultado do bloco, declarar: parsers/import idempotente entregues; contagens 5/31/74/466 aguardam execução na máquina com o `DADOS777.FDB` e inventário. Não marcar reconciliação como verde sem essa evidência.

---

## Self-Review

- **Cobertura:** execução coletiva (Tasks 2/5/6), formulário completo (Task 6), resumo real (Tasks 2/5), evento idempotente (Task 4), TETF (Tasks 1/3/4), import (Task 7), gate (Task 8).
- **Sem placeholders:** a única dependência externa está explicitamente bloqueada por falta da fonte e falha fechado; não há campos IDEAGRI inventados.
- **Tipos:** `StatusExecucao` vem de `iatf.calc.ts`; `ResumoLoteExec`/`AplicacaoLoteExec` nascem na Task 2 e são usados na 5/6; `finalidade` é o mesmo union em Prisma/service/client; `origemExecucaoId` é unique no schema e chave do upsert.
