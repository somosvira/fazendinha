# Fatia 21 — Custo por produto exato (precificar no Cadastros) — Design + Plano

**Data:** 2026-06-17 · **Status:** aprovado ("pode seguir com tudo"). **Depende de:** Fatia 17 (aplicações), 18 (custo de sanidade por rateio).

## Objetivo
Permitir **custo exato** de sanidade: semear os 15 produtos aplicados no Cadastros (com `custoUnitario` editável — CRUD já existe) e o `custo-sanidade` usa o **custo por produto** quando precificado, ao lado do rateio por volume (Fatia 18). Conforme o usuário precifica, o número fica exato.

## Mudanças
1. **Seed dos produtos** (`import-rebanho.ts`): coletar os nomes distintos de produto das aplicações (`eventosSanitarios` tipo APLICACAO) e **upsert** em `Produto` (`tipo=MEDICAMENTO`, `ativo`) por nome — **não** sobrescrever `custoUnitario` (preserva o que o usuário preencher). Idempotente; o import já preserva `Produto`.
2. **Service `agregarCustoSanidade`**: buscar `Produto` (mapa `nome→custoUnitario`); no breakdown de produtos, anexar `custoUnitario` e `custoExato = n × custoUnitario` (null quando sem preço). Novos campos no retorno: `produtos: {produto, n, custoUnitario, custoExato}[]` (substitui `topProdutos`, com custo), `custoExatoTotal` (Σ dos precificados), `produtosPrecificados`/`produtosTotais`.
3. **UI (`CustoProducaoTab.tsx`)**: a tabela "Produtos mais aplicados" ganha colunas **Custo unit.** e **Custo total** ("—" quando sem preço); uma linha/KPI **"Custo exato (precificados): R$ X · Y de Z produtos · defina os custos no Cadastros"**. O rateio por volume (Fatia 18) continua como estimativa default.

## Verificação
- Postgres: `Produto` ganha os 15 (Lactotropin, Vacina Poli-Star, Dectomax…) com `custoUnitario` null.
- API `/rebanho/custo-sanidade`: `produtos[]` com custoUnitario null + `custoExatoTotal` 0 (até precificar); precificar um produto no Cadastros → `custoExato` dele aparece e entra no total.
- Navegador: aba Custo mostra as colunas de custo + o aviso "defina no Cadastros"; Cadastros lista os 15 com campo de custo.
- Motor/serviço testados; server+client build/test verdes; idempotente.

## Deferido
- Custo exato **por animal** (hoje o exato é por produto/herd; o per-animal segue rateio); dose × custo/unidade; reclassificação Animal Aquisição.
