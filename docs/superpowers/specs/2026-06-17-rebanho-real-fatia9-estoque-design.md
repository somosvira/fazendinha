# Fatia 9 — Estoque + custo vaca/dia — Design

**Data:** 2026-06-17
**Status:** decidido autonomamente (usuário pediu pra seguir o recomendado e catalogar)
**Origem:** Tássila — "Estoque (vamos precisar saber o estoque de insumos pra chegar num valor final de **custo vaca/dia**)". É o **norte** que liga rebanho ↔ financeiro.
**Depende de:** Fatia 8 (`Produto`, `ClienteFornecedor`).

---

## 1. Objetivo

Aba **Estoque**: saldo de insumos (entradas − saídas), registro de movimentos, e o KPI headline **custo vaca/dia** = consumo de insumos valorizado ÷ (vacas em lactação × dias). Espelha o `MOVIMENTOESTOQUE` do Ideagri.

## 2. Decisões (catalogadas)
- **`MovimentoEstoque`** com `tipo` ENTRADA/SAIDA/AJUSTE. Entrada = compra (fornecedor + valor); Saída = consumo (opcionalmente por lote). `custoUnitario` é **snapshot** no momento do movimento (default = `Produto.custoUnitario`); `valorTotal = quantidade × custoUnitario`.
- **Saldo é computado** (Σ entradas − Σ saídas por produto), não armazenado — simples e sempre correto no volume atual.
- **custo vaca/dia** (MVP) = Σ(valorTotal das SAÍDAS no período) ÷ (vacas em lactação × dias do período). Função **pura, TDD**. Período default 30 dias. É o KPI que a Tássila pediu e que o dashboard financeiro já estima por cima (custo/litro).
- **Aba Estoque no grupo REBANHO** (operacional, depois de Produção).
- **Deferido:** gerar `Lancamento` financeiro automático na compra (a ENTRADA guarda fornecedor+valor; o link com `Lancamento`/`Categoria` é follow-up); alocação fina por centro de custo/atividade; importação de NOTA/XML; validade/FEFO; multi-tenant. Catalogado.

## 3. Modelo de dados (`schema.prisma`)

```prisma
enum TipoMovimento { ENTRADA SAIDA AJUSTE }

model MovimentoEstoque {
  id            Int           @id @default(autoincrement())
  produto       Produto       @relation(fields: [produtoId], references: [id])
  produtoId     Int
  tipo          TipoMovimento
  data          DateTime      @db.Date
  quantidade    Decimal       @db.Decimal(12, 2)
  custoUnitario Decimal       @db.Decimal(12, 2)   // snapshot
  valorTotal    Decimal       @db.Decimal(14, 2)   // quantidade × custoUnitario
  grupo         Grupo?        @relation(fields: [grupoId], references: [id])  // lote consumidor (SAIDA)
  grupoId       Int?
  fornecedor    ClienteFornecedor? @relation(fields: [fornecedorId], references: [id]) // ENTRADA
  fornecedorId  Int?
  observacao    String?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  @@index([produtoId, data])
  @@index([tipo, data])
}
```
`Produto` ganha `movimentos MovimentoEstoque[]`; `Grupo` ganha `movimentosEstoque MovimentoEstoque[]`; `ClienteFornecedor` ganha `movimentosEstoque MovimentoEstoque[]`. (Só relações inversas — nada quebra.)

## 4. Motor (puro — `estoque.calc.ts`, TDD)

```ts
export interface MovIn { tipo: "ENTRADA" | "SAIDA" | "AJUSTE"; quantidade: number; valorTotal: number; data: string }
export function saldoProduto(movs: MovIn[]): { saldo: number; valor: number }; // Σ(±qtde), Σ(±valor); AJUSTE soma com sinal da qtde
export function custoVacaDia(saidas: { valorTotal: number; data: string }[], vacasEmLactacao: number, hoje: string, periodoDias: number): number | null;
```
Regras:
- `saldoProduto`: ENTRADA soma, SAIDA subtrai, AJUSTE soma (quantidade pode ser negativa). `valor` análogo (saldo valorizado).
- `custoVacaDia`: soma `valorTotal` das saídas com `data` nos últimos `periodoDias` (≥ hoje−periodoDias); divide por `(vacasEmLactacao × periodoDias)`; `null` se `vacasEmLactacao == 0`. Arredonda 2 casas.

## 5. API (`services/rebanho/estoque.ts` + rota)

- `GET /api/rebanho/estoque/saldos` → `[{ produtoId, nome, tipo, unidade, saldo, valor, minimoEstoque, abaixoMinimo }]` (todos os produtos estocáveis, saldo computado dos movimentos).
- `GET /api/rebanho/estoque/movimentos?produtoId=&tipo=` → lista (desc por data) com nome do produto/fornecedor/lote.
- `POST /api/rebanho/estoque/movimentos` → cria (Zod: produtoId, tipo, data não-futura, quantidade>0, custoUnitario? default Produto.custoUnitario, grupoId?, fornecedorId?, observacao?). `valorTotal` computado.
- `DELETE /api/rebanho/estoque/movimentos/:id`.
- `GET /api/rebanho/estoque/custo-vaca-dia?dias=30` → `{ periodoDias, custoVacaDia, vacasEmLactacao, totalConsumo }` (vacas em lactação = `resumo.del != null`).
- Erros: 404 produto/movimento; 400 payload.

Service espelha o padrão router→service + Zod das fatias anteriores.

## 6. Client

- `rebanho/api.ts`: `useSaldos`, `listarMovimentos`/`registrarMovimento`/`excluirMovimento`, `useCustoVacaDia`.
- **Aba Estoque** (`EstoqueTab`, grupo REBANHO): 
  - KPI **custo vaca/dia** em destaque (+ vacas em lactação, consumo do período) — o headline.
  - Tabela de **saldos** (produto · tipo · saldo · valor · mínimo · ⚠ abaixo do mínimo).
  - Tabela de **movimentos** recentes + botão "Registrar movimento" → drawer (`MovimentoForm`: tipo, produto, data, quantidade, custo, fornecedor [entrada]/lote [saída], obs).
- Sidebar: item **Estoque** no grupo REBANHO (chave `reb-estoque`, entre Produção e IA). Nav em `Shell.tsx`/`RebanhoContent.tsx`.

## 7. Seed

`seed-rebanho.ts`: alguns movimentos — entradas (compra de Ração Lactação Alta, Núcleo Mineral via fornecedor) e saídas (consumo recente) de modo que haja saldo positivo e um custo vaca/dia plausível (ex.: ração consumida ~R$ 2.000 nos últimos dias → custo/vaca/dia coerente). Idempotente (`movimentoEstoque.deleteMany({})`).

## 8. Testes
- **Motor (`saldoProduto`, `custoVacaDia`)** — TDD: entradas−saídas; ajuste; saldo zero; custo = consumo/(vacas×dias); vacas=0 → null; saídas fora do período ignoradas.
- Zod schemas. API smoke (entrada/saída → saldo; custo-vaca-dia). Client render smoke de `EstoqueTab`. Navegador: registrar entrada e saída, ver saldo e custo vaca/dia mudarem.

## 9. Decisões deferidas
- Compra gerar `Lancamento` financeiro (link Estoque↔financeiro completo) · alocação por centro de custo/atividade · NOTA/XML · validade/FEFO/lote do produto · custo vaca/dia por categoria de insumo · multi-tenant.
