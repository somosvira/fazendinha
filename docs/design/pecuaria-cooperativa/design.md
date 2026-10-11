# Pecuária V3 — Cooperativa contemporânea

Implementação de 11/10/2026 na branch `codex/pecuaria-cooperativa-contemporanea`, criada da branch `codex/financeiro-cooperativa-contemporanea` com seu trabalho local preservado. A direção visual é a [Cooperativa aprovada no Financeiro](../financeiro-cooperativa/design.md). A organização operacional usa como referência o [PR #313](https://github.com/somosvira/fazendinha/pull/313), especialmente seus commits de navegação e Nutrição. O contrato da [Pecuária V1–V3](../../pecuaria/README.md), o schema e a API atual prevalecem sobre a proposta do PR.

## Estrutura e navegação

| Área | Endereço | Conteúdo |
|---|---|---|
| Rebanho | `/pecuaria/rebanho` | Visão geral, animais e lotes |
| Animais | `/pecuaria/rebanho/animais` | Consulta, filtros, seleção e ações coletivas existentes |
| Cadastro | `/pecuaria/rebanho/animais/novo` | Formulário e revisão do cadastro |
| Ficha | `/pecuaria/rebanho/animais/:id` | Resumo, identificação/genética, sanidade, peso/manejo, nutrição e histórico |
| Lotes | `/pecuaria/rebanho/lotes` e `/pecuaria/rebanho/lotes/:id` | Consulta e detalhe |
| Sanidade | `/pecuaria/sanidade` | Agenda de ciclos/tarefas, ocorrências, aplicações, exames e carências |
| Pesagem coletiva | `/pecuaria/rebanho/animais` | Ação da seleção de animais; o endereço antigo `/pecuaria/pesagem-manejo` redireciona preservando filtros |
| Nutrição | `/pecuaria/nutricao` | Visão geral por lote, receitas e fechamentos |
| Configurações | `/configuracoes/pecuaria` | Rebanho, genética e sanidade; receitas continuam na Nutrição |

Nutrição mantém o estado na query: `aba=receitas|fechamentos`, `loteId`, `fechamentoId`, `acao=atribuir|corrigir|consumo|estorno`, `vigenciaId`, `formReceita=nova|editar|versao|detalhe|publicar` e `receitaId`. Busca, paginação e filtros continuam na URL; o histórico do navegador restaura a consulta.

Links antigos de Sanidade e Nutrição sob `/pecuaria/rebanho` são normalizados sem perder query ou fragmento. Cadastros antigos levam ao grupo correspondente de Configurações, conservando parâmetros de consulta e links para materiais. A normalização inicial substitui a entrada atual do histórico; a navegação do usuário continua usando `pushState`.

A sidebar mantém o agrupamento visual Pecuária, com as três rotinas: Rebanho, Sanidade e Nutrição. A busca global conhece os mesmos destinos. Acesso às rotinas e às configurações exige a área Pecuária; alterações dependem de `lancar`. Os cadastros existentes recebem essa permissão e continuam em leitura quando ela está ausente.

## Aplicação da referência

Usar as primitivas existentes de `financeiro-ui.tsx`, os componentes shadcn-style/Radix e os formulários de domínio. Evitar uma biblioteca paralela ou campos ilustrativos sem suporte da API.

| Decisão visual | Padrão aplicado |
|---|---|
| Fundo | Sálvia clara `--background` / `#edf2ed` |
| Sidebar | `--fin-sidebar` / `#e1e9e2`, paisagem discreta e marca Terrano original |
| Ação principal | Verde floresta `--primary` / `#24493b`, texto branco |
| Superfície | `--card`, branco |
| Texto | `--foreground` e `--muted-foreground` |
| Tipografia | DM Sans; título de página 28 px e 24 px no móvel |
| Painéis / controles | Raios de 16 / 8 px; sombra discreta e borda sem saturação |
| Tabelas | Cabeçalho sálvia, corpo branco, células 10 × 16 px e texto de 14 px |
| Ícones de seções | Ícone existente em círculo sálvia de 36 px |
| Modais / painéis laterais | Cabeçalho sálvia, conteúdo branco, rodapé e ações com contraste |

A ficha do animal é um documento contínuo: uma superfície externa, separadores internos e âncoras para as seis seções. Os dados e ações de cada seção permanecem montados; os históricos não foram removidos. Pesagem e movimentação ficam no cabeçalho; ações secundárias ficam em “Mais ações”, com fechamento por Escape e retorno de foco ao acionador.

Formulários de novo animal e Nutrição ocupam a largura disponível, com título dentro do formulário e revisão à direita. No novo animal, salvar/cancelar ficam na revisão; as receitas e operações nutricionais mantêm as ações no rodapé do formulário. A revisão empilha abaixo do formulário em telas menores. Os painéis laterais existentes continuam sendo usados para ações de manejo, pesagens e cadastros auxiliares.

Tabelas extensas mantêm rolagem horizontal dentro do contêiner. Navegação local pode rolar horizontalmente; isso não autoriza cortar botões fora de suas superfícies. A paginação quebra a linha no móvel. Filtros sanitários ocupam uma linha em telas largas e se reorganizam nas menores.

## Ícones e tema compartilhado

A geometria canônica dos ícones financeiros permanece em seu inventário existente. As novas entradas da Pecuária reutilizam Lucide: `Beef`, `HeartPulse` e `Leaf`; os grupos de cadastro usam `Beef`, `Dna`, `HeartPulse` e `Leaf`. Ícones de ação e da ficha são os mesmos já usados no domínio. Na sidebar, o traço é 1,7; no conteúdo, preservam-se os tamanhos 16–20 px e as propriedades dos componentes existentes. Não há um mockup raster específico da Pecuária para alegar identidade pixel a pixel.

A paleta fica em `client/src/styles/cooperativa-theme.css`. A composição compartilhada é aplicada por `financeiro-theme.css` a `.financeiro-content` e `.pecuaria-content`; detalhes da Pecuária ficam em `pecuaria/pecuaria-theme.css`. O seletor no root alcança portais Radix e a sidebar. Ao sair dessas áreas, o escopo desaparece. Os tokens `--fin-*` foram conservados para compatibilidade com o Financeiro.

Essa organização centraliza as cores para uma futura feature de temas; a seleção de temas por usuário e sua persistência ainda não fazem parte desta implementação.

## Adaptação do PR à branch atual

Foram aproveitadas a separação operacional, a ficha por âncoras, as configurações da Pecuária e as consultas/formulários da Nutrição por lote. O Financeiro conserva suas rotas e seu redesign atual; não foi portado o deslocamento global das configurações financeiras proposto no PR.

A API desta branch não oferece `/nutricao/visao-geral`, `/nutricao/lotes/:id/resumo`, `GET /nutricao/vigencias/:id` nem filtro de situação dos fechamentos. O adaptador de leitura do cliente usa lotes, vigências e fechamentos já existentes; percorre as páginas antes de resumir custos ou filtrar/paginar a situação. Resolve também os sítios dos fechamentos e os lotes em uso de cada receita.

Os valores continuam entregues e mascarados pela API. Resumos incluem apenas fechamentos confirmados, excluem estornos e distinguem custo desconhecido de zero. A soma e a média de apresentação usam centavos inteiros (`bigint`), sem cálculo monetário em ponto flutuante. Isso não gera fatos, baixa de estoque, movimentos financeiros ou regras contábeis.

As consultas de vigência trabalham com até quatro lotes simultâneos. A obtenção do histórico completo tem custo proporcional ao número de páginas; para históricos grandes, a evolução adequada é um agregado paginado no servidor, respeitando o mesmo contrato e permissões. Não foi introduzido cache compartilhado entre sítios.

Nenhum endpoint, schema, migration ou serviço de gravação foi alterado. Reprodução e leite de versões futuras não foram reintroduzidos. A base IDEAGRI continua sendo fonte de carga inicial, não uma restrição de interface ou cadastro.

## Verificação

A [revisão visual](../../../design-qa.md) registra capturas reais, estados, larguras e limites da conferência. A [galeria de evidências](../../../output/qa/pecuaria-cooperativa-2026-10-11/index.html) reúne as páginas e os estados; os PNGs originais ficam ao lado.

Os testes cobrem rotas/aliases, gates de área, paginação do adaptador, custos parciais/mascarados, estornos, receitas/vigências e os fluxos existentes de manejo/sanidade/seleção. A conferência no navegador usa as fixtures locais, com escritas de negócio bloqueadas. Não equivale à homologação integral da V3, teste de todas as combinações de dados ou auditoria completa de acessibilidade.

## Refinamento com feedback de 11/10/2026

- Rebanho, Sanidade, Nutrição e Ciclos/Tarefas usam a variante financeira de `SubTabs`, composta pelas mesmas primitivas `Tabs`, `TabsList` e `TabsTrigger` de Configurações financeiras e a classe compartilhada `fin-abas`. A variante antiga permanece para os outros consumidores.
- Não repetir o nome do módulo acima dos títulos principais. Ações de gestão ficam no cabeçalho, usando o botão padrão.
- Categoria e sítio têm painéis com alturas iguais. Baixas e os quatro últimos eventos compartilham uma linha no desktop e empilham no celular.
- A participação de descarte voluntário fica dentro da classe correspondente, com numerador, denominador e exclusões explícitos.
- Sanidade usa seis filtros de largura e altura uniformes no desktop, três no tablet e um no celular. Novo ciclo fica no cabeçalho da tabela.
- Animais mantém busca, botão Filtros e apenas os filtros ativos como chips removíveis. O diálogo permite alterar os critérios; Concluir fecha o diálogo. Filtros e paginação continuam na URL. A atualização não desmonta os controles em consultas vazias.
- Seleção individual tem checkbox de 20 px em alvo mínimo de 44 × 44 px. O clique na área de seleção não abre a ficha.
- A pesagem coletiva permanece na barra de seleção de Animais. A sidebar não repete uma página apenas para selecionar os mesmos animais; links antigos redirecionam preservando query e fragmento.

Capturas desta rodada: [galeria dos refinamentos](../../../output/qa/pecuaria-refinamentos-2026-10-11/index.html).
