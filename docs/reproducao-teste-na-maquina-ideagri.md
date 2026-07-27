# Reprodução — o que testar na máquina com o IDEAGRI

> Este PR entregou a **operação** da paridade reprodutiva (Bloco A: IATF/TETF) com código e testes verdes, mas a **reconciliação com o histórico real** depende do `DADOS777.FDB`, que não existe no ambiente onde o código foi escrito. Este documento cataloga exatamente o que rodar na máquina que tem o IDEAGRI instalado.

**Contrato de aceite:** [`design/reproducao-paridade-ideagri.md`](design/reproducao-paridade-ideagri.md)
**Especificação:** [`superpowers/specs/2026-07-26-reproducao-paridade-ideagri-design.md`](superpowers/specs/2026-07-26-reproducao-paridade-ideagri-design.md)

## Pré-requisitos na máquina do IDEAGRI

- Cópia do `DADOS777.FDB` acessível ao `isql.exe` do Firebird (ver `scripts/extract-ideagri-repro-inventory.sh`).
- Banco Postgres de dev do Fazendinha (`DATABASE_URL` no `server/.env`).
- `pnpm install` já rodado.

## 1. Gerar o inventário oficial de colunas (fonte de verdade)

```bash
bash scripts/extract-ideagri-repro-inventory.sh
```

Confirma telas/funções/contagens/colunas/dicionários. **Antes de importar, conferir os nomes reais de coluna** de `PROTOCOLOIATF`, `PROTOCOLOIATFPRINCIPIOATIVO`, `PROGRAMACAOIATF`, `PROGRAMACAOIATFASSOCIACAO` e `RESULTADOEXAMEGINECOLOGICO` na saída `@COL@`. O adaptador do app espera o **contrato intermediário** abaixo — o SQL de dump precisa emitir exatamente esses campos, na ordem dada, a partir das colunas reais.

### Contrato intermediário que o dump (`scripts/rebanho-dump.sql`) deve emitir

Delimitador `~|~`. Uma linha por registro, com o prefixo indicado.

| Prefixo | Campos (na ordem) | Origem IDEAGRI |
|---|---|---|
| `@PROTOIATF@` | ideagriId · nome · finalidade(`IATF`\|`TETF`) | `PROTOCOLOIATF` |
| `@PROTOPRIN@` | protocoloIdeagriId · dia · principio · produto · dose · uso | `PROTOCOLOIATFPRINCIPIOATIVO` |
| `@PROGIATF@` | ideagriId · nome · dataInicio(`YYYY-MM-DD`) · protocoloIdeagriId | `PROGRAMACAOIATF` |
| `@PROGASSOC@` | numeroAnimal · ideagriId · programacaoIdeagriId · usoCidr(`0`\|`1`) · estimulo · perdaImplante(`0`\|`1`) | `PROGRAMACAOIATFASSOCIACAO` |
| `@RESULTGINE@` | codigo · nomeResumido · nomeCompleto · tipo · padrao | `RESULTADOEXAMEGINECOLOGICO` (Bloco B) |
| `@REPRODUTOR@` | ideagriId · nome · codigo · racaSigla · centralSigla | `ANIMALINFO_REPRODUTOR` (Bloco C) |
| `@INDICADOR@` | ideagriId · sigla · nome · unidade · direcao · colunaLegada · ranking(`0`\|`1`) | `GENCATALOGOINDICADOR` (Bloco C) |
| `@VALORIND@` | reprodutorIdeagriId · indicadorSigla · valor | `GENVALORIND` (Bloco C) |
| `@MARCADOR@` | ideagriId · sigla · nome | `GENCATALOGOMARCADOR` (Bloco C) |
| `@VALORMARC@` | reprodutorIdeagriId · marcadorSigla · resultado | valores por touro vinculados a `GENCATALOGOMARCADOR` (Bloco C; relação física a confirmar no inventário) |
| `@CASEINA@` | ideagriId · sigla · nome | `GENCATALOGOCASEINA` (Bloco C) |
| `@VALORCAS@` | reprodutorIdeagriId · caseinaSigla · genotipo | valores por touro vinculados a `GENCATALOGOCASEINA` (Bloco C; relação física a confirmar no inventário) |
| `@TIPOSEMEN@` | ideagriId · sigla · nome | `TIPOSEMEN` (Bloco C) |
| `@ESTSEMEN@` | ideagriId · reprodutorIdeagriId · tipoSemenSigla · lote · localizacao · doses | estoque de sêmen (Bloco C; tabela física a confirmar no inventário) |
| `@PEDIGREE@` | reprodutorIdeagriId · paiNome · paiCodigo · maeNome · maeCodigo · avoMaternoNome · avoMaternoCodigo · avoPaternoNome · avoPaternoCodigo | `GENPEDIGREE` (Bloco C) |

Finalidade fora de `IATF/TETF`, id ausente ou referência quebrada **abortam** o build (fail-closed) — é intencional; corrija o mapeamento SQL, nunca invente dado. O mesmo vale para os contratos de genética/sêmen: os prefixos acima são o contrato intermediário do parser, não uma afirmação de que as colunas físicas ou relações da fonte já foram reconciliadas.

## 2. Regenerar o JSON e importar

```bash
node scripts/build-rebanho-json.mjs <dump.txt> $(date +%F)
pnpm --filter rionovo-server run db:push          # aplica schema (finalidade/ideagriId/principios)
pnpm --filter rionovo-server run import:rebanho    # idempotente por ideagriId
```

O import loga: `IATF importado: N protocolos, N princípios, N programações, N associações.`

## 3. Reconciliar contagens (gate de aceite do Bloco A)

Confirmar que os números batem com o baseline do contrato:

| Fonte | Esperado | Como conferir |
|---|---|---|
| `PROTOCOLOIATF` | **5** | `SELECT count(*) FROM "ProtocoloIATF" WHERE "ideagriId" IS NOT NULL;` |
| `PROTOCOLOIATFPRINCIPIOATIVO` | **31** | `SELECT count(*) FROM "PrincipioProtocoloIATF";` |
| `PROGRAMACAOIATF` | **74** | `SELECT count(*) FROM "ProgramacaoIATFLote" WHERE "ideagriId" IS NOT NULL;` |
| `PROGRAMACAOIATFASSOCIACAO` | **466** | `SELECT count(*) FROM "AplicacaoProtocoloIATF" WHERE "ideagriId" IS NOT NULL;` |

Divergência sem explicação = falha; regenerar antes de aprovar (o banco recebe lançamentos novos).

## 4. Smoke do fluxo operacional (já implementado, testar no navegador)

1. **Protocolos IATF** — criar um protocolo com **finalidade TETF** e um IATF.
2. **Ficha do animal → Protocolo IATF** — aplicar um protocolo; preencher **CIDR / estímulo / perda de implante**; marcar uma etapa como feita com **produto/dose/observação** e recarregar (os campos persistem).
3. Concluir a **etapa terminal** de um protocolo IATF → confere que aparece um evento **INSEMINACAO** na timeline; reabrir a etapa → o evento some (idempotência).
4. Repetir com um protocolo **TETF** → etapa terminal gera **TRANSFERENCIA_EMBRIAO**.
5. **Programação por lote** — programar um grupo; expandir; marcar uma etapa como **feita para o lote** deixando 1 animal como **exceção**; conferir o resumo `feitas · puladas · pendentes · atrasadas` e que a exceção continua pendente.
6. Verificar **escopo de propriedade**: outra propriedade não altera a execução/lote.

## 5. Testes automatizados (rodam em qualquer máquina)

```bash
pnpm --filter rionovo-server exec vitest run src/services/rebanho/iatf.calc.test.ts src/services/rebanho/iatf-lote-exec.calc.test.ts src/services/rebanho/iatf.idempotente.test.ts src/services/rebanho/iatf-lote.exec.test.ts src/services/rebanho/import-iatf.test.ts
pnpm exec node --test scripts/build-rebanho-json.test.mjs
pnpm --filter rionovo-client exec vitest run src/rebanho/lib/iatf-lote.test.ts
pnpm build
```

## 6. Reconciliação pendente de genética e sêmen (Bloco C)

**Não houve reconciliação real do Bloco C neste ambiente.** A fonte `DADOS777.FDB` não existe nesta máquina; portanto, as quantidades abaixo são o baseline que ainda precisa ser conferido na máquina do IDEAGRI, e não contagens observadas por esta execução:

| Fonte | Baseline pendente | Inclui |
|---|---:|---|
| `ANIMALINFO_REPRODUTOR` | **67** | reprodutores e seus identificadores oficiais |
| `GENCATALOGOINDICADOR` | **271** | catálogo de indicadores genéticos |
| `GENCATALOGOMARCADOR` | **20** | catálogo de marcadores |
| `GENCATALOGOCASEINA` | **15** | catálogo de caseínas |
| `TIPOSEMEN` | **3** | tipos de sêmen |

Também permanecem pendentes de extração e reconciliação **os valores por touro**: indicadores (`GENVALORIND`), resultados de marcadores, genótipos de caseínas, pedigree (`GENPEDIGREE`) e os lotes/doses do estoque de sêmen. Esses valores não receberam contagens nesta máquina e não devem ser inferidos a partir dos catálogos.

Até a reextração do `DADOS777.FDB`, a biblioteca de genética/sêmen opera somente com o que o usuário cadastrar no Fazendinha. Quando a fonte estiver disponível, o SQL deve emitir os dez prefixos do contrato intermediário, o parser deve regenerar o JSON e o import deve ser executado de forma idempotente; só então as contagens e os valores por touro poderão ser declarados reconciliados.

## 7. Gate de paridade do acasalamento dirigido (Bloco D)

**A paridade real do Bloco D continua pendente.** Esta máquina não possui o `DADOS777.FDB`; portanto, ainda não foram confirmados os nomes físicos de tabelas/colunas, o catálogo de medidas/combinações nem casos dourados reais do IDEAGRI.

O inventário agora emite `@ACASALTAB@<relação>` para cada tabela candidata cujo nome normalizado contenha `ACASAL` (ou `MEDIDA` com indício nominal de relação com genética/reprodução/sêmen) e amplia `@COL@` com suas colunas. Essa saída é descoberta, não confirmação de schema.

### Contrato intermediário pendente de mapear na fonte

Delimitador `~|~`. Os SELECTs reais só podem ser escritos em `scripts/rebanho-dump.sql` **depois** de conferir `@ACASALTAB@` e `@COL@` na máquina-fonte.

| Prefixo | Campos (na ordem) |
|---|---|
| `@MEDACAS@` | ideagriId · nome · tipo · consanguinidadeMax · exigePedigree(`0`\|`1`) · ativo(`0`\|`1`) |
| `@ITEMMEDACAS@` | medidaIdeagriId · indicadorSigla · peso · minimo · maximo |
| `@COMBACAS@` | ideagriId · nome · ativo(`0`\|`1`) |
| `@ITEMCOMBACAS@` | combinacaoIdeagriId · medidaIdeagriId · peso · obrigatoria(`0`\|`1`) · ordem |
| `@CASOACAS@` | ideagriId · nome · entradaJson · rankingEsperadoJson |

Tipos permitidos de medida: `MERITO`, `RESTRICAO_INDICADOR`, `CONSANGUINIDADE`, `PEDIGREE`, `SEMEN`. O parser e o import são fail-closed: registro inválido, duplicata ou referência ausente aborta a carga; casos dourados permanecem no JSON e não criam plano/snapshot fictício no banco.

### Fluxo obrigatório na máquina do IDEAGRI

1. Rodar `bash scripts/extract-ideagri-repro-inventory.sh` contra uma cópia do `DADOS777.FDB`.
2. Conferir as linhas `@ACASALTAB@` e as respectivas `@COL@`; identificar as relações e campos reais de medidas, combinações e casos de referência.
3. Só então preencher os cinco SELECTs em `scripts/rebanho-dump.sql`, sem inferir nomes físicos.
4. Gerar o dump e executar `node scripts/build-rebanho-json.mjs <dump.txt> $(date +%F)`; qualquer registro inválido deve bloquear a escrita do JSON.
5. Executar `pnpm --filter rionovo-server run import:rebanho`; genética é importada antes do acasalamento para resolver indicadores por sigla.
6. Rodar o gate real:

```bash
ACASALAMENTO_CASOS_DOURADOS_PATH=server/prisma/rebanho_real.json pnpm --filter rionovo-server exec vitest run src/services/rebanho/acasalamento-casos-dourados.test.ts
```

A fixture sintética continua sendo o default em qualquer máquina. Quando a env acima é informada, caminho ausente, JSON inválido ou `casosDouradosAcasalamento` ausente/vazio fazem o teste falhar — nunca há fallback silencioso. Só declarar a paridade concluída depois que **todos** os casos reais reproduzirem ranking e status no motor.

## Pendências dos próximos blocos

- **Bloco B** (aptidão, dicionário ginecológico de 44 resultados, parto→cria): **ENTREGUE** (commits `007633d`→`a9944ee`). Operando com o conjunto-semente de 9 resultados ginecológicos (códigos negativos) até a reextração. **Pendente na máquina:** reconciliar `RESULTADOEXAMEGINECOLOGICO` (44) e `EXAMEANIMAL` (248) a partir do `DADOS777.FDB` — adicionar o contrato `@RESULTGINE@` ao dump, rodar `build-rebanho-json` + `import:rebanho` e conferir que os códigos oficiais positivos substituem os seeds na listagem.
- **Bloco C** (sêmen/genética): operação entregue; a reconciliação real permanece pendente nos termos da seção 6.
- **Bloco D** (acasalamento dirigido): operação e gate sintético entregues; contrato físico, catálogo e casos dourados reais permanecem pendentes conforme seção 7.
- **Blocos E–F** (FIV/TE, relatórios/aceite): descritos na especificação; entram em PRs próprios.
