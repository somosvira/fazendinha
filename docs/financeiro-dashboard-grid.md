# Visão geral financeira em grid

A visão geral responde quanto está disponível e quais compromissos exigem ação. O desenho compacto foi aprovado em 08/out/2026.

- Cinco indicadores: saldo disponível atual, recebimentos e pagamentos realizados, saldo a pagar e a receber por vencimento no período. Os últimos dois também mostram o saldo pendente vencido e a quantidade; incluem todos os pendentes/parciais retornados, não apenas as cinco linhas visíveis.
- Compromissos: abas de vencidos e próximos sete dias (hoje até hoje + 7, sempre dentro do período selecionado), cinco linhas por aba e acesso à lista completa preservando o período. O calendário abre em Dialog e conserva consulta de detalhes e liquidação conforme permissão.
- Contas: as incluídas no saldo geral vêm primeiro; as excluídas podem ser expandidas. Saldo disponível é uma fotografia atual, independente do filtro de período.
- Resultado de caixa: usa `realizado.resultado` calculado no servidor, líquido de estornos. Inclui aportes e retiradas, não equivale a lucro.
- Gráfico: Linhas mostra o acumulado, Barras mostra os valores de cada dia/mês. O subtítulo acompanha a escolha. As séries também se distinguem pelo traçado.
- Despesas por categoria: mantém filtro múltiplo, rosca, total líquido, legenda e tratamento de estornos negativos, em tamanho compacto.
- Rastreabilidade: recolhida por padrão, mantém indicadores, histórico e links com período. O gráfico de volume por tipo foi removido da visão geral; os valores permanecem disponíveis no contrato e na conferência detalhada.

## Componentes e responsividade

A página usa as primitivas locais shadcn (Card, Table, Badge, Tabs, Collapsible, ToggleGroup, Dialog, Button, Input e Select). Popover/Command continuam compondo o filtro de categorias e o seletor de período. O tema Terrano é preservado; não se cria outro sistema visual. A biblioteca Radix unificada atende às novas primitivas; componentes existentes continuam compatíveis com seus pacotes individuais.

O grid divide painéis a partir de 1280px; abaixo disso, empilha. As tabelas e o calendário têm rolagem horizontal contida, sem expandir a página. A rosca compacta usa o tamanho do painel para alternar entre legenda lateral e empilhada. Diminuímos espaços e altura dos gráficos, preservando valores e ações legíveis.

Não há alteração de API, schema, persistência, cálculos contábeis, auditoria ou autorização. Loading, erro, retry e descarte confirmado de rascunho continuam existentes. As imagens aprovadas usam dados ilustrativos; a implementação só apresenta dados da API.
