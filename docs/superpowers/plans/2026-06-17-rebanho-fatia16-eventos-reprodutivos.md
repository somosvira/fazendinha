# Fatia 16 — Eventos reprodutivos no cockpit — Implementation Plan

> **For agentic workers:** Backend-only, controller (Firebird). Estende o pipeline da Fatia 14/15. Steps com checkbox.

**Goal:** Importar `REPRODUCAO` (3.119 eventos) → `EventoReprodutivo`, enchendo a timeline do cockpit dos animais reais. Sem mudança de API/UI (timeline já lê EventoReprodutivo).

**Architecture:** Bloco `@E@` no dump SQL → `parseEvento` no transformador → `eventos[]` no JSON → `createMany` no importador.

## Global Constraints
- Mapa: cdtipo {1,2,3}→INSEMINACAO, 4→DIAGNOSTICO, 7→PARTO. DIAGNOSTICO `P`→positivo/`N`→negativo (só tipo 4). reprodutor = nome do touro (join). Eventos de TODOS os animais da fazenda (ativos+baixados) = 3.119.
- Sem mudança de schema. Idempotente (cascade do animal.deleteMany limpa eventos). Datas via `new Date`. Server ESM, PT-BR.

---

### Task 1: Dump `@E@` + transformador `parseEvento` (TDD)

**Files:** Modify `scripts/rebanho-dump.sql`, `scripts/build-rebanho-json.mjs`, `scripts/build-rebanho-json.test.mjs`.

- [ ] **Step 1: SQL** — adicionar ao fim de `rebanho-dump.sql`:
```sql
/* ── EVENTOS REPRODUTIVOS (REPRODUCAO) ─────────────────────────────────────── */
SELECT '@E@' || a.NUMERO
  || '~|~' || CAST(r.CDTIPOREPRODUCAO AS VARCHAR(4))
  || '~|~' || CAST(r.DATA AS VARCHAR(12))
  || '~|~' || COALESCE(rep.NOME, rep.NUMERO, '')
  || '~|~' || COALESCE(r.DIAGNOSTICO,'')
  || '~|~' || COALESCE(CAST(r.DTPARTOPROVAVEL AS VARCHAR(12)),'')
  || '~|~' || COALESCE(CAST(r.CDTIPOPARTO AS VARCHAR(4)),'')
  || '~|~' || COALESCE(CAST(r.NUMCRIA AS VARCHAR(4)),'')
  || '~|~' || COALESCE(r.SEXOCRIA1,'')
  AS "LINHA"
FROM REPRODUCAO r
  JOIN ANIMAL a ON a.CDANIMAL = r.CDANIMAL
  LEFT JOIN ANIMAL rep ON rep.CDANIMAL = r.CDREPRODUTOR
WHERE a.TIPOANIMAL='A' AND a.ANIMALREBANHO=1 AND r.DATA IS NOT NULL;
```

- [ ] **Step 2: teste** — em `build-rebanho-json.test.mjs`, importar `parseEvento` e testar:
```js
test("parseEvento: IA → INSEMINACAO com reprodutor", () => {
  const e = parseEvento("1002~|~1~|~2025-07-31~|~BRUISER~|~~|~~|~~|~~|~");
  assert.equal(e.numero, "1002"); assert.equal(e.tipo, "INSEMINACAO");
  assert.equal(e.data, "2025-07-31"); assert.equal(e.reprodutor, "BRUISER");
});
test("parseEvento: diagnóstico P → DIAGNOSTICO resultado positivo", () => {
  const e = parseEvento("1002~|~4~|~2025-08-20~|~~|~P~|~2026-05-01~|~~|~~|~");
  assert.equal(e.tipo, "DIAGNOSTICO"); assert.equal(e.resultado, "positivo");
  assert.equal(e.dtPartoPrevista, "2026-05-01");
});
test("parseEvento: cobertura/TE → INSEMINACAO com observação", () => {
  assert.match(parseEvento("1~|~2~|~2025-01-01~|~~|~~|~~|~~|~~|~").observacao, /Cobertura/);
  assert.match(parseEvento("1~|~3~|~2025-01-01~|~~|~~|~~|~~|~~|~").observacao, /embri/i);
});
test("parseEvento: parto → PARTO com cria", () => {
  const e = parseEvento("1027~|~7~|~2023-09-12~|~~|~~|~~|~1~|~1~|~M");
  assert.equal(e.tipo, "PARTO"); assert.equal(e.numCrias, 1); assert.equal(e.sexoCria, "M");
});
```

- [ ] **Step 3: rodar e ver falhar** — `node --test scripts/build-rebanho-json.test.mjs` → FAIL (parseEvento ausente).

- [ ] **Step 4: implementar** em `build-rebanho-json.mjs`:
```js
const TIPO_EV = { "1": "INSEMINACAO", "2": "INSEMINACAO", "3": "INSEMINACAO", "4": "DIAGNOSTICO", "7": "PARTO" };
export function parseEvento(linha) {
  const f = linha.split(SEP);
  const cdtipo = f[1];
  const tipo = TIPO_EV[cdtipo] ?? "INSEMINACAO";
  const obs = cdtipo === "2" ? "Cobertura (monta natural)" : cdtipo === "3" ? "Transferência de embrião" : null;
  return {
    numero: f[0],
    tipo,
    data: s(f[2]),
    reprodutor: s(f[3]),
    resultado: cdtipo === "4" ? (f[4] === "P" ? "positivo" : f[4] === "N" ? "negativo" : null) : null,
    dtPartoPrevista: s(f[5]),
    tipoParto: cdtipo === "7" ? s(f[6]) : null,
    numCrias: cdtipo === "7" ? n(f[7]) : null,
    sexoCria: cdtipo === "7" ? s(f[8]) : null,
    observacao: obs,
  };
}
```
No `main()`: rotear `@E@` → `eventos.push(parseEvento(l.slice(3)))`; adicionar `eventos` ao objeto gravado (`{ geradoEm, animais, controles, eventos }`); logar `eventos=${eventos.length}`.

- [ ] **Step 5: rodar e ver passar** — `node --test ...` → PASS (11 testes).

- [ ] **Step 6: commit** — `feat(rebanho): extrai eventos reprodutivos (REPRODUCAO) do Ideagri`.

### Task 2: Regenerar JSON + importar eventos + verificar

**Files:** Modify `server/prisma/import-rebanho.ts`, `server/prisma/rebanho_real.json`.

- [ ] **Step 1: re-extrair** — `bash scripts/extract-rebanho.sh`. Conferir: `python3 -c "import json,collections as c; d=json.load(open('server/prisma/rebanho_real.json')); print('eventos', len(d['eventos'])); print(dict(c.Counter(e['tipo'] for e in d['eventos'])))"` → ~3119; INSEMINACAO ~1006, DIAGNOSTICO ~1775, PARTO ~338.

- [ ] **Step 2: importer** — em `import-rebanho.ts`: adicionar interface `EventoJson` (numero, tipo, data, reprodutor, resultado, dtPartoPrevista, tipoParto, numCrias, sexoCria, observacao) ao `RebanhoJson` (`eventos: EventoJson[]`); após criar animais (já há o mapa `numero→animalId`), montar `eventoRows` e `createMany` em lotes de 500:
```ts
const eventoRows = dados.eventos
  .filter((e) => animalIdByNum.get(e.numero) != null)
  .map((e) => ({
    animalId: animalIdByNum.get(e.numero)!,
    tipo: e.tipo, data: d(e.data)!,
    reprodutor: e.reprodutor ?? null, resultado: e.resultado ?? null,
    dtPartoPrevista: d(e.dtPartoPrevista), tipoParto: e.tipoParto ?? null,
    numCrias: e.numCrias ?? null, sexoCria: e.sexoCria ?? null, observacao: e.observacao ?? null,
  }));
for (let i = 0; i < eventoRows.length; i += 500) await prisma.eventoReprodutivo.createMany({ data: eventoRows.slice(i, i + 500) });
console.log(`Eventos reprodutivos inseridos: ${eventoRows.length}.`);
```
(Usar o nome real do mapa numero→animalId que já existe no arquivo; conferir.)

- [ ] **Step 3: re-import + verificar** — `pnpm --filter rionovo-server run import:rebanho`; depois:
```bash
DB=$(grep -m1 DATABASE_URL server/.env | cut -d= -f2- | tr -d '"')
psql "$DB" -tAc "select count(*) from \"EventoReprodutivo\";"           # ~3119
psql "$DB" -tAc "select tipo,count(*) from \"EventoReprodutivo\" group by tipo order by 2 desc;"
psql "$DB" -tAc "select e.tipo,e.data,e.reprodutor,e.resultado from \"EventoReprodutivo\" e join \"Animal\" a on a.id=e.\"animalId\" where a.numero='1002' order by e.data desc limit 5;"
```
Idempotente (rodar 2× → não dobra).

- [ ] **Step 4: build/test server** — `pnpm --filter rionovo-server build` + `test` verdes.

- [ ] **Step 5: commit** — `feat(rebanho): importa eventos reprodutivos reais (cockpit timeline)`.

---

## Verificação final (controller, navegador)
- Cockpit de CATARINA #1002 (e outros): timeline com eventos reais (IA com touro, DG positivo/negativo + previsão de parto, parto com cria), ordenados por data.
- PR, merge, sync, catalogar + memória.

## Self-review
- Cobertura: §2 mapeamento→T1; §3 import→T2; §4 verificação→final. ✓
- Tipos: `tipo` ∈ TipoEventoReprodutivo; `resultado` string; datas Date. Sem placeholders (código completo). ✓

## Deferido
- Sanidade (DOENCAANIMAL/APLICACAOPRODUTO/MAMITE), pesagens (PESO), CIO/SECAGEM, genealogia, composição racial, reclassificação Animal Aquisição.
