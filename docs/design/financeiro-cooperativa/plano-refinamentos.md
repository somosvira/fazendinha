# Plano de refinamentos do Financeiro — feedbacks de 11/10/2026

Status: implementado e verificado em 11/10/2026. Evidências e limites em [design-qa.md](../../../design-qa.md#refinamentos-dos-13-feedbacks--11102026).
Base: branch `codex/financeiro-cooperativa-contemporanea`, incluindo a implementação local existente.
Referências: os 13 comentários e capturas fornecidos pelo usuário, [design.md](design.md), [iconografia.md](iconografia.md) e [contrato financeiro](../../financeiro-rebuild-contrato.md).

## Objetivo e análise

Manter a direção Cooperativa contemporânea e tornar o Financeiro mais uniforme: leitura contínua dos detalhes, tabelas e filtros compactos, formulários com uma organização previsível e modais com hierarquia clara. Resolver primeiro o impedimento de navegação com trabalho ativo.

As capturas iniciais mostram problemas de composição e contraste percebido, sobretudo em telas largas. Elas não permitem certificar teclado, contraste medido, salvamento de rascunho ou impressão. O plano combinou essa evidência com inspeção do código; os testes de interação e as capturas posteriores estão registrados na validação da implementação.

Constatações no código antes da implementação:

- **Navegação:** `App.tsx/navegarTab` altera a URL com `pushState` sem notificar os consumidores da rota. Operações, detalhe e nova operação compartilham a aba `lancar`; `OperacoesFinanceiras` atualiza o estado do formulário ao receber `popstate`. Esse caminho explica como a URL pode passar para a lista e o formulário continuar aberto. Confirmar com teste de reprodução antes da correção. O mecanismo existente `router.ts/navegarPara` já atualiza a URL e notifica a aplicação.
- **Rascunho:** o formulário agenda o autosave após 800 ms e cancela o temporizador ao desmontar. Portanto, corrigir apenas a troca de tela exige também verificar a última edição feita imediatamente antes da saída.
- **Contas:** `FluxoContasFinanceiras` já apresenta o fluxo consolidado, dentro da seção recolhida “Mostrar receitas e despesas” do extrato geral. Torná-lo visível aproveita dados e cálculos existentes.
- **Gráficos:** a saída financeira usa atualmente a cor do texto principal (`--fin-saida: var(--foreground)`). Isso reduz a distinção semântica das séries. Os componentes de gráfico são compartilhados com outras áreas, então o ajuste precisa respeitar o escopo financeiro.
- **Relatórios:** o histórico já carrega na entrada e no retorno da criação. O botão “Atualizar” pode sair do uso habitual, preservando recuperação de erro e atualização necessária de relatórios em processamento.
- **Documento:** o gerador persistido `server/src/services/financeiro/relatorios.pdf.ts` já desenha em escala de cinza. A prévia `.rg-doc` herda cores do tema. O principal ajuste está na prévia e no caminho de impressão/exportação pelo navegador, com verificação do PDF efetivamente baixado.

## Cobertura dos 13 comentários

| Comentário | Mudança proposta | Critério de aceite |
| --- | --- | --- |
| 1 — Detalhe da operação | Uma superfície contínua de resumo, com seções internas | Identificação, valor, itens e consequências são lidos como uma única operação; todos os vínculos e ações continuam disponíveis |
| 2 — Cores do gráfico | Paleta própria das séries, com distinção por traço e legenda | Receitas e despesas identificáveis em linhas e barras, inclusive sem depender apenas da cor |
| 3 — Retorno à lista | Sincronizar rota e tela, preservando rascunho e última edição | Clicar em Operações abre a lista; continuar trabalho recupera os dados; voltar/avançar funciona |
| 4 — Tabelas | Contrato único de espaçamento, colunas, alinhamento e paginação | Mesma aparência e alinhamento em todas as tabelas do módulo, sem colunas estreitas distribuídas como vazios excessivos |
| 5 — Espaços nos filtros | Larguras reais dos controles e agrupamento compacto | Filtros ficam próximos e aproveitam a largura sem lacunas entre cada seletor |
| 6 — Busca junto aos filtros | Busca e filtros na mesma barra no desktop | Produtos e parceiros seguem o mesmo padrão, com quebra responsiva e todos os filtros preservados |
| 7 — Modais e folhas laterais | Cabeçalho sálvia, ícones canônicos, títulos e rodapés contrastantes | Hierarquia perceptível entre cabeçalho, campos e ação; foco, fechamento e rolagem preservados |
| 8 — Atualizar histórico | Remover a ação do cabeçalho e manter atualização contextual | Histórico atualizado na entrada/retorno; falhas oferecem tentar novamente; processamento não fica permanentemente desatualizado |
| 9 — Páginas nova/novo | Formulário à esquerda, resumo à direita, título dentro do formulário | Operação e relatório seguem a mesma estrutura, ocupando a área disponível, sem faixa de botões no topo |
| 10 — Pagamento | Aplicar o padrão ao detalhe e à liquidação de compromisso | Valor pendente e ação principal claros; pagamento e recebimento têm tratamentos coerentes |
| 11 — Voltar | Breadcrumbs nos detalhes, com navegação contextual | Retorno correto à origem, preservando período e parâmetros relevantes |
| 12 — Balanço geral | Promover o gráfico consolidado existente e apresentar saldo atual com escopo explícito | Gráfico acessível sem expandir uma seção; período e filtros correspondem aos dados exibidos |
| 13 — Documento | Prévia, impressão e PDF em preto, branco e cinza | Nenhuma informação depende de verde/vermelho; fundo branco, valores e totais legíveis em impressão monocromática |

## Decisões visuais comuns

### Tabelas e barras de filtros

Reutilizar `TabelaFinanceira`, `Paginacao`, `ListaCadastroFinanceiro` e as primitivas atuais. Ajustar a base antes das telas individuais.

- Mesmo recuo horizontal para busca, cabeçalho, linhas e rodapé. Ponto inicial: 16 px na barra de filtros e 12–16 px nas células, seguindo a mesma linha de alinhamento.
- Espaçamento vertical de 10–12 px nas células, com altura suficiente para leitura e controles. A densidade será ajustada por conteúdo; não reduzir fonte ou alvo de toque para ganhar espaço.
- Texto à esquerda; valores monetários e quantidades numéricas à direita, com algarismos tabulares; datas, status e ações em colunas de largura controlada. Cabeçalho e conteúdo devem compartilhar o alinhamento.
- Uma coluna de conteúdo recebe a largura restante; datas, valores e ações não se expandem indiscriminadamente. Em Contas, a descrição da última movimentação recebe essa largura, enquanto o nome permanece o título do cartão móvel. Quebra de descrições longas sem truncar dados importantes nem criar rolagem na página inteira.
- Contagem e paginação no rodapé como regra. Se tabelas longas precisarem de controle superior, repetir o mesmo controle compacto, sem uma faixa vazia exclusiva.
- Barra única para busca e filtros: busca flexível; seletores com largura suficiente para o texto e limites claros; intervalos de 8–12 px. Evitar controles estreitos dentro de grandes colunas de grid.
- Em telas menores, permitir quebra organizada da barra e manter o comportamento móvel de tabelas/cartões existente. Não esconder colunas ou filtros para diminuir espaços.

Aplicar em operações, compromissos, contas, extratos geral e individual, configurações, histórico de relatórios e demais tabelas financeiras embutidas. Calendário conserva sua organização própria. As tabelas do documento impresso seguem a mesma lógica de alinhamento, com medidas específicas para papel.

### Formulários de página inteira

Aplicar primeiro a `/financeiro/operacoes/nova` e `/financeiro/relatorios/novo`.

- Grid desktop com formulário flexível à esquerda e resumo de aproximadamente 320–360 px à direita, intervalo de 20–24 px.
- Usar a largura disponível após a sidebar e os recuos comuns; não usar `100vw` nem manter uma limitação que deixe uma grande área ociosa nessas páginas.
- Título, descrição e estado de salvamento dentro do início do formulário esquerdo. Nenhuma faixa de ações acima dele.
- Confirmação/geração no resumo direito; limpar rascunho e navegação secundária no rodapé do formulário. Preservar confirmação de descarte e permissões existentes.
- Resumo acompanha a revisão da operação/relatório. Pode ficar fixo durante rolagem somente se couber na altura da janela e não ocultar ações.
- No celular, ordem de leitura: título e formulário, resumo e ação principal. Não comprimir duas colunas nem duplicar a ação principal sem necessidade.

Esse contrato vale para novas páginas de criação completas. Modais de cadastros continuam modais/folhas laterais com organização adequada à sua dimensão.

### Operação como resumo contínuo

Após o breadcrumb, usar uma superfície branca principal: cabeçalho com código, descrição, situação, parceiro, data e valor; abaixo, faixas internas para itens, consequências financeiras e físicas, documentos, procedimentos e auditoria presentes na operação.

Separar seções por divisórias e títulos, mantendo os ícones da referência. Retirar fundos e sombras independentes que façam os vínculos parecer operações separadas. Contagens e situações ficam junto de seus títulos. Estados vazios usam mensagens breves dentro da seção correspondente.

Preservar correção, cancelamento, estorno, navegação entre vínculos e histórico. A operação confirmada continua imutável: a composição visual não altera essa regra.

### Gráficos e identidade

Definir tokens específicos para séries financeiras. Proposta inicial: entradas em verde `#2D664D`, saídas em ocre discreto `#806343`; eixos e grade em cinzas suaves. Medir contraste antes de consolidar esses valores no guia.

Receitas usam linha contínua; despesas, tracejada. Legenda, tooltip e barras usam as mesmas cores e nomes. A grade deve ficar atrás dos dados na hierarquia. Não usar o vermelho de cancelamento/erro como cor genérica de toda despesa nem modificar gráficos de outros módulos por cascata global.

Na página Contas, deixar visível o fluxo consolidado junto do saldo geral, antes dos detalhes extensos do extrato. O período e os filtros que afetam o gráfico devem ficar claramente próximos e ser compartilhados com o extrato correspondente. Filtros exclusivos da lista de cadastros não podem mudar silenciosamente o escopo do fluxo.

Nomear corretamente: **saldo atual** é posição de conta; **entradas e saídas do período** são fluxo. Não apresentar a diferença entre entradas e saídas como saldo histórico. Uma curva de saldo histórico só pode ser usada se houver base de abertura e movimentações completas para reconstruí-la. Nesta entrega, priorizar a composição dos componentes e cálculos já existentes.

Conservar o tratamento de transferências próprias no consolidado e de estornos na data efetiva, além dos critérios das contas incluídas no saldo geral. Qualquer diferença de escopo entre saldo e fluxo deve estar explícita.

### Modais, folhas laterais e breadcrumbs

Aplicar em cadastros, compromisso, pagamento/recebimento, transferência, confirmações e demais superfícies financeiras.

Cabeçalho com sálvia suave, título floresta e ícone canônico; corpo branco com seções legíveis; rodapé separado por borda e ação primária evidente. Reforçar o overlay somente na medida necessária para distinguir o plano ativo. Não aplicar verde escuro à superfície inteira nem usar cor para diferenciar informações sem texto.

No compromisso, destacar descrição, saldo pendente e vencimento antes dos metadados. Na liquidação, manter conta, valor, data e consequências visíveis. Pagamento parcial, recebimento, validação, anexos e bloqueio durante envio continuam funcionando.

Breadcrumbs pequenos substituem os botões soltos de voltar em operações, contas e relatórios: `Financeiro / Contas / Nome da conta`, por exemplo. Último item identifica a página atual. Preservar retorno contextual válido de Estoque/Sanidade, sem forçar todos os caminhos à mesma origem. Links mantêm parâmetros do período e usam o mecanismo de navegação existente. Garantir leitura acessível e retorno de foco.

### Documento monocromático

Isolar o tema do documento do tema de navegação: papel branco, texto preto, cinza legível em metadados, bordas e negrito para totais. Retirar fundos coloridos, marcadores verde/vermelho e dependência de tokens agro da `.rg-doc`.

Positivos, negativos, realizado e previsto permanecem distinguíveis por rótulos, sinal e organização. Conferir prévia, impressão do navegador e PDF baixado com o mesmo snapshot. O PDF do servidor já usa escala de cinza; modificar esse gerador somente se a verificação revelar uma lacuna necessária, preservando a emissão auditável e os arquivos históricos.

## Ordem de execução

1. **Correção funcional prioritária — comentário 3.** Reproduzir o problema em teste; unificar a notificação de navegação pelo mecanismo existente; garantir a última edição do rascunho ao sair. Verificar sidebar, atalho de trabalho ativo, voltar/avançar e links diretos. Nenhuma reescrita de roteador.
2. **Contrato compartilhado — comentários 2, 4, 5, 6, 7 e 11.** Fixar tokens de séries, tabela, filtros, cabeçalhos de modal e breadcrumbs. Validar uma tabela, uma barra de filtros, um modal e uma folha lateral antes da aplicação em massa.
3. **Páginas e fluxos — comentários 1, 8, 9, 10 e 12.** Reorganizar o resumo da operação; alinhar operação/relatório novos; promover gráfico geral; aplicar tratamento de compromisso/liquidação; remover o refresh habitual. Migrar todas as tabelas/filtros ao contrato definido.
4. **Documento e conferência — comentário 13 e revisão dos demais.** Alinhar prévia/impressão/PDF; verificar todos os 13 pontos nas telas reais, além dos estados funcionais afetados. Atualizar os guias para descrever o que foi efetivamente entregue.

## Divisão entre agentes: assertividade e uso de tokens

Seguir a preferência anterior por delegação com custo-benefício. Modelos são sugestões de execução; não há estimativa de preço ou economia percentual. Máximo de quatro agentes ativos incluindo o coordenador.

| Responsável | Modelo/esforço sugerido | Arquivos e responsabilidade | Justificativa |
| --- | --- | --- | --- |
| Coordenador — fundação e integração | `gpt-6.1-sol`, médio; alto apenas para decisão difícil | `financeiro-theme.css`, `financeiro-ui.tsx`, `DialogFinanceiro.tsx`, `ListaCadastroFinanceiro.tsx`, contrato de breadcrumbs, tokens e documentação | Mudanças compartilhadas precisam de uma única decisão para evitar divergência e retrabalho |
| Agente A — navegação e operações | `gpt-6.1-sol`, médio | `App.tsx`, `router.ts` se necessário, `OperacoesFinanceiras.tsx`, `FormOperacao.tsx`, `OperacaoFinanceiraDetalhe.tsx`, testes de navegação/rascunho | Estado de rota, debounce, correção e auditoria exigem maior cuidado que uma mudança mecânica |
| Agente B — contas e compromissos | `gpt-6.1-sol`, médio | `ContasFinanceiras.tsx`, `ExtratoGeral.tsx`, `FluxoContasFinanceiras.tsx`, `CompromissosFinanceiros.tsx`, `CompromissoDetalheDialog.tsx`, `LiquidarCompromissoModal.tsx`, gráficos compartilhados sob contrato financeiro | Escopo dos dados, estornos, transferências e foco entre modais justificam revisão mais cuidadosa |
| Agente C — cadastros e padronização mecânica | `gpt-6-luna`, médio | `ConfiguracoesFinanceiras.tsx`, formulários de cadastro e aplicação do padrão às tabelas de sua área | Após exemplos e contratos prontos, é trabalho localizado e repetitivo; escalar dúvidas ao coordenador |
| Agente D — relatórios e impressão | `gpt-6.1-sol`, médio, em segunda onda | `RelatoriosFinanceiros.tsx`, `NovoRelatorioFinanceiro.tsx`, `RelatorioFinanceiroDetalhe.tsx`, estilos e exportação do documento; gerador do servidor somente se necessário | Rascunho, emissão assíncrona, prévia e PDF têm contratos diferentes que precisam permanecer coerentes |

**Ondas:** primeiro coordenador + A, para resolver navegação e definir a base. Depois coordenador + A/B/C para aplicação em arquivos exclusivos. Quando A ou C terminar, abrir a vaga para D. O coordenador integra e revisa com foco nos pontos de maior risco.

Cada arquivo tem um responsável por vez. Agentes de páginas não editam os arquivos compartilhados do coordenador; pedem um ajuste de contrato. `components/charts.tsx` fica com B, sob definição de tokens do coordenador. Estilos compartilhados de documento ficam com D e devem ser isolados em `.rg-doc`/impressão.

Para reduzir tokens: fornecer a cada agente os comentários de sua área, os arquivos pertinentes e os contratos comuns; não encaminhar as 29 imagens para todos. Usar uma tela aprovada como exemplo para tarefas mecânicas. Retornos contêm alterações, verificação e pendências concretas. Evitar relatórios repetidos, vários agentes auditando a mesma tela e suítes completas a cada edição.

## Verificação e conclusão

### Comportamento

- Regressão de navegação: preencher nova operação, voltar imediatamente à lista antes dos 800 ms do autosave, retomar e conferir campos e vínculos; repetir com gravação pendente e falha simulada. Falha não pode apagar dados silenciosamente nem criar um bloqueio permanente de navegação.
- Testar lista versus atalho de trabalho ativo, voltar/avançar, rota direta e correção baseada em operação. Conferir também a navegação do rascunho de relatório.
- Preservar busca, todos os filtros, contagens, paginação e abertura por teclado após a mudança das barras/tabelas.
- Conferir relatórios na entrada, após geração e após falha. Se houver processamento assíncrono, atualizar apenas enquanto necessário; não introduzir polling contínuo de todos os registros.
- Verificar que o gráfico promovido corresponde ao período e extrato, com transferências próprias e estornos tratados como no contrato atual. Usar testes existentes e acrescentar casos apenas para comportamento novo ou riscos identificados.
- Manter permissões de leitura/escrita, confirmação de descarte, foco nos diálogos e bloqueio durante envio financeiro.

### Visual e impressão

- Conferir 1876×877, a dimensão dos comentários, além de 1440, 1180/1024, 768/720 e 375 px. Incluir conteúdo longo, poucos registros, vazio, carregando e erro. Sem rolagem horizontal no documento da página; rolagem de tabela permanece localizada quando necessária.
- Comparar busca, cabeçalhos, dinheiro, ações e rodapés entre todas as páginas com tabela. Verificar que grandes telas não recriam vazios entre controles estreitos.
- Conferir teclado, foco visível, zoom de 200%, legibilidade de labels e alvos de toque. Medir contraste de texto e elementos essenciais; as capturas atuais não certificam acessibilidade.
- Inspecionar ícones contra o inventário canônico. Não alterar geometria ou trocar por aproximações durante esses refinamentos.
- Gerar/inspecionar documento de teste com várias páginas, valores negativos, previsto e realizado. Comparar valores da prévia com o snapshot/PDF, verificar quebra de páginas e legibilidade em escala de cinza. Usar fixtures ou ambiente descartável, sem gerar lançamentos para capturar telas nem alterar a massa local.
- Executar testes proporcionais às áreas alteradas e build do client na integração; testes do server se houver alteração no gerador. Não criar testes que apenas espelhem classes CSS.

Concluir somente quando os 13 comentários tiverem evidência de atendimento, o erro de navegação estiver coberto por regressão e o resultado visual estiver conferido. Registrar em `design-qa.md` o que foi testado, os limites e eventuais pendências. Atualizar `design.md`, o contrato visual vigente e documentação de comportamento na mesma mudança da implementação.

## Limites da mudança

Preservar DM Sans, sálvia, floresta, marca Terrano e iconografia canônica. Reutilizar componentes, bibliotecas e contratos existentes. Não reexecutar seed, limpar banco, modificar cálculo contábil ou reintroduzir módulos legados. Preservar alterações locais e arquivos de outras tarefas.

Este plano acrescenta, por solicitação expressa do usuário, a revisão da apresentação monocromática do documento e a exposição do gráfico geral. Esses pontos atualizam o escopo visual anterior, que excluía revisão de PDF. As decisões foram incorporadas ao design.md e ao contrato visual vigente após implementação e verificação; os registros da entrega anterior permanecem como histórico.

## Resultado da execução

O coordenador integrou a fundação comum; agentes com arquivos separados trataram operações/navegação, contas/compromissos, cadastros e relatórios. Cadastros usou o modelo de menor custo previsto; áreas de rascunho, escopo financeiro e documento seguiram a divisão de maior cuidado. Não houve alteração do gerador do servidor, schema ou cálculos financeiros. A divisão registra a escolha dos modelos, sem estimar gasto real de tokens não medido.

A suíte completa passou com 128 arquivos e 1.007 testes. Os testes focados posteriores cobriram as últimas integrações de formulários, filtros e navegação; TypeScript e build final passaram. As capturas incluem 1876×877 e larguras 375/768/1024/1440, retomada dos dois rascunhos com escrita simulada, prévia monocromática, mídia de impressão e PDF baixado. Consulte o relatório de QA para a cobertura específica e suas limitações.
