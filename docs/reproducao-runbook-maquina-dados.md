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
| A | `PROTOCOLOIATF` / `PROTOCOLOIATFPRINCIPIOATIVO` / `PROGRAMACAOIATF` / `PROGRAMACAOIATFASSOCIACAO` | 5 / 31 / 74 / 466 |
| A | `REPRODUCAO` por tipo (IA / cobertura / TE / DG / parto) | 832 / 61 / 146 / 1843 / 352 |
| B | `RESULTADOEXAMEGINECOLOGICO` / `EXAMEANIMAL` | 44 / 248 |
| C | `ANIMALINFO_REPRODUTOR` / `GENCATALOGOINDICADOR` / `GENCATALOGOMARCADOR` / `GENCATALOGOCASEINA` / `TIPOSEMEN` | 67 / 271 / 20 / 15 / 3 |
| E | `COLETA` / `EMBRIAOCLASSIFICACAO` / `GRUPOPOOLDOADORA` | 7 / 6 / 0 (vazio) |

Além das contagens, C tem **valores por touro** (indicadores, marcadores, caseínas, pedigree, doses) a conferir; E tem **estágios de embrião** por coleta.

### 3.2 Reconciliação por evento (Bloco F)

O relatório usa o cálculo puro `reconciliarContagens(observado, baseline)`:

1. `observado` = `contarEventosPorTipo(propriedadeId)` (contagem por tipo de `EventoReprodutivo` no app).
2. `baseline` = as contagens por tipo levantadas no IDEAGRI (ex.: `{ INSEMINACAO: 832, COBERTURA: 61, TRANSFERENCIA_EMBRIAO: 146, DIAGNOSTICO: 1843, PARTO: 352 }`).
3. `reconciliarContagens(observado, baseline)` lista as divergências (`observado - baseline`); qualquer linha com `divergencia !== 0` sem explicação **reprova** — regenere o dump/import antes de aprovar.

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

## Checklist final de "100%"

- [ ] Contagens da §3.1 conferidas sem divergência não explicada.
- [ ] `reconciliarContagens` (§3.2) sem divergência residual.
- [ ] Casos dourados reais (§3.3) verdes.
- [ ] Valores por touro (C) e estágios de embrião (E) conferidos.
- [ ] Smoke dos fluxos (§4) aprovado pelo operador/veterinário.
- [ ] Matriz do contrato ([`design/reproducao-paridade-ideagri.md`](design/reproducao-paridade-ideagri.md)) atualizada para `✅`/`N/A`.
