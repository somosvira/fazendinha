# Financeiro — Cooperativa contemporânea

Guia visual do Financeiro na base integrada até a V5. Tokens e componentes efetivos são a referência atual; os mockups selecionados em outubro de 2026 são proveniência de direção, não cópia do runtime. O [design system](../../../client/DESIGN.md) e o [guia compartilhado](../cooperativa-unificada.md) mantêm os padrões transversais.

## Fontes e precedência

`client/src/styles/cooperativa-theme.css`, `identidade-rural.css`, `tabelas-operacionais.css`, `client/src/financeiro/financeiro-theme.css` e as primitivas compartilhadas definem a implementação. O [contrato financeiro](../../financeiro-rebuild-contrato.md) define os fatos e seus efeitos; o visual não redefine dinheiro, situação, período ou permissão.

Os arquivos originais em `output/design/financeiro-cooperativa-2026-10-10/` eram artefatos locais e não estão versionados nesta árvore. Não são links operacionais nem requisito para desenvolver. Evidências datadas disponíveis ficam em [QA](../../../design-qa.md). Divergências entre captura antiga e código precisam ser resolvidas pelo escopo da mudança.

## Identidade

Ações usam petróleo `#006f68`, detalhes turquesa `#009c91`, lateral cinza esverdeada `#dce8e5`, painéis brancos e fundo quase branco. Títulos usam Manrope e dados/controles DM Sans, com números tabulares. Esses valores descrevem a identidade vigente e substituem a antiga paleta sálvia/floresta da proposta inicial.

Cor semântica acompanha texto: verde para confirmação, vermelho para cancelamento/erro/vencimento e âmbar para atenção. Entrada financeira, confirmação de formulário e liberação clínica são significados diferentes. Não mostrar sucesso antes da resposta do servidor nem destacar um rascunho incompleto como aprovado.

## Composição e navegação

Cabeçalho conserva identidade e comandos; abas vêm antes da consulta. PageHeader, CabecalhoTabela, SubTabs, BarraConsulta, PainelFiltros e TabelaFinanceira são reutilizados. Títulos não se repetem em faixas sem função. A visão geral financeira conserva indicadores de saldo, realizado e compromissos com suas bases explícitas.

Filtros adicionais e filtros de coluna editam um rascunho comum. Aplicar confirma; Limpar dentro do editor só altera o rascunho; Cancelar/Escape descarta. Busca/período visíveis seguem o contrato da consulta. Ordenação atua sobre a base completa disponível antes de paginar, com ausência ao final, sem inferir números do texto formatado.

Cabeçalho tabular padrão em tela usa 36px e 12px; quadros analíticos compactos usam sua variante. Células e linhas crescem para o conteúdo. Larguras de referência distribuem as colunas e determinam a conversão para cartões quando não houver espaço; não esconder dados/ações apenas para caber. Impressão conserva contrato próprio.

## Operações e compromissos

Operação separa resumo, itens, compromissos, estoque, documentos e histórico conforme existência dos vínculos. Parceiro e impactos têm ações independentes da abertura da linha. Alteração visual não muda o total do negócio nem soma outra vez seus efeitos.

Compromissos distingue pagar/receber, valor original, saldo exigível, situação e vencimento. Atraso usa texto e contraste em toda a linha/cartão, sem depender somente da cor. Lista/calendário conservam recorte e contexto. Cancelado com saldo zero não é representado como pago.

## Contas e relatórios

Contas, Extrato geral e Análise são consultas relacionadas com bases próprias. Saldo atual não é resultado de caixa do período. Reversões mantêm original, inverso, sinal e explicação. Documentos emitidos têm Resumo, Análises, Itens e Documento; seu snapshot não é recalculado ao trocar aba.

Relatórios priorizam desktop. Gráficos usam escalas lineares e zero, valores exatos acessíveis e rótulos honestos. Resultado acumulado não é saldo bancário mensal. Totais não são recompostos de linhas truncadas, e a impressão conserva a emissão original. Não criar pizzas positivas a partir de ajustes negativos.

## Acessibilidade e estados

Rótulos, foco, teclado, nome dos comandos, mensagens de falha e retorno ao acionador são parte da interação. Ícone decorativo não substitui nome acessível. Dados monetários ocultos permanecem mascarados no servidor; tooltip e documento não podem contornar a regra.

Carga inicial, atualização, vazio e erro têm apresentações distintas. Formulários conservam campos após falha; durante gravação, bloqueiam comandos concorrentes. Recarga/retomada de rascunho e exclusão de trabalho ativo seguem a fila de gravação existente.

## Integração V5

Vendas de leite abrem a cadeia financeira real; coleta física, preço pendente, obrigação e recebimento mantêm situações próprias. Novas composições não devem inventar valor zero para viabilizar o formulário. Preço comercial, custo produtivo e referência gerencial permanecem separados também no desenho.

A [iconografia](iconografia.md) registra as diretrizes de uso, sem um catálogo manual paralelo aos componentes. Fluxos e efeitos completos estão no [manual](../../guia/02-financeiro-operacoes.md). Capturas históricas e automação não substituem inspeção atual nem homologação de campo.
