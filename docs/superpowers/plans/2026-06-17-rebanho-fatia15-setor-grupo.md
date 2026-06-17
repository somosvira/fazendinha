# Fatia 15 — Separar setor × grupo + filtro de Setor — Implementation Plan

> **For agentic workers:** Tasks 1–2 são controller-only (Firebird). Tasks 3–4 (API+UI) são subagente-friendly. Steps com checkbox.

**Goal:** Parar de conflar setor↔grupo no import (passar a trazer o lote de manejo real de `ANIMALINFO_CADASTRO.GRUPO`, separado do setor) e adicionar um filtro de Setor na aba Animal.

**Architecture:** Estende o pipeline da Fatia 14 (SQL dump → transformador → import). API ganha filtro `setor` + endpoint `/rebanho/setores`; UI ganha dropdown de Setor.

**Tech Stack:** Firebird isql, Node ESM, Prisma 6, Hono + Zod, React 18.

## Global Constraints
- Fonte: `ANIMALINFO_CADASTRO` (`SETOR` físico, `GRUPO` = lote atual; batem com a UI do Ideagri). Vazio → null.
- Não tocar em `extract_rio_novo.py`; sem mudança de schema (Animal já tem `setor` texto + `grupoId`).
- Setor/grupo não afetam custo/litro (produção filtra status). Server ESM (`.js`), PT-BR.

---

### Task 1: Extração traz setor+grupo separados (controller)

**Files:** Modify `scripts/rebanho-dump.sql`, `scripts/build-rebanho-json.mjs`, `scripts/build-rebanho-json.test.mjs`.

- [ ] **Step 1: `rebanho-dump.sql`** — no bloco `@A@`, trocar `LEFT JOIN SETOR s ON s.CDSETOR=a.CDSETOR` por `LEFT JOIN ANIMALINFO_CADASTRO c ON c.CDANIMAL=a.CDANIMAL`; o campo de setor passa a `COALESCE(c.SETOR,'')` e **adicionar** ao final `|| '~|~' || COALESCE(c.GRUPO,'')` (15º campo). Manter pelagem (13) p/ raça.

- [ ] **Step 2: teste do transformador** — em `build-rebanho-json.test.mjs`, atualizar a linha de exemplo de `parseAnimal` para 15 campos e asserir `setor`/`grupo` separados:
```js
const linha = "1002~|~CATARINA~|~F~|~7~|~2019-06-01~|~2022-10-01~|~~|~~|~0~|~BAIXADO~|~2026-04-10~|~Venda~|~Principal - Leite~|~~|~Vacas secas";
const a = parseAnimal(linha);
assert.equal(a.setor, "Principal - Leite");
assert.equal(a.grupo, "Vacas secas");
// animal sem grupo → null
assert.equal(parseAnimal("10~|~~|~F~|~7~|~2023-05-13~|~2023-05-13~|~~|~~|~0~|~ATIVO~|~~|~~|~Principal - Leite~|~~|~").grupo, null);
```

- [ ] **Step 3: rodar e ver falhar** — `node --test scripts/build-rebanho-json.test.mjs` → FAIL (parseAnimal não lê grupo).

- [ ] **Step 4: implementar** — em `parseAnimal`, adicionar `grupo: s(f[14])` ao objeto retornado (setor continua `s(f[12])`, raca `racaDe(f[13])`). Em `main()`, **remover** `a.grupo = a.setor;` (manter `if (a.grupo) grupos.add(a.grupo)` lendo o `a.grupo` já parseado).

- [ ] **Step 5: rodar e ver passar** — `node --test scripts/build-rebanho-json.test.mjs` → PASS (7+ testes).

- [ ] **Step 6: commit** — `git commit -am "feat(rebanho): extrai setor e grupo (lote) separados do ANIMALINFO_CADASTRO"`.

### Task 2: Regenerar JSON + re-import + verificar (controller)

**Files:** Modify `server/prisma/rebanho_real.json`.

- [ ] **Step 1: re-extrair** — `bash scripts/extract-rebanho.sh`. Validar o JSON:
```bash
python3 - <<'PY'
import json,collections
d=json.load(open("server/prisma/rebanho_real.json")); a=[x for x in d["animais"] if x["status"]=="ATIVO"]
print("setores:", dict(collections.Counter(x["setor"] for x in a)))
print("grupos:", dict(collections.Counter(x["grupo"] for x in a).most_common(6)))
print("sem grupo:", sum(1 for x in a if x["grupo"] is None))
PY
```
Esperado: setores = 5 valores; grupos = lotes reais (Vacas secas, Bezerreiro, "1"…); ~271 sem grupo. **setor ≠ grupo agora.**

- [ ] **Step 2: re-import** — `pnpm --filter rionovo-server run import:rebanho`. Conferir Postgres:
```bash
DB=$(grep -m1 DATABASE_URL server/.env | cut -d= -f2- | tr -d '"')
psql "$DB" -tAc "select g.nome,count(*) from \"Animal\" a join \"Grupo\" g on g.id=a.\"grupoId\" where a.status='ATIVO' group by g.nome order by 2 desc limit 8;"
psql "$DB" -tAc "select count(distinct setor) from \"Animal\" where setor is not null;"  -- 5
```
Esperado: grupos reais (Bezerreiro, Vacas secas…); 5 setores. Idempotente (rodar 2×).

- [ ] **Step 3: build/test server** — `pnpm --filter rionovo-server build` limpo; `pnpm --filter rionovo-server test` verde.

- [ ] **Step 4: commit** — `git commit -am "feat(rebanho): re-import com grupo de manejo real (setor separado)"`.

### Task 3: API — filtro setor + endpoint /rebanho/setores (subagente-friendly)

**Files:** Modify `server/src/services/rebanho/animais.schemas.ts`, `server/src/services/rebanho/animais.ts` (service `listar`), `server/src/routes/rebanho/animais.ts`. Test: `server/src/services/rebanho/animais.*.test.ts` (se houver de filtro) ou smoke.

**Interfaces:**
- Produz: `GET /rebanho/animais?setor=<nome>` filtra por setor; `GET /rebanho/setores` → `string[]`.

- [ ] **Step 1:** no schema de **listagem** (o que tem `status/grupoId/q`), adicionar `setor: z.string().max(40).optional()`.
- [ ] **Step 2:** no service `listar(...)`, no objeto `where`, adicionar `...(setor ? { setor } : {})`.
- [ ] **Step 3:** novo service `listarSetores(): Promise<string[]>` = `(await prisma.animal.findMany({ where: { setor: { not: null } }, select: { setor: true }, distinct: ["setor"], orderBy: { setor: "asc" } })).map(a => a.setor!)`.
- [ ] **Step 4:** rota `GET /rebanho/setores` no router de animais, chamando `listarSetores`.
- [ ] **Step 5:** build server + test. Smoke manual: `curl /api/rebanho/setores` → 5 setores; `curl '/api/rebanho/animais?setor=Principal%20-%20Leite&status=ATIVO'` → só desse setor.
- [ ] **Step 6: commit** — `git commit -am "feat(rebanho): API filtra animais por setor + GET /rebanho/setores"`.

### Task 4: UI — dropdown de Setor na aba Animal (subagente-friendly)

**Files:** Modify `client/src/rebanho/api.ts` (hook `useSetores` + `listarAnimais` aceita `setor`), `client/src/rebanho/components/AnimalTab.tsx`. Test: estender `client/src/rebanho/__smoke__/render.test.ts`.

- [ ] **Step 1:** em `api.ts`, `listarAnimais` já manda `qs(f)` — adicionar `setor?` ao tipo do filtro de `useAnimais`/`listarAnimais`. Novo `export const listarSetores = () => req<string[]>("/rebanho/setores")` + hook `useSetores()` (mesma forma de `useGrupos`).
- [ ] **Step 2:** em `AnimalTab.tsx`, `const [setor, setSetor] = useState<string>("")` (""=todos); `useAnimais({ status, setor: setor || undefined })`; `const { data: setores } = useSetores()`. Renderizar um `<select>` ao lado dos botões de status:
```tsx
<select className="rb-select" value={setor} onChange={(e) => setSetor(e.target.value)} style={{ position: "absolute", left: 220, top: 30, zIndex: 2 }}>
  <option value="">Todos os setores</option>
  {(setores ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
</select>
```
- [ ] **Step 3:** smoke em `render.test.ts` — a AnimalTab renderiza "Todos os setores".
- [ ] **Step 4:** client build + test verdes.
- [ ] **Step 5: commit** — `git commit -am "feat(rebanho): dropdown de Setor na aba Animal"`.

---

## Verificação final (controller, navegador)
- Aba Animal: dropdown de Setor (5 opções) filtra (Principal - Leite → 266); coluna de grupo mostra lote real (Vacas secas, Bezerreiro…). Filtros status + setor combinam.
- Nutrição: agrupa por lote real (não mais por setor).
- PR, merge, sync, catalogar + memória.

## Self-review
- Cobertura: §3 extração→T1, re-import→T2, API→T3, UI→T4. Verificação→§final. ✓
- Sem placeholders; código concreto. Tipos: `setor`/`grupo` string|null consistentes; `setores: string[]`. ✓

## Decisões deferidas
- `GRUPOS` plural; limpeza de grupos órfãos; setor→centro de custo; reclassificação Animal Aquisição.
