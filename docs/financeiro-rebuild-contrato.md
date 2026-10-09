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
- Aplicações sanitárias/fechamentos nutricionais usam o estoque único. Origens de compra direta, aplicação documentada e reconciliação têm efeitos próprios; não substitua uma pela outra para criar saldo fictício.
- Centros, categorias e movimentos de atividades agrícolas anteriores podem permanecer. A remoção dos módulos não autoriza apagar a história financeira ou seus cadastros pelo nome.

## Permissões e documentos

Rotas exigem sessão, área/ação e escopo; custos e exportações devem respeitar a visibilidade financeira. Há uma limitação atual de exposição de valores em operações comuns ao operador sem `verValores`. Em `server/src/routes/financeiro.ts`, `apresentarOperacao()` mascara Serviço e efeitos de transferência/perda quando não há visibilidade de custos, mas retorna outras operações sem o mesmo mascaramento. Isso confirma que a proteção não é uniforme; a correção e o reteste desse acesso permanecem pendentes.

Documentos e relatórios usam R2 e chaves persistidas. Rascunhos com anexo e operações confirmadas têm fluxos distintos de acesso; não suponha rota de download onde ela não existe. Confira rotas e `services/financeiro/documentos.ts` antes de mudar esse contrato.

## Validação

Invariantes, estornos e concorrência ficam nos testes ao lado dos serviços e em `server/tests/financeiro/invariantes.test.ts`. A bateria `test:financeiro:integration` prepara seu próprio banco temporário com migrations. Não depende de seeds antigos nem de checklist de PR. Consulte [desenvolvimento](desenvolvimento.md) para o cenário integrado atual.
