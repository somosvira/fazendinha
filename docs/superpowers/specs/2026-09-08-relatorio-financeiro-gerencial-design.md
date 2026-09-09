# Relatório financeiro gerencial — configurável e exportável

Issue: somosvira/fazendinha#248.

## Objetivo

Entregar, dentro da Central de Relatórios, um gerador de **relatório financeiro gerencial** com filtros (propriedade, período, regime), seções configuráveis (ordem e visibilidade), texto editorial editável (título, subtítulo, observações), pré-visualização fiel e exportação em PDF (identidade Terrano) e CSV, com **todos os agregados calculados no backend** a partir dos `Lancamento` reais.

## Decisões de produto

- **Entrada:** novo card `Relatório financeiro gerencial` (área Financeiro, formato Documento) na Central (`/relatorios`), aberto internamente como o Fechamento mensal. O Fechamento continua existindo; nada é removido.
- **Propriedade:** o relatório usa o sítio ativo (`X-Propriedade-Id`, via `comPropriedade()`). Um seletor na tela permite trocar apenas entre as propriedades disponíveis (`GET /api/propriedades`); sem sítio explícito, a leitura consolidada segue `resolverEscopoLeitura`.
- **Regime de leitura:** `realizado` (caixa: `LIQUIDADO`, `estornado=false`, `dataLiquidacao` no período), `previsto` (compromissos: `ABERTO`, `estornado=false`, `dataVencimento` no período) ou `ambos`. Realizado e previsto **nunca** se somam: seções de compromissos ficam em bloco próprio, com rótulo "Previsto".
- **Transferências entre contas** (`CentroCusto = "(Sem centro de custo)"`) movimentam saldo de conta, mas **não** entram em entradas/saídas/resultado (mesma regra do Dashboard). O relatório declara isso em nota de rodapé da seção.
- **Estornos** (`estornado=true`) nunca entram em totais; a seção "Operações por tipo" mostra quantidade e valor estornado separadamente, para auditoria.
- **`LIQUIDADO_PARCIAL`** é tratado como não realizado (não há valor pago parcial no schema); aparece contado na seção de operações por tipo como "parcialmente liquidado", fora dos totais.
- **Template** (título, subtítulo, observações, ordem/visibilidade das seções) é estado de apresentação do cliente, persistido em `localStorage` por propriedade. Não existe persistência no servidor nesta fatia (listado como evolução futura em `docs/design/relatorios-gerais.md`).
- **Pré-visualização = exportação:** o mesmo componente React renderiza a prévia na tela e é o nó capturado pelo `html2pdf`. Não há um segundo renderizador.
- **CSV:** um único arquivo com todas as tabelas visíveis, separadas por linha de título de seção, formato `;` + BOM (padrão de `relatorioExport.ts`).
- **Estado vazio:** cada seção sem dados imprime "Sem registros no período" em vez de zeros; o resumo executivo mostra contagens zero explicitamente.
- **Permissão:** leitura exige a aba `relatorio` (`exigePermissao("relatorio")` no servidor; `canSee("relatorio")` no cliente).

## Arquitetura

### Backend

Rota fina → service de I/O → cálculo puro testado. Arquivos novos, todos flat como o restante do financeiro:

- `server/src/services/relatorio-gerencial.schemas.ts` — `relatorioGerencialQuerySchema`: `inicio`, `fim` (YYYY-MM-DD, obrigatórios, `inicio <= fim`, período máximo 24 meses), `regime` (`realizado|previsto|ambos`, default `ambos`).
- `server/src/services/relatorio-gerencial.calc.ts` — funções puras sobre linhas já carregadas (`LinhaLancamento` com valores `number` já convertidos por `Prisma.Decimal.toNumber()` em centavos-seguro via `arred2`):
  - `classificarLinha(linha)` → `transferencia | estorno | parcial | receita | custeio | investimento` (investimento = `centroCusto.ehInvestimento` ou nome contendo "investimento", ou `categoria.classificacao = INVESTIMENTO`; regra do Dashboard).
  - `atividadeDe(centroNome)` → `leite | cafe | outros` (extraído do Dashboard; o Dashboard passa a importar daqui).
  - `agregarRealizado(linhas, meses)` → entradas/saídas por mês, resultado, por atividade, por grupo→categoria, por centro de custo.
  - `agregarPrevisto(linhas, hoje)` → a pagar / a receber, vencidos × a vencer, lista ordenada por vencimento (limite 200 linhas por natureza).
  - `agregarSaldoContas(contas, movimentosAteInicio, movimentosPeriodo)` → saldo inicial, entradas, saídas, saldo final por conta e total.
  - `agregarOperacoesPorTipo(linhas)` → contagem e valor por tipo, incluindo estornos e parciais.
  - `agregarRastreabilidade(linhas, fechamentos)` → lançamentos com documento/NF anexada, sem centro de custo, meses fechados no período.
- `server/src/services/relatorio-gerencial.ts` — `gerarRelatorioGerencial(query, propriedadeId)`. Consultas: (1) `findMany` dos lançamentos do período (ambos os regimes; `select` enxuto, sem paginação porque o período é limitado a 24 meses); (2) `groupBy` por conta/natureza dos liquidados **até a véspera do início** para o saldo inicial de cada conta (inclui transferências); (3) `contaBancaria.findMany`; (4) `fechamentoMensal.findMany` no período; (5) `propriedade.findUnique` para o nome. Nunca carrega a base inteira.
- `server/src/routes/relatorio-gerencial.ts` — `GET /api/financeiro/relatorio-gerencial` com `zValidator("query")`, `exigePermissao("relatorio")`, `resolverEscopoLeitura(c)`; erros 500 em PT-BR. Montado em `index.ts` após o `authMiddleware`.

DTO (`RelatorioGerencialDTO`):

```ts
{
  meta: { geradoEm, propriedade: { id, nome } | null, periodo: { inicio, fim }, regime, filtros: { regime, propriedadeId } },
  resumo: { entradas, saidas, resultado, saldoContasFinal, nLancamentos, aPagar, aReceber } // aPagar/aReceber null se regime=realizado
  saldoContas: { contas: [{ id, nome, banco, saldoInicial, entradas, saidas, saldoFinal }], total: {...} } | null
  entradasSaidas: { meses: [{ mes, entradas, saidas, resultado }], total } | null
  resultado: { receita, custeio, investimento, resultado, porAtividade: [{ atividade, receita, custeio, investimento, resultado }] } | null
  compromissos: { aPagar: { total, vencido, aVencer, itens[] }, aReceber: {...} } | null
  categorias: { grupos: [{ grupo, total, categorias: [{ categoria, total, pct }] }], centros: [{ centro, total, pct }] } | null
  operacoes: [{ tipo, quantidade, valor, entraNoTotal }]
  rastreabilidade: { comDocumento, semDocumento, comNotaFiscal, semCentroCusto, mesesFechados: ["2026-03"], ... }
}
```

Seções do regime não pedido vêm `null`; o cliente as oculta e o CSV as ignora. Valores em `number` com 2 casas (padrão `arred2`), não arredondados para reais inteiros.

### Frontend

Pasta nova `client/src/components/relatorio-gerencial/`:

- `types.ts` — DTO espelhado + `TemplateRelatorio` (`titulo`, `subtitulo`, `observacoes`, `secoes: [{ id, visivel }]`).
- `template.ts` — `SECOES_PADRAO`, `templatePadrao()`, reducer puro (`moverSecao`, `alternarSecao`, `editarTexto`), `carregarTemplate/salvarTemplate` (localStorage por propriedade). Testado.
- `export.ts` — `relatorioGerencialParaCsv(dto, template)` (puro, testado) + `baixarCsv` + `exportarPdf(elemento, nome)` via `html2pdf.js` (A4 retrato, fundo papel, `pagebreak.avoid: [".rg-secao-bloco"]`).
- `RelatorioGerencialDocumento.tsx` — renderizador do documento (cabeçalho Terrano com `TerranoSymbol`, metadados de geração, seções na ordem do template, rodapé com filtros). Mesmo nó para prévia e PDF. Estados vazios por seção.
- `RelatorioGerencial.tsx` — tela: barra de filtros (propriedade, `DateRangePicker`, regime), painel lateral "Montar relatório" (textos + lista de seções com ⬆⬇ e checkbox), botões Gerar / Baixar PDF / Baixar CSV, prévia. Carrega via `fetchRelatorioGerencial` em `client/src/api.ts` com `comPropriedade()`.
- `Relatorios.tsx` — card novo + `interno: "gerencial"`.
- `lib/searchIndex.ts` — entrada para a paleta ⌘K.
- Estilos: bloco `.rg-*` mínimo em `base.css` só para o documento (largura A4, quebras de página); o restante é Tailwind.

## Fluxo de dados

1. Usuário ajusta filtros → `GET /api/financeiro/relatorio-gerencial?inicio&fim&regime` com `X-Propriedade-Id`.
2. Backend resolve escopo, consulta o recorte do período, agrega em puro, devolve DTO.
3. Cliente aplica o template (ordem/visibilidade/texto) sobre o DTO **somente na apresentação**; nenhum valor é editável.
4. Exportar PDF captura o nó do documento; exportar CSV serializa as tabelas visíveis.

## Tratamento de erros

- Query inválida → 400 do `zValidator` (mensagens em PT-BR no schema).
- Falha no banco → 500 `{ error: "Erro inesperado ao gerar relatório." }`; cliente mostra `toast.error` e mantém o último resultado.
- Sem permissão → 403; cliente já bloqueia a aba via `GatedTab`.
- Falha no `html2pdf` → toast, sem travar a tela.

## Testes

- Servidor: `relatorio-gerencial.calc.test.ts` (classificação, exclusão de estornos/transferências/parciais, saldo por conta com saldo inicial, previsto separado, operações por tipo, rastreabilidade, estado vazio), `relatorio-gerencial.schemas.test.ts` (datas, regime, limite de 24 meses), `routes/relatorio-gerencial.test.ts` (403 sem permissão, 400 query inválida — com o service mockado, como `routes/rebanho/relatorios.test.ts`).
- Cliente: `template.test.ts` (ordem, visibilidade, persistência), `export.test.ts` (CSV respeita seções visíveis e ordem), `RelatorioGerencialDocumento.test.tsx` (estado vazio sem números enganosos; título personalizado; realizado e previsto em blocos distintos), `Relatorios.test.tsx` (card abre o gerencial).

## Fora de escopo

Persistência do template no servidor, PDF gerado no servidor, demonstrações contábeis, conciliação bancária, edição de valores.
