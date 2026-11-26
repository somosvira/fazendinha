# Questões de produto e levantamentos anteriores

## Questões para decisão

As [decisões de negócio](decisoes-de-negocio.md#direção-de-produto-confirmada) registram o que a fazenda já definiu. As questões abaixo ficaram em aberto.

| Tema | Exemplo da decisão que falta |
|---|---|
| Devolução maior que a dívida | Se faltam R$ 500 para quitar a compra e a devolução vale R$ 800, R$ 500 abatem o saldo. Como tratar os R$ 300 restantes? A mesma dúvida vale para uma compra já quitada. [Devolução atual](../client/src/financeiro/DevolucaoAnimais.tsx) |
| Cadastro de animais comprados | Ao comprar dez cabeças do mesmo fornecedor, faz falta informar os dados comuns uma vez e preencher os dez brincos juntos? Hoje já é possível repartir o **preço** do lote entre os animais. [Compra](../client/src/financeiro/FormOperacao.compraAnimais.test.tsx) |
| Correção de uma devolução | Se a devolução já foi registrada e depois cancelada por erro no valor, a pessoa precisa abrir a devolução cancelada e fazer a correção pela tela? A ficha hoje oferece essa ação para a compra de animais cancelada. [Ficha da operação](../client/src/financeiro/OperacaoFinanceiraDetalhe.tsx) |
| Custo de aquisição | Uma bezerra comprada por R$ 2.000 acumula R$ 500 em manejo. Em qual consulta a fazenda quer ver os R$ 2.500, com a aquisição identificada separadamente? [Custos da Pecuária](../server/src/services/pecuaria/custos/) |
| Venda e baixa do animal | Quando a fazenda vende uma cabeça, quer registrar uma única vez a saída do rebanho, o comprador, o preço e a condição de recebimento? [Rebanho](../server/src/services/pecuaria/rebanho/) e [Financeiro](../server/src/services/financeiro/operacoes.ts) |
| Ações diferentes no mesmo manejo | Uma confirmação em lote já atende a mesma ação da mesma programação para vários animais. O documento antigo propôs reunir ações diferentes na mesma confirmação. Falta um caso de campo em que isso faça diferença. [Execução de protocolos](../server/src/services/pecuaria/protocolos/execucao.ts) |

A definição de saldo por tanque permanece em aberto. Custo e margem da produção, bonificações por qualidade, importação histórica e tratamento de registros atrasados ficam para a implementação das respectivas rotinas. O [levantamento da origem dos dados](pecuaria/leite-ideagri-referencia.md) conserva a proposta histórica de corte para futura conferência.

**Um caso diferente na Nutrição.** A palavra “recomendado” para baixa automática também aparece na [tela de configuração](../client/src/pecuaria/rebanho/nutricao/ConfiguracaoNutricao.tsx). O manual explica os modos e seus efeitos. Decidir se a fazenda endossa a recomendação afeta o texto da própria interface.

## Levantamento anterior

O [inventário da revisão anterior](https://github.com/somosvira/fazendinha/blob/4271f29952902fa1e4ccb30909b6c11afa35d607/docs/lacunas.md) registra verificações da base `b63931e4`, inclusive a cobertura do assistente naquela data. Para interpretar a idade gestacional após TE, consulte o [manual de Reprodução](guia/05-pecuaria-reproducao.md). Para entender a cobertura entre controles individuais, consulte o [manual de Produção](guia/06-pecuaria-producao.md).

## Validações que não se inferem do merge

Publicação em Workers/Neon, baseline efetivamente aplicada em cada ambiente, R2 real, entrega de e-mail, chamadas reais de IA, dispositivos/leitores de tela e rotina da fazenda exigem evidência do ambiente e do cenário. O merge e os testes com mocks não substituem essas verificações.

Concorrência PostgreSQL deve identificar os comandos e disputas exercitados; um teste estrutural SQL, uma transação revertida ou uma chamada sequencial não comprova todos os interleavings. A substituição histórica autorizada da base demonstrativa não autoriza reset ou nova carga nesta tarefa.

Roteiros V3/V4/V5 e evidências visuais históricas permanecem preservados. Seus resultados pertencem aos cenários/data originais; nenhuma marcação foi aprovada ou reiniciada pela atualização documental. Bases antigas de QA não devem ser recriadas para preencher a documentação.
