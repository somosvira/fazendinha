# Fatia 17 — Eventos de sanidade no cockpit — Implementation Plan

> **For agentic workers:** Backend-only, controller (Firebird). Estende o pipeline da Fatia 16. Steps com checkbox.

**Goal:** Importar `DOENCAANIMAL` (339→OCORRENCIA) + `APLICACAOPRODUTO` (3257→APLICACAO) → `EventoSanitario`, completando o lado sanitário da timeline. Sem mudança de API/UI.

**Architecture:** Blocos `@D@`/`@V@` no dump → `parseDoenca`/`parseAplicacao` no transformador → `eventosSanitarios[]` no JSON → `createMany` no importador.

## Global Constraints
- DOENCAANIMAL→OCORRENCIA (doenca=DOENCA.NOMECOMPLETO, data=DTINICIO, dtFim, diasTratamento). APLICACAOPRODUTO→APLICACAO (produto=PRODUTO.NOME, data=DTAPLICACAOPRODUTO, dose, carencia). Todos os animais da fazenda. ~3596 eventos.
- Sem mudança de schema. Idempotente (cascade). Datas via `new Date`. Server ESM, PT-BR.

---

### Task 1: Dump `@D@`/`@V@` + transformador `parseDoenca`/`parseAplicacao` (TDD)

**Files:** Modify `scripts/rebanho-dump.sql`, `scripts/build-rebanho-json.mjs`, `scripts/build-rebanho-json.test.mjs`.

- [ ] **Step 1: SQL** — adicionar ao fim de `rebanho-dump.sql`:
```sql
/* ── DOENÇAS / OCORRÊNCIAS (DOENCAANIMAL) ──────────────────────────────────── */
SELECT '@D@' || a.NUMERO
  || '~|~' || COALESCE(doe.NOMECOMPLETO,'')
  || '~|~' || COALESCE(CAST(da.DTINICIO AS VARCHAR(12)),'')
  || '~|~' || COALESCE(CAST(da.DTFIM AS VARCHAR(12)),'')
  || '~|~' || COALESCE(CAST(da.DIASTRATAMENTO AS VARCHAR(6)),'')
  || '~|~' || COALESCE(da.OBSERVACAO,'')
  AS "LINHA"
FROM DOENCAANIMAL da
  JOIN ANIMAL a ON a.CDANIMAL = da.CDANIMAL
  LEFT JOIN DOENCA doe ON doe.CDDOENCA = da.CDDOENCA
WHERE a.TIPOANIMAL='A' AND a.ANIMALREBANHO=1 AND da.DTINICIO IS NOT NULL;

/* ── APLICAÇÕES DE PRODUTO (APLICACAOPRODUTO) ──────────────────────────────── */
SELECT '@V@' || a.NUMERO
  || '~|~' || COALESCE(p.NOME,'')
  || '~|~' || COALESCE(CAST(ap.DTAPLICACAOPRODUTO AS VARCHAR(12)),'')
  || '~|~' || COALESCE(CAST(ap.DOSEAPLICADA AS VARCHAR(20)),'')
  || '~|~' || COALESCE(CAST(ap.CARENCIA AS VARCHAR(6)),'')
  || '~|~' || COALESCE(ap.OBSERVACAO,'')
  AS "LINHA"
FROM APLICACAOPRODUTO ap
  JOIN ANIMAL a ON a.CDANIMAL = ap.CDANIMAL
  LEFT JOIN PRODUTO p ON p.CDPRODUTO = ap.CDPRODUTO
WHERE a.TIPOANIMAL='A' AND a.ANIMALREBANHO=1 AND ap.DTAPLICACAOPRODUTO IS NOT NULL;
```

- [ ] **Step 2: teste** — em `build-rebanho-json.test.mjs`, importar `parseDoenca`/`parseAplicacao`:
```js
test("parseDoenca → OCORRENCIA", () => {
  const e = parseDoenca("1002~|~Mastite clínica~|~2025-03-01~|~2025-03-08~|~7~|~obs");
  assert.equal(e.numero, "1002"); assert.equal(e.tipo, "OCORRENCIA");
  assert.equal(e.doenca, "Mastite clínica"); assert.equal(e.data, "2025-03-01");
  assert.equal(e.dtFim, "2025-03-08"); assert.equal(e.diasTratamento, 7);
});
test("parseAplicacao → APLICACAO com produto/dose/carencia", () => {
  const e = parseAplicacao("1002~|~Dectomax~|~2025-04-10~|~10 ml~|~30~|~");
  assert.equal(e.tipo, "APLICACAO"); assert.equal(e.produto, "Dectomax");
  assert.equal(e.data, "2025-04-10"); assert.equal(e.dose, "10 ml"); assert.equal(e.carencia, 30);
});
```

- [ ] **Step 3: rodar e ver falhar** — `node --test scripts/build-rebanho-json.test.mjs` → FAIL.

- [ ] **Step 4: implementar** em `build-rebanho-json.mjs`:
```js
export function parseDoenca(linha) {
  const f = linha.split(SEP);
  return { numero: f[0], tipo: "OCORRENCIA", data: s(f[2]), doenca: s(f[1]),
    dtFim: s(f[3]), diasTratamento: n(f[4]), observacao: s(f[5]) };
}
export function parseAplicacao(linha) {
  const f = linha.split(SEP);
  return { numero: f[0], tipo: "APLICACAO", data: s(f[2]), produto: s(f[1]),
    dose: s(f[3]), carencia: n(f[4]), observacao: s(f[5]) };
}
```
No `main()`: `const eventosSanitarios = []`; rotear `@D@`→`eventosSanitarios.push(parseDoenca(l.slice(3)))`, `@V@`→`...parseAplicacao(...)`; adicionar `eventosSanitarios` ao objeto gravado; logar `eventosSanitarios=${eventosSanitarios.length}`.

- [ ] **Step 5: rodar e ver passar** — `node --test ...` → PASS (13 testes).

- [ ] **Step 6: commit** — `feat(rebanho): extrai eventos de sanidade (doenças + aplicações) do Ideagri`.

### Task 2: Importar EventoSanitario + verificar

**Files:** Modify `server/prisma/import-rebanho.ts`, `server/prisma/rebanho_real.json`.

- [ ] **Step 1: re-extrair** — `bash scripts/extract-rebanho.sh`. Conferir: `python3 -c "import json,collections as c; d=json.load(open('server/prisma/rebanho_real.json')); s=d.get('eventosSanitarios',[]); print('sanit', len(s), dict(c.Counter(e['tipo'] for e in s)))"` → ~3596; OCORRENCIA ~339, APLICACAO ~3257.

- [ ] **Step 2: importer** — em `import-rebanho.ts`: `interface EventoSanitarioJson { numero; tipo; data; doenca?; dtFim?; diasTratamento?; produto?; dose?; carencia?; observacao? }` + `eventosSanitarios: EventoSanitarioJson[]` no `RebanhoJson`. Após os eventos reprodutivos, montar `sanitarioRows` (filtrar `idByNumero.has` + `data`) com `animalId, tipo, data: d(e.data)!, doenca, dtFim: d(e.dtFim), diasTratamento, produto, dose, carencia, observacao` (campos ausentes → null) e `createMany` em lotes de 500. Logar a contagem.

- [ ] **Step 3: re-import + verificar**:
```bash
pnpm --filter rionovo-server run import:rebanho
DB=$(grep -m1 DATABASE_URL server/.env | cut -d= -f2- | tr -d '"')
psql "$DB" -tAc "select tipo,count(*) from \"EventoSanitario\" group by tipo order by 2 desc;"  # APLICACAO ~3257, OCORRENCIA ~339
psql "$DB" -tAc "select e.tipo,e.data::date,coalesce(e.produto,e.doenca,'-') from \"EventoSanitario\" e join \"Animal\" a on a.id=e.\"animalId\" where a.numero='1002' order by e.data desc limit 5;"
```
Idempotente (2× → não dobra).

- [ ] **Step 4: build/test server** — `pnpm --filter rionovo-server build` + `test` verdes.

- [ ] **Step 5: commit** — `feat(rebanho): importa eventos de sanidade reais (cockpit timeline)`.

---

## Verificação final (controller, navegador)
- Cockpit de um animal com aplicações (ex.: Lactotropin/Dectomax) e/ou doenças: timeline costura reprodução + **sanidade** + produção.
- PR, merge, sync, catalogar + memória.

## Self-review
- Cobertura: §2→T1, §3 import→T2, §4→final. Tipos: `tipo` ∈ TipoEventoSanitario; datas Date. Sem placeholders. ✓

## Deferido
- MAMITE+ANALISELEITE (qualidade do leite); VACINA distinta; EXAME; custo de sanidade (APLICACAOPRODUTO × custo do produto); pesagens; composição racial; reclassificação Animal Aquisição.
