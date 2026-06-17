# Fatia 10 — Ponte: compra de insumo → lançamento financeiro — Design

**Data:** 2026-06-17
**Status:** aprovado no brainstorming ("os dois" — ponte + custo real; esta é a 1ª das duas fatias)
**Origem:** "fechar o loop do custo" — unir Estoque (rebanho) ao `Lancamento` (financeiro). Fatia 11 (Custo de Produção) vem depois.
**Depende de:** Fatia 9 (`MovimentoEstoque`), Fatia 8 (`Produto`, `ClienteFornecedor`).

---

## 1. Objetivo

Registrar uma **ENTRADA** (compra de insumo) no Estoque passa a gerar um **`Lancamento` financeiro real**, que entra no fluxo de caixa do dashboard financeiro (que já agrega todo `Lancamento` via `buildDashboard`). Comprar uma vez aparece nos dois módulos.

## 2. Contexto real (verificado)
- `Lancamento` real (6.704 linhas); `buildDashboard()` agrega — mas **não existe** caminho de *criar* lançamento pelo app.
- `CentroCusto`: **"Atividade Leiteira"** (ehInvestimento=false), "Plantio Café", "Atividade Leiteira - Investimento", etc.
- `Categoria`: "Ração", "Medicamento Animal", "Curral", "Pessoal - Salário"… (alvos reais para mapear produtos).
- `FechamentoMensal`: **0 linhas** hoje → o check de mês fechado fica implementado (correto pra produção) mas é no-op no estado atual.

## 3. Modelo de dados (`schema.prisma`)
- **`Produto`** ganha o vínculo com o plano de contas financeiro:
```prisma
  categoria      Categoria?   @relation(fields: [categoriaId], references: [id])
  categoriaId    Int?
  centroCusto    CentroCusto? @relation(fields: [centroCustoId], references: [id])
  centroCustoId  Int?
```
- **`MovimentoEstoque`** ganha o vínculo com o lançamento gerado:
```prisma
  lancamento    Lancamento? @relation(fields: [lancamentoId], references: [id])
  lancamentoId  Int?        @unique
```
- Relações inversas: `Categoria` += `produtos Produto[]`; `CentroCusto` += `produtos Produto[]`; `Lancamento` += `movimentoEstoque MovimentoEstoque?`. (Só aditivo — nada quebra no financeiro.)

## 4. Lógica da ponte (`services/rebanho/estoque.ts`)

No `registrarMovimento`, quando `tipo === "ENTRADA"` e `gerarLancamento !== false`:
1. Resolve `categoriaId`/`centroCustoId`: usa os do input; se ausentes, os do `Produto`. Se ainda assim faltar **qualquer um dos dois**, **não cria** lançamento (cria só o movimento) e retorna `{ lancamentoCriado: false, motivo: "produto sem categoria/centro de custo" }`.
2. **Fechamento:** se o mês de `data` está em `FechamentoMensal`, não cria e retorna `{ lancamentoCriado: false, motivo: "mês fechado" }`.
3. Cria o `Lancamento`: `natureza=DEBITO`, `valor=valorTotal`, `dataCompetencia=dataVencimento=dataLiquidacao=data`, `situacao=LIQUIDADO`, `categoriaId`, `centroCustoId`, `clienteFornecedorId = fornecedorId ?? null`, `descricao = "Compra: {produto.nome} ({quantidade} {unidade})"`.
4. Liga `MovimentoEstoque.lancamentoId`. Retorna `{ id, lancamentoCriado: true, lancamentoId }`.

No `excluirMovimento`: se o movimento tem `lancamentoId`, exclui também o `Lancamento` (checando fechamento; se o mês do lançamento estiver fechado, **não exclui** o movimento e lança erro com motivo). Como hoje não há fechamentos, o caminho normal exclui ambos.

> A ENTRADA continua válida sem categoria/centro de custo (gera só o movimento). O lançamento é um efeito colateral opcional/condicional, nunca bloqueia o registro de estoque.

## 5. API
- `registrarMovimento` agora aceita no input (Zod): `gerarLancamento?: boolean` (default true), `categoriaId?: number`, `centroCustoId?: number`. Retorna `{ id, lancamentoCriado, lancamentoId?, motivo? }`.
- **Selects do formulário:** `GET /api/rebanho/categorias` → `[{id,nome}]` e `GET /api/rebanho/centros-custo` → `[{id,nome,ehInvestimento}]` (listas simples do plano de contas, ordenadas). Service em `cadastros.ts` ou novo `financeiro-ref.ts`.
- Produto DTO (cadastros) passa a incluir `categoriaId`/`centroCustoId` (+ nomes) e o `produtoSchema` aceita os dois opcionais; `ProdutoForm` ganha os selects (para o produto carregar seu mapeamento default).

## 6. Client
- **`MovimentoForm`** (Estoque): no modo **ENTRADA**, mostra selects **Categoria** e **Centro de custo** (default = os do produto selecionado) + toggle **"Gerar lançamento financeiro"** (default ligado). Ao salvar, mostra feedback ("Lançamento gerado" ou o motivo de não ter gerado).
- **`ProdutoForm`** (Cadastros): ganha selects opcionais Categoria + Centro de custo (mapeamento contábil do produto).
- `api.ts`: `listarCategorias`/`listarCentrosCusto`; `MovimentoInput`/`ProdutoInput`/DTOs com os novos campos; o retorno de `registrarMovimento` expõe `lancamentoCriado`/`motivo`.

## 7. Seed
- Mapear os produtos semeados a categorias reais por nome: "Ração Lactação Alta"→Categoria "Ração"; "Mastijet"/"Antibiótico X"→"Medicamento Animal"; "Núcleo Mineral"→"Ração" (ou criar "Suplemento Mineral"? usar "Ração" pra simplificar) — e todos com `centroCusto` "Atividade Leiteira". As ENTRADAS semeadas passam a gerar lançamentos (idempotente: o seed limpa os lançamentos que ele criou — marcar via `descricao` prefixo "Compra:" ou rastrear pelo vínculo).

## 8. Testes
- Backend: lógica de resolução (input > produto > nenhum) e o gate de fechamento são testáveis numa função pura `resolverLancamentoDaEntrada(input, produto, mesesFechados)` → `{ deveCriar, categoriaId?, centroCustoId?, motivo? }` (TDD). Zod do movimento com os novos campos. API smoke: ENTRADA c/ produto categorizado → lançamento criado + aparece em `/api/dashboard`; ENTRADA sem categoria → `lancamentoCriado:false`; excluir → remove o lançamento.
- Client: render smoke do `MovimentoForm` com os selects; navegador: registrar compra → ver no Estoque e no dashboard financeiro.

## 9. Decisões deferidas
- Gastos/Lançar reais (seguem mock) · editar lançamento gerado pela tela financeira · parcelamento da compra · conta bancária na compra · alocação fina · multi-tenant. **Fatia 11:** a tela Custo de Produção (custo/litro real).
