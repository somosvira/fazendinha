# Preferências compartilhadas

- Financeiro: sempre usar primitivas shadcn. Manter grid compacto, faixas de destaque e cards de efeitos. A paleta aprovada é marrom, verde, vermelho e preto/grafite sobre superfícies claras; não usar azul nem amarelo forte. Não interpretar o pedido de retirar azul como pedido para neutralizar todos os cards. Ver `DESIGN.md` e `docs/financeiro-dashboard-grid.md`.

- **Modelo aprovado em 09/10/2026:** aplicar a direção clara e neutra do novo mockup apenas à visão geral financeira e à sidebar. Grid aprovado: primeira linha com recebimentos/pagamentos, contas/disponibilidade e compromissos; segunda linha com calendário separado e despesas por categoria. O calendário compacto fica sempre visível, com contadores por dia e expansão para o mês completo. Painéis brancos sem faixas decorativas, sans-serif, grafite, verde nos saldos e vermelho nos atrasos. Essa decisão substitui a preferência por faixas coloridas somente nesses dois locais; demais páginas permanecem como estavam. Sempre shadcn.

- Visão geral: evitar duplicar valores em uma faixa superior. Integrar recebimentos/pagamentos ao gráfico, saldo e contas incluídas à disponibilidade, e a pagar/a receber aos compromissos. Os quatro valores abrem listas em modal no período selecionado; não levam diretamente a contas/extratos.

## Grid integrado aprovado — 09/10/2026

Esta organização substitui a divisão anterior de três painéis na primeira linha: recebimentos/pagamentos ocupam 75% e contas/disponibilidade 25%. Na segunda, compromissos e calendário aberto por padrão compartilham um único Card shadcn com 80% da largura; despesas por categoria ficam nos 20% restantes, com rosca e legenda empilhadas. Dentro do painel maior, os próximos compromissos aparecem primeiro, ao lado do mês. No celular, a agenda integrada empilha a lista antes do calendário. Expansão, detalhes, liquidação e modais dos valores permanecem disponíveis.
