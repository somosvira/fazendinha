# Contrato atual de Financeiro e Estoque

Este contrato descreve a implementação atual, independente do financeiro anterior e do Excel. Estrutura em `server/prisma/schema.prisma`; regras em `server/src/services/financeiro/` e `services/estoque/`; rotas em `server/src/routes/financeiro.ts` e `estoque.ts`.

## Fatos e efeitos

| Entidade | Significado |
|---|---|
| `Operacao` / `ItemOperacao` | Fato de negócio e seus itens |
| `CompromissoFinanceiro` | Valor pendente a pagar/receber |
| `Liquidacao` | Vínculo do pagamento/recebimento posterior ao compromisso |
| `TransacaoFinanceira` | Dinheiro realizado |
| `MovimentoConta` | Efeito no saldo da conta |
| `MovimentoEstoque` | Efeito físico com origem justificável |
| `DocumentoFinanceiro` | Comprovante/anexo da operação ou transação |
| `AuditoriaFinanceira` | Autoria, ação, motivo e estados anteriores/posteriores |

Itens, compromissos, transações, movimentos físicos e documentos só existem quando exigidos pelo fato. Rascunho não deve produzir efeitos de uma operação confirmada.

## Dinheiro e histórico

1. Saldo da conta resulta da abertura e do razão de movimentos; `MovimentoConta` é a fonte dos efeitos de dinheiro. Saldo geral respeita contas ativas incluídas na disponibilidade e o escopo consultado.
2. Compromisso não altera saldo. Compra/serviço integralmente pago no ato não cria compromisso; pagamento parcial cria transação pelo pago e compromisso somente pelo restante.
3. Liquidação não supera o pendente. Transferência entre contas próprias gera duas pontas equivalentes, sem criar receita/despesa pela circulação do dinheiro.
4. Use `Prisma.Decimal` e `dinheiro()` em `regras.ts`; preserve precisão e os formatos dos DTOs existentes.
5. Escritas financeiras respeitam o sítio e `PeriodoFinanceiro` fechado, usam transação e registram auditoria. Confirmados são cancelados/estornados com eventos inversos, sem apagar o fato original.
6. Relatórios/visão geral distinguem competência do fato, dinheiro realizado e pendências. Não use custo de consumo pecuário como nova compra/despesa. Cálculos atuais ficam em `services/financeiro/dashboard.calc.ts` e `services/relatorio-gerencial.calc.ts`, com seus testes.

## Estoque compartilhado

- Recebimento físico independe de pagamento. Compra para estoque recebida gera entrada vinculada à operação; compra a prazo pode aumentar estoque sem alterar conta. Serviço não gera quantidade física.
- Produto não tem setor único: possui centros por `ProdutoCentroCusto`. Categoria é classificação financeira; usos genético, sanitário e nutricional são atributos independentes do Produto e podem coexistir.
- O sítio distingue saldos e custos. Transferência conserva origem/destino, quantidade, unidade, vínculos e custo congelado; não cria nova despesa nem duplica custo no consolidado.
- Ajuste e perda precisam de justificativa e trilha. Estorno conserva o original e seu inverso. O cálculo físico considera o par conforme `statusSaldoEstoque`/`estoque.calc.ts`; não filtre indiscriminadamente apenas confirmados.
- `PartidaProduto` é o lote do produto, distinto do lote de animais. Saldo rastreado exige alocação por partida, compatibilidade de unidade e tratamento explícito de validade desconhecida/vencida na data do fato.
- Ativar rastreio de estoque existente exige prévia; não altera saldo/valor nem cria lote vazio. A identificação de partidas redistribui o histórico sem efeito líquido. Não desative rastreio para contornar uma validação.
- Aplicações sanitárias, tentativas reprodutivas V4 e fechamentos nutricionais usam o estoque único. Origens de compra direta, aplicação documentada e reconciliação têm efeitos próprios; não substitua uma pela outra para criar saldo fictício.
- Centros, categorias e movimentos de atividades agrícolas anteriores podem permanecer. A remoção dos módulos não autoriza apagar a história financeira ou seus cadastros pelo nome.

## Valorização do saldo — follow-up em validação

A implementação do follow-up introduz `BaseValorizacaoEstoque`, `ParcelaValorizacaoEstoque` e o método de valorização no `MovimentoEstoque`. Esta seção acompanha o código em construção; a migration ainda não foi aplicada ao ambiente local e os fluxos completos aguardam validação. Não representa homologação nem disponibilidade em produção.

### Base, parcelas e conservação

- Produto rastreado usa média do **saldo remanescente** por grupo atual de produto/validade e sítio. Não há nova identidade de lote físico nem registro por dose. Aliases continuam resolvidos para a partida raiz.
- Produto sem rastreio usa aquisições disponíveis em ordem FIFO. Bases econômicas não criam partidas físicas fictícias. Transferência que usa várias origens conserva uma base no destino por parcela de origem, com vínculo `baseOrigemId`, valores próprios e disponibilidade desde a transferência; não reúne preços diferentes em uma base média no destino.
- A base conserva produto, sítio, grupo quando aplicável, origem, método, disponibilidade, ordem e eventual abertura documentada. O corte da abertura é distinto da data da origem usada na ordenação FIFO.
- A parcela vincula um movimento à base utilizada e preserva quantidade/valor com sinal. O saldo é derivado da abertura e das parcelas; não existe outra compra, obrigação ou movimento de conta pelo consumo.
- O total monetário é autoritativo. Unitário arredondado serve à apresentação; a saída que esgota a base absorve seu resíduo. Dinheiro e quantidades usam Decimal, com precisão do contrato físico/financeiro.
- A identidade obrigatória é **abertura + entradas + ajustes líquidos = saídas líquidas + estoque final**, com diferença exatamente zero em quantidade e centavos por grupo/sítio e no consolidado. Transferências internas se anulam no consolidado.
- Exemplo: 10 unidades por R$ 40 e 10 por R$ 65 no mesmo grupo formam 20/R$ 1.050. Consumir duas atribui R$ 105 e conserva 18/R$ 945. O consumo integral fecha R$ 1.050. A compra posterior não muda os R$ 105 já registrados.

Compra, pagamento e consumo são perspectivas distintas. Recebimento a prazo aumenta estoque sem pagamento; estoque remanescente continua sendo valor disponível. Não afirmar que todo desembolso já foi consumido enquanto houver saldo ou gastos de logística separados.

### Transição e abertura documentada

Movimentos anteriores conservam valores e método `LEGADO`. Não há backfill de preços nem recálculo proporcional de consumos antigos. Quantidade sem valor comprovado permanece desconhecida e exige abertura antes de usar o novo método; zero comprovado é válido e não equivale a ausência de evidência.

A prévia por produto/sítio mostra saldo físico, quantidade valorizada, estado do valor e impedimentos de retroatividade. A confirmação apresenta a revisão dessa prévia e a revalida sob trava; exige quantidade correspondente ao saldo, valor comprovado, referência, evidência, motivo e autoria. Reenvio da mesma chave/dados não repete a abertura. Uma abertura não altera quantidade física, compra, pagamento ou custo histórico.

Rotas acrescentadas em Estoque:

- `GET /api/estoque/produtos/:id/valorizacao`: diagnóstico com data e sítio.
- `POST /api/estoque/produtos/:id/valorizacao/abertura`: abertura documentada com revisão e chave de reenvio.

Consulta e abertura de valores exigem a visibilidade financeira no servidor; abertura também exige lançamento e período aberto. O detalhe do produto oferece o fluxo operacional. Dados anteriores sem lastro não recebem valor inventado para permitir uma saída.

Em produto sem rastreio, a abertura admite várias origens comprovadas, cada uma com quantidade, valor total, data e referência. A soma deve corresponder ao saldo físico. Quando a única evidência disponível for um inventário, sua referência deve identificar essa abertura; não se criam aquisições históricas presumidas. Grupo rastreado recebe uma abertura correspondente ao saldo do grupo.

Inventário inicial e ajuste positivo que iniciam uma base exigem referência e evidência: `documentacaoValor` na operação financeira e `referenciaValor`/`evidenciaValor` no ajuste de estoque. O movimento conserva essa comprovação em `evidenciaValor`, com a autoria existente. Uma justificativa de diferença física não substitui a comprovação do preço. Ajuste em base já conhecida conserva seu valor de referência e rejeita preço divergente; a API financeira direciona ajustes para o fluxo de Estoque, que aplica essas regras. Contagem sem base de valor exige regularizar a abertura antes de confirmar o ajuste.

### Desconto comercial e logística

Nas compras, o desconto comercial reduz o valor dos itens elegíveis antes da criação do estoque e da obrigação. A distribuição proporcional conserva os centavos do desconto; uma distribuição explícita deve fechar o total e respeitar elegibilidade e limite de cada item. Desconto de liquidação continua sendo outro fato e não reescreve o custo histórico do estoque.

A logística cobrada pelo mesmo fornecedor constitui item próprio, sem estoque, com categoria e centro de custo. Não entra no custo da dose. Cobrança de terceiro deve ter sua própria operação e obrigação. `Operacao.composicaoComercial` conserva a explicação do bruto, desconto e líquido por item e da logística; `ItemOperacao` conserva os valores líquidos utilizados no cálculo. Esse JSON não cria outro lançamento nem outro valor a somar.

### Correções, concorrência e leitura

Os gravadores compartilham travas por produto em ordem estável, além das garantias existentes de cada domínio. Itens repetidos de uma operação consomem o saldo atualizado após o item anterior. Movimento, alocação física, parcela monetária e fato operacional são confirmados atomicamente.

Estorno cria parcelas inversas dos valores originais. Entrada com consumidores dependentes não pode ser retirada como se ainda estivesse integralmente disponível. A correção retroativa apresenta os impedimentos e revalida na confirmação; este PR não inclui motor geral de recálculo histórico nem contorna período fechado.

Leituras por grupo devem usar as parcelas preservadas. Uma repartição feita novamente na consulta não substitui o registro do valor utilizado. Custos antigos, snapshots e autoria permanecem consultáveis. Valores completo/parcial/desconhecido e oculto por permissão não são intercambiáveis.

As garantias SQL conferem somas, sinais e compatibilidade das referências. O domínio não oferece edição/exclusão das parcelas ou bases confirmadas. A limpeza administrativa de fixtures inteiras em uma transação não é fluxo de negócio e deve permanecer restrita aos produtos criados pelo próprio teste, sem desabilitar triggers.

## Permissões e documentos

Rotas exigem sessão, área/ação e escopo; custos e exportações devem respeitar a visibilidade financeira. No follow-up, `apresentarOperacao()` passa a mascarar valores em todas as operações quando não há acesso financeiro com `verValores`, incluindo a composição comercial. Listagem, detalhe, criação, confirmação de rascunho e resposta de estorno utilizam esse apresentador. A abertura de valorização exige a mesma visibilidade no servidor. Esses ajustes não constituem homologação de todas as rotas financeiras; cada DTO e relatório continua responsável por conferir sua permissão.

Documentos e relatórios usam R2 e chaves persistidas. Rascunhos com anexo e operações confirmadas têm fluxos distintos de acesso; não suponha rota de download onde ela não existe. Confira rotas e `services/financeiro/documentos.ts` antes de mudar esse contrato.

## Validação

Invariantes, estornos e concorrência ficam nos testes ao lado dos serviços e em `server/tests/financeiro/invariantes.test.ts`. A bateria `test:financeiro:integration` prepara seu próprio banco temporário com migrations. Não depende de seeds antigos nem de checklist de PR. Consulte [desenvolvimento](desenvolvimento.md) para o cenário integrado atual.

## Reprodução V4 e Serviços

Tentativas de IA/TE/cobertura podem integrar os procedimentos de um Serviço confirmado, com valor individual opcional e vínculo navegável até o fato. A soma das atribuições inclui reprodução, aplicações, exames e protocolos sanitários, respeitando o valor total do Serviço e a permissão de ver valores. O vínculo não altera quantidade física nem cria nova despesa.

Um Serviço com tentativa válida vinculada não pode ser cancelado antes de revisar seus procedimentos. O consumo reprodutivo também não pode ser estornado isoladamente pelo Estoque: a correção parte da reprodução e distingue devolução por erro de lançamento de material efetivamente usado ou descartado. Períodos fechados e o histórico dos movimentos permanecem protegidos.

Tentativas e aplicações anuladas com consumo mantido continuam ocupando o limite atribuído ao Serviço e impedem cancelamento sem revisão dos vínculos. Material incluído no Serviço pode manter seu consumo sem movimento fictício de estoque. Anular uma tentativa vinculada verifica tanto o período do fato quanto o do Serviço; nenhum retry pode retirar a atribuição de um período fechado. Aplicação de compra direta com consumo mantido conserva a quantidade destinada, impedindo sua reutilização por outra aplicação.
