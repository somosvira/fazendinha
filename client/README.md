# Frontend do Terrano

## Direção: entender rápido, registrar com segurança, aprofundar quando necessário

O Terrano atende o trabalho diário da fazenda e a análise do gestor. A primeira leitura da tela deve responder **onde estou, qual animal ou conjunto estou vendo, o que merece atenção e o que posso fazer**. O usuário não precisa conhecer a organização interna do sistema para trabalhar.

Este README consolida os pedidos de simplificação do projeto e estabelece a direção para as próximas mudanças de organização e hierarquia. As composições aprovadas são incorporadas por fluxo, sem presumir que todas as páginas já foram migradas. As composições propostas precisam de mockup aprovado e validação na interface real, conforme [AGENTS.md](../AGENTS.md).

**Simplificar significa retirar repetição e organizar a informação. Não significa diminuir a fonte, apagar funções ou esconder impedimentos.**

### Como usar esta base

| Fonte | Responsabilidade |
|---|---|
| Este README | Hierarquia, navegação, conteúdo e critérios de revisão do frontend |
| [PRODUCT.md](PRODUCT.md) | Público, propósito e limites do produto |
| [DESIGN.md](DESIGN.md) | Tokens e componentes da implementação atual; não é aprovação automática de toda composição existente |
| [Pesquisa de interfaces agro](../docs/design/pesquisa-interfaces-agro.md) | Referências externas, evidências visuais, aprendizados e limites da pesquisa |
| [Contratos de domínio](../docs/README.md) | Regras, estados, efeitos, permissões e dados que o desenho deve preservar |

A pesquisa externa inspira soluções; não muda contratos. Quando a organização atual divergir desta direção, registrar a diferença e propor a composição, sem apresentar uma tela antiga como padrão obrigatório.

## 1. Regras para qualquer tela

1. **Uma tarefa principal por contexto.** Consultar animais, registrar produção e analisar um relatório pedem organizações diferentes.
2. **O conteúdo começa cedo.** Título, contexto e controles não devem consumir a primeira tela inteira antes do resultado ou dos registros.
3. **Uma ação principal destacada.** As ações frequentes continuam visíveis; as ocasionais ficam em menu. Ações de alto risco têm revisão própria.
4. **Sem descrições pequenas decorativas.** Remover frases que repetem o título, anunciam o que já está visível ou ensinam uma interação evidente.
5. **Informação necessária fica legível.** Rótulo, unidade, data relevante, situação, erro e impedimento não viram texto minúsculo nem dependem de passar o mouse.
6. **Detalhe tem lugar próprio.** Método de cálculo, proveniência, auditoria e configuração avançada ficam acessíveis no contexto certo.
7. **Visual deve facilitar uma comparação ou uma ação.** Um cartão cheio de texto não melhora uma tabela só por ter bordas arredondadas.
8. **Navegação preserva contexto.** Busca, sítio, filtros, seleção e retorno precisam continuar coerentes ao abrir uma ficha e voltar.
9. **Cor indica significado.** Texto e ícone acompanham estados; verde não é a cor de todo número e vermelho não é decoração.
10. **Função preservada, apresentação mais clara.** Não alterar cálculo, permissão, fluxo de gravação ou estado de negócio como efeito colateral do redesign.

### Aberturas em modal

Detalhes de registro, formulários, conferências e filtros abrem em **modal centralizado**, também em telas pequenas. Não criar drawers, sheets ou painéis que entram pela lateral para esses fluxos. Usar os diálogos existentes com largura adequada, altura limitada à janela e rolagem interna, mantendo título, botão de fechar e ações acessíveis.

Preservar foco dentro do modal, retorno ao acionador, fechamento por Escape quando permitido, proteção de rascunho e bloqueio durante gravação. As URLs e os retornos dos fluxos continuam funcionando, inclusive ao abrir um registro pela busca global. A navegação fixa entre áreas não é um painel de detalhe.

## 2. Dois percursos, a mesma informação confiável

| Percurso | O que precisa aparecer primeiro | O que pode ficar depois |
|---|---|---|
| Funcionário autorizado em uma rotina | Sítio, data, animal/lote, ação, campos necessários e confirmação | Histórico completo, parâmetros e análise gerencial |
| Gestor ou técnico analisando | Resultado, período, população, comparação e pendência que afeta a leitura | Fórmula, composição da base, evidência individual e exportação detalhada |

Esses percursos orientam a composição e não criam novos papéis ou permissões. Usar os acessos existentes. Ações só de leitura e ações de lançamento precisam continuar distinguíveis.

Não pressupor que toda pessoa do agro tem o mesmo conhecimento ou dificuldade. Avaliar tarefas reais com funcionário, gestor e técnico; um teste de tela deve verificar compreensão, e não apenas se a pessoa conseguiu clicar.

## 3. Três níveis de informação

| Nível | Conteúdo | Apresentação |
|---|---|---|
| Essencial | Identidade, situação atual, valor com unidade, referência temporal, ação e impedimento | Diretamente visível, com contraste e tamanho de leitura |
| Contexto da tarefa | Evolução, últimos eventos, lista filtrada, motivo da pendência, distribuição | Seção aberta, gráfico, lista ou tabela perto do conteúdo principal |
| Detalhe especializado | Fórmula, fonte, versão, autoria completa, parâmetros e trilha de auditoria | Ajuda contextual, detalhe do registro ou área de configuração |

Classificar pela consequência para a tarefa, não pelo nome técnico do campo. **Uma carência ativa, um custo incompleto ou uma precisão de medida que muda a interpretação não são detalhes dispensáveis.** Mostrar o alerta curto no nível essencial e deixar a explicação completa acessível.

Não colocar seções centrais inteiras dentro de accordions. Histórico, reprodução, produção e sanidade precisam poder ser lidos. Expansão serve para evidência auxiliar, não para esconder o trabalho principal.

## 4. Navegação e organização por trabalho

Preservar as áreas vigentes: Financeiro, Estoque, Pecuária, Sítios e Contas/Acessos. Dentro de Pecuária, os pontos de entrada são Rebanho, Reprodução, Leite, Sanidade, Nutrição, Visitas veterinárias e Relatórios. Configurações e cadastros auxiliares aparecem no contexto da área, sem repetir atalhos em todos os blocos.

O problema não se resolve apenas reduzindo o menu lateral. Primeiro eliminar caminhos duplicados, títulos repetidos e sucessivas faixas de navegação dentro da mesma página.

- A lateral responde **em qual área trabalho**.
- A navegação local responde **qual consulta ou assunto dessa área estou vendo**.
- Filtros respondem **quais registros estão incluídos**.
- A ficha responde **qual registro estou consultando**.

Usar abas para assuntos relacionados; usar filtros para mudar o conjunto de registros. Não criar uma aba para cada estado ou botão. Em geral, manter a lateral e uma navegação local; um relatório pode ter um segundo nível de detalhamento quando isso separa resultado e evidências de forma clara. Evitar uma terceira barra de abas.

### Sítio e período

O sítio tem posição previsível e nome legível. Quando a consulta tem escopo local diferente do seletor global, mostrar esse contexto junto ao título; não depender de uma observação pequena para explicar a diferença. A evolução deve evitar estados visualmente contraditórios, preservando os contratos atuais de escopo.

Se a operação exige um sítio e ele ainda não foi escolhido, mostrar a escolha direta de sítios. Não renderizar uma tela de zeros, campos desativados e avisos em sequência. Consolidado deve ser uma opção explícita apenas nas consultas que o suportam.

O período aparece uma vez na barra de contexto, com calendário e acesso a filtros. Repeti-lo somente quando um bloco realmente usa outra referência temporal. Data de medição, coleta, competência e emissão não são intercambiáveis.

### Busca global, busca da lista e seleção

| Experiência | Objetivo | Resultado esperado |
|---|---|---|
| Busca global | Encontrar qualquer destino pesquisável permitido | Ficha exata ou consulta já filtrada |
| Busca da lista | Refinar animais, produtos, operações ou eventos daquela consulta | Atualização da lista, contagem e filtros |
| Seletor de registros | Escolher animal ou conjunto para uma operação | Seleção inequívoca, quantidade e confirmação |

O seletor enviado como referência nesta conversa não substitui a busca global. Na busca cotidiana, reconhecer identificadores e nomes suportados sem exigir marcar previamente uma fileira de campos. Critérios especializados pertencem aos filtros avançados.

A busca deve ser encontrável sem conhecer um atalho de teclado. Teclado é um acelerador. Respeitar o [contrato da busca](../docs/busca-global.md), os destinos exatos, o sítio e as permissões. “Pesquisar tudo” não promete busca em anexos ou entidades que ainda não tenham destino implementado.

## 5. Composição por tipo de tela

### Consulta operacional

Sequência recomendada: **título e contexto → busca e filtros → lista → paginação**. Acrescentar um resumo curto somente se ele ajudar a decidir o próximo passo.

Busca e dois ou três filtros de uso frequente podem ficar diretamente visíveis. Os demais entram em “Filtros”, com critérios ativos removíveis e botão para limpar. A quantidade de filtros disponíveis não deve determinar o tamanho do cabeçalho.

Quando a pessoa escolhe explicitamente Tabela, preservar as colunas também no celular, com rolagem horizontal dentro da consulta e acesso por teclado; não converter essa escolha em cartões. O modo automático dos consumidores sem essa escolha continua disponível. Uma tabela serve para comparar muitos registros. Um cartão serve para reconhecer um registro e agir. A alternância **Cartões / Tabela** aprovada no projeto conserva população, ordenação, filtros, paginação e acesso ao detalhe; a visualização não pode mudar o significado do resultado.

Na tabela, priorizar identificação, situação relevante, data e medida de comparação. Colunas extras ficam disponíveis conforme o contexto e os recursos existentes. Não exibir todos os identificadores, genitores e metadados por padrão. Valores e identificadores críticos não devem ficar sistematicamente cortados.

No cartão de animal, nome e `#brinco` aparecem juntos. Mostrar categoria/finalidade, lote e sítio. Peso/GMD, idade, nascimento e data da última pesagem ficam na ficha e na tabela de consulta, sem repetição no cartão. Acrescentar lactação/DEL, pós-parto, gestação e ocorrência aberta somente com evidência do registro; adaptar o conteúdo à fase. A ilustração genérica não representa foto do animal. Evitar a combinação de parágrafo, tabela interna, várias etiquetas e rodapé explicativo para cada registro.

### Ficha do animal

O cabeçalho aprovado continua compacto: identificação e ilustração existente, sítio/lote, estados independentes, idade e peso em pequenas unidades de informação, com data da pesagem separada e calendário. Pequeno é o componente; o valor continua legível.

O resumo deve responder à situação do animal. A composição aprovada preserva:

1. Identidade e ações no cabeçalho.
2. Situações e restrições que influenciam a próxima ação.
3. Visão sucinta de produção/peso e fatos recentes, quando aplicáveis.
4. Acesso ao histórico e aos assuntos especializados já existentes.

Cadastro e genealogia ficam na aba Cadastro, sem duplicar os mesmos dados no Resumo. Aberturas auxiliares seguem a regra de modal centralizado.

O histórico pode agrupar eventos por data e filtrar por assunto. Cada evento apresenta data, tipo, fato e resultado; detalhes técnicos abrem o registro. Não duplicar um mesmo fato por aparecer em mais de um domínio. Um histórico unificado novo depende da cobertura real das fontes e destinos.

Peso, idade, condição reprodutiva e lactação não são um único status. Preservar a distinção entre peso atual/último conhecido, medido/estimado, papel reprodutivo e aptidão clínica. Não preencher ausência com zero.

No GMD, mostrar o resultado com unidade e período. Quando as métricas usam a mesma base comprovada, o resultado pode ser agrupado; quando as bases diferem, manter a distinção. Fórmulas e fontes ficam em “Como foi calculado”, sem uma frase solta repetida em cada cartão.

### Formulário ou rotina de lançamento

Organizar campos na ordem do trabalho: **contexto → registro → revisão necessária → salvar**. Manter data e sítio claros, agrupamento por assunto, obrigatoriedade e erros junto ao campo.

Contexto já conhecido não vira campo desativado repetido. Campos avançados aparecem quando a escolha os torna necessários. Não colocar um formulário completo em miniatura ao lado de outro bloco de revisão que repete todos os valores.

Salvar e cancelar ficam próximos do fim do formulário e continuam acessíveis em telas pequenas. Uma gravação pendente mostra estado no botão. Recusar saída preserva o rascunho. Troca de sítio ou fluxo não descarta trabalho silenciosamente.

Não esconder a consequência de confirmar estoque, encerrar lactação, pagar ou estornar. O texto de confirmação precisa dizer o efeito concreto, em tamanho normal, mesmo quando a explicação geral saiu da primeira tela.

### Relatório e análise

Sequência recomendada: **título/contexto → período e filtros compactos → resultado → um aviso de cobertura quando necessário → comparação → detalhes**.

- Resultado é o foco; “Montar relatório” não deve dominar a consulta de um relatório existente.
- Agrupar avisos relacionados, preservando todos os motivos no detalhe. Não empilhar três faixas para a mesma limitação.
- Visualização pode usar evolução temporal, barras, composição ou linha do tempo; a escolha acompanha a pergunta respondida.
- Manter tabela para conferência e valores exatos. Não substituir dados por desenhos que impeçam a leitura.
- Usar os templates de filtro existentes, deixando claro seu escopo e persistência. Os templates atuais do navegador não são configurações compartilhadas com toda a equipe.
- Ícones de prévia e exportação podem compactar ações recorrentes já aprovadas, com nome acessível e ajuda. Ações menos familiares precisam de texto visível.
- Builder e parâmetros ficam em um percurso próprio, sem comprimir o relatório entre duas laterais.

**A tela é sucinta; o PDF é completo.** A prévia deve representar o documento a imprimir: filtros, período, população, unidades, gráficos, registros completos do recorte, avisos e paginação. Não imprimir apenas a página da tabela. Preservar os requisitos de emissão e snapshot do [contrato dos relatórios](../docs/pecuaria/relatorios.md).

## 6. Conteúdo: o que tirar, o que manter, o que deslocar

| Encontrado ou recorrente | Tratamento |
|---|---|
| “Acompanhe o efetivo…” abaixo de “Rebanho” | Remover se apenas apresenta o que a tela já mostra |
| “Planeje os atendimentos…” abaixo de “Visitas veterinárias” | Remover da consulta; orientar somente se houver uma dúvida real no fluxo |
| “Precisão não informada” e “Contexto não informado” repetidos em cada cartão de peso | Levar os campos ao detalhe; manter sinalização visível quando a ausência afetar o indicador ou a leitura do gráfico |
| Três indicadores de GMD com a mesma base comprovada | Uma leitura principal e explicação sob demanda; não agrupar bases diferentes apenas por coincidirem os valores |
| Sítio e período repetidos em todos os blocos | Uma referência compartilhada; explicitar exceções reais |
| Nota de metodologia em cada resultado | Uma ajuda próxima do indicador e seção completa no documento exportado |
| Texto de importação/reconciliação em rodapé de rotina comum | Contexto administrativo apropriado; preservar o acesso autorizado para operar a manutenção |
| Origem, autoria, versão e histórico de correções | Detalhe do registro, sem apagar a informação |
| Carência ativa, falha ao salvar, período fechado, base parcial | Mensagem curta e diretamente visível, com motivo e caminho de resolução |
| Instrução “clique para…” para botão já reconhecível | Remover; melhorar o rótulo ou a aparência do controle se a interação não estiver clara |

Não trocar toda descrição por uma interrogação. Uma sequência de dez ícones de ajuda também é poluição. Ajuda contextual fica no item que realmente precisa de definição e funciona por foco e toque, além de mouse. Instrução indispensável para preencher um campo permanece visível.

### Vocabulário e dados

Usar verbos concretos: “Registrar pesagem”, “Registrar parto”, “Salvar produção”, “Abrir ficha”, “Pagar” e “Exportar”. Manter o mesmo nome da ação em botão, título e confirmação.

Evitar códigos internos, nomes de tabelas, versões de metodologia e frases de implementação nas rotinas. Usar o vocabulário do domínio já estabelecido; não renomear sanidade, finalidade, papel ou aptidão apenas para encurtar.

Valor e unidade aparecem juntos: **508 kg**, **0,400 kg/dia**, **28,5 L/vaca**, **10 L**, **98 vacas**. Informar o período de uma taxa e a data de uma medida. Não representar data ou informação estática como botão.

“Sem registro”, “Não informado”, “Não se aplica”, “Sem base suficiente”, “Restrito” e zero têm significados diferentes. Não desenhar um campo vazio de forma que pareça erro, nem usar estado desconhecido como resultado saudável. Ícones genéricos não substituem essas distinções.

## 7. Legibilidade e acabamento

Manter a marca Terrano, a identidade aprovada e os componentes compartilhados. O objetivo desta revisão é a organização; a pesquisa não determina uma troca de paleta ou fonte.

### Escala de leitura proposta

As medidas abaixo são referências CSS para validar nas próximas composições, não uma alteração já aplicada aos tokens:

| Uso | Referência |
|---|---|
| Texto operacional, campo e botão | 16 px |
| Identificação principal e título de seção | 18–22 px |
| Título de página | 26–32 px, sem um grande espaço vazio abaixo |
| Número principal | 24–32 px, conforme a importância |
| Contexto secundário necessário | 14–16 px, com contraste suficiente |
| Tabela desktop densa | 14–16 px, sem encolher para caber mais colunas |

Não usar 10–12 px para instruções, estados ou dados necessários à operação. Se o conteúdo não cabe, rever colunas, agrupamento e prioridade. Se não é útil, retirar da primeira leitura. Evitar paredes de texto cinza-claro, caixa alta longa e abreviações sem definição.

Usar espaçamento para indicar relação: rótulo próximo do valor; maior separação entre assuntos. Reduzir a quantidade de contêineres antes de reduzir padding e fonte indiscriminadamente. Seção → conteúdo costuma bastar; não acumular painel → card → card → tabela interna.

Uma borda agrupa algo; uma sombra diferencia uma camada. Não aplicar ambas em todo elemento. Ícones indicam assunto ou ação, não preenchem todos os títulos. Ilustrações ajudam identidade ou estado vazio e não devem competir com dados nem parecer foto real de um animal quando são genéricas.

Quando resumo e gráfico respondem ao mesmo assunto, reuni-los no mesmo bloco: total e composição de contas; recebimentos/pagamentos e sua evolução; compromissos e valores a vencer. Não repetir os mesmos totais em uma faixa de cards e novamente no gráfico logo abaixo. Usar grid para aproximar comparações sem impor alturas grandes a blocos vazios ou transformar toda página em um mosaico.

### Desktop e campo

No desktop, aproveitar largura para comparação, evitando linhas intermináveis de texto e cartões esticados sem conteúdo. No celular, preservar animal, data, estado e ação antes dos detalhes. Tabela larga pode ter área de rolagem explícita; a página inteira não deve escapar horizontalmente.

Controles de toque têm alvo de pelo menos 44 × 44 px como direção do projeto, com espaçamento entre ações. Manter teclado, foco visível, rótulos acessíveis, zoom e ordem de leitura. Cor sozinha não comunica seleção, risco ou resultado.

Uso no campo exige clareza sobre conexão e salvamento. Não prometer modo offline, sincronização, RFID ou integração com balança porque um concorrente oferece; esses recursos precisam de contrato e implementação próprios.

## 8. Aplicação aos módulos

| Área | Foco da primeira leitura | Detalhe especializado |
|---|---|---|
| Rebanho | Encontrar animal/lote e reconhecer o conjunto | Identificadores adicionais, composição completa e proveniência |
| Reprodução | Fila/agenda, motivo de atenção e próxima ação comprovada | Tentativas, avaliações, evidências e critérios do ciclo |
| Leite | Data/ordenha, volume, destino e pendência da rotina | Alocações, versões, evidência histórica e composição do custo |
| Sanidade | Animal, ocorrência/tarefa, prazo e carência relevante | Exame, protocolo, autoria e rastreabilidade completa |
| Nutrição | Lote, dieta vigente, período e situação do fechamento | Formulação, vigências, participação e composição do consumo |
| Visitas veterinárias | Data, sítio, responsável, situação e entrada no atendimento | Histórico dos grupos e evidências dos procedimentos |
| Financeiro | Valor, vencimento/data, contraparte e situação | Rateio, documentos, autoria, conciliação e trilha de estorno |
| Estoque | Produto, unidade, saldo, sítio e validade relevante | Lotes de produto, custo e movimentos rastreáveis |
| Sítios e acessos | Identificação, situação e ação administrativa | Matriz completa de permissões e auditoria |

Essa divisão é de apresentação. Produção, confirmação de estoque, coleta, venda e recebimento continuam sendo fatos diferentes. Sanidade não é estado financeiro; gestação pode coexistir com lactação; papel de receptora não muda a genealogia. Remover texto não pode fundir essas regras.

Não criar um painel de “tarefas do dia” com números inventados. É uma boa alternativa de composição onde já existem filas e tarefas, desde que haja fonte, data, cobertura e destino de cada item.

## 9. Organização do código para sustentar a consistência

Preservar a organização por domínio e procurar equivalentes antes de criar componentes. Não executar uma mudança geral de diretórios apenas para cumprir este README.

| Responsabilidade atual | Onde conferir |
|---|---|
| Shell, navegação e guarda | `src/App.tsx`, `src/router.ts`, `src/components/AppSidebar.tsx` |
| Primitivas e padrões comuns | `src/components/`, `src/components/ui/`, `src/styles/` |
| Consultas e fluxos financeiros | `src/financeiro/` |
| Rebanho e rotinas pecuárias | `src/pecuaria/rebanho/` |
| Consultas e builder de relatórios | `src/pecuaria/relatorios/` |
| Catálogo e interface da busca | `src/lib/searchIndex.ts`, `src/components/CommandPalette.tsx` |

Reutilizar cabeçalho, barra de consulta, alternância de visualização, data, seleção de sítio, estados e diálogos existentes. Melhorar a composição no nível compartilhado quando o problema se repetir; usar variação de domínio quando a tarefa exigir. Não criar uma nova família de card, botão e CSS para cada aba.

Manter as primitivas Radix/shadcn já adotadas, com Tailwind e os tokens compartilhados. Calendários, menus e dropdowns também seguem essa base; suas superfícies precisam ser opacas e legíveis, sem herdar o fundo decorativo da página. A consistência deve vir da composição e do comportamento comuns, não apenas de usar a mesma biblioteca.

Cálculo de negócio não pertence à renderização. A interface formata e apresenta o contrato; não recalcula indicadores do servidor para caber no desenho. Filtros e destinos mantêm a History API, os parâmetros e as guardas vigentes.

Os cartões de animais mostram apenas nome/brinco/situação no cabeçalho, imagem/categoria/finalidade/lote no centro e ações no rodapé. Abrem a ficha por toda a superfície, com seleção e comandos independentes. Não exibem sítio, contexto clínico/produtivo, papel ou campos adicionais, mesmo com todas as colunas habilitadas na tabela. A tabela principal apresenta Reprodução e DEL; peso/GMD ficam nas colunas adicionais e na ficha. Cabeçalho da tabela e rodapés usam os tokens compartilhados de cor. Tabelas de consulta em tela usam fonte de 13px, inclusive nos textos das tags e comandos internos. A opção explícita de tabela mantém suas colunas com rolagem própria no celular.

### Espaçamento, largura útil e propriedade dos estilos

Usar uma escala curta: 8 px entre elementos inseparáveis, 12–16 px dentro de grupos e 20–24 px entre seções. São referências de composição, não margens obrigatórias em todo descendente. Evitar somar o recuo da página, do painel, da barra e da linha interna para o mesmo grupo. Rótulo e valor ficam próximos; um novo assunto recebe mais separação que seus próprios campos.

O componente reutilizado carrega os estilos de que depende. Sua apresentação deve funcionar ao abrir a URL diretamente em uma aba nova, sem visitar antes o hub de relatórios ou outra rotina. Estilos de domínio não podem depender de um ancestral exclusivo de outro consumidor. Regras comuns permanecem no escopo operacional, incluindo portais, sem atravessar o Financeiro.

Cartões de fatos têm altura do conteúdo. A grade de animais é a exceção: mantém altura uniforme entre os registros da página, sem cortar contexto ou alertas. Ausência de dados não reserva um gráfico vazio. Preservar a distinção entre controle documental, aferição operacional, pendência e zero conhecido. No estoque, aproximar a prioridade de reposição do atalho existente, evitando outro painel com a mesma lista antes dos produtos.

No telefone, avaliar quanto da janela é gasto antes do primeiro registro, além de conferir overflow. Data, nome, unidade e ação precisam caber dentro do próprio controle. Abas horizontais mantêm a seleção visível, inclusive ao abrir uma URL, sem deslocar a página verticalmente. Ajuda e fechar têm alvo de toque de 44 px; ícone pequeno não implica alvo pequeno. Nome, brinco, estados e medidas da ficha aproveitam a largura disponível, sem ficar presos à coluna estreita ao lado da imagem.

Modais têm recuo interno explícito, espaço para fechar e rolagem dentro da altura da janela. Separar grupos com períodos independentes: exportar produção e emitir/consultar relatório não compartilham automaticamente o mesmo intervalo. Um registro confirmado apresenta os fatos para conferência; campos editáveis ficam nos trechos que admitem nova gravação, preservando as ações de inclusão existentes. Configurações mostram a política vigente antes da criação de uma nova versão; o formulário em modal protege rascunho e bloqueia saída durante gravação.

## 10. Critério para revisar e aprovar uma mudança

Antes do mockup, definir: tarefa, público, informação essencial, ação principal e fonte dos dados. A revisão de `impeccable` e `frontend-design` deve avaliar esses itens e não apenas o acabamento.

O mockup deve mostrar ao menos dados usuais, ausência relevante, texto longo e a condição que muda a decisão. Não transformar uma tela vazia e bonita em prova de que a organização funciona com dados reais.

Na implementação, conferir:

- Título e contexto reconhecíveis; primeira informação útil sem várias faixas intermediárias.
- Sem descrições pequenas soltas, títulos duplicados ou a mesma ressalva repetida por registro.
- Fonte operacional legível, unidades presentes e datas associadas ao fato certo.
- Uma ação principal; ações frequentes encontráveis; secundárias com acesso claro.
- Gráficos respondem uma pergunta e permitem conferir os registros que os compõem.
- Cartões/tabela mantêm o mesmo recorte e caminhos; filtros aplicados continuam visíveis.
- Estado vazio, carregamento, erro, atualização e acesso restrito têm tratamentos diferentes.
- Nenhum alerta necessário escondido em tooltip; nenhum botão aparente sem comportamento.
- URL, voltar/avançar, sítio e guarda de rascunho preservados; busca global atualizada na mesma alteração.
- Desktop e celular conferidos no navegador com conteúdo realista; sem marcar homologação apenas por passar testes. Conferir também entrada direta em aba nova, ordem de navegação, aba ativa, texto longo e data/ação dentro do controle.
- Cada modal contado na revisão deve ter sido realmente aberto e conferido após carregar; captura da página ao fundo não comprova o formulário. Testar fechar/retorno de foco e cancelamento de rascunho, sem gravar dados de negócio para uma revisão visual.
- PDF completo e legível quando fizer parte da tarefa; métodos e limitações preservados no documento.

Em uma rodada com usuários, pedir que encontrem um animal, identifiquem sua situação, registrem um fato e retornem ao conjunto anterior. Medir hesitações, caminho percorrido, erros e necessidade de explicação. Registrar a base atual antes de definir metas; não inventar percentuais de melhoria.

### Ordem recomendada para a próxima revisão

Começar pelas rotinas frequentes e pelos problemas vistos na pesquisa: eliminar descrições/repetições compartilhadas; consolidar cabeçalhos, sítio e filtros; revisar ficha e listagem do rebanho; aplicar os mesmos critérios a Leite, Reprodução, Sanidade e Nutrição; conferir consultas financeiras, estoque e PDFs sem descartar as composições já aprovadas.

Cada superfície tem mockup e aceite próprios. Este documento orienta a revisão; não autoriza um redesenho automático de todas as telas nem declara concluído o que ainda é proposta.

## Aplicação do acabamento operacional

O acabamento aprovado abrange Rebanho/Genética/Pesagem, Reprodução/Visitas, Sanidade/Protocolos, Nutrição, todas as rotinas do Leite, Relatórios da Pecuária, Estoque, Sítios, Acessos e painel administrativo. Autenticação conserva a mesma identidade e legibilidade. Esta revisão não altera o visual das rotas do Financeiro.

O escopo compartilhado vem de `usaDesignOperacional` e do atributo `data-design-operacional`, incluindo os portais dos modais. Componentes compartilhados não devem receber uma regra visual indiscriminada que atravesse essa fronteira. O acabamento comum não substitui a composição específica de cada fluxo.

Consultas operacionais usam divisórias horizontais discretas, sem a malha de linhas verticais de uma planilha. Não repetir o mesmo período no seletor, em uma legenda pequena e em um chip. Na ordenha de um único dia, o calendário já identifica a data; agrupamento por data só aparece ao consultar vários dias.

Ao revisar uma área, conferir também criação, edição, detalhe, filtros, confirmação, estados vazios/erro, rolagem e telas estreitas. **Uma página mais bonita não significa que seus modais foram revisados.** Nos modais, iniciar o foco no título ou no destino explicitamente solicitado pelo fluxo, sem disparar uma ajuda automaticamente. Alterações por botão, seleção e calendário também precisam marcar o rascunho para a proteção ao fechar.

As permissões de uma pessoa são abertas em modal pela seleção explícita em Acessos, ou pelo parâmetro `usuario` de um destino exato. A consulta continua acessível após fechar, com retorno de foco. O builder de relatórios conserva a prévia na área principal e reúne os parâmetros no modal Configurar relatório.

A composição operacional usa o cabeçalho da rotina para data e ação principal, sem repetir um título dentro da consulta. No Leite, os turnos exibem volume, naturezas e confirmação das origens; paginação e tamanho ficam após os registros. Produção separa evolução e consulta do registro em blocos próprios. O formulário de ordenha prioriza litros e agrupa origem, identificação e conferência, mantendo o salvamento distinto da entrada em estoque.

Receitas apresentam composição e uso diretamente; a ficha nutricional aproxima dieta, efetivo e vigência. Ocorrências sanitárias reúnem fatos e acompanhamento no próprio registro. Visitas apresentam trabalho em aberto antes do histórico; os formulários separam identidade/contexto dos dados do fato. Cadastros mantêm criação no cabeçalho e consultam histórico em modal sob demanda. O catálogo de relatórios usa seletores superiores e resultado em largura integral. Sítios abre em cartões com tabela alternativa; Estoque aproxima saldo, lotes e rastreabilidade e agrupa as operações de transferência/perda. Essas composições preservam os recortes, estados de ausência, permissões e destinos de cada domínio.


### Densidade responsiva da navegação e dos protocolos

O shell usa gutters iguais: 24px no desktop, 20px entre 901–1100px e 16px até 900px. O assistente reserva folga inferior, sem retirar uma faixa da largura da página. Títulos compartilhados usam 24px/22px; abas usam 14px e alvos de 40px no desktop e 44px no móvel. Escalas específicas de documentos e indicadores continuam próprias. A sidebar recolhida centraliza desenhos proporcionais em acionadores de 44px, com um único fundo no seletor de sítio; mantém navegação móvel, colapso manual e expansão temporária do trilho automático.

Protocolos sanitários apresentam Protocolo, Situação, Versão, Estrutura e Ações; a finalidade continua nas consultas reprodutivas. Ver detalhes é direto; Mais ações reúne os comandos autorizados, com seus bloqueios e confirmações existentes. Cartões organizam nome, situação e estrutura em leitura curta, sem altura reservada para uma prévia ausente. A largura do contêiner governa sua grade; nomes, procedimentos e alertas podem aumentar a altura sem corte.
