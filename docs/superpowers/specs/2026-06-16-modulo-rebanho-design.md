# Módulo Rebanho — Design

**Data:** 2026-06-16
**Status:** aprovado no brainstorming, pronto pra virar plano de implementação
**Origem:** engenharia reversa do **Ideagri** (software comercial de gestão de rebanho leiteiro que o usuário tem acesso) + decisões de UI/IA novas.

---

## 1. Contexto e objetivo

A Rio Novo hoje tem o sistema **financeiro** (fazendinha). Este módulo abre uma **nova frente: gestão de rebanho leiteiro**, espelhando *como o Ideagri trata e armazena os dados*, mas com:

1. **UI muito superior** — nada do visual Delphi anos-2000; linguagem visual da própria fazendinha (editorial, terrosa).
2. **IA integrada** — uma aba de IA que responde qualquer pergunta sobre o contexto da fazenda e cospe insights/previsões ocasionais, **e** aparece de forma proativa dentro das telas.

O primeiro passo concreto é **replicar a ideia de 4 abas** (Animal, Reprodução, Sanidade, Nutrição) como protótipo navegável, no padrão de navegação escolhido.

---

## 2. Escopo

**Dentro do primeiro passo (protótipo):**
- Shell do módulo com **sidebar** de navegação.
- As 4 abas no padrão **nível-rebanho → ficha do animal** (abordagem C).
- A **ficha-cockpit do Animal** com timeline unificada.
- Telas de nível-rebanho com KPIs + work-lists + tabela.
- **Dados mock** (igual a fazendinha está hoje — backend não plugado).
- Cards de **IA proativa** embutidos (mock dos insights).

**Parte da visão, fora do primeiro passo:**
- Aba **Dashboard** geral e aba **IA/chat** completas (seguem o mesmo molde; mockadas depois).
- Backend real: schema Prisma/Postgres, rotas Hono, read-model materializado, jobs de recálculo.
- IA real (LLM sobre os dados), sincronização/offline, ações agênticas.

**Explicitamente não fazemos:** mexer no sistema financeiro existente; copiar o construtor de relatórios/SQL-no-banco do Ideagri; integrações de equipamento (Lely, CowManager, etc.).

---

## 3. Referência — como o Ideagri armazena (resumo)

Stack dele: Delphi VCL + **Firebird** local (388 tabelas) + WebView2 + ACBr (fiscal). Padrões observados (verificados no banco real `DADOS777.FDB`):

- **`ANIMAL`** = hub largo (86 colunas): identidade, genealogia auto-referente (`CDMAE`/`CDPAI`), classificação, ciclo de vida, + muitos campos-ponteiro de estado atual.
- **`REPRODUCAO`** = **tabela-evento polimórfica** (81 colunas) discriminada por `CDTIPOREPRODUCAO`: cio, IA, diagnóstico, parto — variantes esparsas no mesmo registro.
- **Span** (`DTINICIO`/`DTFIM`): `LACTACAO`, `DOENCAANIMAL`, `ANIMALPERIODO`.
- **Sanidade** = catálogo (`DOENCA`) → ocorrência (`DOENCAANIMAL`) → aplicação (`APLICACAOPRODUTO`, com **carência** e **lote do remédio**).
- **Nutrição** no nível do **lote** (`ALIMENTACAOLOTE`), não por animal; `DIETA` como receita.
- **Dashboard** = motor configurável (`DASHBOARDITEM` + `DASHBOARDTOTAL.COMANDOSQL` guarda **SQL cru no banco**) lendo **read-models denormalizados** (`ANIMALINFO_PRODUCAO` ~70 col, `ANIMALINFO_REPRODUCAO` ~45 col) mantidos por procedures (`SP_PRODUCAO305`, `SP_PRODUCAOIEP`…).
- **IA "Rúmi"** mora no banco: `PROMPTSRUMI` (templates) + `RUMIACTIONPARAM`/`TOKEN` (ações agênticas).
- Cross-cutting: PK `CD<entidade>` + `IDUNICO` (GUID p/ sync) + auditoria `SYS$UI/DI/UU/DU`.

**Herdamos:** read-model pré-computado, trio catálogo→ocorrência→aplicação, carência+lote, nutrição por lote, biblioteca de prompts.
**Melhoramos:** evento tipado + view de timeline (em vez de tabela de 81 colunas); enums em vez de code-table pra tudo; read-model explícito; SQL fora do banco.

---

## 4. Decisões de design (aprovadas)

### 4.1 Navegação: abordagem **C — híbrido (work-lists → ficha)**
- **Nível rebanho** de cada domínio = KPIs + IA proativa + **work-lists** ("quem inseminar / fazer DG / secar") + tabela.
- Clicar num animal → **ficha-cockpit** dele. Fecha o loop rebanho ⇄ animal.
- Bate com a rotina real (tarefas do dia) e dá profundidade por animal. A IA pluga nos dois níveis.

### 4.2 Shell: **sidebar escura à esquerda**
- ~222px, fundo `--mast-bg`, marca + **seletor de fazenda** no topo, nav vertical com ícones, botão **✦ Perguntar à IA** fixo, chip do usuário embaixo.
- Itens: Dashboard · Animal · Reprodução · Sanidade · Nutrição · IA.

### 4.3 Linguagem visual: a da **fazendinha**
- Paleta: creme `#F2EDE2`, cards `#FAF6EC`, tinta `#14191A`; atividades **brass `--leite`**, **café `--cafe`**, **sálvia `--outros`**, oxblood `--neg`.
- Tipografia: **Newsreader** (serif, displays) + **DM Sans** (sans, corpo).
- Cores por domínio na timeline: Reprodução=café · Sanidade=oxblood · Nutrição=sálvia · Produção=brass.

### 4.4 IA
- **Dentro das telas (proativa):** card de insight no nível rebanho ("concepção caiu 42%→31%, concentrada no reprodutor X") e na ficha ("CCS subindo 3 controles → risco de mastite subclínica"), com ações sugeridas.
- **Aba IA (dedicada):** chat sobre o contexto da fazenda + previsões/insights ocasionais. Munição vinda do read-model `ResumoAnimal` + biblioteca de prompts (inspirado no `PROMPTSRUMI`).

---

## 5. Modelo de dados

No protótipo isso são **tipos TypeScript** alimentando o mock; o schema Prisma espelha depois.

**Núcleo**
- **`Animal`** (hub enxuto): `id`, `numero`, `nome`, `brincoEletronico`, `sisbov`, `sexo`, `dataNascimento`, `dataEntrada`, `dataBaixa?`, `motivoBaixa?`, `categoria` (enum BEZERRA|NOVILHA|VACA|…), `raca`/`grauSangue`, genealogia `maeId?`/`paiId?`, `grupoAtualId`.
- **Evento** como conceito comum (alimenta a timeline). **Tabelas tipadas por evento** + uma **view de timeline** que faz `UNION` por animal. Campos comuns: `animalId`, `data`, `tipo`, `dominio`.
- **`ResumoAnimal`** (read-model, espelha `ANIMALINFO_*`): estado atual pré-computado — DEL, lactação atual, último DG, IEP, previsão de secagem, CCS recente, produção média, etc. Alimenta work-lists, KPIs, cockpit e IA.

**Por domínio**
| Domínio | Entidades |
|---|---|
| 🐄 Animal | `Animal`, `MovimentoGrupo` (lote/setor no tempo), `ResumoAnimal` |
| ❤️ Reprodução | eventos tipados `Cio`, `Inseminacao`, `DiagnosticoGestacao`, `Parto` (liga crias como novos `Animal`), `Secagem`; span `Lactacao` |
| 💉 Sanidade | `Doenca` (catálogo) → `OcorrenciaSanitaria` (span) → `AplicacaoProduto` (dose, **carência**, lote); `Exame`/`Resultado`; mastite/CCS |
| 🌾 Nutrição | `Dieta` (receita) + `DietaIngrediente`; `Arracoamento` por **lote**; `AlocacaoDieta` (lote↔dieta no tempo) |

---

## 6. Arquitetura, stack e onde vive

- **Reaproveita a stack da fazendinha:** React 18 + Vite + TS no front; (futuro) Hono + Prisma + Neon no back.
- **Novo módulo "Rebanho"** dentro do repo, com seu **próprio shell (sidebar)** e schema Postgres próprio — **não toca no financeiro**. Plataforma "Rio Novo" passa a ter duas frentes (Financeiro + Rebanho).
- **Protótipo = só front:** novas páginas/componentes em `client/src/` (área `rebanho/`), módulo de dados mock + tipos de domínio, navegável. Backend é trabalho futuro.
- Reusar formatadores e o design system existentes (`charts.tsx`, variáveis CSS de `base.css`) onde fizer sentido.

---

## 7. Componentes (unidades)

Cada unidade tem um propósito único e interface clara:

- **`RebanhoShell`** — sidebar + área de conteúdo + roteamento interno. *Depende de:* nada (casca). *Expõe:* slot de página + aba ativa.
- **`HerdDomainView`** (genérico, parametrizado por domínio) — faixa de KPIs + banda de IA + work-lists (tasks) + tabela. *Depende de:* `ResumoAnimal`/mock do domínio. *Expõe:* `onSelectAnimal(id)`.
- **`AnimalCockpit`** — header de identidade + faixa de estado (`ResumoAnimal`) + card de IA + **timeline unificada** + info-sidebar (estado/genealogia/produção). *Depende de:* `Animal` + eventos (timeline) + `ResumoAnimal`.
- **`Timeline`** — renderiza eventos heterogêneos com cor/tag por domínio, em ordem reversa. *Depende de:* lista de eventos normalizada.
- **`IaInsightCard` / `IaInsightBand`** — insight proativo + ações. *Depende de:* um "insight" mock.
- **`mock/` + `types/`** — fonte única dos dados de exemplo e tipos de domínio (espelha o papel do `data/rionovo.ts`).

---

## 8. Fluxo de dados (protótipo)

`mock (tipado)` → `HerdDomainView` lê `ResumoAnimal[]` filtrado por work-list → clique → `AnimalCockpit` lê `Animal` + `eventos[]` + `ResumoAnimal` → `Timeline` renderiza eventos. Insights de IA são objetos mock anexados ao domínio/animal. Nenhuma chamada de rede no passo 1.

Quando o backend entrar: rotas Hono espelham a forma do mock; `ResumoAnimal` vira tabela materializada recalculada por job/trigger; a view de timeline faz `UNION` dos eventos.

---

## 9. Plano do primeiro passo (resumo)

1. Casca `RebanhoShell` com sidebar + navegação entre as 4 abas.
2. Tipos de domínio + mock (1 fazenda, ~dezenas de animais, eventos plausíveis, `ResumoAnimal`).
3. `HerdDomainView` genérico; instanciar **Reprodução** primeiro (mais rica), depois Animal/Sanidade/Nutrição.
4. `AnimalCockpit` + `Timeline` (a tela-âncora).
5. `IaInsightCard/Band` mockados nos dois níveis.

---

## 10. Decisões em aberto (pra depois)

- Roteamento: react-router no módulo vs. estado de view (a fazendinha hoje usa `useState`); a sidebar + drill pede algo mais estruturado.
- Forma exata do `ResumoAnimal` (quais campos por domínio no primeiro corte).
- Como a aba de IA conversa com o resto (contexto que ela recebe; biblioteca de prompts).
- Quantos/quais animais e eventos no mock pra parecer real sem inflar.
