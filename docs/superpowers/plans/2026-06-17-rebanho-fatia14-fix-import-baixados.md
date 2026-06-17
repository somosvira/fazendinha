# Fatia 14 — Corrigir import do rebanho + filtro de baixados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`). **Parte A (Tasks 1–4) é controller-only** (acesso ao Firebird do Ideagri via `isql.exe` em WSL — subagente não tem). **Parte B (Task 5) é subagente-friendly** (mudança só no client).

**Goal:** Substituir o `rebanho_real.json` errado (824 animais, incluía embrião/sêmen/baixado) pela extração correta (631 animais da fazenda = 522 ativos + 109 baixados), commitar um script de extração reproduzível, e expor um filtro Ativos/Baixados/Todos na aba Animal.

**Architecture:** Script SQL delimitado via `isql.exe` → transformador Node ESM monta o JSON → importador Prisma idempotente já existente. Client ganha um seletor de status (API/hook já suportam).

**Tech Stack:** Firebird `isql.exe` (FBCVT), Node ESM, Prisma 6, React 18 + Vite + TS.

## Global Constraints

- Filtro de extração **exato**: `TIPOANIMAL='A' AND ANIMALREBANHO=1` (ativos + baixados da fazenda). Ativo ⇔ `DTBAIXA IS NULL`.
- Contagens-alvo: total **631**; ATIVO **522** (124 VACA / 328 NOVILHA / 67 BEZERRA / 3 TOURO); BAIXADO **109**.
- Mapa de categoria: CD7→VACA · CD6→NOVILHA · CD5→BEZERRA · CD1→BEZERRO · CD2/3/4→TOURO.
- Status: `DTBAIXA IS NULL`→`ATIVO` (dataBaixa/motivoBaixa null); senão `BAIXADO` + `dataBaixa=DTBAIXA` + `motivoBaixa` via `MOTIVOBAIXA.NOME`.
- Não tocar em `extract_rio_novo.py` nem em `Produto`/`MovimentoEstoque`/`Lancamento`/`Dieta`. Sem mudança de schema.
- Server ESM (`.js` nos imports relativos). PT-BR. Idempotente.
- FDB vivo: `/mnt/c/Program Files (x86)/Rúmina/Ideagri/dados/DADOS777.FDB`. isql: `…/FBCVT/isql.exe -user SYSDBA -password masterkey`. Scratch: `/mnt/c/Users/Public/idr_scratch`. **Copiar** o FDB antes de ler (nunca o vivo). **Não** selecionar colunas blob (`OBSERVACAO` etc.) — quebram o isql.

---

### Task 1: SQL de dump delimitado + verificar colunas dos read-models (controller)

**Files:** Create `scripts/rebanho-dump.sql`.

- [ ] **Step 1: Verificar nomes de coluna** dos read-models contra o FDB (a Fatia 12 documentou, mas re-confirmar): rodar `SELECT RDB$FIELD_NAME FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME IN ('ANIMALINFO_PRODUCAO','ANIMALINFO_REPRODUCAO','LEITE','SETOR')`. Anotar os nomes reais de: produção (`ORDEMLACTACAO`, `MEDIAPRODLACATUAL`/`PRODUCAOMEDIA7D`, `PRODUCAO305ULTLAC`, `ULTCCSLACATUAL`, `DTPREVISTASECAGEM`, `DTINICIOULTLAC`, `DTULTSECAGEM`), reprodução (`DTULTDG`, `RESULTADOULTDG`, `IEPPROJETADO`, `DTPREVPARTO`), leite (`CDANIMAL`, `DTLEITE`, `PESO1/2/3`, `PESOTOTAL`). Ajustar os SELECTs do Step 2 aos nomes reais.

- [ ] **Step 2: Escrever `scripts/rebanho-dump.sql`** com 4 blocos delimitados por `'~|~'`, cada um precedido de `SET WIDTH` largo. Usar `COALESCE(...,'')` em texto e datas formatadas. Exemplo (animais):

```sql
SET HEADING OFF;
SET WIDTH LINHA 4000;
-- ANIMAIS
SELECT '@A@' || a.NUMERO
  || '~|~' || COALESCE(a.NOME,'')
  || '~|~' || a.SEXO
  || '~|~' || a.CDCATEGORIA
  || '~|~' || COALESCE(CAST(a.DTNASCIMENTO AS VARCHAR(20)),'')
  || '~|~' || COALESCE(CAST(a.DTENTFAZENDA AS VARCHAR(20)),'')
  || '~|~' || COALESCE(a.BRINCOELETRONICO,'')
  || '~|~' || COALESCE(a.SISBOV,'')
  || '~|~' || COALESCE(CAST(a.NUMPARTOENTRADA AS VARCHAR(8)),'0')
  || '~|~' || (CASE WHEN a.DTBAIXA IS NULL THEN 'ATIVO' ELSE 'BAIXADO' END)
  || '~|~' || COALESCE(CAST(a.DTBAIXA AS VARCHAR(20)),'')
  || '~|~' || COALESCE(mb.NOME,'')
  || '~|~' || COALESCE(s.NOME,'')
  || '~|~' || COALESCE(p.NOME,'')
  AS "LINHA"
FROM ANIMAL a
  LEFT JOIN MOTIVOBAIXA mb ON mb.CDMOTIVOBAIXA = a.CDMOTIVOBAIXA
  LEFT JOIN SETOR s ON s.CDSETOR = a.CDSETOR
  LEFT JOIN PELAGEM p ON p.CDPELAGEM = a.CDPELAGEM
WHERE a.TIPOANIMAL='A' AND a.ANIMALREBANHO=1;
```

Blocos análogos para produção (`@P@`+CDANIMAL+campos), reprodução (`@R@`+...), controles (`@L@`+...), cada um filtrando `CDANIMAL IN (SELECT CDANIMAL FROM ANIMAL WHERE TIPOANIMAL='A' AND ANIMALREBANHO=1)`. Prefixos `@A@/@P@/@R@/@L@` deixam o transformador rotear a linha. (Pelagem→raça: o transformador mapeia nome de pelagem→raça; default "Girolando".)

- [ ] **Step 3: Rodar o dump** e conferir que a saída tem **631** linhas `@A@`:

```bash
ISQL="/mnt/c/Program Files (x86)/Rúmina/Ideagri/FBCVT/isql.exe"
cp "/mnt/c/Program Files (x86)/Rúmina/Ideagri/dados/DADOS777.FDB" /mnt/c/Users/Public/idr_scratch/DADOS777_x.FDB
"$ISQL" -user SYSDBA -password masterkey 'C:\Users\Public\idr_scratch\DADOS777_x.FDB' -i scripts/rebanho-dump.sql -o /mnt/c/Users/Public/idr_scratch/dump.txt 2>&1
grep -c '^@A@' /mnt/c/Users/Public/idr_scratch/dump.txt   # esperado: 631
```

- [ ] **Step 4: Commit** — `git add scripts/rebanho-dump.sql && git commit -m "feat(rebanho): SQL de dump do Ideagri (filtro TIPOANIMAL=A, pertence à fazenda)"`.

### Task 2: Transformador Node ESM (TDD) (controller)

**Files:** Create `scripts/build-rebanho-json.mjs`; Create `scripts/build-rebanho-json.test.mjs`.

- [ ] **Step 1: Teste falhando** — `scripts/build-rebanho-json.test.mjs` (rodável com `node --test`):

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAnimal, derivarStatusRepro, categoriaDe, racaDe } from "./build-rebanho-json.mjs";

test("categoriaDe mapeia CDCATEGORIA por código e sexo", () => {
  assert.equal(categoriaDe("7", "F"), "VACA");
  assert.equal(categoriaDe("6", "F"), "NOVILHA");
  assert.equal(categoriaDe("5", "F"), "BEZERRA");
  assert.equal(categoriaDe("1", "M"), "BEZERRO");
  assert.equal(categoriaDe("2", "M"), "TOURO");
});

test("parseAnimal lê uma linha @A@ delimitada (baixado com motivo)", () => {
  const linha = "1002~|~CATARINA~|~F~|~7~|~2019-06-01~|~2022-10-01~|~~|~~|~0~|~BAIXADO~|~2026-04-10~|~Venda~|~~|~Girolando";
  const a = parseAnimal(linha);
  assert.equal(a.numero, "1002");
  assert.equal(a.nome, "CATARINA");
  assert.equal(a.categoria, "VACA");
  assert.equal(a.status, "BAIXADO");
  assert.equal(a.dataBaixa, "2026-04-10");
  assert.equal(a.motivoBaixa, "Venda");
});

test("derivarStatusRepro: DG positivo => PRENHE", () => {
  assert.equal(derivarStatusRepro({ ultimoDgResultado: "positivo" }, 100), "PRENHE");
});
```

- [ ] **Step 2: Rodar e ver falhar** — `node --test scripts/build-rebanho-json.test.mjs` → FAIL (módulo não exporta as funções).

- [ ] **Step 3: Implementar `scripts/build-rebanho-json.mjs`** — funções puras + main:
  - `categoriaDe(cd, sexo)`: `{7:VACA,6:NOVILHA,2:TOURO,3:TOURO,4:TOURO}[cd]` senão (cd 1/5) `sexo==='F'?'BEZERRA':'BEZERRO'`.
  - `racaDe(nomePelagem)`: se vazio→"Girolando"; senão o próprio nome (a normalização fina fica deferida).
  - `parseAnimal(linha)`: `split('~|~')` nas 14 colunas da Task 1 Step 2 → objeto `{numero,nome,sexo,categoria,dataNascimento,dataEntrada,brincoEletronico,sisbov,numPartosEntrada,status,dataBaixa,motivoBaixa,setor,raca,grupo}` (campos vazios→null; `numPartosEntrada`→Number; `categoria=categoriaDe(cdcat,sexo)`; `raca=racaDe(pelagem)`; `grupo` = setor por enquanto, como na Fatia 12).
  - `derivarStatusRepro(repro, del)`: `ultimoDgResultado==='positivo'`→PRENHE; senão `del!=null && del<60`→PEV; senão VAZIA.
  - `delEStatusLactacao(prod, hoje)`: se `DTINICIOULTLAC` presente e não há `DTULTSECAGEM > DTINICIOULTLAC` → `{del: dias(DTINICIOULTLAC→hoje), lactacaoAberta:{dtInicio:DTINICIOULTLAC}}`; senão `{del:null}`.
  - `main()`: lê o arquivo de dump (caminho via `process.argv[2]`), roteia linhas por prefixo `@A@/@P@/@R@/@L@`, junta produção/reprodução no `resumo` de cada animal (por numero/CDANIMAL→numero), monta `controles[]`, e grava `server/prisma/rebanho_real.json` com `{geradoEm: process.argv[3] ?? "2026-06-17", animais, controles}`. (Datas já vêm `YYYY-MM-DD` do isql; passar timestamp por argv — `Date.now()` não é usado.)

- [ ] **Step 4: Rodar e ver passar** — `node --test scripts/build-rebanho-json.test.mjs` → PASS.

- [ ] **Step 5: Commit** — `git add scripts/build-rebanho-json.mjs scripts/build-rebanho-json.test.mjs && git commit -m "feat(rebanho): transformador dump→rebanho_real.json (TDD)"`.

### Task 3: Orquestrador + regenerar o JSON (controller)

**Files:** Create `scripts/extract-rebanho.sh`; Modify `server/prisma/rebanho_real.json` (regenerado).

- [ ] **Step 1: `scripts/extract-rebanho.sh`** — variáveis no topo (`IDEAGRI_DB`, `ISQL`, `SCRATCH`); copia o FDB vivo→scratch, roda `isql … -i scripts/rebanho-dump.sql -o $SCRATCH/dump.txt`, depois `node scripts/build-rebanho-json.mjs $SCRATCH/dump.txt "$(date +%F)"`. Ecoa as contagens ao final.

- [ ] **Step 2: Rodar** `bash scripts/extract-rebanho.sh` e validar o JSON:

```bash
python3 - <<'PY'
import json,collections
d=json.load(open("server/prisma/rebanho_real.json")); a=d["animais"]
print("total",len(a))                                                  # 631
print("status",dict(collections.Counter(x["status"] for x in a)))      # ATIVO 522 / BAIXADO 109
ativos=[x for x in a if x["status"]=="ATIVO"]
print("ativos cat",dict(collections.Counter(x["categoria"] for x in ativos)))  # VACA124 NOVILHA328 BEZERRA67 TOURO3
print("controles",len(d["controles"]))
PY
```
Esperado: total 631, ATIVO 522 (VACA 124/NOVILHA 328/BEZERRA 67/TOURO 3), BAIXADO 109, controles > 0.

- [ ] **Step 3: Commit** — `git add scripts/extract-rebanho.sh server/prisma/rebanho_real.json && git commit -m "feat(rebanho): re-extração correta (631 animais: 522 ativos + 109 baixados)"`.

### Task 4: Importer grava motivoBaixa + re-import + verificação (controller)

**Files:** Modify `server/prisma/import-rebanho.ts` (se necessário).

- [ ] **Step 1: Conferir o importer** — abrir `import-rebanho.ts` e garantir que o `animal.create`/`createMany` grava `status`, `dataBaixa: a.dataBaixa? new Date(a.dataBaixa):null` e `motivoBaixa: a.motivoBaixa ?? null` a partir do JSON. Se faltar `motivoBaixa`, adicionar.

- [ ] **Step 2: Re-importar** — `pnpm --filter rionovo-server run import:rebanho`. Esperado: log "631 animais, … em lactação, … controles".

- [ ] **Step 3: Verificar Postgres**:

```bash
DB=$(grep -m1 DATABASE_URL server/.env | cut -d= -f2- | tr -d '"')
psql "$DB" -tAc "select status,count(*) from \"Animal\" group by status;"   # ATIVO 522 / BAIXADO 109
psql "$DB" -tAc "select categoria,count(*) from \"Animal\" where status='ATIVO' group by categoria order by 2 desc;"  # 328/124/67/3
psql "$DB" -tAc "select count(*) from \"ControleLeiteiro\";"                  # > 0
```
Rodar o import 2× e conferir que as contagens não dobram (idempotência).

- [ ] **Step 4: Build/test server** — `pnpm --filter rionovo-server build` limpo; `pnpm --filter rionovo-server test` verde.

- [ ] **Step 5: Commit** (se houve mudança no importer) — `git commit -am "feat(rebanho): importer grava motivoBaixa dos baixados"`.

### Task 5: Filtro Ativos/Baixados/Todos na aba Animal (subagente-friendly)

**Files:** Modify `client/src/rebanho/components/AnimalTab.tsx`; Test `client/src/rebanho/__smoke__/animaltab-filtro.test.tsx` (ou estender o smoke existente).

**Interfaces:**
- Consome: `useAnimais({ status })` (já existe, `status: "ATIVO"|"BAIXADO"|"TODOS"`); `Animal` tem `ativo`, `dataBaixa`, `motivoBaixa` (já no `types.ts`).
- Produz: nada para outras tasks.

- [ ] **Step 1: Teste falhando** — render smoke que monta a `AnimalTab` e confere que existe um seletor com as três opções. `client/src/rebanho/__smoke__/animaltab-filtro.test.tsx`:

```tsx
import { renderToString } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { AnimalTab } from "../components/AnimalTab";

describe("AnimalTab filtro de status", () => {
  it("renderiza o seletor Ativos/Baixados/Todos", () => {
    const html = renderToString(<AnimalTab onAbrirAnimal={() => {}} onNovo={() => {}} />);
    expect(html).toContain("Ativos");
    expect(html).toContain("Baixados");
    expect(html).toContain("Todos");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `pnpm --filter rionovo-client test -- animaltab-filtro` → FAIL (texto ausente).

- [ ] **Step 3: Implementar** — em `AnimalTab.tsx`, adicionar `const [status, setStatus] = useState<"ATIVO"|"BAIXADO"|"TODOS">("ATIVO");` e trocar `useAnimais({ status: "ATIVO" })` por `useAnimais({ status })`. Renderizar um grupo de botões (mesmo padrão visual dos toggles do app — `aria-pressed`) acima do `HerdDomainView`:

```tsx
const OPCOES: { k: "ATIVO"|"BAIXADO"|"TODOS"; lab: string }[] = [
  { k: "ATIVO", lab: "Ativos" }, { k: "BAIXADO", lab: "Baixados" }, { k: "TODOS", lab: "Todos" },
];
// dentro do return, antes do HerdDomainView:
<div className="rb-segmented" style={{ position: "absolute", left: 40, top: 30, zIndex: 2, display: "flex", gap: 6 }}>
  {OPCOES.map((o) => (
    <button key={o.k} className="rb-btn" aria-pressed={status === o.k} onClick={() => setStatus(o.k)}>{o.lab}</button>
  ))}
</div>
```
Manter o botão "+ Novo animal" onde está. (O loading/erro já existem.)

- [ ] **Step 4: Mostrar info da baixa** — quando `status !== "ATIVO"`, anexar ao `nomes[a.id]` (ou via uma coluna do domínio) a marca de baixa. Mínimo: passar para o `HerdDomainView` um sufixo no nome dos baixados — em `AnimalTab`, montar `nomes` assim:

```tsx
const nomes = Object.fromEntries(data.map((a) => [a.id, {
  nome: a.ativo ? a.nome : `${a.nome} · baixa ${a.dataBaixa ?? ""}${a.motivoBaixa ? " ("+a.motivoBaixa+")" : ""}`.trim(),
  numero: a.numero,
}]));
```
(Solução mínima sem mexer no `HerdDomainView`; refino visual fica deferido.)

- [ ] **Step 5: Rodar e ver passar** — `pnpm --filter rionovo-client test -- animaltab-filtro` → PASS. Rodar `pnpm --filter rionovo-client build` (tsc + vite) limpo.

- [ ] **Step 6: Commit** — `git commit -am "feat(rebanho): filtro Ativos/Baixados/Todos na aba Animal"`.

---

## Verificação final (controller, navegador)
- Aba **Animal** default = **522 ativos** (nomes reais, breakdown coerente). Seletor → **Baixados** = 109 (com data/motivo no nome). **Todos** = 631.
- **Custo/litro** (aba Custo): recalcula a partir das 124 vacas reais — anotar o novo valor (esperado subir vs R$ 5,35).
- **Dashboard/Produção:** inalterados pelos baixados (filtram `status=ATIVO`).
- PR, merge, sync main. Atualizar o catálogo `docs/HANDOFF-roadmap-tassila-2026-06-17.md` e a memória.

## Self-review
- **Cobertura da spec:** §1–4 (extração/filtro/status/JSON) → Tasks 1–3; §5 (script) → Tasks 1–3; §6 (importer) → Task 4; §7 (UI) → Task 5; §8 (verificação) → seção final. ✓
- **Placeholders:** nenhum — SQL, transformador e JSX completos; colunas dos read-models verificadas no Task 1 Step 1. ✓
- **Consistência de tipos:** `status` usa `"ATIVO"|"BAIXADO"|"TODOS"` em client e API; `categoriaDe` retorna os 5 buckets do `CategoriaAnimal`. ✓

## Decisões deferidas
- Embriões/sêmen; demais filtros do Ideagri (setor/sexo); genealogia; refino visual da marca de baixa; design da reclassificação "Animal Aquisição".
