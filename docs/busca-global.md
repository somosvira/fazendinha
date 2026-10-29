# Busca global

A busca global (`Ctrl/⌘ K` ou lupa da navegação) reúne registros reais, páginas e atalhos dos domínios ativos. Os filtros Tudo, Registros, Páginas e Ações conservam o termo digitado. O desenho aprovado está em `client/mockups/busca-global/index.html`; seus dados são ilustrativos e não provam disponibilidade.

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
