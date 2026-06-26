# DESIGN.md — Sistema de Design Fazendinha

> **Documento de referência visual e de experiência.**
> Toda decisão de UI passa por este documento. Toda nova tela deve ser apresentável sem precisar de explicação verbal.

---

## Sumário

1. [Princípios](#1-princípios)
2. [Voz visual](#2-voz-visual)
3. [Paleta de cores](#3-paleta-de-cores)
4. [Tipografia](#4-tipografia)
5. [Espaçamento, grid e layout](#5-espaçamento-grid-e-layout)
6. [Cards e contêineres](#6-cards-e-contêineres)
7. [Botões](#7-botões)
8. [Badges, chips e pills](#8-badges-chips-e-pills)
9. [Ícones e indicadores](#9-ícones-e-indicadores)
10. [Acessibilidade](#10-acessibilidade)
11. [Estados (loading, empty, error, success)](#11-estados-loading-empty-error-success)
12. [Responsividade](#12-responsividade)
13. [Regras obrigatórias](#13-regras-obrigatórias)
14. [Antipadrões](#14-antipadrões)

---

## 1. Princípios

| Princípio | O que significa |
|---|---|
| **Editorial sobre dashboard** | A interface é mais parecida com um relatório impresso do *Economist* do que com um SaaS B2B comum. Há um leitor, uma hierarquia clara, espaço para respiro. |
| **Tipografia carrega o peso** | Hierarquia é construída por **fonte e tamanho**, não por cor saturada e bordas grossas. |
| **Cores significam coisas** | `--leite`, `--cafe`, `--outros`, `--neg`, `--pos` carregam significado de negócio. Nunca cor decorativa. |
| **Tabular números, sempre** | Todo número usa `font-variant-numeric: tabular-nums`. Alinhamento visual de cifras é não-negociável. |
| **Mais branco, menos linha** | Bordas finas e suaves (`--rule-soft`). Separação por espaço, não por traço. |
| **Densidade calibrada para 60+** | Nada de fontes 12px corpo. Lê-se em tablet a 60cm. |
| **Velocidade percebida** | Animações curtas (180ms). Loading discreto. Skeletons que se parecem com o conteúdo final. |

---

## 2. Voz visual

O Fazendinha quer parecer:

- Uma **carteira de investimentos premium** (Pimco, Berkshire) — séria, calma, números importantes.
- Uma **publicação editorial** (FT, Economist) — tipografia mista serif/sans, eyebrow uppercase, headings expressivos.
- **Não** quer parecer: gamificação, dashboards SaaS coloridos, glassmorphism, neon, telas escuras com gráficos roxos.

A sensação alvo: *"isso aqui foi feito com cuidado por gente que respeita meu tempo."*

---

## 3. Paleta de cores

Todas as cores estão em variáveis CSS em `client/src/styles/base.css`. **Nunca hardcode hex**.

### Fundo e superfícies

| Token | Hex | Uso |
|---|---|---|
| `--bg` | `#F2EDE2` | Fundo principal (paper) |
| `--bg-card` | `#FAF6EC` | Cards |
| `--bg-card-2` | `#F6F1E4` | Hover, contraste suave |
| `--rule` | `#D6CDB8` | Linhas/bordas padrão |
| `--rule-soft` | `#E5DDC9` | Linhas suaves |

### Texto

| Token | Hex | Uso |
|---|---|---|
| `--ink` | `#14191A` | Texto principal |
| `--ink-2` | `#3A4341` | Texto secundário |
| `--ink-3` | `#6B7370` | Texto terciário |
| `--ink-mute` | `#97A09C` | Labels, captions, muted |

### Masthead (header escuro)

| Token | Hex | Uso |
|---|---|---|
| `--mast-bg` | `#0E1311` | Fundo do masthead, da sidebar Rebanho |
| `--mast-ink` | `#E8DCC4` | Texto sobre masthead |

### Atividades / cores semânticas

| Token | Hex | Significado de negócio |
|---|---|---|
| `--leite` | `#B89A5C` | **Leite / receita** — brass quente |
| `--leite-soft` | `#EFE4C8` | Tag/fundo de leite |
| `--cafe` | `#5C3A1E` | **Café / custeio** — brown profundo |
| `--cafe-soft` | `#E5D5C0` | Tag/fundo de café |
| `--outros` | `#6B7A5C` | **Outros / investimento** — sage olive |
| `--outros-soft` | `#DDE2D0` | Tag/fundo de outros |

> **Regra:** ao representar atividade (leite, café, outros), **sempre** usar essas variáveis. Toda nova atividade categórica precisa de cor própria definida em `base.css`.

### Sinais

| Token | Hex | Uso |
|---|---|---|
| `--pos` | `#3D5A3D` | Positivo (lucro, melhora) — moss |
| `--neg` | `#7A3328` | Negativo (prejuízo, alerta) — oxblood |
| `--warn` | `#8A6A20` | Aviso, atenção — dourado |

### No domínio Rebanho

- **Reprodução** → tag `--cafe-soft` (background) com `--cafe` (texto).
- **Sanidade** → vermelho suave (`#EEDAD3`) com `--neg` (texto).
- **Nutrição** → `--outros-soft` com `--outros`.
- **Produção** → `--leite-soft` com `--leite`.

---

## 4. Tipografia

### Fontes

| Família | Tipo | Uso |
|---|---|---|
| **Newsreader** | Serif | Headings, números grandes, citações, eyebrow editorial |
| **DM Sans** | Sans | Body, labels, navegação, eyebrows curtas |

Carregadas via Google Fonts em `client/index.html`. Não bundlar.

### Hierarquia

| Classe | Tamanho | Família | Uso |
|---|---|---|---|
| `.h-display` | 64px | Newsreader 500 | Hero de relatório |
| `.h1` | 36px | Newsreader 500 | Título da página |
| `.h2` | 24px | Newsreader 500 | Subseção |
| `.h3` | 14px UPPER | DM Sans 500, letter-spacing 0.04em | Label de seção |
| `.body-l` | 18px | DM Sans 400 | Parágrafo destaque |
| `.body` | 16px | DM Sans 400 | Parágrafo padrão |
| `.body-s` | 14px | DM Sans 400 | Texto secundário |
| `.caption` | 12px | DM Sans 500, letter-spacing 0.02em | Caption, footnote |
| `.eyebrow` | 11px UPPER | DM Sans 500, letter-spacing 0.18em | Categoria/seção pequena |

### Números

```css
font-variant-numeric: tabular-nums;
font-feature-settings: "tnum", "ss01";
```

Aplicar em **todos os KPIs**, totais, percentuais, datas. Existe a classe utilitária `.tabular` em `base.css`.

### Tamanho corpo elevado (acessibilidade)

`client/src/styles/typescale.css` é carregado **por último** e amplia o corpo (`.body` 17px → 19px, `.body-s` 14px → 15px). **Não remover.**

> Quando criar uma página nova, prefira a classe semântica (`.h2`, `.body`) em vez de tamanho inline. O override de acessibilidade só funciona via classes.

---

## 5. Espaçamento, grid e layout

### Escala de espaçamento

Múltiplos de **4px**:

`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80`

Sempre que possível, usar `clamp()` para responsividade fluida:

```css
padding: clamp(20px, 3vw, 36px);
gap: clamp(16px, 2vw, 28px);
```

### Largura máxima

| Container | Max-width |
|---|---|
| `.shell` | 1440px |
| `.shell-wide` | 1520px |
| `.rb-main` (rebanho) | 1520px com padding `clamp(24px, 4vw, 56px)` |

### Sidebars

- Sidebar fixa do Rebanho: `var(--side-w)` (222px).
- Em mobile (`max-width: 900px`), vira off-canvas.

### Grid editorial

`.report-meta` usa grid `auto 1fr` para alinhar título + meta lateral. O `ReportHeader` em `Shell.tsx` segue isso.

### Border-radius

| Token | Valor | Uso |
|---|---|---|
| (cards) | 10px | Cards padrão |
| (botão) | 6px | Botões |
| (pill) | 999px | Chips, pills, badges arredondados |

Evitar `border-radius: 0` (corte abrupto) e radius > 16px (parece app de banco). Sempre intermediário.

---

## 6. Cards e contêineres

### Tipos de card

1. **Pull-quote / editorial card** — `.rb-ia-band`, `.rb-ia-card`
   ```
   border-left: 1px solid var(--leite);
   padding: 6px 0 6px 18px;
   font-family: Newsreader; font-style: italic;
   ```
   Para citações, insights IA, frases editoriais.

2. **Solid box / KPI card** — `.rb-box`
   ```
   background: var(--bg-card);
   border: 1px solid var(--rule-soft);
   border-radius: 10px;
   padding: 15px 16px;
   ```
   Para conteúdo de KPI, tabelas resumo, lista de KV.

3. **Hover card** — `.rb-dcards > .card` (hover muda fundo para `var(--bg-card-2)`).

### KPI strip

`.rb-kstrip` é a faixa horizontal de KPIs no topo das telas:

```css
display: grid;
grid-template-columns: repeat(var(--cols, 5), 1fr);
gap: 0;
```

Cada `.rb-k`:
- Padding `6px 22px 4px`
- Border-left fina (`1px var(--rule-soft)`)
- Label uppercase pequena (eyebrow)
- Valor 28px serif `tabular-nums`
- Delta colorido (`--pos`, `--neg`, `--warn`)

### Estrutura padrão de seção

```jsx
<section>
  <h3 className="eyebrow">Reprodução</h3>
  <h2 className="h2">Aptas a inseminar</h2>
  <p className="body-s muted">28/mai/2026 – 30 vacas</p>
  <Card>...</Card>
</section>
```

Ordem visual: **eyebrow → h2 → contexto → conteúdo**.

---

## 7. Botões

### Variantes

| Classe | Aparência | Uso |
|---|---|---|
| `.rb-btn` | Border 1px, fundo transparente | Ação secundária |
| `.rb-btn.pri` | Fundo `--mast-bg`, texto `--mast-ink` | Ação primária |
| `.rb-btn` em destaque crítico | adicionar `color: var(--neg)` inline | Ações destrutivas |

### Tamanhos

- Padrão: padding `8px 14px`, font 14px.
- Compacto (dentro de tabelas): padding `4px 10px`.

### Hover

```css
background: var(--bg-card-2);
```

Sem mudança de cor de borda. Sem sombra.

### Estado disabled

```css
opacity: 0.4;
cursor: not-allowed;
```

Não escurecer o botão — só reduzir opacidade.

### Regras de uso

- **Uma ação primária por tela.** Múltiplos primários confundem.
- **Texto em verbo direto.** "Salvar", "Registrar evento", "Inseminar". Nunca "OK" ou "Confirmar" sozinhos.
- **Botão de cancelar** sempre como `.rb-btn` (secundário) à esquerda do primário.

---

## 8. Badges, chips e pills

### Chip (`.rb-chip`)

Maior, com label de status:

```jsx
<span className="rb-chip preg">Prenhe · 30 dias</span>
<span className="rb-chip lact">3ª lactação · DEL 145</span>
```

Cores via classe (`preg` → café-soft / café; `lact` → leite-soft / leite, etc.).

### Pill (`.rb-pill`)

Menor, inline com texto de tabela:

```jsx
<span className="rb-pill">apta · PEV</span>
<span className="rb-pill warn">CCS subindo</span>
```

Sem fundo (apenas border 1px) por padrão. Variantes adicionam fundo suave.

### ActivityPill

Componente exportado em `client/src/components/Gastos.tsx`:

```jsx
<ActivityPill kind="leite" />
<ActivityPill kind="cafe" />
<ActivityPill kind="outros" />
<ActivityPill kind="misto" />
```

Renderiza dot 6×6px + label. Cor via `var(--leite/--cafe/--outros)`. **Sempre usar este componente para atividade**, não recriar.

### Regras

- Pill **nunca** tem ação (não é botão). Para clicável, usar `<button class="rb-btn">`.
- Pill com fundo só quando carrega meaning forte (alerta, sucesso).
- Limite de pills por linha: **3**. Mais que isso, vira tag cloud (ruim).

---

## 9. Ícones e indicadores

### Filosofia

**Pouco ícone, muita palavra.** O produtor de 55 anos não decodifica iconografia abstrata bem. Quando usamos ícones:

- São **complementares**, não substituem texto.
- São **inline com texto** (mesma altura).
- Usam **caracteres Unicode** quando possível (`↗`, `↘`, `→`, `★`, `⚠`, `✓`).

### Indicadores comuns

| Símbolo | Significado |
|---|---|
| `↗` | Subindo (cor `--pos` ou `--neg` conforme contexto) |
| `↘` | Descendo |
| `→` | Estável |
| `★` | Score (5★ = elite) |
| `⚠` | Atenção (cor `--warn`) |
| `✓` | OK (cor `--pos`) |
| `—` | Sem dado / N/A |
| `≈` | Estimativa |

### Cuidados com cor + direção

**CCS subindo é ruim** (deve ser vermelho). **Produção subindo é bom** (verde). A flecha não carrega valor moral — o **contexto define a cor**.

---

## 10. Acessibilidade

### Contraste

- Texto principal sobre `--bg`: ratio ≥ 7:1.
- Texto sobre `--bg-card`: ratio ≥ 6:1.
- Pills com fundo: contraste ≥ 4.5:1.
- **Nunca** usar cor como único sinal — sempre combinar com texto ou ícone.

### Tamanho de toque

Áreas clicáveis ≥ **44×44px** (Apple HIG). Botões grandes, links bem espaçados.

### Foco visível

Outline custom em `:focus-visible`:

```css
outline: 2px solid var(--leite);
outline-offset: 2px;
```

Nunca `outline: none`.

### Navegação por teclado

- Tab atravessa toda tela em ordem lógica.
- Esc fecha modal.
- Enter ativa botão primário.

### Reduce motion

Animações respeitam `prefers-reduced-motion`. Modal pode aparecer sem slide.

### Tamanho de fonte

`typescale.css` (último import em `main.tsx`) garante body ≥ 17px. **Não recriar telas com font-size < 14px**.

---

## 11. Estados (loading, empty, error, success)

### Loading

Mostrar **frase curta**, não spinner perpétuo:

```
Carregando...
```

Em listas com estrutura prevista, usar **skeleton** com mesma altura/forma do conteúdo:

```css
background: var(--bg-card-2);
border-radius: 4px;
height: 14px;
animation: skeleton-pulse 1.2s ease-in-out infinite;
```

### Empty state

Nunca mostrar tabela vazia. Mostrar:

```
Ainda sem controles leiteiros.
[Registrar primeiro controle]
```

- Frase explica **por que está vazio**.
- CTA direciona a **próxima ação**.
- Border `1px dashed var(--rule)`, padding generoso, centralizado.

### Erro

```jsx
<div className="rb-empty" style={{ color: 'var(--neg)' }}>
  Não conseguimos atualizar agora. Tente em alguns segundos.
</div>
```

- **Nunca** mostrar stack trace, JSON, código de erro técnico.
- Linguagem amigável.
- Botão de retry quando aplicável.

### Sucesso

Modal de sucesso usa o pattern do `.rb-drawer.success`:
- Ícone SVG checkmark animado.
- Mensagem curta ("Salvo").
- Fecha automaticamente em 1.2s.

---

## 12. Responsividade

### Breakpoints

| Largura | O que muda |
|---|---|
| ≥ 1700px | Padding lateral aumenta (`clamp 40–96px`) |
| ≥ 1100px | Layout padrão (sidebar + main) |
| < 1100px | KPI 4 cols → 2 cols, padding lateral 24px |
| < 900px | Sidebar off-canvas; topbar mobile; grid 2 → 1 col |
| < 600px | Padding 12px; KPI 2 cols; modal `calc(100vw − 24px)` |

### Comportamento mobile

- Tabelas com scroll horizontal (não quebrar colunas).
- Modais ocupam quase toda largura.
- Sidebar abre com tap no botão hamburger.

### Tablet (foco do produtor)

iPad 10" / 11" é o **primeiro alvo**. Testar a 1180×820 pelo menos.

---

## 13. Regras obrigatórias

> Estas regras são **bloqueantes em PR**. Se uma das regras não estiver atendida, a mudança volta.

1. **Cores via `var(--token)`.** Nenhum hex inline.
2. **Tipografia via classe semântica** (`.h2`, `.body`) — não tamanho inline.
3. **Números com `tabular-nums`** — KPI, totais, percentuais.
4. **Componente reusado, não recriado.** Antes de criar um novo botão/card, conferir o catálogo (`COMPONENTS.md`).
5. **Estados completos.** Toda tela tem loading + empty + error definidos.
6. **Acessibilidade.** Contraste OK, foco visível, sem `outline: none`.
7. **Mobile testado.** A pelo menos 1180px e 720px.
8. **Termos do domínio em PT-BR.** "Vaca", "DEL", "CCS" — nunca "cow", "DIM", "SCC".
9. **Datas em formato BR** (`28/mai/2026`). Hora 24h.
10. **Reais como `R$ X,XX`** com `Intl.NumberFormat('pt-BR', { currency: 'BRL' })`.

---

## 14. Antipadrões

### Visuais

- ❌ Cards com sombra pesada (`box-shadow: 0 8px 24px rgba(0,0,0,0.4)`).
- ❌ Border-radius 16px+ (parece banco mobile).
- ❌ Gradientes coloridos no fundo.
- ❌ Charts com cores arco-íris.
- ❌ Iconografia abstrata sem rótulo (engrenagem, foguete, raios).
- ❌ Modal full-screen com fechamento escondido.
- ❌ Dark mode (sem demanda do produtor).
- ❌ Animações longas (> 250ms).

### Tipográficos

- ❌ ALL CAPS em corpo longo.
- ❌ Itálico para destaque (reservado para citação editorial).
- ❌ Mais de 2 tipos de tamanho na mesma tela.
- ❌ `text-align: justify` (quebra horrível em mobile).

### De copy

- ❌ "Submeter", "Entidade", "CRUD" — jargão de software.
- ❌ "Vaca não encontrada" — preferir "Nenhuma vaca corresponde a esse filtro".
- ❌ Frases longas. Manter ≤ 12 palavras.
- ❌ "Você" formal demais para o público — usar imperativos diretos.

### De comportamento

- ❌ Confirmação modal para ações reversíveis (criar uma anotação).
- ❌ Toast persistente.
- ❌ Salvamento automático **sem feedback**.
- ❌ Botão primário sem `disabled` quando o formulário é inválido.

---

## Referências cruzadas

- [`COMPONENTS.md`](./COMPONENTS.md) — catálogo de componentes prontos.
- [`PRODUCT.md`](./PRODUCT.md) — voz, tom, persona, dores.
- [`AI_RULES.md`](./AI_RULES.md) — como qualquer IA deve aplicar este design.
- Arquivos vivos: `client/src/styles/base.css`, `client/src/styles/typescale.css`, `client/src/rebanho/styles/rebanho.css`.
