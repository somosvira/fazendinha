---
name: Terrano — Cooperativa contemporânea
description: Identidade compartilhada da interface de gestão rural
colors:
  primary: "#006f68"
  brand-accent: "#009c91"
  sidebar-selected: "#2f7570"
  sidebar-selected-ink: "#ffffff"
  canvas: "#f7f8fa"
  canvas-light: "#fcfdfe"
  canvas-sage: "#edf5f4"
  canvas-end: "#f7f8fa"
  sidebar: "#dce8e5"
  nav-hover: "#cfe0dc"
  nav-selected: "#c5ded8"
  surface: "#ffffff"
  surface-subtle: "#f1f5f4"
  heading: "#203c39"
  text: "#263e3b"
  text-muted: "#526863"
  border: "#dfe7e5"
  table-header: "#e2e7ea"
  table-heading: "#34434b"
  table-rule: "#bdc8cf"
  filter-bg: "#e0efec"
  filter-border: "#80b4ac"
  filter-hover: "#cee5e0"
  tag-bg: "#eef1f3"
  tag-text: "#425563"
  tag-border: "#d9e1e6"
  status-positive-bg: "#ddf3e1"
  status-positive-text: "#246a36"
  status-danger-bg: "#fce1df"
  status-danger-text: "#a3312a"
  table-hover: "#edf5f3"
  control-border: "#7a928d"
  positive: "#32683b"
  danger: "#8d3931"
  warning: "#775930"
typography:
  headline:
    fontFamily: '"Manrope", "DM Sans", sans-serif'
    fontSize: "32px"
    fontWeight: 750
    lineHeight: 1.2
  title:
    fontFamily: '"Manrope", "DM Sans", sans-serif'
    fontSize: "18px"
    fontWeight: 750
    lineHeight: 1.4
  body:
    fontFamily: '"DM Sans", "Helvetica Neue", Helvetica, Arial, sans-serif'
    fontSize: "17px"
    fontWeight: 500
    lineHeight: 1.5
  control:
    fontSize: "14px"
    fontWeight: 500
  tag:
    fontSize: "13px"
    fontWeight: 500
  metadata:
    fontSize: "12px"
  compact-metadata:
    fontSize: "11px"
  field-mobile:
    fontSize: "16px"
  dialog-title:
    fontSize: "22px"
    fontWeight: 750
    lineHeight: 1.3
  responsive-headline:
    fontSize: "26px"
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
  tag: "6px"
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

A identidade compartilhada usa canvas neutro quase branco com gradiente turquesa muito suave no topo direito, lateral cinza esverdeada, superfícies brancas, petróleo nas ações e turquesa nos detalhes. A direção petróleo/turquesa aprovada usa Manrope nos títulos, DM Sans na leitura operacional e sombras suaves com intensidade proporcional à elevação. Esta extração descreve a implementação; não transforma a composição de uma tela em regra global.

O [guia humano principal](../docs/design/cooperativa-unificada.md) mantém direção e vínculos por módulo. As fontes efetivas são `src/styles/cooperativa-theme.css`, `src/styles/identidade-rural.css`, `src/financeiro/financeiro-theme.css`, `src/styles/base.css`, `src/components/sidebar-clara.css`, `src/pecuaria/rebanho/rebanho-layout.css` e primitivas em `src/components/ui/`. Código, captura antiga e mockup não equivalem a homologação.

**Key Characteristics:**

- Paleta rural discreta e superfícies claras.
- Hierarquia por tipografia, proximidade e divisórias.
- Componentes compartilhados com estados acessíveis.

## Colors

### Primary

Petróleo identifica ações principais, seleção e foco; turquesa aparece nos detalhes da identidade. A seleção da sidebar usa petróleo e texto branco, enquanto a seleção de texto e superfícies auxiliares usam um tom claro. O botão primitivo usa a cor principal a 90% no hover; o tema também declara um token de hover para consumidores específicos.

### Neutral

Canvas neutro quase branco com gradiente estático turquesa muito suave no topo direito; a lateral cinza esverdeada enquadra painéis brancos opacos. O gradiente fica somente no fundo compartilhado, sem animação e sem aparecer na impressão. Superfícies secundárias e divisórias usam cinzas discretos; cabeçalhos de diálogos e rodapés de receitas ficam brancos. Texto principal, texto secundário e divisórias têm papéis próprios. Borda de campo tem maior contraste que borda de painel. Petróleo identifica ação e seleção; verde permanece como sinal de sucesso; vermelho indica erro ou ação destrutiva. Encerrar ocorrência usa hover neutro; anular usa perigo.

## Typography

Manrope variável (pesos 200–800) é hospedada em `public/fonts/manrope/`, sob SIL OFL, e usada nos títulos, sem substituir o símbolo Terrano. DM Sans permanece no corpo, tabelas, valores e controles. Os títulos usam peso 750 e tracking de -.02em; os títulos de página usam 32px. O corpo global do frontmatter convive com texto de controles e tabelas de 14px e metadados de 12px. Título de página reduz a 26px até 767px. Diálogos usam 22px, peso 750 e entrelinha 1.3. Valores de tabelas e indicadores usam números tabulares. O frontmatter distingue a hierarquia compartilhada das escalas legadas ainda existentes em base.css; registrar esses tamanhos não os aprova para novas composições nem afirma que toda a interface foi padronizada. Metadados de 11px também existem em detalhes. As divergências de tokens legados continuam passíveis de auditoria; não são ignoradas globalmente.

## Layout

Página compartilhada: padding de 24px e máximo de 1600px; Pecuária ocupa a largura disponível. Até 900px, padding de 56px no topo, 16px nas laterais e 32px embaixo. Cabeçalhos agrupam identidade e comandos, com quebra responsiva. Lateral expandida de 224px acima de 1100px; até 900px usa Sheet. Até 1100px, a busca ocupa uma linha própria; no celular os grupos de filtros ocupam linhas completas. Consultas compartilhadas trocam a tabela por cartões conforme a largura disponível e a soma das referências das colunas, preservando ações e seleção.

Abas de Rebanho têm largura natural e quebram em linhas, sem rolagem horizontal. Tabelas mantêm células de 10px por 16px, cabeçalho de 40px e paginação adjacente. O escopo de Rebanho aplica controles de 40px no desktop e 44px até 900px, intervalo comum de 16px e painéis de 12px. Fora desse escopo continuam os estilos compartilhados e exceções legadas; não há padronização retroativa implícita.

A navegação compartilhada por abas usa texto de 16px, ícones de 20px quando presentes e alvos de pelo menos 48px. Páginas de consulta apresentam título e descrição curta da finalidade, seguidos pelas abas quando existentes. Ações gerais ficam à direita do cabeçalho e quebram de linha em telas estreitas. Fichas mantêm o nome do registro e formulários identificam a tarefa. Ciclos/Tarefas preserva a aparência de botões.

No Rebanho, cabeçalho e navegação permanecem durante a carga. Descrições genéricas que apenas repetiam o título foram retiradas. Animais apresenta cabeçalho, navegação, busca/filtros e tabela, sem resumo de indicadores ou alternância de composição. Lotes apresenta tabela e histórico, sem gráfico repetido. A ficha do lote abre em Animais; suas sete abas são Resumo, Animais, Baixas, Movimentações, Sanidade, Nutrição e Alterações. Métricas e período de GMD pertencem somente a Resumo. Os fragmentos históricos `#lote-*` continuam reconhecidos. Essas são composições específicas do domínio, não um modelo universal de dashboard.

## Elevation & Depth

Painéis independentes usam sombra suave com deslocamento vertical, em `--fin-panel-shadow`; indicadores usam `--fin-shadow`. Menus e seletores usam `--fin-popover-shadow`, diálogos e painéis laterais usam `--fin-dialog-shadow`. Ações primárias usam `--fin-button-shadow`, sem elevar filtros selecionados, linhas de tabela ou controles desativados. Impressão remove sombras. Seções internas sem cartão conservam sua apresentação plana.

## Shapes

Controles têm cantos suavizados, painéis raio maior (com variante de 12px no Rebanho) e badges formato de cápsula. Sheet tem arestas retas nos fluxos que o utilizam. Mais filtros usa Dialog central de até 640px (760px em Animais), com título e ícone de filtros, duas colunas no desktop e uma no celular. Rótulos de 14px e campos de 44px mantêm alinhamento. O corpo é rolável e o rodapé branco conserva Limpar, Cancelar e Aplicar filtros; o rascunho só é aplicado ao confirmar. Abas têm contorno discreto, cantos superiores de 8px e intervalo de 4px. A selecionada é branca e conectada à superfície de conteúdo; as inativas têm fundo neutro. `src/styles/abas.css` é o estilo comum à variante `pasta` de TabsList e às navegações nativas. Ciclos/Tarefas conserva a aparência de botões. Os raios não obrigam envolver cada agrupamento em cartão.

## Components

- **Botões:** default, outline, secondary, ghost, destructive e link na primitiva. Anel de foco de 2px; desativado reduz opacidade e bloqueia ponteiro. Tema compartilhado aplica altura mínima de 40px e 44px até 767px, com exceções explícitas; Rebanho amplia o controle móvel até 900px.
- **Campos:** superfície branca, borda de controle, inválido com borda de perigo, desativado tonalizado. Inputs e áreas de texto usam 16px até 900px. Select compartilha busca, popup e teclado.
- **Cartões:** superfície, borda e raio compartilhados; padding depende do consumidor. A primitiva Card usa 24px.
- **Navegação:** lateral tonalizada com colapso, seleção e Sheet móvel; fundo cinza esverdeado com a paisagem rural existente na parte inferior, acima da conta, integrada por multiplicação. A mudança de rota abre o grupo da área atual e recolhe os demais; o acionamento manual dos títulos continua disponível. Trabalhos ativos aparece somente quando existe rascunho ou relatório retomável, sem atalho de criação vazio. Abas conservam semântica e foco Radix.
- **Badges:** situações e efeitos usam raio de 6px, texto de 13px e peso 500. Efeitos ficam em cinza azulado; confirmação usa verde e cancelamento usa vermelho, com fundo e texto próprios. Cor não substitui o rótulo.
- **Fichas do Rebanho:** seções centrais usam SecaoFicha, com títulos diretos e sem controle de recolher. Evidências auxiliares por registro ainda podem expandir. A ficha animal separa Resumo, Cadastro, Histórico, Reprodução, Sanidade e Nutrição e dispensa ilustração genérica; peso atual aparece somente no resumo superior, e os indicadores de GMD conservam definições distintas, agrupando o resultado somente quando utilizam a mesma base de duas pesagens.
- **Cadastro de animal:** modo de compra é contexto fixo, sem campo Origem desativado repetido. Campos ficam no formulário, com salvar/cancelar no rodapé, sem sidebar de revisão duplicada.
- **Cabeçalhos e tabelas:** reutilizar PageHeader, CabecalhoTabela, SubTabs e TabelaFinanceira antes de criar variantes. O acabamento em tela vive em `styles/tabelas-operacionais.css`: cabeçalhos de 48px com fundo cinza neutro #e2e7ea, rótulos de 14px em grafite #34434b e divisória #bdc8cf, texto de 14px, células com 12 × 16px, linhas mínimas de 64px nas consultas compartilhadas e hover integral. Filtros ativos no cabeçalho usam ícone petróleo com ponto indicador; hover e abertura usam cinza, conservando o título em grafite. Colunas distribuem a largura proporcionalmente às referências do domínio; a expansão de uma coluna é explícita. Cartões móveis e documentos mantêm suas estruturas.

## Do's and Don'ts

### Do:

- **Do** reutilizar tokens e primitivas existentes, incluindo portais Radix.
- **Do** aproximar rótulos, números e contexto e conservar números tabulares.
- **Do** preservar foco visível e estados de carregamento, falha e ausência.
- **Do** manter as seções centrais diretamente legíveis, reservando expansão a evidências auxiliares por registro.

### Don't:

- **Don't** tomar detalhes inventados por um mockup como contrato funcional ou substituir o logo existente.
- **Don't** aplicar a família serifada global aos módulos que usam DM Sans.
- **Don't** duplicar contratos funcionais neste documento visual.

## Superfícies operacionais

Rebanho, Sanidade e Nutrição usam o canvas claro como contexto e superfícies brancas para agrupar dados relacionados. Cor de estado não substitui o texto e não deve colorir indiscriminadamente todos os blocos. Ações frequentes ficam diretamente no contexto; controles secundários e evidências excepcionais podem abrir menus ou detalhes. Um título identifica cada agrupamento, sem repetir o título da aba e o do componente interno. Informações de cadastro e auditoria têm seções próprias. A visão geral financeira permanece a referência aprovada e não foi redesenhada nesta revisão.
