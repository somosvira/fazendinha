# Proposta de organização operacional

**Proposta aprovada e implementada.** O comportamento vigente fica nos contratos de Leite, Qualidade e Reprodução; este diretório é somente o protótipo estático. Abrir `/mockups/refino-operacional/index.html` com o Vite local.

O protótipo usa os componentes shadcn do projeto. Não lê nem grava dados operacionais. Números reproduzem os exemplos apresentados pelo usuário, sem recalcular taxas, estimar volumes ou representar validação sanitária. Seleção do sítio, busca, navegação, modal de impedimentos, abas do laudo e alternância visual/tabela funcionam somente no protótipo. Paginação, anexos, correções e abertura de cadastro são representações de continuidade; não executam comandos reais.

## Propostas

- Sem sítio: estado neutro com seleção direta entre sítios autorizados; na implementação, reutilizar a lista e o mecanismo do shell. Não tratar o consolidado como erro nem exibir retry sem utilidade.
- Estoque e demais cabeçalhos: altura determinada por título e ação, recuos de 16 px e eliminação de margens cumulativas. Preservar a superfície visual atual.
- Impedimentos: faixa compacta com contagem e ação para modal; nome/brinco, motivo e acesso ao cadastro, sem alterar elegibilidade.
- Laudo: identificação e datas em grade; Resultados, Informar ou corrigir, Arquivos e Histórico separados. Resultados tipados/unidades, situação pendente/anulada, motivos, correção, anexos, versões e permissões devem permanecer funcionais na implementação. Formato preservado não é trocado retroativamente. A modalidade sem resultado mantém datas não informadas.
- Destinos: resumo do dia separado dos históricos; uma área com abas para fornecimentos, retiradas internas e descarte físico, cada qual com seu próprio filtro/paginação e estados. A troca não deve apagar filtros/rascunhos ou alterar os totais. Sem registro não significa zero. O resumo inclui Nutrição, além de destinos diretos.
- Sidebar: `GitBranch` como proposta de ícone dos ciclos reprodutivos, substituindo o bebê humano.
- Indicadores: alternador entre cartões e tabela usando os mesmos períodos, taxas, denominadores e acesso aos animais. Zero conhecido distinto de base insuficiente; sem novo cálculo.

Revisão com Impeccable e frontend-design: refinamento da identidade existente, hierarquia por tarefa, dados tipados e agrupados, avisos complementares em ajuda contextual, compacidade sem eliminar controles ou conteúdo. Mockup não substitui testes e inspeção da implementação real.
