# COMPONENTS.md — Catálogo de Componentes

> **Catálogo vivo da UI do Fazendinha.**
> Antes de criar um componente novo, **busque aqui**. Componente paralelo = bug.

Convenções de leitura:

- **Path** é onde está implementado.
- **Props** sintetiza apenas o essencial. Veja a interface no arquivo para detalhe.
- **Quando usar / Quando não usar** é a parte mais importante.

---

## Sumário

1. [Layout e Shell](#1-layout-e-shell)
2. [Headers](#2-headers)
3. [Navegação](#3-navegação)
4. [KPI e indicadores](#4-kpi-e-indicadores)
5. [Cards e contêineres](#5-cards-e-contêineres)
6. [Tabelas](#6-tabelas)
7. [Formulários e inputs](#7-formulários-e-inputs)
8. [Botões](#8-botões)
9. [Badges, chips e pills](#9-badges-chips-e-pills)
10. [Gráficos](#10-gráficos)
11. [Timeline](#11-timeline)
12. [Drawers, modais e dialogs](#12-drawers-modais-e-dialogs)
13. [Estados (Loading, Empty, Error)](#13-estados-loading-empty-error)
14. [Animal Cockpit](#14-animal-cockpit)
15. [Formatadores](#15-formatadores)
16. [Diretrizes gerais](#16-diretrizes-gerais)

---

## 1. Layout e Shell

### `<Shell>` (implícito via `App.tsx` + `Masthead`)

- **Path:** `client/src/components/Shell.tsx`
- **Função:** define o tipo `Tab` da aplicação; exporta `Masthead` e `ReportHeader`.
- **Tabs financeiros:** `dashboard`, `gastos`, `lancar`, `plano`, `ia`, `relatorio`.
- **Tabs rebanho:** `reb-dashboard`, `reb-animal`, `reb-reproducao`, `reb-sanidade`, `reb-nutricao`, `reb-producao`, `reb-estoque`, `reb-custo`, `reb-ia`.
- **Tabs auxiliares:** `config`, `cadastros`, `acessos`.

### `<Masthead>`

- Header escuro fixo (`--mast-bg`).
- Mostra 6 abas financeiras + chip do usuário ("Marco Antônio") + logout.
- **Quando usar:** no topo de qualquer página financeira.
- **Quando NÃO usar:** páginas embedadas (demo, print).

### `.rb-side` (legado visual do Rebanho)

- **Path CSS:** `client/src/rebanho/styles/rebanho.css`
- **Função:** mantém tokens e estilos usados pelas telas do Rebanho; não é mais
  a navegação global ativa.
- **Width:** `var(--side-w)` (222px).
- **Estado ativo:** classe `.navi.on` com border-left `--leite` e font-weight 600.

---

## 2. Headers

### `<ReportHeader>`

- **Path:** `client/src/components/Shell.tsx`
- **Função:** cabeçalho editorial com eyebrow + h1 + meta lateral + `DateRangePicker` opcional.
- **Props:**
  - `eyebrow: string` — texto pequeno acima do título.
  - `title: string` — título serif grande.
  - `meta?: ReactNode` — coluna direita (período, contexto).
  - `range?: DateRange` — quando passado, renderiza picker.
- **Quando usar:** topo de Dashboard, Gastos, Relatório, Plano.
- **Quando NÃO usar:** dentro de cards, dentro do Rebanho (que usa header próprio `.rb-head`).

### `.rb-head` (Header de tela de Rebanho)

- **Path CSS:** `rebanho.css`
- **Função:** cabeçalho compacto com h1 + chips de contexto + botões de ação.
- **Estrutura:**
  ```jsx
  <header className="rb-head">
    <h1>Vaca #1234 — Jurema</h1>
    <span className="rb-chip preg">Prenhe · 30 dias</span>
    <span className="rb-chip lact">3ª lactação · DEL 145</span>
    <button className="rb-btn">Registrar evento</button>
    <button className="rb-btn pri">Editar</button>
  </header>
  ```

---

## 3. Navegação

### `<DateRangePicker>`

- **Path:** `client/src/components/DateRangePicker.tsx`
- **Função:** seletor de período pt-BR com calendário duplo + 11 presets.
- **Presets:** Hoje, Últimos 7 dias, Últimos 30 dias, Este mês, Mês anterior, Q1/Q2 2026, YTD, 12 meses, Tudo.
- **Pin:** "Hoje" está fixado em 28/mai/2026 para casar com mocks Rio Novo. Quando dados reais entrarem, **trocar para `new Date()`**.
- **Quando usar:** Dashboard, Gastos, Relatório, qualquer tela com janela temporal.
- **Quando NÃO usar:** páginas de cadastro, ficha individual de animal.

### `<AppSidebar>`

- **Path:** `client/src/components/AppSidebar.tsx`
- **Função:** sidebar global organizada por áreas de trabalho, compartilhada no
  desktop e no drawer mobile.
- **Acesso rápido:** busca global visível, visão geral e novo lançamento quando
  autorizados.
- **Rotinas diretas:** Animais, Reprodução, Sanidade, Controle leiteiro,
  Nutrição, Lotes coletivos, Pesagens e Agronomia ficam em um clique. Leite e
  corte não são áreas diferentes: pertencem à única área **Pecuária**.
- **Rotinas secundárias:** itens menos frequentes ficam em “Mais opções”; o
  bloco abre automaticamente quando uma rota secundária está ativa e persiste
  a preferência no `localStorage`.
- **Permissão:** filtra as áreas usando `user.areas` e protege Equipe/Folha com
  `podeVerFolha`; `pecuaria` é a permissão canônica e as antigas `rebanho` e
  `gado_corte` são normalizadas por compatibilidade. As rotas continuam
  validadas pelo gate de `App.tsx`.

---

## 4. KPI e indicadores

### `.rb-kstrip` + `.rb-k`

- **Path CSS:** `rebanho.css`
- **Função:** faixa horizontal de KPIs.
- **Estrutura:**
  ```jsx
  <div className="rb-kstrip" style={{ '--cols': 5 }}>
    <div className="rb-k">
      <div className="rb-k-lbl">DEL</div>
      <div className="val">145</div>
      <div className="rb-ok">↗ estável</div>
    </div>
    ...
  </div>
  ```
- **Cols:** 2 a 6 via CSS variable `--cols`.
- **Quando usar:** primeira faixa de toda tela de domínio.
- **Quando NÃO usar:** para mostrar apenas 1 número grande (use hero do dashboard).

### `<RentabilidadeKpi>`

- **Path:** `client/src/rebanho/components/animal-cockpit/InsightsPanel.tsx`
- **Função:** card de lucro/margem do animal com sub-grid receita/custos/margem.
- **Cor da borda esquerda:** `--pos` (lucro), `--warn` (margem baixa), `--neg` (prejuízo).
- **Quando usar:** Animal Cockpit, painel de descarte sugerido.

### `<EficienciaGauge>`

- **Path:** `client/src/rebanho/components/animal-cockpit/InsightsPanel.tsx`
- **Função:** arco SVG semicírculo 0–100% com cor por faixa.
- **Quando usar:** percentil ou eficiência produtiva da vaca.

### Hero KPI (financeiro)

- **Path CSS:** `dashboard.css`
- **Função:** número gigante no topo (Newsreader 64px), com label e contexto.
- **Quando usar:** primeira coisa que o produtor vê em Dashboard.

---

## 5. Cards e contêineres

### `.rb-box` (Solid box)

```jsx
<div className="rb-box">
  <h3 className="eyebrow">Projeções</h3>
  <div className="rb-kv">
    <span>Produção 305d</span>
    <strong>8.900 L</strong>
  </div>
</div>
```

- Background `--bg-card`, border `1px var(--rule-soft)`, radius 10px.
- **Quando usar:** conteúdo estruturado (KV, lista, tabela compacta).

### `.rb-ia-card` / `.rb-ia-band` (Pull-quote editorial)

```jsx
<div className="rb-ia-band">
  <em>"CCS subiu em 3 controles consecutivos — alta probabilidade de mastite subclínica."</em>
</div>
```

- Border-left `--leite`, padding lateral, fonte Newsreader itálica.
- **Quando usar:** insight da IA, citação, frase de destaque.
- **Quando NÃO usar:** texto longo (perde a graça).

### `.rb-dcards` (Grid de cards)

```jsx
<div className="rb-dcards">
  <div className="card">...</div>
  <div className="card">...</div>
</div>
```

- Grid 2 colunas, hover muda fundo para `--bg-card-2`.
- **Quando usar:** Dashboard Rebanho (cards de domínios).

### `<Card>` (Financeiro)

- **Path:** componentes diversos em `client/src/components/` usam `.card` direto via CSS.
- Não há ainda um `Card` React abstrato. Se precisar de mais de 3 reusos, criar um.

---

## 6. Tabelas

### `.rb-tbl`

- **Path CSS:** `rebanho.css`
- **Padrão:**
  - Header: font Newsreader, peso 500, lowercase, border-bottom `--rule-soft`.
  - Rows: hover muda fundo para `--bg-card-2`.
  - Numbers: `tabular-nums` automaticamente.

```jsx
<table className="rb-tbl">
  <thead>
    <tr>
      <th>Animal</th><th>DEL</th><th>Status</th><th>Produção</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td className="rb-anm"><strong>Jurema</strong> <span>#1234</span></td>
      <td>145</td>
      <td><span className="rb-pill">Prenhe</span></td>
      <td>28 L/d</td>
    </tr>
  </tbody>
</table>
```

### Regras

- **Sem zebra-striping.** Linhas se separam por espaço, não por cor.
- **Sem linhas verticais** entre colunas.
- **Padding 8px 12px** por célula.
- **Limite de colunas:** 6 em desktop, 4 em tablet, 3 em mobile com scroll horizontal.

---

## 7. Formulários e inputs

### `.rb-fld`

- **Path CSS:** `rebanho.css`, `forms.css`
- **Padrão:** label italic Newsreader + input underline (border-bottom 1px).

```jsx
<label className="rb-fld">
  <span>Número do brinco</span>
  <input type="text" />
</label>
```

### Tipos suportados

| Tipo | Componente |
|---|---|
| Texto curto | `<input type="text">` em `.rb-fld` |
| Texto longo | `<textarea>` em `.rb-fld` |
| Select | `<select>` em `.rb-fld` |
| Data | `<input type="date">` em `.rb-fld` |
| Valor monetário | `<input>` + formatador `fmtMoneyExact` no blur |

### Validação visual

- Erro: borda `--neg`, mensagem abaixo em `--neg` font 12px.
- Sucesso: sem decoração (silenciosa).
- Required: `*` discreto após label.

### Form modal (`AnimalForm`, `EventoForm`, etc.)

- **Path:** `client/src/rebanho/components/AnimalForm.tsx`, `EventoForm.tsx`, etc.
- Patrão: modal centralizado (drawer) com campos espaçados, 2 botões no rodapé.
- **Quando usar:** ação CRUD que não merece página inteira.

---

## 8. Botões

| Classe | Variante | Uso |
|---|---|---|
| `.rb-btn` | Secundário (border 1px) | Cancelar, ações neutras |
| `.rb-btn.pri` | Primário (dark fill) | Ação principal |
| `.rb-btn` + `style={{color:'var(--neg)'}}` | Destrutivo | Excluir, dar baixa |

**Regras:**

- 1 primário por tela.
- Verbo no infinitivo ("Registrar evento", "Salvar baixa").
- `disabled` quando formulário inválido.

---

## 9. Badges, chips e pills

### `<ActivityPill>`

- **Path:** `client/src/components/Gastos.tsx`
- **Props:** `kind: 'leite' | 'cafe' | 'outros' | 'misto'`
- **Renderiza:** dot 6×6px + label.
- **Reuso:** `IA.tsx` importa daqui em vez de duplicar.

### `.rb-chip`

- Chip grande de status (preg, lact, vazia, alerta).
- Variantes: `.preg` (café), `.lact` (leite), `.alert` (neg).

### `.rb-pill`

- Pill pequeno inline para tabelas.
- Pode ter modifier `.warn`, `.ok`, `.alert`.

---

## 10. Gráficos

Todos em `client/src/components/charts.tsx` — **SVG inline próprio, sem dependência externa**.

### `<MonthlyFlowChart>`

- Barras stacked (leite + café + outros) + linha de fluxo.
- 760×320px, responsivo via viewBox.
- **Quando usar:** série temporal 12–23 meses.

### `<WaterfallChart>`

- Cascata: receita → custos → saldo.
- **Quando usar:** DRE simplificado, desmontagem de lucro.

### `<MiniBarChart>`

- Pequeno bar chart inline para KPIs (sparkline).
- **Quando usar:** dentro de KPI strip ou card pequeno.

### `<MonthlyTrendChart>`

- Linha de tendência mensal.
- **Quando usar:** evolução de 1 métrica única ao longo do tempo.

### `<Donut>`

- Donut chart para composição (% das categorias).
- **Quando usar:** breakdown de custos, mix de produção.

> **Regra:** se precisar de outro tipo de gráfico, **criar SVG próprio** seguindo o padrão. Não introduzir `recharts`/`d3` no bundle do produtor.

---

## 11. Timeline

### `.rb-tl` + `.rb-ev` (Timeline)

- **Path CSS:** `rebanho.css`
- **Renderização:** `<Timeline>` em `client/src/rebanho/components/Timeline.tsx`.
- **Estrutura:**
  ```jsx
  <div className="rb-tl">
    <div className="rb-ev reproducao">
      <div className="rb-ev-when">28/mai/2026</div>
      <div className="rb-ev-title">Diagnóstico de gestação — POSITIVO</div>
      <div className="rb-ev-meta">~30 dias · sêmen "Lance 884"</div>
    </div>
  </div>
  ```
- **Cores do dot por domínio:**
  - `.reproducao` → café
  - `.sanidade` → vermelho/`--neg`
  - `.nutricao` → sage/`--outros`
  - `.producao` → brass/`--leite`
- **Alerta:** classe `.alert` adiciona `⚠` no texto.
- **Marcador:** classe `.marker` para eventos-marco (parto, secagem).

**Quando usar:** ficha do animal, histórico de propriedade.

---

## 12. Drawers, modais e dialogs

### `.rb-drawer`

- **Path CSS:** `rebanho.css`
- **Função:** modal centralizado com overlay blurred.
- **Width:** `min(520px, 100vw − 32px)`.
- **Animação:** `rb-modal-in` 180ms (translate Y small).
- **Variantes:**
  - `.success` — checkmark SVG animado, auto-close 1.2s.
  - `.danger` — borda `--neg`, ação destrutiva.

```jsx
<div className="rb-drawer">
  <header>Registrar evento</header>
  <div className="rb-drawer-body">
    <label className="rb-fld">...</label>
  </div>
  <footer>
    <button className="rb-btn">Cancelar</button>
    <button className="rb-btn pri">Salvar</button>
  </footer>
</div>
```

### Regras

- **1 ação primária** no rodapé.
- **Esc fecha**.
- **Click fora fecha** (com confirmação se formulário sujo).
- **Foco no primeiro input** ao abrir.

### Quando usar drawer vs página

| Caso | Use |
|---|---|
| Lançar evento, controle, mastite | **Drawer** (rápido, contexto preservado) |
| Editar configuração ampla | **Página** |
| Confirmar ação destrutiva | **Drawer pequeno** |
| CRUD de cadastro com muitos campos | **Página** (cadastros têm rota própria) |

---

## 13. Estados (Loading, Empty, Error)

### Loading

```jsx
<div className="rb-empty">Carregando…</div>
```

### Empty

```jsx
<div className="rb-empty">
  <p>Ainda sem controles leiteiros para este animal.</p>
  <button className="rb-btn pri">Registrar primeiro controle</button>
</div>
```

`.rb-empty` — border 1px dashed, padding generoso, centralizado.

### Erro

```jsx
<div className="rb-empty" style={{ color: 'var(--neg)' }}>
  Não conseguimos atualizar. Tente em alguns segundos.
</div>
```

### Sucesso

Modal padrão `.rb-drawer.success` com checkmark.

---

## 14. Animal Cockpit

Painel executivo da ficha do animal, montado por 10 sub-componentes em `client/src/rebanho/components/animal-cockpit/InsightsPanel.tsx`:

| Componente | O que mostra |
|---|---|
| `ScoreBadge` | Estrelas (★) + classificação (Elite / Muito Boa / Boa / Atenção / Descarte) |
| `RentabilidadeKpi` | Lucro / receita / custos / margem |
| `Tendencias` | Lista de tendências com seta colorida |
| `Insights` | Alertas com `⚠` ou `✓` |
| `Percentis` | Barras horizontais comparando com pool |
| `ProducaoFinanceira` | KV: acumulado, valor, preço/L, lucro/L |
| `EficienciaGauge` | Arco SVG 0–100% |
| `Projecoes` | Estimativas (P305, receita projetada, data secagem/parto) |
| `Genealogia` | Grid 2 cols pais/avós, botões navegáveis |
| `Timeline` | (compartilhado) |

> Estes componentes **só fazem sentido juntos**. Não exportar isolado para outras telas.

---

## 15. Formatadores

Todos em `client/src/components/charts.tsx`. **Reusar daqui**, não recriar:

| Função | Saída | Uso |
|---|---|---|
| `fmt(n, { decimals, showSign })` | `'1.234,5'` | Número genérico |
| `fmtBR(n)` | `'1.234'` | Inteiro pt-BR |
| `fmtMoney(kThousands, { compact })` | `'R$ 248 mil'` ou `'R$ 1,24 mi'` | Resumos |
| `fmtMoneyExact(val)` | `'R$ 1.234,56'` | Detalhe contábil |

### Datas

```ts
new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  .format(new Date('2026-05-28'))
// → '28 de mai. de 2026' (mas usamos '28/mai/2026')
```

Convencionar `DD/mmm/YY` em headers, `DD/MM/YYYY` em tabelas longas.

---

## 16. Diretrizes gerais

### Antes de criar um componente novo

1. **Busque por classe CSS** em `base.css`, `rebanho.css`, `forms.css`. Talvez exista.
2. **Busque por componente** em `client/src/components/` e `client/src/rebanho/components/`.
3. **Pergunte:** é variante de algo existente? Extensão é melhor que duplicação.
4. **Se for criar:** colocar perto de quem usa (não em uma "ui/" abstrata) e documentar aqui na próxima PR.

### Convenções de nome

- Componentes React: PascalCase, em PT (`AnimalCockpit`, `ReproducaoTab`).
- Classes CSS: kebab-case com prefixo de módulo (`.rb-`, `.shell-`).
- Variáveis CSS: kebab-case com `--` e prefixo semântico (`--leite`, `--ink-2`).

### Limites

- Componente com **> 200 linhas** começa a cheirar mal. Quebrar.
- Componente com **> 6 props obrigatórias** está acoplado demais.
- Estado local em vez de prop drilling. Se passar de 3 níveis, considere contexto.

### Anti-componentes

- ❌ "Generic" `Box`, `Container`, `Wrapper` que aceitam qualquer coisa. Faça um específico.
- ❌ Componente de "ícone genérico" que carrega 20 SVGs. Coloque o SVG inline onde for único.
- ❌ HOC de loading/error. Use renderização condicional simples.

---

## Referências cruzadas

- [`DESIGN.md`](./DESIGN.md) — tokens, princípios visuais.
- [`AI_RULES.md`](./AI_RULES.md) — como IAs devem usar este catálogo.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — onde cada componente encaixa no fluxo.
