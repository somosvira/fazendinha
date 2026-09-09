# Proposta de Reestruturação do Financeiro

**Documento conceitual para apresentação ao cliente**
**Projeto:** Plataforma de Gestão Rural
**Data:** 1º de setembro de 2026

---

## 1. Objetivo da proposta

Esta proposta apresenta uma nova forma de organizar o Financeiro da plataforma, conectando de maneira clara:

- as atividades realizadas pela fazenda;
- os valores que ainda precisam ser pagos ou recebidos;
- o dinheiro que efetivamente entrou ou saiu;
- as movimentações físicas de estoque;
- os documentos que comprovam cada ação.

O objetivo é permitir que cada informação seja registrada uma única vez e produza automaticamente os efeitos corretos no Financeiro, no Estoque e nos relatórios.

> **Princípio central:** o sistema deve diferenciar aquilo que aconteceu no negócio, aquilo que ainda será pago ou recebido e aquilo que efetivamente movimentou dinheiro.

---

## 2. Visão geral da solução

O novo Financeiro será organizado a partir de cinco conceitos principais:

1. **Operação:** explica o que aconteceu.
2. **Compromisso financeiro:** registra um valor a pagar ou a receber.
3. **Transação financeira:** registra uma movimentação real de dinheiro.
4. **Movimento de estoque:** registra uma alteração física de quantidade.
5. **Documento:** comprova a operação ou o pagamento.

Esses conceitos funcionam de forma integrada:

```text
Operação
├── Compromissos a pagar ou receber
├── Movimentos de estoque
├── Transações financeiras realizadas
└── Documentos e comprovantes
```

A separação é interna. O usuário não precisará cadastrar a mesma informação várias vezes. Um único formulário poderá criar automaticamente todos os registros necessários.

---

## 3. O que é uma operação

A operação é o registro principal de um acontecimento da fazenda. Ela responde:

> **O que aconteceu e por que aconteceu?**

Exemplos:

- compra de ração;
- contratação de serviço veterinário;
- venda de leite;
- transferência de dinheiro para a caixinha;
- ajuste de inventário;
- transferência de produtos entre locais.

A operação reúne as informações comuns:

- data;
- propriedade;
- fornecedor ou cliente;
- descrição;
- itens envolvidos;
- responsável pelo registro;
- documentos relacionados.

Ela pode gerar efeitos financeiros, físicos ou ambos.

---

## 4. O que é um compromisso financeiro

O compromisso financeiro representa algo que precisa ser pago ou recebido no futuro.

Exemplos:

- boleto de fornecedor com vencimento em 30 dias;
- parcela de uma máquina;
- valor que um cliente deve pela compra de leite;
- serviço contratado e ainda não pago.

O compromisso pode estar:

- pendente;
- parcialmente liquidado;
- liquidado;
- cancelado.

Enquanto estiver pendente, ele aparece nas previsões e nas contas a pagar ou receber, mas **não altera o saldo das contas financeiras**.

Essa regra permite que o sistema mostre separadamente:

- quanto dinheiro existe hoje;
- quanto deverá sair;
- quanto deverá entrar;
- quanto já está comprometido.

---

## 5. O que é uma transação financeira

A transação financeira representa dinheiro que efetivamente entrou, saiu ou mudou de conta.

Exemplos:

- pagamento de um fornecedor;
- recebimento de um cliente;
- transferência entre duas contas bancárias;
- abastecimento da caixinha;
- retirada de dinheiro.

Somente a transação financeira altera o saldo das contas.

Cada transação deve informar:

- valor realizado;
- data;
- conta de origem ou destino;
- finalidade;
- responsável;
- comprovante, quando aplicável.

---

## 6. Como funcionará uma compra à vista

O usuário registra uma única compra:

```text
Fornecedor: Casa da Ração
Produto: 100 sacos de ração
Valor: R$ 10.000
Pagamento: pago agora
Conta: Sicoob
```

Ao confirmar, o sistema registra automaticamente:

1. a operação de compra;
2. a entrada dos produtos no estoque;
3. o compromisso financeiro;
4. o pagamento integral;
5. a saída de R$ 10.000 da conta Sicoob;
6. a nota fiscal e o comprovante, se anexados.

Para o usuário, todo o processo acontece em uma única ação. Internamente, as informações permanecem separadas para garantir rastreabilidade.

---

## 7. Como funcionará uma compra a prazo

O usuário registra:

```text
Fornecedor: Casa da Ração
Produto: 100 sacos de ração
Valor: R$ 10.000
Pagamento: a prazo
Vencimento: 30 dias
```

Ao confirmar, o sistema registra:

1. a operação de compra;
2. a entrada dos produtos no estoque;
3. uma conta de R$ 10.000 a pagar;
4. a nota fiscal correspondente.

Nesse momento:

- o estoque aumenta;
- a dívida passa a aparecer nas contas a pagar;
- nenhuma conta bancária é alterada;
- o saldo disponível continua representando apenas o dinheiro existente.

Quando o pagamento acontecer, o usuário acessa a conta pendente e registra:

```text
Valor pago: R$ 10.000
Conta utilizada: Sicoob
Data: 30/09/2026
Comprovante: pagamento.pdf
```

Somente então o saldo da Sicoob é reduzido e o compromisso passa a ser liquidado.

---

## 8. Como funcionará um pagamento parcial

Uma compra de R$ 10.000 pode ser paga em mais de uma transação:

```text
Valor da compra:       R$ 10.000
Primeiro pagamento:   R$  4.000
Saldo pendente:        R$  6.000
Segundo pagamento:    R$  6.000
Saldo pendente:        R$      0
```

Cada pagamento registra sua própria:

- conta utilizada;
- data;
- forma de pagamento;
- documentação;
- pessoa responsável.

Isso permite pagar uma mesma obrigação com contas diferentes sem perder o histórico.

---

## 9. Como funcionará uma contratação de serviço

Serviços não precisam gerar estoque.

Exemplo:

```text
Serviço: atendimento veterinário
Fornecedor: Clínica Veterinária
Valor: R$ 500
Pagamento: em 15 dias
```

O sistema registra:

- a operação de contratação;
- um compromisso de R$ 500 a pagar;
- o contrato, recibo ou nota fiscal;
- nenhum movimento de estoque;
- nenhuma alteração imediata no saldo bancário.

No pagamento, uma transação financeira reduz a conta escolhida e liquida o compromisso.

Para despesas pequenas e imediatas, o sistema também poderá oferecer uma opção de **despesa rápida**, sem exigir um fluxo de compra completo.

---

## 10. Como funcionará o Estoque

Toda entrada de estoque deverá possuir uma origem identificada.

As principais origens serão:

- compra;
- transferência entre estoques;
- produção ou colheita;
- devolução;
- bonificação;
- estoque inicial;
- ajuste de inventário autorizado.

Uma entrada não precisará estar paga para alterar o estoque. O produto pode ser recebido hoje e pago futuramente.

Por outro lado, entradas sem justificativa deverão ser bloqueadas. Ajustes continuarão possíveis, mas precisarão informar motivo e responsável.

Essa regra reduz divergências entre:

- o que foi comprado;
- o que foi recebido;
- o que existe fisicamente;
- o que ainda precisa ser pago.

---

## 11. Como funcionará uma transferência

Transferência é o movimento de dinheiro entre duas contas da própria fazenda.

Exemplo:

```text
Conta Sicoob:  - R$ 1.000
Caixinha:      + R$ 1.000
Saldo geral:   sem alteração
```

A transferência:

- não é receita;
- não é despesa;
- não altera o resultado financeiro;
- apenas muda onde o dinheiro está guardado.

O sistema deverá registrar as duas pontas ao mesmo tempo, impedindo que exista uma saída sem a entrada correspondente.

---

## 12. Como funcionará a caixinha

A caixinha será tratada como uma conta financeira do tipo dinheiro em caixa.

Ela será abastecida por uma transferência proveniente de outra conta:

```text
Banco do Brasil
      ↓ transferência
Caixinha da propriedade
```

Quando houver uma despesa pela caixinha, o sistema registrará:

- a saída do saldo da caixinha;
- a finalidade do gasto;
- o responsável;
- o comprovante ou a justificativa.

O orçamento da caixinha será tratado separadamente:

- **saldo:** quanto dinheiro existe;
- **orçamento:** quanto está autorizado para gastar.

Um orçamento não cria dinheiro e não pode ser usado como origem de saldo.

---

## 13. Como será formado o saldo geral

O saldo geral será a soma dos saldos das contas financeiras ativas:

```text
Contas bancárias
+ dinheiro em caixa
+ caixinhas
+ aplicações consideradas disponíveis
= disponibilidade financeira total
```

Cada conta terá seu próprio histórico e deverá informar:

- saldo de abertura;
- data do saldo de abertura;
- entradas;
- saídas;
- transferências;
- saldo atual;
- última conciliação.

O sistema sempre exibirá o total acompanhado da composição por conta, evitando que um número consolidado esconda sua origem.

---

## 14. Configuração Financeira

O Financeiro terá uma área própria de configuração para que usuários autorizados possam administrar:

- contas financeiras;
- fornecedores e clientes;
- categorias;
- centros de custo;
- formas de pagamento;
- caixinhas;
- orçamentos;
- períodos financeiros;
- regras de aprovação;
- permissões dos funcionários;
- mapeamento dos produtos com o Financeiro.

Alterações sensíveis deverão manter histórico, usuário responsável e data da mudança.

---

## 15. Benefícios esperados

### Saldo confiável

O saldo passa a representar somente dinheiro efetivamente disponível nas contas cadastradas.

### Previsão sem distorcer o realizado

Contas futuras aparecem na projeção, mas não alteram o saldo atual.

### Estoque rastreável

Cada entrada informa sua origem e pode ser relacionada à compra correspondente.

### Pagamentos auditáveis

Cada pagamento possui conta, data, valor, responsável e comprovante.

### Menos cadastros duplicados

Um único formulário gera automaticamente os registros internos necessários.

### Caixinha integrada

O dinheiro da caixinha passa a ter uma origem e participa corretamente da posição financeira.

### Visão profissional da operação

O produto deixa de ser apenas um registro de entradas e saídas e passa a acompanhar o ciclo completo de compras, vendas, obrigações, estoque e caixa.

---

## 16. Síntese da proposta

O novo Financeiro será guiado por uma regra simples:

```text
Operação explica o que aconteceu.
Compromisso registra o que falta pagar ou receber.
Transação registra o dinheiro realizado.
Movimento de estoque registra a alteração física.
Documento comprova cada etapa.
```

Com essa separação, o sistema poderá oferecer uma experiência simples para o usuário sem abrir mão de controle, segurança e rastreabilidade.

> **Resultado esperado:** uma plataforma na qual Financeiro e Estoque compartilham a mesma origem de informação, mas cada módulo registra apenas o efeito que realmente lhe pertence.
