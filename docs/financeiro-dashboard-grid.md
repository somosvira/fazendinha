# Visão geral financeira

Contrato da consulta inicial do Financeiro. A identidade atual está no [design unificado](design/cooperativa-unificada.md), as regras monetárias no [contrato financeiro](financeiro-rebuild-contrato.md) e a explicação de uso em [Operações](guia/02-financeiro-operacoes.md). Propostas e relatos antigos de composição foram incorporados aos guias vigentes.

## Indicadores e bases

A visão geral responde quanto está disponível e quais compromissos exigem ação. Saldo disponível é a posição atual das contas incluídas, independente do período dos fluxos. Recebimentos e pagamentos usam a data realizada. A pagar/a receber usam saldo pendente e vencimento no recorte; não são dinheiro já movimentado.

Compromissos apresenta vencidos e próximos vencimentos, com acesso à lista completa preservando contexto. As contagens e totais não são reconstruídos das poucas linhas mostradas. Calendário e detalhe reutilizam as permissões e liquidações existentes.

Contas incluídas no saldo geral aparecem separadas das excluídas. Resultado de caixa é o valor realizado calculado pelo servidor; não representa lucro nem soma de compras/consumos. Transferências próprias não produzem receita/despesa consolidada. Aportes e retiradas mantêm sua classificação.

## Consulta, filtros e navegação

Período e sítio definem o recorte. `inicio`/`fim` inclusivos podem vir da URL, inclusive dos links do assistente. Troca de filtro não reclassifica fatos. Abrir operação, compromisso ou conta leva ao registro de origem; erro ao abri-lo não significa que deixou de existir.

Filtros adicionais usam rascunho e Aplicar/Cancelar. As tabelas seguem a consulta compartilhada; ordenação atua no conjunto completo disponível, antes da paginação. Ausência de valor e zero permanecem distintos; custos e agregados seguem a autorização do servidor.

## Apresentação e evidência

A visão geral mantém a composição compacta de indicadores, compromissos, contas e caixa. O padrão de cores, tabelas, modais, foco e responsividade vem dos tokens/componentes atuais. Não há seletor de temas implementado como consequência de referências visuais antigas.

Os detalhes de relatório emitido têm outro contrato: o snapshot salvo, não esta consulta viva. Capturas e resultados históricos em [QA](../design-qa.md) pertencem às datas/cenários registrados; não atestam disponibilidade nem homologação de todos os fluxos atuais.

## Implementação

Interface em `client/src/financeiro/`; dados e cálculos em `server/src/services/financeiro/dashboard.calc.ts` e serviços financeiros. Testes próximos dessas fontes cobrem bases e recortes. O [painel gerencial](painel-gerencial.md) é outra consulta, com fontes e cortes próprios, e não deve ser confundido com a visão geral financeira.
