# Fatia 16 — Eventos reprodutivos reais no cockpit (REPRODUCAO → EventoReprodutivo) — Design

**Data:** 2026-06-17
**Status:** aprovado no brainstorming (usuário escolheu "Timeline real no cockpit"; começando incremental pela reprodução).
**Depende de:** Fatia 14/15 (pipeline `scripts/extract-rebanho.sh` + importador); modelos `EventoReprodutivo`/timeline (Fatia 2/3).

---

## 1. Problema

O **cockpit do animal** (centro do módulo) mostra **empty-state** pros 631 animais reais: a gente importou só o *resumo agregado* (`ResumoAnimal`), nunca os **eventos**. O Ideagri tem `REPRODUCAO` = **3.119 eventos reprodutivos** por animal (IA, cobertura, TE, diagnóstico, parto), prontos pra encher a timeline.

## 2. Fonte e mapeamento (verificado)

**`REPRODUCAO`** (evento por animal: `CDANIMAL`, `DATA`, `CDTIPOREPRODUCAO`, `CDREPRODUTOR`, `DIAGNOSTICO`, `DTPARTOPROVAVEL`, `CDTIPOPARTO`, `NUMCRIA`, `SEXOCRIA1`, `OBSERVACAO`).

`CDTIPOREPRODUCAO` → nosso `TipoEventoReprodutivo`:
| Ideagri | n | → nosso tipo | nota |
|---|---|---|---|
| 1 Inseminação Artificial | 808 | `INSEMINACAO` | reprodutor = touro |
| 2 Cobertura | 60 | `INSEMINACAO` | observação "Cobertura (monta natural)" |
| 3 Transferência de embrião | 138 | `INSEMINACAO` | observação "Transferência de embrião" |
| 4 Diagnóstico reprodutivo | 1.775 | `DIAGNOSTICO` | `resultado` = DIAGNOSTICO `P`→positivo / `N`→negativo |
| 7 Parto | 338 | `PARTO` | `tipoParto`/`numCrias`/`sexoCria` |

- **`reprodutor`** (string): nome do touro via `LEFT JOIN ANIMAL rep ON rep.CDANIMAL=r.CDREPRODUTOR` (ex.: CATARINA #1002 → BRUISER/ALDO/BRONZE). Null quando não resolve.
- **`resultado`**: só p/ tipo 4 — `DIAGNOSTICO` `P`→"positivo", `N`→"negativo".
- **`dtPartoPrevista`**: `DTPARTOPROVAVEL` (relevante p/ diagnóstico positivo).
- **Parto (tipo 7)**: `tipoParto` = `CAST(CDTIPOPARTO)`, `numCrias` = `NUMCRIA`, `sexoCria` = `SEXOCRIA1`.
- **`CIO` e `SECAGEM`**: **não existem** como tipo em REPRODUCAO (cio é flag; secagem é outra tabela) → deferidos.

**Escopo de animais:** TODOS da fazenda (ativos + baixados), igual ao import de animais → **3.119 eventos** (o cockpit de um baixado também mostra histórico).

## 3. Mudanças (backend-only — o cockpit já lê `EventoReprodutivo`)

`timeline.ts`/`eventos.ts` já fazem `prisma.eventoReprodutivo.findMany({ where: { animalId } })`. **Nenhuma mudança de API/UI** — importar os eventos acende a timeline.

- **`scripts/rebanho-dump.sql`** — novo bloco `@E@`: eventos de REPRODUCAO dos animais da fazenda, delimitado. Campos: `numero, cdtipo, data, reprodutorNome, diagnostico, dtPartoProvavel, cdtipoparto, numcria, sexocria1, observacao`.
- **`scripts/build-rebanho-json.mjs`** — `parseEvento(linha)` puro (TDD): mapeia cdtipo→tipo, monta `{numero, tipo, data, reprodutor, resultado, dtPartoPrevista, tipoParto, numCrias, sexoCria, observacao}`. `main()` roteia `@E@` → `eventos[]` no JSON.
- **JSON `rebanho_real.json`** — novo top-level `eventos: [...]`.
- **`server/prisma/import-rebanho.ts`** — após os animais, `createMany` de `EventoReprodutivo` (mapeia `numero→animalId`, datas via `new Date`, em lotes de 500). Cascade do `animal.deleteMany` já limpa os eventos antigos (idempotente).

## 4. Verificação
- **JSON:** `eventos.length` ≈ 3.119; distribuição por tipo bate com §2 (INSEMINACAO 1006, DIAGNOSTICO 1775, PARTO 338).
- **Postgres:** `eventoReprodutivo.count()` ≈ 3.119; um animal real (CATARINA #1002) tem IA/DG/parto.
- **Navegador:** abrir o cockpit de CATARINA → timeline mostra eventos reais (IA com touro, DG positivo/negativo, parto) ordenados por data. Idempotente (re-import não duplica).
- Transformador (node --test) + server build/test verdes.

## 5. Decisões deferidas (próximas fatias)
- **Sanidade:** `DOENCAANIMAL` (339) + `APLICACAOPRODUTO` (3.257, = consumo veterinário real → também destrava custo de sanidade) + `MAMITE` (24) → `EventoSanitario`.
- **Pesagens:** `PESO` (1.834) → curva de crescimento/GMD (precisa de modelo/aba própria).
- **CIO/SECAGEM** reprodutivos; protocolo IATF (vazio na 777); genealogia mãe/pai; composição racial.
- Reclassificação "Animal Aquisição" (financeiro) — segue guardado.
