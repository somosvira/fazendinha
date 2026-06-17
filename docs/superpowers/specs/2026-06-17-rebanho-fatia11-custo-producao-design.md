# Fatia 11 — Custo de Produção (quebra do custo real) — Design

**Data:** 2026-06-17
**Status:** aprovado no brainstorming — opção **"quebra do custo real, sem divisor quebrado"** (descobri uma incompatibilidade de escala; ver §2).
**Origem:** 2ª metade do "fechar o loop". **Depende de:** Fatia 10 (ponte), Estoque (custo vaca/dia), Produção.

---

## 1. Objetivo

Aba **Custo de Produção** (grupo Rebanho) que entrega o **insight real**: para onde vai o custo do leite (custeio por componente, do `Lancamento` real) + custo vaca/dia (Estoque). Mostra os componentes reais sem inventar um custo/litro errado.

## 2. O obstáculo que define o escopo (catalogado)
A **produção** no banco é o **seed de demonstração** (8 vacas, ~185 L/dia). O **financeiro** (`Lancamento`) é a **fazenda real inteira** (~148 vacas, custeio do leite em R$ milhões/ano). Dividir um pelo outro dá ~R$ 50/litro (custo da fazenda toda ÷ produção de 8 vacas) — sem sentido. Os litros reais da fazenda inteira **não existem no banco** (o "39 mil L" do dashboard é mock).
**Decisão:** não mostrar um custo/litro com divisor quebrado. Mostrar os dois lados reais (custeio do leite + custo vaca/dia) com transparência, e marcar o custo/litro como **pendente de produção em escala real**.

## 3. Modelo de dados
**Nenhuma mudança de schema.** Esta fatia só **lê** `Lancamento` (real), `ResumoAnimal`/Produção e `MovimentoEstoque` (Estoque).

## 4. Agregação (pura + Prisma)

**Função pura (TDD)** `quebrarPorCategoria(itens: {categoria: string; valor: number}[]) → { total: number; linhas: {categoria, valor, pct}[] }` — soma por categoria, ordena desc, calcula `pct` sobre o total (0 se total 0). Testável sem Prisma.

**Service `custo-producao.ts`** `agregarCustoProducao(meses = 12)`:
1. **Custeio do leite (real):** `prisma.lancamento.findMany` com os mesmos filtros do `buildDashboard` (`situacao=LIQUIDADO`, `estornado=false`, `dataLiquidacao` nos últimos `meses` meses) **e** `natureza=DEBITO` **e** `centroCusto.nome = "Atividade Leiteira"`. Mapeia `{categoria: nome, valor}` → `quebrarPorCategoria`. (Mostra "Animal Aquisição" como linha se houver — o dashboard financeiro já sinaliza que deveria ser investimento; refino deferido.)
2. **Custo vaca/dia (real):** reutiliza `calcularCustoVacaDia()` do Estoque (consumo de insumo do seed ÷ vacas×dias).
3. **Litros do período (seed):** estimativa da produção — modo tanque: Σ `ProducaoLote.litros` no período; modo por vaca: `Σ producaoMediaDia (vacas em lactação) × diasDoPeríodo`. **Só para transparência** (não vira divisor de custo/litro).
4. Retorna:
```ts
{ periodoMeses, custeioLeiteTotal, breakdown: [{categoria, valor, pct}],
  custoVacaDia, vacasEmLactacao, litrosPeriodoEstimado,
  custoLitro: null,  // pendente — escalas incompatíveis (ver nota)
  nota: "Custo/litro real requer produção em escala da fazenda inteira; hoje a produção é demonstração (8 vacas)." }
```

## 5. API
- `GET /api/rebanho/custo-producao?meses=12` → o payload acima. `meses` default 12 (janela onde vive o dado financeiro real).
- Service em `services/rebanho/custo-producao.ts`; rota nova montada em `index.ts`.

## 6. Client
- **`CustoProducaoTab`** (grupo Rebanho, chave `reb-custo`, entre Estoque e IA):
  - **Headline:** **Custeio do leite** (total real do período) — o número grande.
  - **Quebra por componente:** tabela/barras (categoria · valor · %) — ração, pessoal, medicamento, energia… (dado real).
  - **KPIs ao lado:** custo vaca/dia (real, Estoque) · vacas em lactação · produção estimada (seed).
  - **Card de transparência:** explica que o **custo/litro real está pendente** de produção em escala real (mostra custeio real vs produção seed lado a lado, com a nota). Honesto, não mostra número quebrado.
- `api.ts`: `obterCustoProducao(meses?)` + `useCustoProducao()`.
- Sidebar: item **Custo** no grupo REBANHO (`Shell.tsx`/`AppSidebar.tsx`/`App.tsx`/`RebanhoContent.tsx`).

## 7. Testes
- **Motor (`quebrarPorCategoria`)** — TDD: lista vazia → total 0, linhas []; soma e ordena por categoria; pct correto; total 0 → pct 0.
- API smoke: `GET /custo-producao` retorna `custeioLeiteTotal` > 0 e um breakdown com "Ração"/"Pessoal - Salário"/etc.; `custoLitro: null` + nota.
- Client render smoke de `CustoProducaoTab`; navegador: aba mostra o custeio real + quebra + a nota de transparência.

## 8. Decisões deferidas
- Produção em escala real (destrava o custo/litro de verdade) · reclassificar "Animal Aquisição" como investimento na quebra · apontar o KPI do dashboard financeiro pra cá · período selecionável (UI) · custo por litro quando houver dados reais · multi-tenant.
