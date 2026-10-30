# Pesquisa de interfaces agro para o Terrano

Pesquisa realizada em **30/10/2026** para orientar o [README do frontend](../../client/README.md). O foco é organização, hierarquia, legibilidade e trabalho operacional em pecuária de leite/corte, com referências complementares de gestão rural e financeiro.

## Escopo e força da evidência

Foram pesquisados materiais de 15 produtos com alguma evidência visual disponível, além de duas prospecções sem evidência suficiente para julgamento da interface. A triagem local reuniu **105 arquivos visuais externos**: capturas, primeiro quadro de animações, páginas de manuais e peças promocionais. Esse número inclui material descartado como logo, fotografia, duplicação e publicidade; **não significa 105 telas distintas de produto**.

Também foram examinados **60 quadros de 20 sequências GIF** do Farmbrite e Aegro, em três posições de cada sequência, e **36 quadros de dois vídeos**, com tempos registrados. Não houve acompanhamento contínuo dos vídeos nem avaliação do áudio. A amostragem permite comparar composição e etapas visíveis; não demonstra todos os comportamentos entre os quadros.

No Terrano, foram capturadas e lidas seis superfícies locais: visão geral do Rebanho, ficha DEV-019, Leite no estado de seleção de sítio, indicadores reprodutivos, visão geral financeira e lista de visitas. As duas imagens enviadas pelo usuário também orientaram a comparação; sua autoria/produto não foi confirmada e não foi atribuída a uma marca.

Não foram criadas contas em concorrentes, contratados planos ou executados lançamentos. Materiais antigos continuam identificados como referências históricas. Publicidade não comprova funcionamento, acessibilidade, desempenho ou disponibilidade atual de uma função.

As capturas e folhas de comparação ficam no diretório local `output/pesquisa-frontend-agro-20261030/`, fora do material necessário para compilar o projeto. Os links abaixo preservam a origem consultável; não dependem de esses arquivos locais existirem em outro checkout. Os direitos das imagens permanecem com seus autores.

## Produtos e materiais examinados

As observações são avaliações desta pesquisa, não afirmações de que uma interface foi homologada por usuários do Terrano.

| Produto e fonte | Evidência efetivamente observada | O que aproveitar | O que evitar ou validar |
|---|---|---|---|
| [IDEAGRI — galeria de relatórios](https://centralderecursos.ideagri.com.br/posts/exemplos-de-alguns-graficos-disponiveis-no-sistema-ideagri-pecuaria-leiteira-e-gestao-economica-e-financeira) | Galeria histórica publicada em 2021; foram examinados 21 exemplos de relatórios nesta coleta, além de duas peças não operacionais | Documento com período, população, gráfico e dados de conferência; separar leitura em tela de relatório completo | Tabelas e legendas muito pequenas, muitas séries e efeitos 3D; não transportar a densidade de um impresso para o celular |
| [JetBov de Curral — demonstração de telas](https://conteudos.jetbov.com/lp-novo-app-de-curral-v2/) | Composição da ficha e menu de manejo; peça específica de indicadores/GMD com tela legível | Identificação do animal junto a peso/evolução; acesso direto às ações de campo | Ícones ou grandes blocos coloridos sem rótulo suficiente; publicidade não demonstra a operação inteira |
| [iRancho — confinamento](https://conteudo.irancho.com.br/irancho/confinamento) | Consulta de baia no celular, formação de baias, projeções e mapa gerencial | Contexto do lote/baia próximo dos dados; representação espacial quando a tarefa é espacial | Excesso de células vazias e cor saturada; não criar mapa decorativo onde não existem dados ou tarefa espacial |
| [Leigado — pecuária leiteira](https://leigado.com.br/software-pecuaria-leiteira) | Painel web, histórico de lactação e telas móveis de animal/manejo em peças de produto | Medida principal clara e reconhecimento de rotinas por assunto; evolução individual | Painel com vários mostradores e donuts simultâneos; cores diferentes para tudo competem pela atenção |
| [UNIFORM-Agri — resumo do rebanho](https://www.uniform-agri.com/knowledge-base/dairy/uniform-app/uniform-app-herd-summary/) e [ficha do animal](https://www.uniform-agri.com/demovideos/animal-record/) | Painel móvel de situações e vídeo histórico da ficha, analisado por quadros | Separar produção, reprodução, saúde, movimentos e genealogia mantendo a identidade do animal | Mosaico de indicadores igualmente fortes; menus densos e tipografia de aplicativo desktop antigo |
| [Farmbrite — início em Livestock](https://help.farmbrite.com/help/getting-started-guides-getting-started-with-livestock) e [consulta do rebanho](https://help.farmbrite.com/help/livestock-dashboard) | 17 animações: listagem, busca, filtros, seleção coletiva, ficha, tratamento, alimentação, medidas, genealogia, mapa, financeiro e anexos | Lista com poucas colunas, resumo breve, ação de registro no contexto e filtros fora do caminho principal | Segunda lateral longa na ficha, formulários extensos e campos pequenos; não copiar o conjunto inteiro de campos |
| [AgriWebb — gestão animal](https://www.agriwebb.com/us/solutions/animal-management/) | Telas móveis de pesagem, detalhe/histórico e mapa em material oficial | Valor/unidade evidentes; contexto do animal e ação de re-pesagem próximos | Transferir lógica de manejo por mapa a toda consulta; inferir offline/hardware para o Terrano a partir de material comercial |
| [Lely Horizon — apresentação de interface e vídeo](https://ux-design-awards.com/winners/lely-horizon) | Painel, ficha com evolução, versão móvel e vídeo promocional com passagem por alerta, ficha, gráfico e registro | Separar atenção/rotina dos indicadores; caminho da exceção ao animal e à ação | Preencher todo espaço com KPIs; tratar recomendação clínica de um produto integrado como função existente no Terrano |
| [Herdwatch — gestão de bovinos](https://herdwatch.com/solutions/cattle-management-software/) | Telas de rebanho, livro de partos e medicamentos dentro de composições promocionais | Linguagem de rotina, lista reconhecível e ação de adicionar próxima do conjunto | Limitação de zoom e legibilidade da peça; não há base para avaliar toda a experiência desktop |
| [Livestocked](https://www.livestocked.com/) | Dois exemplos oficiais: consulta móvel de propriedades e interface desktop com mapa/atividades | Relação entre local e atividade; contexto persistente | Texto pequeno e uso intenso de ícones; não assumir que tema escuro melhora uso no campo |
| [CattleMax — navegação e ficha](https://help.cattlemax.com/article/705-getting-around-cattlemax) | Dashboard e ficha com timeline, abas por assunto e identificação lateral | Ficha como centro de consulta do histórico; áreas reconhecíveis; registro de atividade no contexto | Anatomia com duas navegações e muitas linhas cadastrais; o Terrano não precisa reproduzir a mesma densidade |
| [Aegro — fluxo de caixa](https://aegro.com.br/suporte/financeiro/como-funciona-a-aba-fluxo-de-caixa/) | Três demonstrações animadas de período, exportação de relatório e de gráfico | Resumo e evolução antes do detalhamento; período e ações no contexto da consulta | Várias faixas de navegação; ícones pequenos e excesso de controles no topo. Referência financeira, não modelo integral da pecuária |
| [CowManager — Find my Cow](https://www.cowmanager.com/wp-content/uploads/2025/01/Find-my-Cow-User-Guide-2024.pdf) | Sete páginas selecionadas do manual: lista, seleção, filtros, execução móvel e relatório | Seleção inequívoca e distinção entre lista de trabalho e ficha completa | A evidência cobre um fluxo especializado de localização; não permite julgar todo o produto |
| [DeLaval DelPro FarmManager](https://www.delaval.com/en-us/farm-solutions/farm-management/delaval-delpro/applications/delpro-farmmanager/) | Material oficial com Monitor Board e fila de ordenha, principalmente fotografias de telas | Conceito de visão operacional e filas orientadas ao que fazer | A resolução das fotos limita a análise dos controles. Não tratado como benchmark detalhado de tipografia ou interação |
| [Nedap CowControl — brochura](https://nedap-livestockmanagement.com/wp-content/uploads/sites/2/2024/02/2024-Nedap-CowControl-Extended-EN.pdf) | Quatro páginas iniciais de brochura; predominância de posicionamento e fotografia | Referência de contexto operacional; não determinou a composição proposta | Evidência de UI insuficiente nesta amostra. Não confundir um folheto de soluções com demonstração da interface |

Complemento de leitura operacional: a documentação do [DairyComp/PULSE sobre worklists](https://genplan-a-help.vas.com/en-us/Content/Platform/Features/DairyComp/ReportsWorklists/WorklistsDone.htm) e sua captura de painel de animal mostram a separação entre resumo, eventos e detalhes. O [manual desktop do DairyComp](https://dc-help.vas.com/GetStarted/main_display_area.htm) documenta a CowCard e as páginas de relatório. São referências adicionais da família VAS, sem incluí-las artificialmente na contagem dos 15 produtos da tabela.

Foram prospectados ainda [Pecuá](https://pecua.com.br/) e materiais públicos de BovControl. A coleta não produziu evidência visual suficiente para sustentar recomendações específicas sobre suas interfaces. Não foram classificados como produtos visualmente analisados.

## Vídeos: observações e limites

| Material | Amostragem | Observação aproveitável |
|---|---|---|
| [UNIFORM-Agri — Animal Record](https://www.youtube.com/watch?v=SBxIv5zNHuE), vinculado no site oficial | Duração do arquivo: 11min16s; 18 quadros distribuídos entre aproximadamente 13s e 10min52s | A identidade permanece enquanto mudam os assuntos. Há gráfico e registros tabulares, informações reprodutivas, saúde, movimentos e prévia de impressão. O desenho é denso e histórico; aproveitar a continuidade de contexto, não os campos pequenos |
| [Lely Horizon](https://www.youtube.com/watch?v=6n4UNxyejAw), vinculado na apresentação do produto | Duração do arquivo: 1min20s; 18 quadros distribuídos entre aproximadamente 2s e 1min18s | O roteiro passa por atenção no painel, ficha individual, evidência no gráfico e registro. Ajuda a pensar o encadeamento de tarefa; o vídeo é promocional e não demonstra desempenho ou validação clínica |
| Farmbrite, nos dois artigos oficiais acima | 17 GIFs, três quadros por sequência: aproximadamente 20%, 50% e 80% dos quadros | É possível observar passagem da lista ao formulário, filtros, seleção múltipla, genealogia, registro e consulta de medidas. A animação não prova estados de erro ou permissões |
| Aegro, no artigo de fluxo de caixa acima | Três GIFs, com o mesmo critério de amostragem | Calendário e exportação podem ficar junto à consulta sem um formulário de parâmetros ocupando a tela toda |

O vídeo incorporado pelo artigo Farmbrite não ficou disponível na tentativa de acesso; sua análise em movimento usou os GIFs efetivamente disponíveis. Não atribuir a ele conclusões como se tivesse sido assistido. Quadros de uma sequência não contam como novos produtos nem como telas independentes homologadas.

## O que se repete nas referências úteis

### A ficha é um ponto de trabalho

A identificação não desaparece a cada consulta, e o histórico é organizado por assuntos ou eventos. A pessoa não precisa voltar a uma listagem para descobrir qual animal está vendo. No Terrano, isso reforça o cabeçalho compacto aprovado e o acesso direto à ficha exata pela busca.

### Listagem e visão individual têm densidades diferentes

As tabelas mais úteis permitem comparar linhas; as fichas permitem entender uma entidade. Colocar genealogia, identificadores extras, auditoria e todos os estados em toda linha aumenta a carga visual. A conclusão para o Terrano é oferecer prioridade de colunas e detalhe contextual, mantendo a visão em tabela já solicitada pelo usuário.

### Evolução tem mais utilidade que decoração

Peso ao longo do tempo, curva de produção e eventos datados ajudam a reconhecer mudança. Muitos donuts, mostradores, barras sem escala e cartões de totais disputam atenção sem necessariamente indicar o que fazer. Uma visualização deve responder a uma pergunta e manter acesso aos valores de origem.

### O assunto é mais estável que a tecnologia

Animal, lote, pesagem, tratamento, parto e produção são âncoras de navegação mais compreensíveis que nomes de entidades internas, importadores e versões de metodologia. O usuário pode reconhecer o assunto sem ler um subtítulo de apresentação.

### Há padrões do nicho que não devemos copiar

O setor também tem interfaces com fonte pequena, cores demais, menus profundos e formulários com dezenas de campos. A repetição em vários concorrentes não é prova de qualidade. Também não há base nesta pesquisa para afirmar uma preferência universal de produtores por tabela, mapa, cartão ou tema escuro.

## Confronto com o Terrano atual

| Superfície local observada | Achado | Consequência para a direção |
|---|---|---|
| Rebanho — visão geral | Bons gráficos de composição e destino para consulta; subtítulo genérico e espaço significativo para bloco sem fatos | Preservar a comparação; retirar apresentação redundante e dimensionar ausência sem um painel vazio dominante |
| DEV-019 — resumo | Cabeçalho melhorou; a pesagem ainda contém várias linhas pequenas de origem/precisão/contexto, dentro de cartões aninhados | Preservar valor, data e interpretação confiável; deslocar metadados completos ao detalhe e reduzir contêineres |
| Leite — seleção de sítio | Escolha direta de sítios é clara; contexto técnico e acessos de manutenção ainda aparecem fora da rotina principal | Usar o estado vazio como modelo de escolha; separar manutenção técnica do percurso cotidiano sem apagar o acesso autorizado |
| Indicadores reprodutivos | Resultado já vem antes do detalhamento; existem vários controles e cartões com ausência repetida | Manter a hierarquia aprovada; resumir pendências relacionadas e evitar replicar uma longa ausência em cada bloco |
| Financeiro — visão geral | Composição aprovada com disponibilidade, entradas/saídas e compromissos; ainda há frases auxiliares repetidas | Melhorar leitura pontualmente, sem usar a pesquisa como justificativa para refazer a visão geral inteira |
| Visitas — lista | Identidade, data, sítio, responsável e situação estão presentes, mas cada item repete rótulos e a introdução explica a própria página | Buscar uma linha/card mais direto, preservando contexto suficiente para reconhecer a visita |

São achados visuais do estado capturado, não auditoria completa de todos os fluxos. Não foram realizados testes de uso com produtores, medição de contraste em todos os concorrentes, avaliação mobile de todas as telas ou comparação estatística de produtividade.

## Decisões recuperadas das conversas

Foram consultados chats disponíveis neste app, selecionados pelo vínculo com `/Users/toledo/fazendinha`. A leitura não equivale a acesso universal a conversas de outras contas, chats apagados ou todo o histórico privado de cada participante. Foram lidas páginas de turnos dos chats abaixo e confrontadas com a documentação e o código atuais.

| Chat | Diretriz identificada | Limite ou atualização |
|---|---|---|
| **Avaliar UI/UX do financeiro** | Retirar descrições pequenas e rodapés explicativos; organizar resultados antes de avisos/controles; evitar collapse nas seções centrais; equilibrar texto, gráfico e rótulo; preservar cartões/tabela | Essas decisões reaparecem em Leite, Reprodução, visitas e relatórios, portanto devem orientar a base compartilhada |
| **Avaliar UI/UX do financeiro** | Unidades em cada medida; ajuda contextual no item; período com calendário; prévia de PDF por ícone; documento completo e visual; templates de filtros | Os detalhes não devem ser apagados: precisam de lugar apropriado. Os templates atuais têm persistência local, não compartilhamento automaticamente |
| **Avaliar UI/UX do financeiro** — turnos anteriores também consultados | Grid para reduzir rolagem; reunir totais e gráfico do mesmo assunto; biblioteca shadcn nos controles; superfícies normais nos dropdowns; sidebar com identidade discreta | Houve exploração e revisão de cores ao longo da conversa. Não somar propostas antigas contraditórias nem remover títulos úteis com base em um comentário isolado; prevalecem a direção atual e os pedidos posteriores de simplificação |
| **Corrigir componente de busca** | Busca deve encontrar registros e navegar para o destino exato; manutenção na mesma mudança; idade/peso compactos no cabeçalho; data separada; eliminar indicador repetido e aparência falsa de botão | Preservar o catálogo, limites e gates descritos no contrato da busca. O seletor de animais da referência não representa busca global |
| **Ampliar IA e criar bot WhatsApp** | Conversa com mais espaço; fontes discretas; distinguir ditado e conversa por voz; manter alternativas de entrada | O assistente ajuda no contexto; não deve virar requisito para encontrar dados e operar a interface. Não reativar o bot antigo pela revisão visual |
| **Atualiza branch principal** | Peso de secagem opcional, sem duplicação; correção auditada; evidência e vínculo histórico preservados | A revisão visual não pode tornar peso obrigatório, automatizar encerramento ou esconder consequências das correções |

Histórico de conversa informa intenção; o estado disponível continua dependendo de rotas, serviços, banco, permissões e interface. Pedidos antigos de ampliar módulos, sementes ou integrações não foram tratados como autorização nova. Nenhuma informação de acesso ou configuração privada foi incorporada a este documento.

## Síntese de direção

O Terrano não precisa escolher entre ser completo e ser simples. Precisa distinguir **o que o usuário precisa reconhecer agora**, **o que precisa consultar durante a tarefa** e **o que precisa conferir em detalhe**.

As regras de aplicação e os critérios de aceite estão no [README do frontend](../../client/README.md), evitando dois guias normativos com recomendações duplicadas. Esta pesquisa registra as evidências que sustentam essa direção; não aprova uma interface, não altera contratos de domínio e não certifica os produtos comparados.
