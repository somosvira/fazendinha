# Plano de implementação — Financeiro Cooperativa contemporânea

Os 13 feedbacks posteriores à entrega foram implementados em 11/10/2026 conforme o [plano de refinamentos](plano-refinamentos.md). Os ajustes de navegação, composição, tabelas, filtros, modais, gráficos e apresentação monocromática dos documentos estão incorporados ao guia vigente. A validação desta rodada está em [design-qa.md](../../../design-qa.md#refinamentos-dos-13-feedbacks--11102026).

Data: 10/10/2026. Base: `codex/financeiro-dashboard-grid`. Status: etapas 1–7 concluídas no escopo da implementação visual em 11/10/2026 na branch `codex/financeiro-cooperativa-contemporanea`. Evidências e limites em [design-qa.md](../../../design-qa.md).

## Objetivo e fonte de decisão

Aplicar a direção do mockup 03 a todo o Financeiro, usando o [design.md](design.md) como especificação e os 29 mockups como referência visual. Preservar componentes, campos, ações, dados, estados e contratos existentes. Os arquivos de imagem representam páginas e exemplos de estados; não são 29 páginas independentes nem uma lista completa dos campos condicionais.

Implementar primeiro a fundação compartilhada, depois a visão geral e os fluxos, validando cada etapa antes de seguir. A execução foi autorizada em 11/10/2026, na nova branch. Esta mudança permanece local, sem publicação ou deploy incidental.

## Limites e decisões já definidas

- Reutilizar Tailwind, Radix, Recharts e as primitivas locais. Nenhuma biblioteca nova, reconstrução de navegação ou conjunto paralelo de componentes.
- DM Sans em títulos e corpo; fundo sálvia, superfícies brancas, ações floresta, vermelho reservado a erro/atraso/efeitos destrutivos. Aplicar os tokens do guia, não cores aproximadas copiadas de cada PNG.
- Manter layout móvel, abas e agenda textual existentes. As proporções desktop não devem comprimir a interface no celular.
- Aplicar a proposta da sidebar no contexto do Financeiro, incluindo navegação móvel, recolhimento e trabalhos ativos. Conferir que o tema e seus portais são restaurados ao sair do módulo; a mudança não redefine as demais áreas.
- Preservar a marca. Os ícones devem corresponder visualmente aos da preview, conforme o contrato de iconografia abaixo; reutilizar os existentes apenas quando correspondam à referência. A silhueta rural é decorativa opcional, de prioridade posterior; não deve atrasar a entrega ou exigir um novo componente funcional.
- Nenhuma alteração prevista em API, schema, Decimal, regras contábeis, cálculos de gráficos, autorização, persistência ou geração do PDF. Alterar filtros de emissão ou apresentação do PDF é outro escopo.
- Não reintroduzir módulos removidos, reativar o assistente, reexecutar seed, limpar banco ou confirmar ações financeiras para obter screenshots.

## Preparação

### Contrato obrigatório de iconografia

A preview é a galeria entregue com 29 PNGs. O mockup 01, derivado do modelo 03 escolhido, é a referência principal para ícones repetidos da sidebar e do dashboard. As demais telas definem os ícones específicos de seus controles. Quando um mesmo controle tiver pequenas variações entre imagens geradas, prevalece o 01 para elementos globais; para controles específicos, registrar uma única referência canônica no inventário antes de distribuir o trabalho. Nenhum agente escolhe um ícone aproximado por conta própria.

Antes de implementar telas, o agente responsável pela fundação deve criar `iconografia.md` nesta pasta, com uma linha por papel visual: tela/controle, PNG de origem, recorte de referência, ícone/SVG escolhido, tamanho, espessura, cor, preenchimento, fundo, alinhamento e espaçamento. O inventário deve cobrir sidebar, cabeçalhos de painéis, indicadores, ações, filtros, documentos, tabelas, calendários e fechamentos. Inspecionar os ícones existentes de Lucide e os SVGs do projeto, sem substituir a marca Terrano.

Usar o SVG existente quando a geometria corresponder à preview. Um nome semelhante em Lucide não prova equivalência: conferir orientação das setas, formas internas, quantidade de traços, terminais e preenchimento. Se não houver correspondência, reproduzir o desenho como SVG estático no mecanismo de ícones já adotado pelo projeto, sem adicionar biblioteca ou componente funcional. Não trocar ícone por emoji, caractere de fonte ou imagem rasterizada do botão inteiro. Reutilizar o mesmo desenho e as mesmas medidas em todas as ocorrências equivalentes.

Definir também o tratamento: círculos/fundos suaves de cabeçalhos são parte da referência e não autorização para criar cards ou ações. Manter nomes acessíveis dos controles; SVG decorativo usa `aria-hidden`. Ícone de ação sem texto conserva o nome acessível e o alvo de toque.

Critério de aceite: comparar recortes da tela implementada e da preview na mesma escala, lado a lado e com sobreposição quando útil. Aprovar somente desenho, orientação, tamanho, espessura, cor, fundo e alinhamento correspondentes. Conferir manualmente cada papel e automaticamente a consistência de reutilização, quando pertinente; nenhuma substituição fica pendente no fechamento. Variações de antialiasing entre o PNG gerado e o navegador não são desenhos diferentes.

Os PNGs gerados não contêm os vetores originais. Por isso, a identidade visual será um requisito verificável da implementação, não uma alegação antecipada de igualdade pixel a pixel. O inventário só será marcado como conferido depois da comparação real. Papéis não representados em nenhuma preview devem reutilizar o sistema existente e ser identificados explicitamente como extensão, sem alegar referência inexistente.

Antes da implementação, verificar a branch, alterações locais e instruções do repositório; preservar os artefatos e o trabalho de outras tarefas. Reconfirmar README, ARCHITECTURE e contrato financeiro. O índice `docs/README.md` indicado nas instruções não existe nesta branch; usar diretamente os contratos, código e testes disponíveis, sem assumir funcionalidades a partir de documentos históricos.

Capturar a interface atual nas larguras 375, 768, 1024 e 1440/1600 px, com referências suficientes para antes/depois. Usar dados demonstrativos existentes e ações somente de leitura; se um fluxo exigir escrita para validação, usar teste com fixture ou banco descartável, sem alterar a massa local de referência.

Conferir os controles reais de cada tela antes de editar. Diferenças de rasterização, ícones, cores semânticas ou campos omitidos em uma imagem devem ser resolvidas mantendo a interface funcional e as regras do design.md.

## Etapas e critérios de conclusão

### 1. Fundação visual e isolamento

Arquivos principais: `client/src/financeiro/financeiro-theme.css`, `cores-financeiro.css`, `dashboard-grid.css`, `FinanceiroContent.tsx`, `financeiro-ui.tsx`, `SecaoFinanceira.tsx`, `CamposCadastro.tsx` e `CarregamentoFinanceiro.tsx`.

Mapear os tokens atuais para o guia: canvas, superfície, texto, primária, entrada, saída, pendência, alerta, foco e borda essencial de campo. Separar raio de painel (16 px), controle (8 px) e badge; evitar usar um único `--radius` para todas as superfícies. Centralizar tipografia, dinheiro tabular, espaçamento e alturas de controles. Remover/substituir os hexadecimais e raios antigos de `dashboard-grid.css` que hoje prevalecem sobre o tema.

Manter o mecanismo atual de escopo `:root:has(.financeiro-content)` quando suficiente, incluindo portais Radix. Alterar os componentes compartilhados somente quando uma classe ou variante existente não resolver o requisito; não aplicar overrides globais indiscriminados às primitivas.

Concluída quando painel, tabela, botão, badge, campo, seletor, Skeleton e aviso seguem a paleta, com foco legível e sem vazamento visual ao navegar para Estoque/Pecuária e voltar. Verificar campos normais, inválidos, desabilitados e menus abertos.

### 2. Sidebar e visão geral como referência implementada

Arquivos: `client/src/components/AppSidebar.tsx`, `sidebar-clara.css` e regras pertinentes de `client/src/styles/base.css`; `VisaoGeralFinanceira.tsx`, `DashboardResumo.tsx`, `DashboardCompromissos.tsx`, `DashboardCalendario.tsx`, `RankingCategorias.tsx` e `dashboard-grid.css`. Mockups 01 e 27.

Preservar destinos, seletor de sítio, atalhos de rascunhos, busca, usuário, recolhimento e drawer móvel. Aplicar cores e dimensões no contexto financeiro.

Na visão geral desktop, substituir a disposição atual gráfico/contas pela composição do modelo 03: contas à esquerda, cerca de 25%; gráfico à direita, cerca de 75%. No painel de compromissos, calendário à esquerda, cerca de 65%; lista prioritária à direita, cerca de 35%. Categorias seguem abaixo em largura completa. Tratar proporções como referência, ajustando-as à legibilidade, sem reduzir dados ou controles. Manter ordem de foco coerente com a composição; conservar as abas móveis e seus conteúdos.

Manter totais, período, Linhas/Barras, calendário completo, detalhamento dos indicadores, vencidos/próximos sete dias, links de contas, pizza/ranking, filtros e lançamentos por categoria. Não criar uma faixa nova de KPIs ou recuperar rastreabilidade removida da visão geral.

Concluída quando a visão geral implementada reproduz a hierarquia do modelo 03 nas larguras alvo e todas as interações existentes permanecem disponíveis. Ela passa a ser a referência real de estilo para as demais etapas.

### 3. Operações e revisão de efeitos

Arquivos: `OperacoesFinanceiras.tsx`, `FormOperacao.tsx`, `OperacaoFinanceiraDetalhe.tsx`, `NotaFiscalAnexo.tsx`, `ProcedimentosAtendimento.tsx`, `VinculosPecuaria.tsx` e componentes atuais de revisão/cancelamento. Mockups 02–04, 28 e 29.

Aplicar tabelas, filtros, formulário por grupos, revisão lateral e hierarquia do detalhe. Preservar documentos e seu número opcional, itens, classificação, categorias, rateio por centro, condições financeiras e avisos. Estilizar também os campos condicionais dos tipos disponíveis, mesmo sem PNG específico. Detalhes com histórico, perdas, transferências ou múltiplos registros devem conservar seu conteúdo e rolagem.

Estilizar a folha existente `client/src/pecuaria/rebanho/sanidade/GerenciarProcedimentosServico.tsx` quando aberta pelo Financeiro, sem alterar regras de origem, estoque ou custo individual e sem afetar seu contexto externo. Tratar cancelar/estornar como ações destrutivas; manter motivo, revisão e confirmação. Manter estados de rascunho e falha de salvamento reais.

Concluída quando compra, serviço, venda, consumo direto e os demais tipos expostos conservam campos/validação, rascunhos, anexos e acesso à origem. Confirmar cancelamento/estorno apenas em testes isolados, sem gravações na massa local.

### 4. Compromissos e liquidação

Arquivos: `CompromissosFinanceiros.tsx`, `ControleVisaoCompromissos.tsx`, `CalendarioCompromissos.tsx`, `CompromissoDetalheDialog.tsx`, `LiquidarCompromissoModal.tsx`, `HistoricoLiquidacoes.tsx`, `NotaFiscalAnexo.tsx` e `DialogFinanceiro.tsx`. Mockups 05–10.

Unificar listagem, calendário e os quatro filtros; distinguir vencido de status. Preservar saldo original/pendente, paginação, busca e ações conforme permissão. Manter diferenças entre pagamento e recebimento, nota opcional do pagamento, revisão dos efeitos, rolagem e rodapé. Aplicar o tema ao histórico e aos diálogos encadeados, incluindo retorno do foco.

Concluída quando alternâncias, seleção de dia, detalhe, abertura/fechamento de liquidação, vencidos, parcial e liquidado funcionam com rótulos e valores íntegros. Testes existentes confirmam os contratos de anexo e liquidação.

### 5. Contas, extratos e transferências

Arquivos: `ContasFinanceiras.tsx`, `ExtratoGeral.tsx`, `FluxoContasFinanceiras.tsx` e diálogo de transferência existente. Mockups 11–13.

Preservar Contas e Extrato geral como seções distintas na mesma página, incluindo destino `#extrato-geral`. Aplicar composição ao gráfico, dados bancários, saldo, filtros e tabelas. Manter movimentos de entrada/saída, estornos, links de origem e paginação. Transferência mantém duas contas e revisão de impacto, inclusive o tratamento das contas incluídas/excluídas do saldo geral.

Concluída quando as duas seções, detalhe por ID, navegação com período, alternância de gráfico e revisão da transferência funcionam sem perda de colunas ou truncamento de dinheiro.

### 6. Cadastros e relatórios

Cadastros: `ConfiguracoesFinanceiras.tsx`, `ListaCadastroFinanceiro.tsx`, `PainelCadastro.tsx`, `FormConta.tsx`, `FormParceiro.tsx`, `FormProduto.tsx`, `FormCadastrosGerenciais.tsx` e `CamposCadastro.tsx`. Mockups 14–23.

Aplicar o mesmo padrão às cinco abas e aos formulários de criação/edição. Preservar filtros específicos, vínculos, situação, paginação, reativação e aviso de descarte. Contas/parceiros/produtos continuam em Sheet; categorias/centros em Dialog. Campos bancários, endereço recolhível, papéis e propriedades condicionais do produto permanecem disponíveis. Não criar novas rotas para cada aba.

Relatórios: `RelatoriosFinanceiros.tsx`, `NovoRelatorioFinanceiro.tsx`, `RelatorioFinanceiroDetalhe.tsx` e composições atuais de resumo/prévia. Mockups 24–26.

Aplicar a direção ao histórico, emissão, filtros avançados, revisão e detalhe. Preservar autor, propriedade, recorte, estados de geração, snapshot, PDF e avisos de truncamento existentes. O PDF gerado não recebe redesign incidental.

Concluída quando abas, query strings existentes, criação/edição e descarte mantêm comportamento; relatórios conservam filtros, rascunho, leitura e download. Testar controles dinâmicos e dados longos, sem depender apenas dos exemplos dos PNGs.

### 7. Conferência final e documentação

Revisar os 29 casos da galeria e complementar a amostragem com edição, estorno, histórico, vazio, erro, carregamento, permissão restrita e campos condicionais. Comparar cada tela real ao mockup correspondente. Verificar 375/768/1024/1440 px, zoom 200%, teclado, foco em cadeias de diálogos, movimento reduzido, contrastes de controles e séries dos gráficos. Não aceitar conteúdo escondido ou sobreposto pelo menu móvel.

Rodar `pnpm --filter rionovo-client run test` e `pnpm --filter rionovo-client run build` ao concluir. Durante as etapas, rodar os testes existentes dos arquivos afetados; repetir a suíte ampla somente se novas alterações ou falhas justificarem. Não criar testes que apenas afirmem classes CSS. Acrescentar testes de comportamento somente se uma mudança de composição tocar navegação, foco, controle condicional ou visibilidade de ação.

Não habilitar flags de integração com escrita nem usar banco local como descartável. Se houver necessidade de integração, preparar um banco realmente descartável. Não ampliar a tarefa para corrigir divergências históricas de backend.

Atualizar o design.md com decisões finais, registrar no contrato visual `docs/financeiro-dashboard-grid.md` a implementação vigente e retirar deste plano os trechos temporários já incorporados. Separar testes automatizados, inspeção visual e homologação manual: não declarar etapas não executadas como aprovadas.

Concluída quando build e testes proporcionais passam, a revisão visual não aponta perda de controles/dados, o tema não vaza para outros módulos e a documentação descreve o resultado implementado.

## Sequência de entregas e revisão

### Distribuição entre agentes: assertividade e gasto de tokens

A execução segue esta distribuição. Usar no máximo o coordenador e três agentes executores simultâneos. Modelos indicados refletem a complexidade do trabalho, sem pressupor preços ou prometer economia numérica. Evitar modelos de maior custo para tarefas mecânicas e evitar modelo econômico quando a economia elevar o risco de regressão.

| Agente | Modelo / esforço sugerido | Responsabilidade exclusiva | Motivo da escolha |
| --- | --- | --- | --- |
| Coordenador e fundação | `gpt-6.1-sol`, alto na fundação; médio na integração | Etapas 1–2; tokens, primitivas, sidebar, dashboard, inventário de ícones, contratos comuns e integração | CSS em cascata, portais e composição global exigem análise; uma decisão correta reduz retrabalho de todos |
| Operações | `gpt-6.1-sol`, médio | Etapa 3; operações, formulário, detalhes, cancelamento/estorno e procedimentos do serviço | Muitos campos condicionais e efeitos financeiros; assertividade compensa o custo |
| Compromissos e contas | `gpt-6.1-sol`, médio | Etapas 4–5; calendário, liquidação, histórico, contas, extratos e transferência | Foco encadeado, anexos e valores demandam atenção a contratos existentes |
| Cadastros e relatórios | `gpt-6-luna`, médio | Etapa 6; aplicar padrões já estabilizados nas cinco abas, formulários e relatórios | Trabalho majoritariamente repetitivo após a fundação; escalar uma dúvida complexa ao coordenador sem refazer o lote |
| Revisor final | `gpt-6.1-sol`, médio | Etapa 7; revisão independente dos diffs, iconografia, acessibilidade e regressões | Revisão direcionada ao resultado final evita auditorias completas repetidas |

O revisor final entra após os executores concluírem e cabe no mesmo limite de concorrência. O coordenador continua responsável pela integração e pelos comandos finais. A escolha de modelo do executor econômico não autoriza simplificar comportamento: se surgir mudança de lógica, concorrência, permissões ou estado financeiro, ele interrompe essa parte e envia a questão ao coordenador.

**Ondas de execução:**

1. Fundação sequencial: coordenador implementa e estabiliza tema, sidebar, visão geral e iconografia. Nenhum executor modifica telas antes de esse contrato estar disponível.
2. Execução paralela: três executores recebem áreas independentes e aplicam o tema estabilizado. Compartilhar somente o guia, inventário, mockups pertinentes, arquivos permitidos e testes relacionados.
3. Integração sequencial: coordenador recebe entregas, resolve ajustes compartilhados e executa build/suíte final. Não permitir alterações concorrentes nos arquivos comuns.
4. Revisão independente: revisor analisa o diff consolidado e evidências visuais; devolve achados concretos. Correções são verificadas nos casos afetados, sem reiniciar toda a exploração.

**Propriedade dos arquivos:** CSS compartilhado, `financeiro-ui.tsx`, `DialogFinanceiro.tsx`, `PainelCadastro.tsx`, primitivas UI, sidebar e inventário ficam com o coordenador. Executores podem sugerir ajustes nesses arquivos, mas não editá-los em paralelo. Operações possui também `GerenciarProcedimentosServico.tsx` no escopo necessário ao Financeiro. Cada executor altera somente os arquivos de suas etapas; relatórios e cadastros não modificam o fluxo financeiro para satisfazer uma imagem.

**Uso eficiente de contexto e tokens:**

- Fornecer um briefing curto por agente com objetivo, limites, arquivos exclusivos, dependências, critérios de aceite e comandos de validação. Evitar encaminhar todo o histórico da conversa.
- Ler arquivos por necessidade, com buscas dirigidas. Não repetir leitura integral de contratos e capturas a cada tela.
- O coordenador publica uma única definição de tokens e ícones; executores a reutilizam. Não pedir novas imagens, novas direções ou novas bibliotecas.
- Enviar um resumo por marco, contendo arquivos alterados, validação, pendências e decisões necessárias. Evitar despejar logs completos ou o código inteiro.
- Rodar testes focados por entrega. Coordenador roda a suíte completa e o build após integração; repetir apenas quando alterações/falhas justificarem.
- Escalar dúvidas concretas com trecho relevante e proposta de resolução; não lançar dois agentes sobre o mesmo problema nem refazer uma etapa inteira por divergência pequena.
- Conferir ícones no inventário e nos recortes correspondentes. Isso reduz julgamento subjetivo e sucessivas rodadas de tentativa visual.

Distribuição orientativa de esforço: fundação/coordenação 30%, operações 25%, compromissos/contas 20%, cadastros/relatórios 15% e revisão 10%. São prioridades de planejamento, não consumo medido nem orçamento rígido. Se for definido um teto total de tokens antes da execução, distribuí-lo nessas proporções e revisar o gasto após a fundação; não alegar previsão exata sem medição.

**Formato obrigatório de entrega dos executores:** escopo concluído; arquivos alterados; comparação com mockups e inventário de ícones; testes/comandos e resultado; limitações reais. O coordenador mantém o progresso neste plano, incorporando decisões finais ao design.md.

| Entrega | Etapas | Resultado revisável |
| --- | --- | --- |
| A | 1–2 | Tema compartilhado, sidebar e visão geral implementada |
| B | 3 | Operações, formulário, detalhe e revisões |
| C | 4–5 | Compromissos, liquidação, contas e extratos |
| D | 6 | Cinco cadastros, formulários e relatórios |
| E | 7 | Comparação final, validação e documentação vigente |

A implementação pode avançar nessa ordem sem pedir nova confirmação a cada ajuste rotineiro, quando autorizada. Mudanças de escopo funcional devem ser explicitadas antes de serem incluídas. Evitar estimativas de prazo sem medir a primeira entrega; usar critérios de conclusão e evidência para acompanhar progresso.

## Principais pontos de atenção

- Cascata CSS: o dashboard ainda fixa cores, tamanhos e raios, além dos tokens compartilhados. Consolidar na etapa 1 para evitar duas direções visuais concorrentes.
- Portais e sidebar: ambos estão fora de parte da árvore do conteúdo. Conferir abertura de menu/modal e saída do módulo para evitar tema indevido.
- Densidade: PNGs possuem quantidades pequenas de registros. Usar paginação e rolagem real para grandes listas, sem cortar conteúdo para imitar uma imagem.
- Tipos e permissões: um mockup de compra ou usuário proprietário não cobre todas as condições. Conferir campos e ações por tipo e perfil usando fixtures e testes existentes.
- Estado financeiro: cor e posição não podem confundir disponibilidade atual, caixa realizado, saldo pendente e valores históricos de relatório.

## Resultado da execução · 11/10/2026

Fundação, sidebar, visão geral e integração executadas pelo coordenador. Os três agentes aplicaram os padrões a operações, compromissos/contas e cadastros/relatórios com a distribuição acima; o revisor independente conferiu diffs e capturas, e os achados foram corrigidos. Os modelos indicados para os executores foram utilizados. Os percentuais de planejamento não são uma medição de tokens ou custo realizado.

Validação: 978 testes em 127 arquivos na suíte completa, 115 testes focados depois das correções e build com TypeScript aprovados. Capturadas as 29 referências de estado, 24 combinações de páginas/larguras e 14 combinações de diálogos/larguras. Verificados menu móvel, Escape, foco da transferência, movimento reduzido e isolamento do tema. Nenhuma ação financeira confirmada no cenário local.

Homologação de leitor de tela, zoom nativo do navegador e todos os perfis/estados no navegador permanecem fora da evidência desta execução. O zoom automatizado usa viewport equivalente a 200%; estados condicionais e permissões foram verificados nos testes existentes. O relatório visual distingue essas lacunas das verificações executadas.
