# Início — Home executiva da fazenda — Design

**Data:** 2026-07-21
**Origem:** feedback da fazenda (item 1) — *"O Dashboard poderia ter os dados do rebanho também, não só financeiro."*
**Status:** aprovado no brainstorming
**Diagnóstico relacionado:** [feedback-fazenda-2026-07-21-diagnostico.md](../../feedback-fazenda-2026-07-21-diagnostico.md), §5.1

---

## 1. Contexto e objetivo

Ao abrir o sistema, a usuária esperava uma **visão da fazenda toda**, mas a tela inicial é o Dashboard financeiro. O Painel do Rebanho existe, mas está a dois cliques e mostra o módulo inteiro, não um resumo.

Esta fatia entrega uma tela **"Início"**: uma home executiva que responde *"como a fazenda está hoje?"* em cinco segundos, reunindo o essencial de **rebanho + financeiro** com atalho para cada módulo.

**Não** substitui nem duplica telas: o Dashboard financeiro e o Painel do Rebanho continuam intactos. A Home resume e leva para eles.

## 2. Escopo

**Dentro:**
- Nova `Tab "inicio"` + item "Início" no topo da sidebar (acima do grupo GESTÃO).
- A Home vira a **tela inicial ao logar**.
- Deep-link `/inicio` (bidirecional em `router.ts`).
- Quatro blocos: saudação/cabeçalho, "Precisa de atenção", "Leite hoje", "Caixa".
- Reuso total dos endpoints existentes (`GET /api/dashboard`, `GET /api/rebanho/dashboard`).
- Respeita a propriedade ativa (multi-propriedade) como todas as telas.

**Fora (YAGNI / fatias futuras):**
- Outros módulos (plantio/café, corte, milho, equipe) — entram depois se provarem valor.
- Endpoint agregador novo — reusamos os dois que já existem.
- Gráficos pesados, personalização de cards, metas configuráveis.
- Redesenho do Dashboard financeiro.

## 3. Conceito

**Pergunta que a Home responde:** *"Como a fazenda está hoje?"* — um raio-x, não um centro de comando. Cada bloco é um **resumo com atalho**, nunca a tela inteira do módulo.

Ordem de cima para baixo (mais acionável primeiro):

1. **Cabeçalho** — "Fazenda \<propriedade ativa\> · \<data\>", saudação ao usuário. Discreto.
2. **Precisa de atenção** — reusa os `alertas` do rebanho, já ordenados por severidade (secagem atrasada, CCS alta, DG pendente…). Máx. 3–4; cada um leva à worklist correspondente. Vazio → "✓ Operação em dia".
3. **Leite hoje** — produção do dia (L), vacas em lactação, média/vaca, e um indicador de tendência. Atalho "Ver rebanho →" (`reb-dashboard`).
4. **Caixa** — saldo em caixa hoje + resumo do **último mês com dados** (entrada / saída / fluxo), rotulado com o mês (ex.: "mai/2026"). Isso respeita o atraso de ~2 meses do BPO sem a Home parecer "zerada". Atalho "Ver financeiro →" (`dashboard`).

## 4. Arquitetura (frontend)

Segue a forma dos módulos existentes.

```
client/src/inicio/
  InicioContent.tsx          # entrypoint: chama os 2 hooks, monta os 4 blocos
  components/
    AtencaoCard.tsx          # reusa alertas do rebanho (resumo)
    LeiteHojeCard.tsx        # resumo de produção
    CaixaCard.tsx            # saldo + último mês
  lib/
    inicioDerive.ts          # funções puras que extraem o recorte de cada payload
    inicioDerive.test.ts
```

- `InicioContent` recebe `onNav: (t: Tab) => void` (mesmo padrão dos módulos) e dispara a navegação dos atalhos.
- Os cards são pequenos e recebem apenas o resumo já derivado — fáceis de testar isoladamente.

## 5. Dados — reuso, zero backend novo

| Bloco | Fonte | O que extrai |
|---|---|---|
| Precisa de atenção | `GET /api/rebanho/dashboard` | `alertas` (já ordenados/severidade), top 3–4 |
| Leite hoje | `GET /api/rebanho/dashboard` | produção do dia, vacas em lactação, média/vaca, tendência |
| Caixa | `GET /api/dashboard` | saldo em caixa hoje + último mês com dados (entrada/saída/fluxo) |

- Ambos os endpoints já filtram por `X-Propriedade-Id` via `comPropriedade()`.
- A lógica de **"último mês com dados"** já existe no Dashboard financeiro (`ultimoMesComDados` em `components/Dashboard.tsx`). Extrair para uma função pura reutilizável em `lib` e reusar nos dois lugares (evita duplicar a heurística).

## 6. Estados

Cada card é independente e resiliente:
- **Loading:** skeleton no card.
- **Erro:** mensagem curta no próprio card ("Não foi possível carregar."), sem derrubar a tela nem os outros cards.
- **Vazio:** "Sem dados nesta propriedade ainda." (ex.: propriedade sem rebanho, ou mês sem lançamento).

Um card falhar/estar vazio **não quebra** os demais.

## 7. Navegação e tela inicial

- `Tab "inicio"` adicionada ao union em `components/Shell.tsx`.
- Item "Início" no **topo** do `AppSidebar` (novo grupo/seção acima de GESTÃO), ícone casa.
- `App.tsx`: monta `<InicioContent onNav={navegarTab} />`; usa `"inicio"` como aba inicial (substitui o default atual do Dashboard financeiro).
- `router.ts`: mapeia `inicio ⇄ /inicio`.
- Permissões: a Home só mostra o que o usuário já pode ver (rebanho é liberado; financeiro segue o gate existente — se o usuário não pode ver financeiro, o card de Caixa não aparece, em vez de dar erro).

## 8. Testes

- **Puros (`inicioDerive`)** — TDD: extrai leite/caixa/atenção do payload; payload vazio/nulo → resumo vazio sem quebrar; "último mês com dados" cobre o caso do mês corrente zerado.
- **Componentes** — cada card renderiza os números certos; estado vazio e de erro; atalho dispara `onNav` com a `Tab` correta.
- **Navegação** — `router.ts` ida-e-volta `inicio ⇄ /inicio`.
- **Visual** — no app real (Rio Novo): Home abre ao logar, mostra leite + caixa + atenção; atalhos levam às telas certas; troca de propriedade muda os números.

## 9. Critérios de sucesso

1. Ao logar, a primeira tela é "Início" e responde "como a fazenda está" sem rolagem no desktop.
2. Os números batem com o Painel do Rebanho e o Dashboard financeiro (mesma fonte).
3. Trocar a propriedade ativa muda os dados da Home.
4. Nenhum card derruba a tela ao falhar/estar vazio.
5. O Dashboard financeiro e o Painel do Rebanho permanecem inalterados.

## 10. Decisões deferidas

- Incluir outros módulos (plantio/corte/milho/equipe) na Home.
- Endpoint agregador `GET /api/visao-geral` (só se o reuso dos dois endpoints se mostrar insuficiente).
- Personalização/ordenação de cards, metas, gráficos de tendência mais ricos.
