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

Finalidade fora de `IATF/TETF`, id ausente ou referência quebrada **abortam** o build (fail-closed) — é intencional; corrija o mapeamento SQL, nunca invente dado.

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

## Pendências dos próximos blocos (não neste PR)

- **Bloco B** (aptidão, dicionário ginecológico de 44 resultados, parto→cria): **ENTREGUE** (commits `007633d`→`a9944ee`). Operando com o conjunto-semente de 9 resultados ginecológicos (códigos negativos) até a reextração. **Pendente na máquina:** reconciliar `RESULTADOEXAMEGINECOLOGICO` (44) e `EXAMEANIMAL` (248) a partir do `DADOS777.FDB` — adicionar o contrato `@RESULTGINE@` ao dump, rodar `build-rebanho-json` + `import:rebanho` e conferir que os códigos oficiais positivos substituem os seeds na listagem.
- **Blocos C–F** (sêmen/genética, acasalamento, FIV/TE, relatórios/aceite): descritos na especificação; entram em PRs próprios.
