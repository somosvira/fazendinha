# Preferências compartilhadas

- Financeiro: sempre usar primitivas shadcn. Manter grid compacto, faixas de destaque e cards de efeitos. A paleta aprovada é marrom, verde, vermelho e preto/grafite sobre superfícies claras; não usar azul nem amarelo forte. Não interpretar o pedido de retirar azul como pedido para neutralizar todos os cards. Ver `DESIGN.md` e `docs/financeiro-dashboard-grid.md`.

- **Modelo aprovado em 09/10/2026:** aplicar a direção clara e neutra do novo mockup apenas à visão geral financeira e à sidebar. Grid aprovado: primeira linha com recebimentos/pagamentos, contas/disponibilidade e compromissos; segunda linha com calendário separado e despesas por categoria. O calendário compacto fica sempre visível, com contadores por dia e expansão para o mês completo. Painéis brancos sem faixas decorativas, sans-serif, grafite, verde nos saldos e vermelho nos atrasos. Essa decisão substitui a preferência por faixas coloridas somente nesses dois locais; demais páginas permanecem como estavam. Sempre shadcn.

- Visão geral: evitar duplicar valores em uma faixa superior. Integrar recebimentos/pagamentos ao gráfico, saldo e contas incluídas à disponibilidade, e a pagar/a receber aos compromissos. Os quatro valores abrem listas em modal no período selecionado; não levam diretamente a contas/extratos.

## Grid integrado aprovado — 09/10/2026

Esta organização substitui a divisão anterior de três painéis na primeira linha: recebimentos/pagamentos ocupam 75% e contas/disponibilidade 25%. Na segunda, compromissos e calendário aberto por padrão compartilham um único Card shadcn com 80% da largura; despesas por categoria ficam nos 20% restantes, com rosca e legenda empilhadas. Dentro do painel maior, os próximos compromissos aparecem primeiro, ao lado do mês. No celular, a agenda integrada empilha a lista antes do calendário. Expansão, detalhes, liquidação e modais dos valores permanecem disponíveis.

- Ajuste aprovado nos comentários de 09/10: categorias abaixo da agenda, em largura completa; remover rastreabilidade da visão geral. Calendário aberto com descrição, direção e valor dos compromissos nos dias (agenda textual no celular). Painel de compromissos ocupa toda a segunda linha, com calendário maior; contas acompanha a altura do gráfico na primeira linha. Componentes e contratos de auditoria fora da visão geral permanecem disponíveis.

- Categorias na visão geral: substituir rosca por “Onde estamos gastando”, ranking compacto das cinco maiores despesas positivas, com barra discreta, valor e participação. Total líquido inclui estornos. Uma categoria resulta em uma linha; “Ver todas” abre lista completa e filtro no Dialog shadcn. Clique na categoria mantém detalhamento de lançamentos do período. As participações usam o total positivo completo, inclusive categorias fora das cinco exibidas; estornos ficam identificados no modal, sem barras/percentuais negativos.

- Refinamento aprovado: manter o título “Despesas por categoria”, seguido do total líquido, e pizza compacta à esquerda do ranking no desktop. No celular, pizza e ranking se empilham. Pizza usa as mesmas cinco categorias do ranking e agrupa as restantes em “Outras categorias”; total e participações consideram todo o período. Filtro/lista completa continuam no modal.

- Sidebar: dar personalidade com fundo cinza esverdeado discretamente mais forte e seleção mais contrastante; manter aspecto profissional, grafite e verde suave. Evitar voltar ao quase branco ou acrescentar cores saturadas.

- Correção explícita da sidebar: usuário rejeitou o cinza esverdeado. Usar cinza neutro um pouco mais escuro, sem verde no fundo, hover, seleção ou texto da navegação. Essa preferência substitui a nota anterior sobre verde suave na sidebar.

- 09/10/2026: usuário autorizou estender o novo design neutro da visão geral a TODAS as telas financeiras, inclusive detalhes, formulários, calendários e modais. Substitui a limitação anterior à inicial e as faixas/gradientes decorativos. Fundo cinza claro, cards brancos, sans, layout compacto; verde/vermelho semânticos, marrom discreto. Dropdowns com fundo branco padrão shadcn (incluindo período), seleção neutra. Sidebar permanece cinza neutro, sem verde.
