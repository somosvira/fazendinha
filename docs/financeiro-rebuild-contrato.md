# Contrato funcional — reconstrução do Financeiro

Este documento fixa as regras que orientam a reconstrução local do Financeiro. Ele é deliberadamente independente do modelo legado e da importação do Excel.

## Fonte da verdade

- `Operacao` explica o fato de negócio.
- `CompromissoFinanceiro` representa apenas valor ainda pendente, a pagar ou receber.
- `TransacaoFinanceira` representa dinheiro realizado.
- `MovimentoConta` é a única fonte de alteração do saldo de uma conta.
- `MovimentoEstoque` representa alteração física e sempre possui uma origem justificável.
- `Documento` comprova uma operação ou uma transação.

## Cardinalidades

Uma operação possui, opcionalmente, muitos itens, compromissos, transações, movimentos de estoque e documentos. Nenhuma dessas relações é obrigatória por conveniência técnica: elas existem somente quando o fato de negócio as exige.

## Regras monetárias

1. Saldo da conta = saldo de abertura + entradas confirmadas - saídas confirmadas.
2. Saldo geral = soma das contas ativas incluídas na disponibilidade.
3. Compromisso não altera saldo.
4. Compra ou serviço integralmente pago no ato não cria compromisso.
5. Pagamento parcial imediato cria transação pelo valor pago e compromisso somente pelo restante.
6. Liquidação posterior nunca pode superar o saldo pendente do compromisso.
7. Transferência entre contas próprias possui duas pontas de mesmo valor e impacto zero no saldo geral.
8. Registros financeiros confirmados não são apagados; são revertidos com evento inverso e trilha de auditoria.

## Regras de estoque

1. Compra de item estocável gera movimento físico apenas quando houver recebimento.
2. Recebimento não depende de pagamento.
3. Entrada de origem `COMPRA` exige vínculo com operação de compra.
4. Ajuste exige justificativa e usuário responsável.
5. Transferência de estoque gera saída e entrada vinculadas.
6. Movimento confirmado não é apagado; é revertido.

## Cenários obrigatórios

1. Compra à vista: estoque aumenta, conta diminui, nenhum compromisso é criado.
2. Compra a prazo: estoque aumenta, compromisso é criado, saldo não muda.
3. Compra parcialmente paga: saldo diminui pelo valor pago e compromisso representa somente o restante.
4. Serviço à vista: conta diminui e estoque não muda.
5. Serviço a prazo: compromisso é criado e estoque e saldo não mudam.
6. Venda à vista: estoque diminui quando aplicável e conta aumenta.
7. Venda a prazo: compromisso a receber é criado e saldo não muda.
8. Transferência financeira: duas contas mudam e o saldo geral permanece igual.
9. Aporte de caixinha: transferência de uma conta para uma conta do tipo `CAIXA`.
10. Reversão: efeitos são neutralizados sem apagar histórico.

## Restrições desta execução

- somente branch local `financeiro-rebuild`;
- somente banco `fazendinha_local`;
- nenhum push ou deploy;
- nenhum compromisso de compatibilidade com o modelo antigo;
- nenhuma importação do Excel nesta fase;
- seed pequeno e determinístico como única massa inicial.
