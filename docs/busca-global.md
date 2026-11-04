# Busca global

A busca global (`Ctrl/⌘ K` ou lupa da navegação) reúne registros reais, páginas e atalhos dos domínios ativos. Os filtros Tudo, Registros, Páginas e Ações conservam o termo digitado. O desenho aprovado está em `client/mockups/busca-global/index.html`; seus dados são ilustrativos e não provam disponibilidade.

## Busca exclusiva de animais

`Ctrl/⌘ Shift K` abre um modal centralizado com a tabela do rebanho já carregada, mesmo sem termo. A consulta reutiliza `GET /api/pecuaria/rebanho/animais` com `situacao=TODOS`, `comContexto=true`, ordenação crescente por brinco e páginas de 20 animais. Não carrega o rebanho inteiro no navegador. A busca global `Ctrl/⌘ K` conserva seu catálogo, fontes, limites e endpoint anteriores; o parâmetro `tipos=animal` de `/api/busca` continua disponível, mas não alimenta esta tabela.

Os filtros principais são termo, situação (todos, ativos ou baixados), sexo e lote. Mais filtros abre um segundo modal centralizado, com rascunho próprio, para sítio, categoria, finalidade, raça na composição, origem, papel reprodutivo, idade mínima/máxima e tipo/período da baixa. Os catálogos e parâmetros são os já disponíveis no rebanho. Categoria também admite sem categoria ou definida manualmente, sem combinar parâmetros incompatíveis. O botão informa a quantidade de campos avançados aplicados. O sítio selecionado no shell é obrigatório para a consulta e não pode ser ampliado no modal; em Consolidado, o filtro restringe o recorte sem mudar a preferência do shell até abrir uma ficha. Aplicar uma troca de sítio limpa o lote. Aplicar confirma os campos de uma vez e retorna à primeira página; Cancelar, fechar pelo X ou Escape descartam o rascunho sem alterar a consulta. Limpar filtros limpa somente o rascunho, que ainda precisa ser aplicado. Escape fecha apenas o modal superior, com retorno do foco ao botão Mais filtros. A idade aceita inteiros de 0 a 600 meses e extremos inclusivos, com limite mínimo não superior ao máximo; datas de baixa devem ser reais e ordenadas. Os campos de baixa ficam desabilitados e são omitidos da consulta enquanto a situação principal for Ativos; valores anteriormente aplicados continuam disponíveis ao voltar a Todos ou Baixados. Alterar um filtro principal ou termo retorna à primeira página; o termo tem debounce de 200 ms. Fechar e reabrir limpa os filtros. A montagem da busca é segregada por usuário e sítio no App.

As colunas são brinco/nome, situação, categoria, reprodução, produção, lote e sítio. Reprodução/produção vêm de `contextoCartao`, sem cálculo novo no cliente; ausência permanece não informada e machos mostram não se aplica. O rótulo produtivo reutiliza a regra existente de lactação: ausência de lactação conhecida não comprova secagem. Os identificadores adicionais e a filiação da referência IDEAGRI não viram colunas nesta entrega: não fazem parte do DTO resumido desta listagem. A identificação detalhada permanece na ficha.

Clique na linha ou no brinco abre a ficha exata, com o sítio retornado e o contexto de retorno validado do rebanho. Setas navegam, Enter abre a ficha e Escape fecha. A seleção é anunciada ao leitor de tela; quando o foco já está numa linha, as setas movem também o foco. A entrada usa uma linha discreta de foco. A tabela tem rolagem própria e paginação compartilhada, mantendo os filtros e o fechamento utilizáveis em telas estreitas.

Repetir o atalho do modo aberto fecha; o outro atalho troca entre lista de animais e busca global. Requisições são canceladas ao fechar, desmontar ou alterar o recorte; respostas atrasadas não repõem a lista anterior. Durante a digitação, resultados antigos deixam de poder abrir fichas. Carregamento, ausência e falha de rede são estados distintos, com nova tentativa para a consulta e para as opções dos filtros. O cliente confere a navegação, e as rotas do rebanho continuam autorizadas no servidor por sessão, área e escopo.

Validação automatizada cobre carga inicial, paginação/filtros, debounce, respostas obsoletas, falha/retry, ausência, sítio do shell, restrição de acesso, reabertura e navegação por teclado, confirmação/cancelamento do rascunho avançado, categorias especiais e validação dos intervalos. A validação manual confere a lista real e a abertura da ficha no servidor local; testes unitários não substituem homologação do ambiente publicado.

## Comportamento

Páginas e ações vêm de um catálogo local e aparecem imediatamente. Registros são consultados em `GET /api/busca?q=`, após 200 ms sem digitação. São necessárias duas letras, ou um único dígito para identificadores curtos. A consulta aceita até 60 caracteres, ignora diferenças de caixa e acentos e exige todas as palavras. Caracteres `%`, `_` e `!` são tratados literalmente. Identificadores técnicos são encontrados pela igualdade completa; não entram como fragmentos que produziriam resultados aleatórios numa busca numérica.

A busca cobre nomes, identificações operacionais e referências declaradas por cada fonte: brinco, nome, identificação provisória, eletrônico, SISBOV e referência IDEAGRI nos animais; nome/documento/nome fantasia/contato nos parceiros; número/referência e descrição nas operações; códigos de lotes de produtos; códigos de genitores e siglas raciais, além dos nomes dos cadastros. Não procura indiscriminadamente em todo JSON, anexos ou valores monetários.

Cada fonte devolve até seis registros; o conjunto tem limite de 120. Igualdade e prefixo têm prioridade sobre correspondência parcial, com desempate estável. A interface informa a limitação e permite refinar o termo. A busca não carrega tabelas completas no cliente nem cria índice persistido, sincronização ou dependência de IA.

Ao mudar o termo, fechar a busca ou trocar sítio/usuário, respostas obsoletas são descartadas e requisições pendentes são canceladas. Registros antigos não ficam selecionáveis enquanto outro termo é consultado. A primeira linha de registro passa a ser a seleção de teclado quando os dados chegam, evitando que páginas recebam prioridade por terem carregado antes. Setas selecionam, Enter abre, Escape fecha; foco e bloqueio do fundo usam o diálogo compartilhado. Falha de rede/HTTP/formato inválido oferece nova tentativa e não é apresentada como ausência; páginas locais continuam disponíveis.

## Cobertura e destinos

| Família | Resultados e navegação |
|---|---|
| Rebanho e genética | Animais e lotes abrem fichas; categorias do rebanho, raças e genitores abrem os cadastros filtrados; material genético conserva o link de consulta existente |
| Financeiro | Operações e contas abrem detalhes; parceiros abrem ficha de leitura; compromissos abrem o detalhe na listagem sem restringir tipo/situação; categorias, grupos e centros abrem consultas filtradas; relatórios financeiros abrem a emissão |
| Estoque | Produto abre ficha; lote de produto abre movimentos filtrados por partida; movimento abre a rastreabilidade do fato |
| Sanidade e reprodução | Ocorrências, aplicações e exames abrem o detalhe existente; tentativas abrem o histórico do animal; partos e visitas abrem fichas; programações abrem o núcleo sanitário ou reprodutivo correspondente; modelos e tipos abrem os cadastros filtrados |
| Nutrição | Receitas abrem a versão em leitura; fechamentos abrem o detalhe preservado |
| Leite | Produção diária abre a folha individual na data operacional; qualidade abre a amostra por ID, independentemente da página da lista; coleta abre consulta pela data física e referência; venda abre a operação comercial; emissão abre o snapshot; tanque abre o equipamento vigente |
| Administração | Sítios abrem a consulta filtrada, incluindo inativos; usuários abrem a ficha por ID |

Páginas e subconsultas também são encontradas por vocabulário de uso, incluindo relatórios, reprodução, ordenhas, qualidade, destinos, configurações e cadastros. Atalhos de criação somente aparecem com permissão de lançamento e levam ao formulário real, sem executar uma gravação.

O atalho do Rebanho também reconhece “Geral”, “histórico do animal” e “auditoria do animal” e abre a consulta existente do Rebanho. Esses termos não criam um novo destino pesquisável: a ficha resolve aliases de seção legados na própria URL e continua respeitando o escopo e as permissões da consulta.

Não são fontes autônomas: logs/auditoria, sessões/tokens, rascunhos privados, componentes internos de protocolos, medições/alocações individuais internas, anexos binários ou campos livres dentro de snapshots. Esses dados permanecem acessíveis pelos contextos autorizados dos registros principais. Manejos/pesagens e emissões reprodutivas ainda não têm fonte autônoma nesta busca: seus destinos precisam receber um fato/emissão histórico exato, e abrir apenas a ficha geral não satisfaz esse contrato. Documentos financeiros são encontrados quando ligados diretamente a uma operação, abrindo o contexto dessa operação; anexos exclusivamente de outros contextos ainda não são fontes. Versões históricas/futuras de tanque ficam fora da busca, pois o destino atual mostra o equipamento vigente na data de referência. São limites explícitos, não promessa de cobertura de cada tabela técnica.

## Autorização e sítio

O servidor resolve sessão e sítio antes da consulta e seleciona somente fontes autorizadas por área, aba, visibilidade de valores e gestão de acessos. Estoque é compartilhado entre Financeiro e Pecuária. Contas aceitam a equivalência existente da aba de cadastros. Consultas monetárias e documentos/relatórios financeiros exigem área Financeiro e `verValores`; dados administrativos exigem `gerenciarAcessos` ou dono. Não se retorna dinheiro, e-mail de usuário, snapshot ou conteúdo de laudo no DTO da busca. A pesquisa de e-mail administrativo serve à localização da ficha, sem expor esse campo no resultado.

Registros operacionais usam o sítio persistido no fato. Animais usam a localização de referência da ficha (aberta ou última conhecida); não são buscados em qualquer sítio por terem passado por ele. Cadastros compartilhados não recebem um filtro de saldo que ocultaria produtos sem estoque. Fatos sem sítio conhecido não são atribuídos ao sítio selecionado: só podem aparecer no consolidado. O texto de contexto identifica o sítio e, quando pertinente, a data.

Resultados trazem `caminho` completo, além de tipo, ID, rótulo, contexto, grupo e aba. A navegação conserva query/fragmento e passa pela guarda de alterações pendentes. Ao abrir um fato a partir do consolidado, o sítio do registro é selecionado dentro da mesma ação protegida, antes da montagem do destino. Recusar a guarda conserva sítio e URL anteriores. Consultas que recebem links atualizam o filtro/alvo também quando já estão abertas; voltar/avançar restaura o contexto. Essas conveniências não substituem a autorização dos endpoints de destino.

## Implementação e manutenção

`client/src/lib/searchIndex.ts` é o catálogo de páginas/ações; `CommandPalette.tsx` apresenta a consulta e `App.tsx` integra a navegação protegida. As fontes de registros estão em `server/src/services/busca.consulta.ts`; `busca.ts` executa a leitura e monta os DTOs; a rota valida a entrada com Zod e resolve o escopo. SQL parametrizado normaliza texto no PostgreSQL e aplica os limites no servidor. Identificadores SQL dinâmicos vêm somente de constantes do catálogo, nunca da request. Não há mudança de schema, migration ou escrita de domínio nesta entrega.

Sempre que mudar páginas, registros, fluxos, URLs/filtros ou permissões, revisar a busca na mesma alteração, conforme AGENTS.md: catálogo, fontes, destino exato, gates e testes. Cada fonte nova precisa demonstrar que o resultado pode ser aberto pelo perfil e sítio que o encontrou; exclusões precisam de motivo documentado. Aceitar um parâmetro sem consumi-lo no destino não conta como integração. Abrir um relatório existente não adiciona variáveis ao builder; qualquer ampliação do próprio relatório continua sujeita ao seu contrato.

## Validação

Testes de servidor cobrem entrada, seleção prévia de fontes autorizadas, parâmetros SQL, escopo e contrato dos destinos. Testes de cliente cobrem catálogo, busca assíncrona, filtro de tipo, seleção por teclado, falha/repetição, restauração por URL, recepção de links e guarda de navegação. Consultas locais de conferência são somente de leitura no `fazendinha_seedatev3`, sem habilitar flags de integração, criar fixtures, aplicar migrations ou alterar o manifesto da seed. Validação no navegador e testes automatizados são evidências distintas; nenhuma marca de homologação de domínio é aprovada por esta mudança.

A revisão visual de Animais/ficha/ordenhas/filas mantém o catálogo, os gates e os destinos existentes. O registro geral de ordenha continua consumindo `leiteModo=registro`, `registroId`, data operacional e ordenha; sua apresentação é modal, sem perder o período da consulta no retorno. Os cartões abrem o animal exato, sem substituir a navegação por uma ficha ilustrativa. O contexto adicional do cartão é dado de leitura da lista, não nova fonte autônoma da busca.

O acabamento operacional geral conserva os destinos da busca. A seleção por `usuario` em Acessos abre o editor em modal; receitas, operações nutricionais e protocolos continuam consumindo suas URLs antes de apresentar o modal. Trocar a apresentação não autoriza abrir outro registro nem remover o retorno da consulta. Filtros e parâmetros persistentes continuam sujeitos aos testes de navegação existentes.

A reformulação da composição operacional preserva as URLs, fontes e gates da busca. Cabeçalhos integrados do Leite, agrupamento das visitas, seleção superior dos relatórios e cartões de Sítios são apresentações dos mesmos destinos. O histórico dos cadastros é consultado em modal sob demanda; não há novo tipo de registro pesquisável introduzido por essa apresentação.

A composição das consultas operacionais mantém os destinos existentes de políticas, exames, estoque e relatórios. A ação de resultado completo no cartão de exame abre o mesmo registro pelo handler de detalhe, sem criar uma nova entidade pesquisável. Formulários de nova versão em modal preservam a página de configuração alcançada pela busca. Alterações de espaçamento e resumo visual não modificam catálogo, fontes, gates ou parâmetros de navegação.

A revisão de responsividade e densidade conserva o catálogo, as fontes, os gates e os destinos exatos. Sidebar, ações do catálogo de protocolos e cartões de animais usam os handlers anteriores; parâmetros de visualização, busca, paginação e retorno continuam reconhecidos. A retirada de medidas/datas dos cartões não remove campos pesquisáveis ou a informação da ficha e da tabela.

A integração automática do Bezerreiro conserva a identidade do animal e os destinos de sua ficha. Participação é um intervalo contextual, não um segundo cadastro pesquisável; a regularização exige conferir lote e localização e não é executada pela busca. A página Bezerreiro permanece no catálogo sob o gate de Pecuária.

O cancelamento de programação do Bezerreiro é uma ação contextual ao período na ficha exata do animal, acessível pelo destino já indexado. Não ganha comando global: exige conferir a fase, o intervalo e a versão da participação antes de escrever. Mantém os gates de Pecuária, lançamento e sítio; não altera URLs ou fontes de registros.



### Assistente Terrano

Conversas privadas e propostas temporárias de pesagem não são indexadas na busca global: pertencem ao usuário e ao recorte de permissões da conversa, não a uma página pública de registros. São retomadas pelo Histórico do próprio assistente. O catálogo inclui IA Terrano (`/assistente`), Radar (`/assistente?aba=radar`) e Metas (`/metas`), para usuários reais ativos. `/ia` e o legado continuam desativados. O antigo atalho `/assistente?aba=metas` é normalizado para `/metas`. A pesagem confirmada pertence à ficha exata do animal (`/pecuaria/rebanho/animais/:id`), que já é pesquisável por identificação e sítio. Pesagens individuais ainda não têm fonte específica na busca: o resultado do animal abre sua ficha e o histórico de peso, sem prometer localizar uma pesagem pelo texto do chat.


Metas individuais e medições ainda não têm fonte de registros na busca: a projeção versionada e os gates conservadores por indicador precisam de integração própria antes de indexar títulos com segurança. Nesta versão, a busca abre a página Metas, onde a lista é filtrada no servidor; não promete abrir uma meta exata a partir de seu título. Snapshots privados do Radar também não são indexados. Fontes do Radar e das medições automáticas abrem as consultas operacionais já filtradas, respeitando sítio e guarda de navegação.
