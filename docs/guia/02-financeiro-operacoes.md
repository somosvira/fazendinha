# Financeiro · Operações

## Conceito: negócio, obrigação e dinheiro

Uma **operação** registra o negócio. Um **compromisso** registra o restante a pagar ou receber. Uma **transação** registra dinheiro realizado. Um **movimento de conta** registra sua entrada ou saída numa conta. A **liquidação** liga o pagamento ou recebimento posterior à obrigação original.

Essas entidades são separadas porque suas datas e seus efeitos podem ser diferentes. Comprar hoje, receber amanhã e pagar no próximo mês é uma história coerente; o saldo bancário não deve mudar só porque existe uma obrigação.

## Tipos de operação e efeitos

| Tipo | Uso | Efeito a conferir |
|---|---|---|
| Compra para estoque | Material que ficará disponível para uso posterior | Entrada quando recebido; dinheiro/obrigação conforme condição |
| Compra para consumo direto | Material comprado para destinação direta comprovada | Origem para o consumo, sem inventar saldo armazenado |
| Serviço | Trabalho contratado | Valor e condição financeira; procedimentos podem ser vinculados |
| Venda | Comercialização | Receita/obrigação; quantidade física apenas quando o percurso exige |
| Aporte | Entrada de recursos próprios | Entrada em conta; não confundir com venda |
| Retirada | Saída de recursos | Saída em conta; não confundir com compra de material |
| Transferência financeira | Circulação entre contas próprias | Duas pontas equivalentes; não cria receita ou despesa consolidada |
| Inventário, bonificação e devolução | Origens físicas específicas | Conferir documentação, quantidade, valor e vínculo exigidos |
| Ajuste e transferência de estoque | Regularização ou mudança física | Fluxo próprio de Estoque; não usar para simular compra/pagamento |
| Compra de animais | Compra de animais com cadastro no Rebanho | Mesmos efeitos de uma compra; animais entram no Rebanho na confirmação; devolução de cabeças pela ficha da compra; correção pela ficha da compra cancelada |
| Produção de leite | Volume produzido na ordenha | Entrada pela Pecuária; não criar operação financeira fictícia de valor zero |

Para confirmar leite produzido, abra **Pecuária → Leite** e confira a origem da produção.

## Exemplo completo: compra com pagamento parcial

Considere uma compra de R$ 1.000, recebida integralmente, com R$ 300 pagos no ato.

1. Cadastre fornecedor, itens, quantidade/unidade, classificação, sítio e datas.
2. Informe recebimento físico e condição financeira real.
3. Confira a prévia: entrada física, transação de R$ 300 e compromisso de R$ 700.
4. Confirme. A conta sofre apenas R$ 300 de saída; o recebimento físico não espera os R$ 700.
5. Ao pagar R$ 200 depois, liquide essa parcela. O compromisso passa a parcial e resta R$ 500.
6. O pagamento final de R$ 500 liquida o compromisso. O estoque não recebe o produto novamente.

Compra totalmente paga no ato não precisa criar compromisso para depois liquidá-lo artificialmente. Em pagamento a menor, o restante continua devido; a liquidação atual não possui abatimento automático do saldo.

## Comprar animais ou devolver cabeças

Na compra de animais, informe o fornecedor e os animais que entraram. Confira o sítio, a identificação das cabeças e a condição de pagamento antes de confirmar. Ao usar **Valor do lote**, confira a parcela atribuída a cada cabeça. O ECC opcional informado no cadastro de uma cabeça é registrado como exame de escala 1–5 na confirmação, na data de entrada; o rascunho não cria o exame.

Se devolver parte da compra, abra a ficha da compra confirmada e escolha **Devolver cabeças**. Selecione os animais que saíram, confira quanto o fornecedor devolverá e informe se o valor já foi recebido ou se ficará a receber. A devolução registra a saída dessas cabeças e o crédito ou recebimento correspondente. Se a compra tiver saldo a pagar, confira esse compromisso separadamente.

## Estados e transições

| Objeto | Estados | Transição e significado |
|---|---|---|
| Operação | Rascunho, Confirmada, Cancelada | Preparar não produz efeitos; confirmar produz os efeitos validados; cancelar conserva histórico |
| Compromisso | Pendente, Parcial, Liquidado, Cancelado | Pagamentos/recebimentos alteram o saldo exigível; cancelado não é liquidado |
| Transação | Confirmada, Revertida | A reversão gera o efeito inverso e conserva o original |
| Período financeiro | Aberto, Fechado | Fechamento protege fatos; correção não pode contornar essa trava |

“Vencido” é uma condição da data e do saldo ainda devido, não prova de inadimplência definitiva nem um novo pagamento. Valor original e saldo pendente continuam separados. Um título cancelado pode mostrar saldo atual zero sem ter sido pago.

## Cadastros e classificação gerencial

A conta identifica onde o dinheiro circula. Parceiros podem ter papéis compatíveis com os negócios. Categoria classifica a operação ou o item; grupo organiza categorias; centro de custo identifica a destinação gerencial. Ao cadastrar uma categoria, escolha seu grupo. Categorias antigas sem grupo podem ser regularizadas no cadastro.

O grupo vem da categoria, sem uma escolha independente na operação. Alterar o agrupamento atual pode mudar a organização de consultas futuras do histórico, mas não os valores dos fatos nem relatórios já emitidos. Campos ausentes não devem ser preenchidos por inferência do nome do fornecedor.

Desconto comercial reduz os itens elegíveis, com distribuição que conserva centavos. Logística do fornecedor é item próprio, sem estoque, e não entra automaticamente no custo da dose. Cobrança de terceiro tem operação própria.

## Onde trabalhar

**Operações** consulta os fatos por tipo e impacto: movimentou estoque, gerou conta a pagar, gerou conta a receber ou movimentou dinheiro. Um registro pode ter vários impactos. O detalhe mostra itens, compromissos, documentos, histórico e movimentos vinculados.

**Compromissos** separa pagar/receber, saldo, vencimento e situação; lista e calendário são apresentações da mesma obrigação. **Contas** separa cadastro, extrato geral e análise. Transferências próprias são excluídas do fluxo consolidado de receita/despesa. **Relatórios** preservam a emissão; alternar Resumo, Análises, Itens e Documento não recalcula os fatos.

Busca, filtros e ordenação devem agir sobre o recorte completo autorizado antes de paginar. Abrir um filtro cria rascunho; Aplicar confirma o recorte, Cancelar preserva a consulta. Links para parceiro, compromisso e movimento abrem o registro exato.

## Correções e documentos

Rascunhos permitem retomar o trabalho; sua exclusão é diferente de cancelar uma operação confirmada. A fila de gravação precisa terminar antes de descartar, para não recriar o rascunho. Correções de confirmados exigem motivo, análise das dependências e período aberto.

Estornar um pagamento pode reabrir o saldo devido; não significa devolver fisicamente um produto. Cancelar uma compra já consumida exige tratar os consumidores, e não apenas ocultar a operação. Comprovantes e PDFs são privados e só podem ser baixados com o acesso correspondente.

## Como interpretar relatórios

**Caixa realizado** usa pagamentos/recebimentos. **Compras e serviços** usam a data do negócio. **Compromissos** representam a posição pendente. **Saldo** inclui a abertura e os movimentos da conta. Esses valores não devem ser somados entre si.

Resultado de caixa não é lucro: pode incluir aporte e não contempla necessariamente depreciação, custos não registrados ou competência econômica completa. A linha acumulada do relatório é resultado de caixa acumulado, não uma série de saldos bancários mensais reconstruída.

Linhas truncadas de um relatório não recompõem seu total; o documento emitido pode conter agregados de um recorte maior. Valores ocultos ou desconhecidos continuam indisponíveis. Novas correções pedem nova emissão para aparecer no documento.

## Integração com Pecuária

Um Serviço pode ser ligado a aplicações, exames, tentativas e procedimentos realizados, respeitando o total contratado e as atribuições explícitas. O vínculo não cria outro procedimento nem outra despesa. Custo de material e Serviço podem coexistir; material já incluído num pacote não deve ser contado de novo.

Uma coleta de leite com preço pendente pode reduzir estoque antes de existir venda financeira. O fechamento comercial cria a venda e a obrigação/recebimento normal, sem reduzir novamente os litros. O capítulo Produção detalha esse percurso.
