---
name: Terrano — Cooperativa contemporânea
description: Identidade compartilhada da interface de gestão rural
colors:
  primary: "#24493b"
  canvas: "#f4f7f5"
  canvas-light: "#fafcfb"
  canvas-sage: "#e7efe9"
  canvas-end: "#eef3f0"
  sidebar: "#e4ece6"
  nav-hover: "#dbe6de"
  nav-selected: "#cedfd3"
  surface: "#ffffff"
  surface-subtle: "#f3f5f4"
  heading: "#22352c"
  text: "#283c31"
  text-muted: "#56665f"
  border: "#dce2df"
  control-border: "#7b8d81"
  positive: "#2d664d"
  danger: "#8d3931"
  warning: "#775930"
typography:
  headline:
    fontFamily: '"DM Sans", "Helvetica Neue", Helvetica, Arial, sans-serif'
    fontSize: "28px"
    fontWeight: 650
    lineHeight: 1.2
  title:
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: '"DM Sans", "Helvetica Neue", Helvetica, Arial, sans-serif'
    fontSize: "17px"
    fontWeight: 500
    lineHeight: 1.5
  control:
    fontSize: "14px"
    fontWeight: 500
  metadata:
    fontSize: "12px"
  compact-metadata:
    fontSize: "11px"
  field-mobile:
    fontSize: "16px"
  dialog-title:
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.3
  responsive-headline:
    fontSize: "24px"
  legacy-h1:
    fontSize: "40px"
  legacy-h3:
    fontSize: "20px"
  legacy-kpi:
    fontSize: "36px"
  legacy-body-small:
    fontSize: "15px"
  legacy-body-large:
    fontSize: "19px"
rounded:
  control: "8px"
  panel: "16px"
  rebanho-panel: "12px"
  pill: "9999px"
spacing:
  small: "8px"
  controls: "12px"
  content: "16px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  button-outline:
    textColor: "{colors.text-muted}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
  rebanho-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.rebanho-panel}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "4px 12px"
  badge:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
---

# Design System: Terrano

## Overview

**Creative North Star: "Cooperativa contemporânea"**

A identidade compartilhada usa canvas sálvia, superfícies brancas, verde floresta e DM Sans. O usuário confirmou preservar essa identidade e melhorar a organização tanto para o trabalho diário de funcionários quanto para análise e gestão. Esta extração descreve a implementação; não transforma a composição de uma tela em regra global.

O [guia humano principal](../docs/design/cooperativa-unificada.md) mantém direção e vínculos por módulo. As fontes efetivas são `src/styles/cooperativa-theme.css`, `src/financeiro/financeiro-theme.css`, `src/styles/base.css`, `src/components/sidebar-clara.css`, `src/pecuaria/rebanho/rebanho-layout.css` e primitivas em `src/components/ui/`. Código, captura antiga e mockup não equivalem a homologação.

**Key Characteristics:**

- Paleta rural discreta e superfícies claras.
- Hierarquia por tipografia, proximidade e divisórias.
- Componentes compartilhados com estados acessíveis.

## Colors

### Primary

Verde floresta identifica ações principais, seleção e foco. O botão primitivo usa a cor principal a 90% no hover; o tema também declara um token de hover para consumidores específicos.

### Neutral

Canvas quase neutro com gradiente estático entre branco frio e sálvia; a lateral sálvia mais definida enquadra painéis brancos opacos. O gradiente fica somente no fundo compartilhado, sem animação e sem aparecer na impressão. Superfícies secundárias e divisórias usam cinzas discretos; cabeçalhos de diálogos e rodapés de receitas ficam brancos. Texto principal, texto secundário e divisórias têm papéis próprios. Borda de campo tem maior contraste que borda de painel. Verde identifica ação, seleção e sucesso; vermelho indica erro ou ação destrutiva. Encerrar ocorrência usa hover neutro; anular usa perigo.

## Typography

DM Sans é a família efetiva dos módulos autenticados, inclusive títulos com classe histórica de serifada. O corpo global do frontmatter convive com texto de controles e tabelas de 14px e metadados de 12px. Título de página reduz a 24px até 767px. Diálogos usam 22px, peso 600 e entrelinha 1.3. Valores de tabelas e indicadores usam números tabulares. O frontmatter distingue a hierarquia compartilhada das escalas legadas ainda existentes em base.css; registrar esses tamanhos não os aprova para novas composições nem afirma que toda a interface foi padronizada. Metadados de 11px também existem em detalhes. As divergências de tokens legados continuam passíveis de auditoria; não são ignoradas globalmente.

## Layout

Página compartilhada: padding de 24px e máximo de 1600px; Pecuária ocupa a largura disponível. Até 900px, padding de 56px no topo, 16px nas laterais e 32px embaixo. Cabeçalhos agrupam identidade e comandos, com quebra responsiva. Lateral expandida de 224px acima de 1100px; até 900px usa Sheet. Filtros ocupam largura integral até 767px.

Abas de Rebanho têm largura natural e quebram em linhas, sem rolagem horizontal. Tabelas mantêm células de 10px por 16px, cabeçalho de 40px e paginação adjacente. O escopo de Rebanho aplica controles de 40px no desktop e 44px até 900px, intervalo comum de 16px e painéis de 12px. Fora desse escopo continuam os estilos compartilhados e exceções legadas; não há padronização retroativa implícita.

A navegação compartilhada por abas usa texto de 16px, ícones de 20px quando presentes e alvos de pelo menos 48px. Páginas de consulta apresentam título e descrição curta da finalidade, seguidos pelas abas quando existentes. Ações gerais ficam à direita do cabeçalho e quebram de linha em telas estreitas. Fichas mantêm o nome do registro e formulários identificam a tarefa. Ciclos/Tarefas preserva a aparência de botões.

No Rebanho, cabeçalho e navegação permanecem durante a carga. Descrições genéricas que apenas repetiam o título foram retiradas. Animais apresenta cabeçalho, navegação, busca/filtros e tabela, sem resumo de indicadores ou alternância de composição. Lotes apresenta tabela e histórico, sem gráfico repetido. A ficha do lote abre em Animais; suas sete abas são Resumo, Animais, Baixas, Movimentações, Sanidade, Nutrição e Alterações. Métricas e período de GMD pertencem somente a Resumo. Os fragmentos históricos `#lote-*` continuam reconhecidos. Essas são composições específicas do domínio, não um modelo universal de dashboard.

## Elevation & Depth

Painéis compartilhados têm borda e nenhuma sombra. Diálogos mantêm sombra e overlay. O token de sombra suave de painel ainda existe, mas o seletor compartilhado de cartões aplica sombra nenhuma. Valores de profundidade estão no sidecar.

## Shapes

Controles têm cantos suavizados, painéis raio maior (com variante de 12px no Rebanho) e badges formato de cápsula. Sheet tem arestas retas. Abas têm contorno discreto, cantos superiores de 8px e intervalo de 4px. A selecionada é branca e conectada à superfície de conteúdo; as inativas têm fundo neutro. `src/styles/abas.css` é o estilo comum à variante `pasta` de TabsList e às navegações nativas. Ciclos/Tarefas conserva a aparência de botões. Os raios não obrigam envolver cada agrupamento em cartão.

## Components

- **Botões:** default, outline, secondary, ghost, destructive e link na primitiva. Anel de foco de 2px; desativado reduz opacidade e bloqueia ponteiro. Tema compartilhado aplica altura mínima de 40px e 44px até 767px, com exceções explícitas; Rebanho amplia o controle móvel até 900px.
- **Campos:** superfície branca, borda de controle, inválido com borda de perigo, desativado tonalizado. Inputs e áreas de texto usam 16px até 900px. Select compartilha busca, popup e teclado.
- **Cartões:** superfície, borda e raio compartilhados; padding depende do consumidor. A primitiva Card usa 24px.
- **Navegação:** lateral tonalizada com colapso, seleção e Sheet móvel; fundo uniforme. A mudança de rota abre o grupo da área atual e recolhe os demais; o acionamento manual dos títulos continua disponível. Trabalhos ativos aparece somente quando existe rascunho ou relatório retomável, sem atalho de criação vazio. Abas conservam semântica e foco Radix.
- **Badges:** cápsulas compactas com variantes existentes, sem substituir texto de situação.
- **Fichas do Rebanho:** seções centrais usam SecaoFicha, com títulos diretos e sem controle de recolher. Evidências auxiliares por registro ainda podem expandir. A ficha animal separa Resumo, Cadastro, Histórico, Reprodução, Sanidade e Nutrição e dispensa ilustração genérica; peso atual aparece somente no resumo superior, e os indicadores de GMD conservam definições distintas, agrupando o resultado somente quando utilizam a mesma base de duas pesagens.
- **Cadastro de animal:** modo de compra é contexto fixo, sem campo Origem desativado repetido. Campos ficam no formulário, com salvar/cancelar no rodapé, sem sidebar de revisão duplicada.
- **Cabeçalhos e tabelas:** reutilizar PageHeader, CabecalhoTabela, SubTabs e TabelaFinanceira antes de criar variantes.

## Do's and Don'ts

### Do:

- **Do** reutilizar tokens e primitivas existentes, incluindo portais Radix.
- **Do** aproximar rótulos, números e contexto e conservar números tabulares.
- **Do** preservar foco visível e estados de carregamento, falha e ausência.
- **Do** manter as seções centrais diretamente legíveis, reservando expansão a evidências auxiliares por registro.

### Don't:

- **Don't** tratar a captura antiga ou o mockup da conversa como nova direção aprovada.
- **Don't** aplicar a família serifada global aos módulos que usam DM Sans.
- **Don't** duplicar contratos funcionais neste documento visual.

## Superfícies operacionais

Rebanho, Sanidade e Nutrição usam o canvas sálvia como contexto e superfícies brancas para agrupar dados relacionados. Cor de estado não substitui o texto e não deve colorir indiscriminadamente todos os blocos. Ações frequentes ficam diretamente no contexto; controles secundários e evidências excepcionais podem abrir menus ou detalhes. Um título identifica cada agrupamento, sem repetir o título da aba e o do componente interno. Informações de cadastro e auditoria têm seções próprias. A visão geral financeira permanece a referência aprovada e não foi redesenhada nesta revisão.
