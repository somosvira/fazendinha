# Fatia 14 — Corrigir o import do rebanho + filtro de baixados — Design

**Data:** 2026-06-17
**Status:** aprovado no brainstorming (usuário: importar todos os animais da fazenda — ativos + baixados — e replicar o filtro "Baixado" do Ideagri).
**Depende de:** Fatia 12 (importador `import-rebanho.ts`), schema rebanho existente.

---

## 1. Problema (diagnóstico)

A Fatia 12 importou **824 animais**, todos com `status = ATIVO`. Errado. A extração ad-hoc filtrou a tabela `ANIMAL` por `STATUS = 1` (824 linhas), mas no Ideagri `STATUS` **não** distingue animal vivo da fazenda — inclui **embriões** (`TIPOANIMAL='E'`, 161) e **sêmen** (`TIPOANIMAL='S'`, 54), e não exclui **baixados** (baixado = `DTBAIXA IS NOT NULL`).

O filtro real que a listagem do Ideagri usa (Tipo=Animal · Pertence à fazenda=Sim · Baixado=Não) é:

```sql
TIPOANIMAL = 'A' AND ANIMALREBANHO = 1 AND DTBAIXA IS NULL   -- = 522 (bate com a UI)
```

Contagens corretas (FDB de 2026-06-17 16:38, já atualizado pelo usuário):

| Conjunto | Predicado | N |
|---|---|---|
| Animais da fazenda (todos) | `TIPOANIMAL='A' AND ANIMALREBANHO=1` | **631** |
| → Ativos | `… AND DTBAIXA IS NULL` | **522** |
| → Baixados | `… AND DTBAIXA IS NOT NULL` | **109** |

Breakdown dos 522 ativos (por `CDCATEGORIA`): **124 vacas** (CD7) · **328 novilhas** (CD6) · **67 bezerras** (CD5, ♀ "em crescimento") · **3 touros** (CD2 Reprodutor). Sem bezerros e sem novilhos no rebanho ativo.

**Causa-raiz secundária:** a extração foi **ad-hoc** (sem script commitado), então não é reproduzível nem auditável — por isso o filtro errado passou. Esta fatia commita um script de extração com o filtro explícito.

## 2. Objetivo

1. **Re-extrair corretamente** os 631 animais da fazenda (522 ativos + 109 baixados) do FDB atualizado, com status/baixa corretos, e re-importar (substituindo os 824).
2. **Commitar um script de extração reproduzível** (`scripts/extract-rebanho.*`) com o filtro explícito — toda vez que o usuário atualizar o Ideagri, roda o script e re-importa.
3. **Expor um filtro "Baixado"** na aba Animal (Ativos / Baixados / Todos), espelhando o Ideagri. A API e o modelo já suportam — falta só a UI.

## 3. Mapeamento Ideagri → nosso schema (delta sobre a Fatia 12)

**Base (`ANIMAL`):** filtro `TIPOANIMAL='A' AND ANIMALREBANHO=1` (ativos + baixados). Demais campos como na Fatia 12.

**Categoria (`CDCATEGORIA` → `CategoriaAnimal`):** confirmado contra a tabela `CATEGORIA`:
- CD7 Vaca → `VACA`; CD6 Novilha → `NOVILHA`; CD5 Em crescimento (♀) → `BEZERRA`; CD1 Em crescimento (♂) → `BEZERRO`; CD2 Reprodutor / CD3 Boi carreiro / CD4 Rufião → `TOURO`.

**Status / baixa (novo nesta fatia):**
- `DTBAIXA IS NULL` → `status='ATIVO'`, `dataBaixa=null`, `motivoBaixa=null`.
- `DTBAIXA IS NOT NULL` → `status='BAIXADO'`, `dataBaixa=DTBAIXA`, `motivoBaixa` = nome via `CDMOTIVOBAIXA → MOTIVOBAIXA.NOME` (null se não houver).

**Resumo (`ANIMALINFO_PRODUCAO` / `ANIMALINFO_REPRODUCAO`) e controles (`LEITE`):** mesma lógica da Fatia 12 (produção média, DEL + lactação aberta via `DTINICIOULTLAC`, CCS, status reprodutivo derivado, IEP, controles `PESO1/2/3`/`PESOTOTAL`), agora restritos ao conjunto dos 631. Para **baixados**, o resumo costuma vir vazio/sparso — preencher o que existir, null no resto. Produção/DEL só para vacas em lactação ativas. **A implementação re-verifica os nomes exatos de coluna** dos `ANIMALINFO_*` contra o FDB antes de montar o JSON.

## 4. Forma do JSON (`server/prisma/rebanho_real.json`)

Igual à Fatia 12, **adicionando `motivoBaixa`**:

```json
{ "geradoEm": "2026-06-17",
  "animais": [
    { "numero":"...", "nome":"...", "sexo":"F", "categoria":"VACA",
      "dataNascimento":"...", "dataEntrada":"...", "brincoEletronico":null, "sisbov":null,
      "numPartosEntrada":0, "status":"BAIXADO", "dataBaixa":"2026-04-10", "motivoBaixa":"Venda",
      "setor":null, "raca":"Girolando", "grupo":"...",
      "resumo": { /* idem Fatia 12; sparso/null para baixados */ } } ],
  "controles": [ { "numero":"...", "data":"...", "peso1":null, "peso2":null, "peso3":null, "pesoTotal":24.5 } ] }
```

`status ∈ ATIVO|BAIXADO`. `categoria ∈ VACA|NOVILHA|BEZERRA|BEZERRO|TOURO`.

## 5. Script de extração reproduzível (`scripts/`)

Conjunto commitado (roda só nesta máquina WSL+Windows — documentado, como o `extract_rio_novo.py` do financeiro):

- `scripts/extract-rebanho.sh` — orquestra: copia o `DADOS777.FDB` vivo para o scratch, roda os dumps SQL via `FBCVT/isql.exe` (`-user SYSDBA -password masterkey`), chama o transformador. Caminhos do Ideagri/scratch no topo do script (ajustáveis).
- `scripts/rebanho-dump.sql` — `SELECT`s delimitados (`|| '~|~' ||`, `COALESCE`, `SET WIDTH` largo p/ evitar truncamento; **sem colunas blob** — `OBSERVACAO` etc. quebram o isql) de: animais (com o filtro da §3), produção, reprodução, controles. Um dump por dataset.
- `scripts/build-rebanho-json.mjs` — Node ESM puro: lê os dumps delimitados, monta o `server/prisma/rebanho_real.json` (deriva DEL/lactação aberta/status reprodutivo, junta resumo+controles por `numero`). Sem dependência de driver Firebird.

O `extract_rio_novo.py` (financeiro) **não é tocado**.

## 6. Importador (`server/prisma/import-rebanho.ts`)

Idempotente, já existente. Ajuste mínimo: garantir que grava `motivoBaixa` (o modelo já tem o campo) e `status`/`dataBaixa` a partir do JSON. Sem mudança de schema. Substitui todo o rebanho a cada run (deleta `producaoLote` + `animal` cascade; preserva `Produto`/`MovimentoEstoque`/`Lancamento`/`Dieta`).

## 7. UI — filtro "Baixado" na aba Animal

A API já aceita `status: ATIVO | BAIXADO | TODOS` (`animais.schemas.ts`) e o hook `useAnimais({status})` repassa. Hoje a `AnimalTab` está fixa em `ATIVO`.

- Adicionar um seletor **Ativos / Baixados / Todos** no topo da aba (default **Ativos** → 522), espelhando o "Baixado: Não/Sim/Todos" do Ideagri. `useAnimais({ status })` com o estado do seletor.
- Quando `BAIXADO`/`TODOS`: a tabela mostra a **data e o motivo da baixa** (colunas/realce) para os baixados; KPIs continuam sobre o conjunto exibido.
- Corrigir contagens/labels que assumam "ativos = total" (KPIs derivam do conjunto retornado, então ficam corretos por construção).

## 8. Verificação

- **Contagens (Postgres):** total 631; `status=ATIVO` = 522 (124 vaca/328 novilha/67 bezerra/3 touro); `status=BAIXADO` = 109; controles importados > 0. Idempotência (rodar import 2× → mesmas contagens).
- **Custo/litro:** recalcula a partir das 124 vacas reais (produção/cock filtram `status=ATIVO`, então baixados não entram). Anotar o novo valor.
- **Navegador:** aba Animal default mostra 522 ativos (nomes reais); seletor → Baixados mostra os 109 com data/motivo; Todos = 631. Produção/Dashboard inalterados pelos baixados.

## 9. Decisões deferidas (catalogadas)

- **Embriões e sêmen** (`TIPOANIMAL='E'/'S'`) — domínio de material genético/reprodução, não "animais"; abas próprias ficam para depois.
- **Demais filtros do Ideagri** (Setor, Sexo, Tipo) na aba Animal — só "Baixado" agora; os outros conforme necessidade.
- **Genealogia mãe/pai**, timeline de eventos por animal, refino do statusReprodutivo — como na Fatia 12.
- **Design da reclassificação "Animal Aquisição"** (custeio↔investimento) — guardado, retomar após esta fatia.
