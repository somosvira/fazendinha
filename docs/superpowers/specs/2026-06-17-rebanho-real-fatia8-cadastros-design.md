# Fatia 8 — Cadastros (Produto + Fornecedor) — Design

**Data:** 2026-06-17
**Status:** decidido autonomamente (usuário pediu pra seguir o recomendado e catalogar — decisões no `docs/HANDOFF-roadmap-tassila-2026-06-17.md`)
**Origem:** conversa com a Tássila — "Cadastros (de produtos, fornecedores…)" fica na **aba Fazenda** do Ideagri. Fundação para a Fatia 9 (Estoque → custo vaca/dia).

---

## 1. Objetivo

Uma aba **Cadastros** (área "Fazenda") com dois catálogos: **Produtos** (remédio/ração/insumo — unifica o que hoje é texto livre) e **Fornecedores**. É a base que a Fatia 9 (Estoque) vai consumir para chegar no custo vaca/dia.

## 2. Decisões (catalogadas)
- **`Produto`** com `tipo` **funcional** (MEDICAMENTO/RACAO/INSUMO/MINERAL/OUTRO) — melhoria deliberada sobre o `TIPO` P/S genérico do Ideagri (a categoria real do Ideagri vive em `CLASSIFICACAO`). Campos úteis ao rebanho: unidade, custo unitário, carência (remédio), %MS (ração/mineral), estocável, mínimo de estoque.
- **Fornecedor = estender o `ClienteFornecedor` existente** (do app financeiro) com `tipo`/contato/`ativo` — **não duplicar** uma lista de fornecedores. Serve financeiro + rebanho; a Fatia 9 (compras) referencia ele.
- **Aba Cadastros no rodapé** do sidebar (área farm-wide, perto de Configurações/Acessos) — não dentro do grupo REBANHO.
- **Deferido:** migrar os campos texto-livre `produto`/`loteProduto` da Sanidade para FK de `Produto` (follow-up); link de `Produto` com a `Categoria` financeira (entra na Fatia 9, onde o custo é usado). Multi-tenant segue deferido.

## 3. Modelo de dados (`server/prisma/schema.prisma`)

```prisma
enum TipoProduto { MEDICAMENTO RACAO INSUMO MINERAL OUTRO }

model Produto {
  id            Int         @id @default(autoincrement())
  nome          String      @unique
  tipo          TipoProduto @default(INSUMO)
  unidade       String      @default("un")   // un | kg | L | dose | saco | mL ...
  custoUnitario Decimal?    @db.Decimal(12, 2)
  carencia      Int?                          // horas (medicamento)
  percentualMS  Decimal?    @db.Decimal(5, 2) // % matéria seca (ração/mineral)
  estocavel     Boolean     @default(true)
  minimoEstoque Decimal?    @db.Decimal(12, 2)
  ativo         Boolean     @default(true)
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  @@index([tipo])
}
```

`ClienteFornecedor` ganha:
```prisma
enum TipoPessoa { CLIENTE FORNECEDOR AMBOS }
// no model ClienteFornecedor, adicionar:
  tipo      TipoPessoa @default(FORNECEDOR)
  telefone  String?
  email     String?
  ativo     Boolean    @default(true)
```
(os campos `id`, `nome @unique`, `documento`, `lancamentos` permanecem; nada quebra no financeiro.)

## 4. API

- **Produtos:** `GET /api/rebanho/produtos` (lista, filtro `?tipo=&q=&ativo=`), `POST`, `PATCH /:id`, `DELETE /:id` (ou baixa `ativo=false` — usar soft-delete: PATCH ativo=false; manter DELETE só se sem uso). Zod: nome obrigatório, tipo enum, unidade, números opcionais.
- **Fornecedores:** `GET /api/rebanho/fornecedores` (filtro `?tipo=&q=`), `POST`, `PATCH /:id`. `documento` opcional, `tipo` enum. Reaproveita `ClienteFornecedor`.
- Erros: 404 inexistente; 409 nome/documento duplicado.

Services em `server/src/services/rebanho/cadastros.ts` (ou `produtos.ts` + `fornecedores.ts`), padrão router→service + Zod, espelhando `nutricao.ts` (CRUD de Dieta).

## 5. Client

- `rebanho/api.ts`: fetchers/hooks `useProdutos`/`useFornecedores` + criar/editar.
- **`CadastrosView`** — aba com sub-abas internas **Produtos** | **Fornecedores** (toggle simples). Cada uma: lista (tabela) + botão "Novo" → drawer de formulário (espelha `AnimalForm`/`DietaForm`). Produtos: filtro por tipo. Edição inline ou drawer. Soft-delete (ativar/desativar).
- **Sidebar:** item **Cadastros** no rodapé do `AppSidebar` (perto de Configurações). Chave de nav `cadastros`. `App.tsx` roteia `cadastros` → `CadastrosView`; redirect effect early-return em `cadastros`.

## 6. Seed

`seed-rebanho.ts`: alguns produtos de exemplo (ex.: "Mastijet" MEDICAMENTO un carência 96; "Ração Lactação Alta" RACAO kg %MS 88; "Núcleo Mineral" MINERAL kg; "Sêmen Lance 884" INSUMO dose) e 2–3 fornecedores (ex.: "Cargill", "Coop. Boa Vista" — coerentes com os que já aparecem no financeiro). Idempotente.

## 7. Testes

- Backend: Zod schemas (válido/ inválido), CRUD smoke (criar/listar/filtrar/editar/duplicado→409). (Sem motor de recálculo nesta fatia — é CRUD.)
- Client: render smoke de `CadastrosView` (lista + sub-abas); verificação no navegador (criar produto e fornecedor, ver na lista, filtrar por tipo).

## 8. Decisões deferidas
- Sanidade/Nutrição passarem a referenciar `Produto` por FK (follow-up) · link `Produto`↔`Categoria` financeira (Fatia 9) · `Estoque`/movimentação (Fatia 9) · multi-tenant.
