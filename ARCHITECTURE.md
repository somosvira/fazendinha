# Arquitetura

O [system design](docs/system-design.md) complementa este documento com fronteiras, relações e fluxos transacionais até a V5; o [manual por eixos](docs/guia/README.md) explica seu uso.

## Organização

Monorepo pnpm com `client` (React 18, Vite 6, TypeScript) e `server` (Hono, Prisma 6, Zod, TypeScript). Node 22+; versões exatas estão nos manifests e no `pnpm-lock.yaml`.

| Responsabilidade | Fonte no repositório |
|---|---|
| Shell e navegação por URL | `client/src/App.tsx`, `client/src/router.ts`, `client/src/components/AppSidebar.tsx` |
| Sessão e sítio nas requests | `client/src/propriedadeScope.ts`, `client/src/api/auth.ts` |
| Interface financeira | `client/src/financeiro/` |
| Interface pecuária | `client/src/pecuaria/rebanho/` |
| App HTTP e gates | `server/src/app.ts`, `server/src/middleware/` |
| Rotas e regras de negócio | `server/src/routes/`, `server/src/services/` |
| Dados e integridade SQL | `server/prisma/schema.prisma`, `server/prisma/migrations/` |
| Configuração e armazenamento | `server/src/env.ts`, `server/src/lib/storage.ts`, `server/src/lib/uploads.ts` |

Rotas validam entradas e coordenam serviços; serviços orquestram banco e regras. Funções `*.calc.ts` isolam cálculos puros. DTOs/mappers devem conservar distinções como `null`, zero, pendente e desconhecido. O cliente usa Tailwind v4, primitivas Radix/shadcn-style e Recharts 3; componentes e estilos existentes descrevem a implementação, sem fixar uma direção visual futura.

## Runtimes e banco

O deploy usa exclusivamente Cloudflare Workers: interface e API compartilham o mesmo Worker, com Neon para banco e R2 para arquivos. `server/src/app.ts` constrói o Hono compartilhado. `index.ts` atende o desenvolvimento local em Node; `worker.ts` é o entrypoint de produção com assets do Vite definidos em `wrangler.jsonc`. O frontend usa `/api` relativo; o Vite faz proxy para 41873 em desenvolvimento.

`db.ts` usa `PrismaPg` em Node, compatível com PostgreSQL local ou Neon, e `PrismaNeon` no Worker. Em Node o client é reutilizado; no Worker `resetPrismaPorRequisicao()` prepara o client para a requisição antes das rotas. Preserve essa ordem e o tratamento do contexto de I/O.

O schema usa `public` para Financeiro/Estoque/Auth/Sítios e `pecuaria` para os fatos pecuários. IDs e relações seguem o schema, sem inferir um tipo global único de identificador. SQL das migrations acrescenta constraints, índices parciais e catálogos que o Prisma não representa integralmente. `migrate deploy` aplica a cadeia; `db push` não é equivalente.

A estrutura versionada parte da baseline `20261025000000_base_unificada`, consolidada na V5. A cadeia anterior permanece no Git; nomes de migrations antigas em evidências são proveniência histórica, não arquivos a executar nesta árvore. Uma instalação com dados da cadeia anterior precisa de reconciliação própria, conforme [deploy](DEPLOY.md#banco-e-bootstrap). Evoluções usam migrations incrementais, sem reescrever a baseline aplicada. `RegistroChuva` não integra o modelo atual.

Nenhum entrypoint executa automaticamente os bootstraps de propriedade/dono. São comandos explícitos em `server/src/scripts/`. Aplicação de migrations em dev vem do script `dev` do servidor, não de `app.ts`.

## Domínios e integrações

Financeiro separa operação, compromisso, transação, movimento de conta e efeito físico. Estoque é compartilhado com Pecuária; consumo operacional não cria uma segunda despesa. Confira [o contrato](docs/financeiro-rebuild-contrato.md).

Pecuária V1–V5 reúne rebanho, genética, sanidade, peso/manejo, nutrição e reprodução, com auditoria e localização histórica. Reprodução usa fatos individuais, gestação, parto/crias, visitas com atividades e programações IATF; consumo de material e nascimento de crias são transacionais. Consulte também o [contrato V4](docs/pecuaria/reproducao.md). Confira [seu contrato](docs/pecuaria/README.md). Agricultura/Cultivo/Equipe não têm módulos operacionais atuais. Centros/categorias e origens físicas de atividades retiradas podem existir no histórico financeiro.

Produção V5 separa aferição geral/individual, confirmação no estoque, natureza, destinos, qualidade, coletas e fechamento comercial. Medição não cria saldo antes da confirmação; retirada com preço pendente não cria receita; fechamento usa o motor financeiro sem repetir a saída. `LEITE_FIFO_V1` admite custo pendente somente nas origens/alocações lácteas comprovadas. Veja [leite](docs/pecuaria/leite.md) e [seus fluxos integrados](docs/system-design.md#caminho-leiteiro-e-ausência-de-duplicação).

O [assistente de consulta](docs/assistente-consulta.md) usa OpenAI para interpretar perguntas e um registro de ferramentas autorizadas para formatar respostas com dados dos serviços financeiros e artigos de ajuda revisados. O backend nunca envia os resultados financeiros ao modelo. O canal `/api/assistente/*` é separado, exige usuário real ativo e pode ser desativado com `ASSISTENTE_CONSULTA_ENABLED=false`. Guias e consultas rápidas funcionam sem chave de IA. Os agregados exigem as flags de valores, salários e investimento até haver mascaramento granular confiável.

O bot anterior, motor estruturado legado e WhatsApp conservam código. `ASSISTENTE_ATIVO=false` nos dois lados mantém esses canais e `/ia` suspensos; o servidor devolve `FEATURE_DISABLED`/503 para bot/WhatsApp. A configuração de credenciais não os reativa.

## Sessão, permissões e sítio

Login, recuperação e definição de senha bloqueiam submissões concorrentes por instância e preservam campos após falhas. Convite/reset aguardam a validação do link antes de oferecer senha: HTTP 404 significa inválido/expirado; rede ou outras falhas oferecem nova tentativa sem afirmar que o token é inválido. O cliente de autenticação conserva o status HTTP no erro. Respostas de validação ou de criação de sessão de um link anterior são ignoradas quando o contexto muda ou desmonta. Essa proteção visual não substitui os gates nem a validade/uso único garantidos pelo servidor.

`app.ts` monta health, WhatsApp e auth pública antes de `authMiddleware`; WhatsApp tem validação própria e também está sujeito à suspensão do assistente. Rotas protegidas resolvem sessão/usuário e aplicam gates. Áreas válidas: `financeiro` e `pecuaria`; estoque aceita qualquer uma delas. Flags e presets ficam em `services/auth/papeis.ts`.

`SHARED_ACCESS_TOKEN` mantém um dono sintético de transição. Sem usuários e sem esse token, o middleware permite acesso com dono sintético somente fora de produção. Em `NODE_ENV=production`, esse caso responde 503 por bootstrap incompleto; quando há usuários e nenhuma sessão válida, responde 401.

`comPropriedade()` inclui sessão e `X-Propriedade-Id`. A seleção visual/consolidada não autoriza escrita global: use os resolvedores existentes de escopo e, em fatos pecuários, o sítio na data do evento. Permissões precisam ser conferidas também nos links de retorno, DTOs, agregados e exportações.

A seleção de sítio é uma preferência em `sessionStorage`, separada por usuário e aba, restaurada após recarregar a interface. Consolidado remove essa preferência; troca de conta não reutiliza o escopo da conta anterior. Sem armazenamento disponível, a seleção funciona em memória. A preferência não substitui a autorização do servidor nem o sítio histórico do fato.

Operações financeiras usam contratos explícitos de DTO para ocultar valores em todos os tipos e respostas de escrita, mantendo quantidades e rastreabilidade. Consultas monetárias agregadas, relatórios/documentos e revisão de fatos financeiros exigem `verValores` no servidor. Rascunhos não são devolvidos como formulários mascarados: suas rotas exigem a permissão para impedir autosave destrutivo de campos ocultos. Sem valores, novas operações usam envio direto com preços manuais; confira o [contrato financeiro](docs/financeiro-rebuild-contrato.md#permissões-e-documentos).

## Armazenamento e configuração

`env.ts` valida configuração no carregamento. R2 é o armazenamento atual obrigatório: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NOTAS` e `STORAGE_NAMESPACE` (`dev`, `staging`, `prod`, `test`). Não existe seleção atual por `STORAGE_DRIVER` nem fallback de disco local.

Novos objetos são segregados por namespace; a leitura usa as chaves persistidas, incluindo arquivos anteriores. Preserve esses caminhos. Anexos e relatórios são objetos privados acessados pelos fluxos autorizados do servidor. Credenciais ficam fora do Git. `JWT_SECRET` também assina os intents de upload direto; as sessões de usuário são persistidas no banco, não JWTs. O exemplo completo está em `server/.env.example`.

## Testes

Vitest em ambos os workspaces; teste perto do código. O servidor inclui `src/**/*.test.ts`, `prisma/seed/**/*.test.ts` e os helpers históricos testados em `seedatev3`, `seedatev4` e `seedatev5`. Seu setup fornece R2 inerte, sem acesso ao bucket; para unitários basta uma `DATABASE_URL` inerte. Testes de transformação IDEAGRI usam `node --test scripts/*.test.mjs`. O planejamento da manutenção local dos sítios usa `node --test server/scripts/consolidacao-sitios-local/modelo.test.mjs`, sem acesso ao banco.

As flags `AUTH_DB_INTEGRATION=1`, `PECUARIA_DB_INTEGRATION=1` e `FINANCE_DB_INTEGRATION=1` habilitam casos com PostgreSQL real. No desenvolvimento local, use somente `fazendinha_seedatev3`, com todas as migrations, após revisar se a suíte cria/remove apenas fixtures próprias. Não crie clones nem bancos auxiliares. `test:financeiro:integration` e os testes que recriam estrutura ficam restritos ao CI externo; não execute essa bateria no ambiente local. Seus tipos podem ser conferidos por `tsc -p server/tsconfig.financeiro.json`.

Quando qualquer flag de integração está habilitada, o Vitest do servidor executa os arquivos em sequência: compartilham o banco e transações Serializable de cenários independentes podem conflitar mesmo com fixtures distintas. Os testes de concorrência mantêm suas operações simultâneas dentro de cada caso. Sem as flags, os arquivos unitários continuam paralelos. O cenário sanitário com 101 participantes tem limite próprio de 30 segundos para criar e consultar os fatos reais; os demais conservam o limite padrão.

`.github/workflows/staging.yml` compila os dois workspaces, testa o transformador, a interface e o servidor com banco efêmero, além de executar a bateria financeira separada e conferir os contratos da carga V4 e da seed única. O job `seed-unificada` verifica baseline, interrupção/retomada e reexecução idempotente no PostgreSQL efêmero do CI. Testes unitários, integrações e homologação visual/manual são evidências distintas.

Configuração e fluxo de publicação em Cloudflare ficam em [DEPLOY.md](DEPLOY.md).

## Interface unificada

Consultas tabulares reutilizam `financeiro/BarraConsulta.tsx` e `PainelFiltros.tsx`: a composição visual não executa consultas nem mantém cópias dos filtros de domínio. Cada consumidor conserva valores, autorização, handlers, paginação e contratos de URL. `PainelFiltros` usa o Dialog compartilhado, centralizado, com corpo rolável e ações persistentes. A composição de campos e intervalos é compartilhada por `CampoFiltro`/`GrupoCamposFiltro`; o modal controla o foco inicial no título, e datas reutilizam `DatePicker`. Os consumidores fornecem os valores e handlers, sem redefinir medidas da estrutura. `useRascunhoConsulta.ts` mantém a cópia editável do modal; só a aplicação explícita entrega o conjunto ao domínio. Fechar ou cancelar descarta essa edição, e limpar no painel não executa a consulta. Estados de seleção única frequentes usam `SituacoesConsulta`; critérios adicionais têm identificação e remoção junto à tabela. O adaptador `BarraFiltros` da Pecuária delega à mesma composição. Em Operações, `FiltrosOperacoes.tsx` compõe os critérios das colunas e do modal com o mesmo rascunho; `ContextoOperacao.tsx` apresenta os vínculos de leitura de parceiro e impactos. `ColunaTabela.cabecalho` permite um controle no cabeçalho sem substituir o título textual dos cartões. O modo de cartões com links mantém botões de contexto fora do botão que abre o registro. Tabelas contextuais nativas usam `consulta-tabela` somente na apresentação em tela; a impressão não recebe essas regras.

Financeiro, Pecuária, Estoque e as demais telas autenticadas compartilham os tokens de `client/src/styles/cooperativa-theme.css`. A direção desta entrega está documentada no [guia Cooperativa contemporânea](docs/design/cooperativa-unificada.md), com referências específicas para Financeiro e Pecuária. PageHeader, CabecalhoTabela, SubTabs e TabelaFinanceira compõem cabeçalhos, abas e listagens reutilizando as primitivas existentes. As larguras de referência das colunas determinam sua proporção em tela, com expansão explícita por `larguraFlexivel` quando necessária. `styles/tabelas-operacionais.css` unifica cabeçalhos, densidade e hover das consultas compartilhadas e contextuais, sem aplicar essas regras aos documentos de impressão. Seleção e persistência de temas não estão implementadas.

Consultas visuais reutilizam `components/VisualizacaoConsulta.tsx` para a preferência individual e a URL, e `ConsultaVisual.tsx` para cartões com navegação separada dos comandos e agrupamento cronológico. O agrupamento conserva a ordem recebida e não reúne registros separados pela ordenação. Os consumidores mantêm os dados, filtros, seleção, ações e paginação do domínio; tabelas continuam como alternativa. Componentes sanitários adaptam resultados e prazos sem atribuir interpretação clínica; a cronologia do animal usa leituras existentes autorizadas e distingue data do fato da auditoria. O histórico de dietas usa os limites registrados das vigências, sem presumir consumo.

Os seletores de opção única usam o popup compartilhado `components/ui/select`, com busca por rótulo sem distinguir maiúsculas ou acentos, estado sem resultados e navegação por teclado. Digitar não troca o valor selecionado; fechar limpa a busca e devolve o foco ao gatilho. Itens filtrados continuam montados para conservar rótulo e valor nativo do formulário, mas não ficam visíveis nem recebem foco na navegação. `SelectCampo` adapta os filhos `option`/`optgroup`, preserva grupos, opções desativadas, valores numéricos e opções sem `value` explícito; vazio continua vazio para a validação de campos obrigatórios. A busca é local às opções já disponíveis, não amplia o escopo autorizado nem consulta outros registros no servidor. Menus de ações não são seletores e não recebem busca.

Acessos usa uma lista pesquisável por nome/e-mail e filtrável por situação, ao lado do editor no desktop e acima dele em telas estreitas. As contagens ficam no cabeçalho da lista. O editor apresenta áreas, permissão de registro e visibilidade de valores da pessoa selecionada, com estados pressionados acessíveis nos controles e revogação em seção própria. A busca é local aos usuários autorizados retornados pela API e não modifica permissões; alterações continuam usando os endpoints e a confirmação de revogação existentes.

O editor de permissões aguarda a resposta do servidor antes de apresentar a alteração como salva, bloqueando novos comandos durante essa gravação. Falhas preservam o estado anterior. Copiar um convite só anuncia sucesso após a confirmação do clipboard; quando indisponível ou negado, oferece orientação de cópia manual. Convites e modais legados ativos usam a primitiva Radix compartilhada para foco protegido, Escape e devolução do foco ao acionador. Datas iniciais financeiras seguem o calendário local compartilhado, sem converter a data do usuário para UTC.

`DialogContent` e `SheetContent` também conservam o elemento que tinha foco antes da abertura quando o fluxo é controlado sem `Trigger` Radix. No fechamento, devolvem o foco a esse elemento se ainda estiver conectado/habilitado, respeitando um destino explícito do consumidor. Campos de texto e áreas de texto no conteúdo/diálogos usam 16px em larguras até 900px para leitura e prevenção de zoom de foco móvel; isso não substitui homologação em Safari/dispositivo físico.

A navegação de Pecuária mantém Rebanho, Reprodução, Visitas, Sanidade, Nutrição, Leite e Relatórios; pesagem coletiva é ação da seleção em Animais, e `/pecuaria/pesagem-manejo` permanece alias que conserva consulta e fragmento. Os resumos nutricionais usam o agregado de leitura `/api/pecuaria/rebanho/nutricao/resumo`: o banco soma o histórico confirmado por fechamento/lote e o servidor aplica escopo e mascaramento. O cliente não percorre mais páginas do histórico para montar o panorama; o histórico detalhado conserva paginação, com filtro de situação no servidor. As gravações de domínio não mudam; confira o [guia específico](docs/design/pecuaria-cooperativa/design.md).

O shell mantém tokens e navegação disponíveis durante o carregamento sob demanda de Financeiro, Rebanho, Sanidade, Nutrição, Estoque e Configurações. Os imports lazy ficam fora do componente App para conservar identidade; Suspense apresenta o carregamento sem mudar contratos de URL, gates ou a chave de remontagem por sítio.

Em navegadores com `scrollbar-gutter`, a raiz reserva espaço estável para a rolagem. Quando o Radix bloqueia a rolagem em um overlay, a margem compensatória adicional é neutralizada para não duplicar esse espaço; foco protegido e bloqueio da rolagem permanecem ativos. Navegadores sem suporte conservam a compensação original. Filtros das listagens usam superfície de formulário, distinta do cabeçalho tonalizado da tabela; números e ações mantêm alinhamento consistente. O skeleton do panorama nutricional representa o resumo e a tabela de lotes, sem reservar gráficos redundantes.

Na Nutrição, `ConteudoEstavel` conserva apenas a altura anterior enquanto o novo contexto anuncia carregamento (`aria-busy`). A reserva é liberada ao concluir ou falhar a consulta. Dados do contexto anterior não ficam visíveis nem são reutilizados para impedir a contração intermediária do layout; não há cache novo nem mudança no escopo das consultas.

## Base comum de Pecuária

Sanidade e Reprodução compartilham Protocolo, EtapaProtocolo, ProgramacaoProtocolo, ParticipacaoProtocolo e TarefaProtocolo. ExameAnimal reúne evidência e observações; InterpretacaoReprodutiva conserva os vínculos clínicos. PeriodoReprodutivoAnimal é a fonte do papel por data. Views de leitura preservam os contratos IATF anteriores sem escrita paralela. O [contrato comum](docs/pecuaria/protocolos-exames.md) descreve identidade, versões, histórico, migração e retorno coordenado.

As consultas operacionais de partos e indicadores carregam períodos iniciais e reutilizam o seletor de datas. As emissões e os filtros completos ficam em `/pecuaria/relatorios`, preservando os snapshots existentes; a política reprodutiva fica em Configurações da Pecuária. Essas leituras usam sítio explícito, com seletor local quando o escopo global é Consolidado. Veja o [contrato de navegação](docs/pecuaria/reproducao.md#consultas-operacionais-e-navegação).

No Rebanho, carregamentos de dados preservam cabeçalho e navegação da rota. A lista de animais prioriza busca/filtros/tabela; a ficha do lote usa abas com fragmentos `#lote-*`, conservando componentes e rascunhos montados. Seções principais de ficha são títulos diretos, enquanto detalhes de evidência continuam expansíveis. Dimensões comuns ficam em `client/src/pecuaria/rebanho/rebanho-layout.css`; o contrato de interface está em `docs/pecuaria/README.md`.

Modais comuns de `financeiro-ui.tsx` usam `data-fin-scroll="conteudo"` para conservar a rolagem vertical dentro da altura máxima. A decoração compartilhada de diálogos não pode cortar ações abaixo da dobra; drawers e diálogos com corpo/rodapé próprios mantêm suas regiões de rolagem.
