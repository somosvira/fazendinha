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
| Produção de leite | Fato produtivo da V5 | Entrada pela Pecuária; não criar operação financeira fictícia de valor zero |

A presença de um identificador no enum técnico não significa que exista um formulário livre para qualquer combinação. O motor valida os efeitos permitidos por tipo; Leite usa seus próprios comandos para preservar a origem produtiva.

## Exemplo completo: compra com pagamento parcial

Considere uma compra de R$ 1.000, recebida integralmente, com R$ 300 pagos no ato.

1. Cadastre fornecedor, itens, quantidade/unidade, classificação, sítio e datas.
2. Informe recebimento físico e condição financeira real.
3. Confira a prévia: entrada física, transação de R$ 300 e compromisso de R$ 700.
4. Confirme. A conta sofre apenas R$ 300 de saída; o recebimento físico não espera os R$ 700.
5. Ao pagar R$ 200 depois, liquide essa parcela. O compromisso passa a parcial e resta R$ 500.
6. O pagamento final de R$ 500 liquida o compromisso. O estoque não recebe o produto novamente.

Compra totalmente paga no ato não precisa criar compromisso para depois liquidá-lo artificialmente. Em pagamento a menor, o restante continua devido; a liquidação atual não possui abatimento automático do saldo.

## Estados e transições

| Objeto | Estados | Transição e significado |
|---|---|---|
| Operação | `RASCUNHO`, `CONFIRMADA`, `CANCELADA` | Preparar não produz efeitos; confirmar produz os efeitos validados; cancelar conserva histórico |
| Compromisso | `PENDENTE`, `PARCIAL`, `LIQUIDADO`, `CANCELADO` | Pagamentos/recebimentos alteram o saldo exigível; cancelado não é liquidado |
| Transação | `CONFIRMADA`, `REVERTIDA` | A reversão gera o efeito inverso e conserva o original |
| Período financeiro | `ABERTO`, `FECHADO` | Fechamento protege fatos; correção não pode contornar essa trava |

“Vencido” é uma condição da data e do saldo ainda devido, não prova de inadimplência definitiva nem um novo pagamento. Valor original e saldo pendente continuam separados. Um título cancelado pode mostrar saldo atual zero sem ter sido pago.

## Cadastros e classificação gerencial

Contas representam os lugares onde o dinheiro circula. Parceiros podem ter papéis compatíveis com os negócios. Categoria classifica a operação ou o item; grupo organiza categorias; centro de custo identifica a destinação gerencial; custeio/investimento é outra classificação.

O grupo vem da categoria, sem uma escolha independente na operação. Alterar o agrupamento atual pode mudar a organização de consultas futuras do histórico, mas não os valores dos fatos nem snapshots já emitidos. Campos ausentes não devem ser preenchidos por inferência do nome do fornecedor.

Desconto comercial reduz os itens elegíveis, com distribuição que conserva centavos. Logística do fornecedor é item próprio, sem estoque, e não entra automaticamente no custo da dose. Cobrança de terceiro tem operação própria.

## Onde trabalhar

**Operações** consulta os fatos por tipo e impacto: movimentou estoque, gerou conta a pagar, gerou conta a receber ou movimentou dinheiro. Um registro pode ter vários impactos. O detalhe mostra itens, compromissos, documentos, histórico e movimentos vinculados.

**Compromissos** separa pagar/receber, saldo, vencimento e situação; lista e calendário são apresentações da mesma obrigação. **Contas** separa cadastro, extrato geral e análise. Transferências próprias são excluídas do fluxo consolidado de receita/despesa. **Relatórios** preservam a emissão; alternar Resumo, Análises, Itens e Documento não recalcula os fatos.

Busca, filtros e ordenação devem agir sobre o recorte completo autorizado antes de paginar. Abrir um filtro cria rascunho; Aplicar confirma o recorte, Cancelar preserva a consulta. Links para parceiro, compromisso e movimento abrem o registro exato.

## Correções e documentos

Rascunhos permitem retomar o trabalho; sua exclusão é diferente de cancelar uma operação confirmada. A fila de gravação precisa terminar antes de descartar, para não recriar o rascunho. Correções de confirmados exigem motivo, análise das dependências e período aberto.

Estornar um pagamento pode reabrir o saldo devido; não significa devolver fisicamente um produto. Cancelar uma compra já consumida exige tratar os consumidores, e não apenas ocultar a operação. Comprovantes e PDFs são privados no R2, sujeitos a autorização também no download.

## Como interpretar relatórios

**Caixa realizado** usa pagamentos/recebimentos. **Compras e serviços** usam a data do negócio. **Compromissos** representam a posição pendente. **Saldo** inclui a abertura e os movimentos da conta. Esses valores não devem ser somados entre si.

Resultado de caixa não é lucro: pode incluir aporte e não contempla necessariamente depreciação, custos não registrados ou competência econômica completa. A linha acumulada do relatório é resultado de caixa acumulado, não uma série de saldos bancários mensais reconstruída.

Linhas truncadas de um relatório não recompõem seu total; o snapshot pode conter agregados de um recorte maior. Valores ocultos ou desconhecidos continuam indisponíveis. Novas correções pedem nova emissão para aparecer no documento.

## Integração com Pecuária

Um Serviço pode ser ligado a aplicações, exames, tentativas e procedimentos realizados, respeitando o total contratado e as atribuições explícitas. O vínculo não cria outro procedimento nem outra despesa. Custo de material e Serviço podem coexistir; material já incluído num pacote não deve ser contado de novo.

Na V5, uma coleta de leite com preço pendente pode reduzir estoque antes de existir venda financeira. O fechamento comercial cria a venda e a obrigação/recebimento normal, sem reduzir novamente os litros. O capítulo Produção detalha esse percurso.

## Implementação e verificações

O fluxo HTTP principal está em `server/src/routes/financeiro.ts`; o motor em `server/src/services/financeiro/operacoes.ts`, as regras monetárias em `regras.ts` e a máscara de DTOs em `visibilidade.ts`. A interface está em `client/src/financeiro/`. O schema `public` contém Operacao, ItemOperacao, CompromissoFinanceiro, Liquidacao, TransacaoFinanceira, MovimentoConta, PeriodoFinanceiro e AuditoriaFinanceira.

Os testes próximos dos serviços e `server/tests/financeiro/invariantes.test.ts` verificam efeitos e invariantes; as rotas têm testes próprios de visibilidade e escrita. Sua existência não atesta execução nesta revisão. Detalhes: [contrato financeiro](../financeiro-rebuild-contrato.md).
