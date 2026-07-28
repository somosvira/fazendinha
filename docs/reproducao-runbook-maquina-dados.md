# Runbook — reconciliação da reprodução na máquina com o IDEAGRI

> **Para quem tem o `DADOS777.FDB`.** Todo o código da paridade reprodutiva (Blocos A→F) está em `main`, com testes verdes. O que **falta** é a reconciliação com o histórico real: rodar a extração da fonte, importar e conferir contagens. Este é o passo a passo, na ordem. Nenhum número da fonte está embutido no código — o import é *fail-closed* e você confere tudo aqui.
>
> Detalhe por bloco: [`reproducao-teste-na-maquina-ideagri.md`](reproducao-teste-na-maquina-ideagri.md) · contrato de aceite: [`design/reproducao-paridade-ideagri.md`](design/reproducao-paridade-ideagri.md).

## 0. Pré-requisitos (uma vez)

1. Cópia do `DADOS777.FDB` acessível ao `isql.exe` do Firebird.
2. Postgres de dev do Fazendinha configurado em `server/.env` (`DATABASE_URL`). **Use um banco descartável** — o import **substitui** o rebanho.
3. `pnpm install` na raiz.
4. Sanidade do código (roda em qualquer máquina, deve estar tudo verde):

```bash
pnpm --filter rionovo-server run test
pnpm --filter rionovo-client run test
pnpm exec node --test scripts/build-rebanho-json.test.mjs
pnpm build
```

## 1. Inventário da fonte (fonte de verdade dos nomes de coluna)

```bash
bash scripts/extract-ideagri-repro-inventory.sh
```

Confere telas/funções/contagens/colunas/dicionários. **Antes de importar**, use a saída `@COL@`/`@ACASALTAB@` para conferir os nomes físicos reais das tabelas de cada bloco. O `scripts/rebanho-dump.sql` precisa emitir o **contrato intermediário** (delimitador `~|~`, um registro por linha) exatamente com os campos e prefixos que o parser espera. Os prefixos e campos de cada bloco estão tabelados em [`reproducao-teste-na-maquina-ideagri.md`](reproducao-teste-na-maquina-ideagri.md):

- **Bloco A (IATF/TETF):** `@PROTOIATF@` · `@PROTOPRIN@` · `@PROGIATF@` · `@PROGASSOC@`
- **Bloco B (ciclo):** `@RESULTGINE@` (dicionário ginecológico oficial) + `@E@` já cobre IA/cobertura/TE/DG/parto
- **Bloco C (genética/sêmen):** `@REPRODUTOR@` · `@INDICADOR@` · `@VALORIND@` · `@MARCADOR@` · `@VALORMARC@` · `@CASEINA@` · `@VALORCAS@` · `@TIPOSEMEN@` · `@ESTSEMEN@` · `@PEDIGREE@`
- **Bloco D (acasalamento):** `@MEDACAS@` · `@ITEMMEDACAS@` · `@COMBACAS@` · `@ITEMCOMBACAS@` · `@CASOACAS@`
- **Bloco E (FIV/TE):** `@EMBCLASS@` · `@COLETA@` · `@OOCITO@` · `@FERTCOL@` · `@EMBRIAO@` · `@POOLGRP@` · `@POOLITEM@`

> **Fail-closed:** id ausente, sigla inválida, finalidade fora de `IATF/TETF`, tipo de medida fora do conjunto permitido, ou referência quebrada **abortam** a geração do JSON e o import. Isso é intencional: corrija o mapeamento SQL, **nunca invente dado**.

## 2. Gerar o JSON e importar

```bash
node scripts/build-rebanho-json.mjs <dump.txt> $(date +%F)
pnpm --filter rionovo-server run db:push        # sincroniza o schema (todos os blocos)
pnpm --filter rionovo-server run import:rebanho  # idempotente por ideagriId
```

O import loga as contagens por bloco (IATF, genética/sêmen, acasalamento, FIV/pool). Rodar 2× converge para o mesmo estado — não duplica. A ordem interna resolve dependências: genética antes de acasalamento (indicadores por sigla) e antes de FIV (reprodutor por `ideagriId`).

## 3. Reconciliar contagens (gate de aceite)

Compare o que entrou no app com o baseline levantado no IDEAGRI. **Você cola o baseline** — ele não está no código.

### 3.1 Baseline de referência a conferir na fonte

| Bloco | Fonte | Baseline |
|---|---|---:|
| A | `PROTOCOLOIATF` / `PROTOCOLOIATFPRINCIPIOATIVO` / `PROGRAMACAOIATF` / `PROGRAMACAOIATFASSOCIACAO` | 5 / 31 / 75 / 469 |
| A | `REPRODUCAO` por tipo (IA / cobertura / TE / DG / parto) | 837 / 61 / 146 / 1843 / 353 |
| B | `RESULTADOEXAMEGINECOLOGICO` / `EXAMEANIMAL` | 44 / 248 |
| C | `ANIMALINFO_REPRODUTOR` / `GENCATALOGOINDICADOR` / `GENCATALOGOMARCADOR` / `GENCATALOGOCASEINA` / `TIPOSEMEN` | 67 / 271 / 20 / 15 / 3 |
| E | `COLETA` / `EMBRIAOCLASSIFICACAO` / `GRUPOPOOLDOADORA` | 7 / 6 / 0 (vazio) |

Além das contagens, C tem **valores por touro** (indicadores, marcadores, caseínas, pedigree, doses) a conferir; E tem **estágios de embrião** por coleta.

### 3.2 Reconciliação por evento (Bloco F)

O relatório usa o cálculo puro `reconciliarContagens(observado, baseline)`:

1. `observado` = contagem por tipo de `EventoReprodutivo` restrita a `ideagriId IS NOT NULL` (idealmente, aos IDs presentes no JSON corrente). Não use a contagem global: ela pode incluir lançamentos manuais; o filtro por propriedade também não substitui o filtro de origem.
2. `baseline` = as contagens por tipo levantadas no IDEAGRI (ex.: `{ INSEMINACAO: 837, COBERTURA: 61, TRANSFERENCIA_EMBRIAO: 146, DIAGNOSTICO: 1843, PARTO: 353 }`).
3. `reconciliarContagens(observado, baseline)` lista as divergências (`observado - baseline`); qualquer linha com `divergencia !== 0` sem explicação **reprova** — regenere o dump/import antes de aprovar.

O script operacional `server/scripts/reconciliar-ideagri.mts` aplica esse escopo de origem tanto aos eventos quanto aos catálogos que possuem `ideagriId`.

### 3.3 Gate dos casos dourados do acasalamento (Bloco D)

Quando o dump real trouxer `@CASOACAS@`:

```bash
ACASALAMENTO_CASOS_DOURADOS_PATH=server/prisma/rebanho_real.json \
  pnpm --filter rionovo-server exec vitest run src/services/rebanho/acasalamento-casos-dourados.test.ts
```

Caminho ausente, JSON inválido ou `casosDouradosAcasalamento` vazio fazem o teste falhar — sem fallback silencioso. Só declarar paridade quando **todos** os casos reais reproduzirem ranking e status.

## 4. Smoke dos fluxos no navegador (aceite do operador)

Suba o app (`pnpm dev`) e valide, em Rebanho:

- **Reprodução:** taxa de concepção IA/MN/TE; **Relatório reprodutivo** por período (coberturas, prenhezes, partos, taxa).
- **IATF/TETF:** protocolo + programação por lote; etapa terminal gera IA (ou TE em TETF) idempotente.
- **Acasalamento:** medidas/combinações; plano por lote; recomendação por mérito/parentesco.
- **FIV / TE:** coleta (oócitos por qualidade + fertilização por reprodutor); embrião como estoque; seletor de embrião na TE (doadora/touro derivados). Pool de doadoras → "Aplicar pool" cria coletas em rascunho.
- **Escopo de propriedade:** trocar de sítio não vaza dados de outro.

## 5. Itens marcados N/A (não precisam de reconciliação)

- **Receber coletas / Receber dados IATF:** N/A arquitetural. A sincronização desktop→cloud não é replicada; o equivalente web é o import idempotente (passos 1–2) + o lançamento/execução na tela, já entregues.

## 6. Estado apurado no backup de 2026-07-28 — lacunas A→F

- **A — IATF/TETF:** dump, JSON e banco reconciliam 5 protocolos, 31 princípios, 75 programações e 469 associações, sem divergência.
- **B — ciclo reprodutivo:** os eventos de origem reconciliam sem divergência: 837 IA, 61 coberturas, 146 TE, 1.843 DG e 353 partos. O dicionário ginecológico tem 44 resultados; faltam extrair/reconciliar os 248 exames e os dicionários de parto/auxílio.
- **C — genética/sêmen:** fonte e banco reconciliam 67 reprodutores e catálogos de 271 indicadores, 20 marcadores, 15 caseínas e 3 tipos de sêmen. `GENPROVA`, valores, pedigree e estoque estão vazios nesta base.
- **D — acasalamento:** `ESQUEMAMEDIDA`, itens, medidas combinadas e recomendações estão vazios; não há casos dourados reais extraíveis. Reconciliação de dados reais é `N/A`; motor e fluxo web permanecem cobertos por fixture/testes.
- **E — FIV/TE:** fonte e banco reconciliam 6 classificações, 7 coletas e 7 buckets de oócitos. Os 171 embriões não têm classificação/estágio preenchido; fertilizações e pools estão vazios.
- **F — relatório/aceite:** cálculo, testes, API e reconciliação dos eventos de origem estão verdes. O aceite visual por operador/veterinário continua pendente.

> Estado importado em 2026-07-28: 644 animais — os 638 do rebanho mais 6 doadoras externas referenciadas pelas coletas —, 3.240 eventos e todos os catálogos A/C/E comprovados. Duas execuções completas convergiram após corrigir a limpeza das coletas e o escopo da propriedade; a reconciliação final não possui divergências.

## Checklist final de "100%"

- [x] Contagens disponíveis da §3.1 conferidas sem divergência não explicada.
- [x] `reconciliarContagens` (§3.2) sem divergência residual.
- [x] Casos dourados reais (§3.3): `N/A` — fonte sem motor/casos persistidos; fixture sintética verde.
- [x] Valores por touro (C) e estágios de embrião (E): conferidos vazios na fonte; catálogos/coletas reconciliados.
- [ ] Smoke visual dos fluxos (§4) aprovado pelo operador/veterinário. Smoke autenticado de API aprovado.
- [ ] Matriz do contrato ([`design/reproducao-paridade-ideagri.md`](design/reproducao-paridade-ideagri.md)) integralmente em `✅`/`N/A` — aguarda somente aceite visual onde aplicável.
