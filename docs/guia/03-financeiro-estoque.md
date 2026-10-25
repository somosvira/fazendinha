# Financeiro · Estoque

## Conceito: um estoque compartilhado

Estoque acompanha quantidades por produto e sítio, com origem e destino justificáveis. O mesmo Produto pode ter uso sanitário, nutricional e genético; esses usos não criam estoques paralelos. Lote de animais agrupa o rebanho; partida/lote de produto identifica material e validade.

Saldo físico responde “quanto existe”; valor do saldo responde “qual valor está comprovado no remanescente”. Preço de venda, valor da compra, custo do consumo e referência comercial têm propósitos diferentes.

## Rotina de entrada e saída

1. Cadastre o produto, unidade, usos e rastreio aplicável.
2. Registre a origem física: recebimento de compra, inventário documentado ou produção confirmada.
3. Se rastreado, identifique partidas e validade conforme a evidência disponível.
4. Consulte saldo no sítio e na data relevantes.
5. Consuma pelo fluxo que originou o uso: aplicação, reprodução, fechamento de dieta ou destino leiteiro.
6. Para diferença de contagem, perda ou transferência, use o comando específico com motivo.

Uma aplicação não deve ser acompanhada de uma saída manual extra. Sua confirmação já produz o movimento vinculado quando a origem é estoque. Compra direta/documentada tem contrato próprio e não autoriza fabricar uma entrada fictícia para depois consumi-la.

## Movimentos e rastreabilidade

| Fato | Quantidade | Dinheiro e história |
|---|---|---|
| Recebimento | Entrada no sítio | Valor e vínculo à compra; pagamento pode ocorrer depois |
| Consumo operacional | Saída vinculada ao fato | Atribui custo; não cria outra despesa |
| Transferência | Saída na origem e entrada no destino | Conserva quantidade, unidade, parcelas e valor; anula-se no consolidado |
| Perda | Saída justificada | Distingue material perdido de material administrado |
| Ajuste de contagem | Diferença documentada | Não substitui comprovação de preço nem corrige todos os fatos passados |
| Estorno | Movimento inverso | Mantém original e vínculos; depende da disponibilidade e dos consumidores |

O saldo deve considerar corretamente o original e a reversão. Filtrar indiscriminadamente apenas registros confirmados pode eliminar uma ponta e produzir um saldo falso.

## Partidas e validade

Produto rastreado exige alocação das saídas por partida, unidade compatível e tratamento explícito da validade na data. Vencida, desconhecida e conhecida são condições distintas. Um alias de partida resolve para o grupo canônico; não pode ser contado como outro estoque.

Ativar rastreio sobre saldo existente tem prévia e identificação das partidas. Redistribui a identificação do histórico, sem criar quantidade/valor adicional. Não se desliga rastreio apenas para contornar uma validação.

## Valor do saldo e custo utilizado

Produto rastreado usa média do saldo remanescente do grupo de produto/validade no sítio. Produto sem rastreio usa bases econômicas disponíveis em FIFO. Transferência conserva uma base de destino por parcela de origem; preços diferentes não são achatados numa média arbitrária.

Exemplo: dez unidades a R$ 40 e dez a R$ 65 no mesmo grupo formam 20 unidades e R$ 1.050. Consumir duas atribui R$ 105, deixando 18 unidades e R$ 945. Uma compra posterior não altera os R$ 105 daquele uso.

O total monetário é autoritativo; o custo unitário arredondado é apresentação. A última saída absorve o resíduo de centavos. A conservação precisa fechar: abertura + entradas + ajustes líquidos = saídas líquidas + saldo final, em quantidade e valor.

Saldo histórico sem preço não recebe custo inventado. A abertura documentada exige quantidade correspondente, valor, referência, evidência, motivo e conferência de versão. Não cria compra, pagamento ou custo histórico novo. Quantidade zero, custo zero comprovado e custo desconhecido são diferentes.

## A exceção leiteira da V5

Leite pode entrar fisicamente com custo produtivo ainda pendente, pelo método restrito `LEITE_FIFO_V1`. Essa exceção exige origem leiteira e alocações comprovadas; não relaxa a regra para os demais produtos.

Produzir 1.000 L, vender 600 L, fornecer 100 L e guardar 300 L conserva a quantidade. Uma apuração documentada posterior de R$ 1.500 atribui R$ 900 à venda, R$ 150 ao fornecimento e R$ 450 ao saldo. Não lança outra despesa ou recebimento. Histórico e versões da apuração permanecem consultáveis.

No leite, o saldo comercial é uma parte do físico: 50 L comerciais + 10 L de colostro = 60 L físicos, mas apenas 50 L candidatos à venda. Encerrar a carência do animal hoje não torna comercial o leite produzido durante a restrição.

## Interface e interpretação

Produtos e Movimentações têm consultas próprias. Produtos oferece cartões/tabela, saldo, mínimo e valor conhecido; não soma kg, litros e unidades como uma única quantidade. Reposição compara saldo com mínimo cadastrado e não prevê dias até faltar sem uma base de consumo.

Validades consideram grupos com saldo positivo. Ausência de grupos não prova validade conhecida. O detalhe abre as origens, movimentos e valorização; links para fatos de Pecuária conservam o contexto. Transferir, ajustar e perder são comandos distintos.

Estoque Leite é um recorte da mesma base. Ordenhas ainda sem confirmação aparecem na produção, mas não no saldo disponível. O tanque registrado na ordenha identifica o recipiente de origem; o sistema não promete saber em qual tanque está cada sobra hoje.

## Limites e correções

Não existe motor geral de recálculo retroativo do estoque. Entrada com consumidores, período fechado e classificação restritiva exigem regularização explícita. Corrigir um lançamento não pode devolver material que foi realmente utilizado ou descartado.

O produto leiteiro atual deve ser ativo, em litros, sem rastreio por partida e dedicado ao percurso leiteiro. Misturar métodos/históricos ou usar transferência/ajuste genérico para resolver um saldo leiteiro não reconciliado não é um percurso suportado automaticamente.

## Implementação e verificações

Rotas: `server/src/routes/estoque.ts`; serviços: `server/src/services/estoque/estoque.ts` e `valorizacao.ts`; consumo pecuário: `server/src/services/pecuaria/consumo.ts`. Produto, MovimentoEstoque, PartidaProduto, AlocacaoPartidaEstoque, BaseValorizacaoEstoque e ParcelaValorizacaoEstoque ficam no schema `public`; origens/alocações lácteas ficam em `pecuaria` e apontam para os mesmos movimentos.

Testes de valorização, perdas, transferências, integrações pecuárias e conservação leiteira acompanham os serviços. SQL protege compatibilidade, somas e histórico. Referências: [Financeiro/Estoque](../financeiro-rebuild-contrato.md) e [estoque do leite](../pecuaria/leite-decisoes-estoque.md).
