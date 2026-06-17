# Fatia 15 — Separar setor × grupo (lote de manejo) + filtro de Setor — Design

**Data:** 2026-06-17
**Status:** aprovado no brainstorming (usuário escolheu "Separar + filtro de Setor" ao ver o sistema de setores do Ideagri).
**Depende de:** Fatia 14 (pipeline de extração `scripts/extract-rebanho.sh`, importador).

---

## 1. Problema

O Ideagri tem **duas dimensões distintas** por animal, visíveis na listagem:
- **Setor** — localização física (5 na 777: Principal/Mexicana/Carlos Alves × Leite/Receptoras/Compost).
- **Grupo atual** — lote de manejo (Vacas secas, Novilhas Prenhas, Bezerreiro, Receptoras/Descartes, recrias, pastos "1/2/3"…).

Nossa extração (Fatia 12/14) **conflou as duas**: o transformador faz `a.grupo = a.setor`, então o nosso campo `grupo` (que a **Nutrição** usa como lote, com `Grupo → Dieta`) está com **nomes de setor**, não com os lotes reais. Os 522 ativos têm `setor` ∈ 5 valores em ambos os campos.

## 2. Fonte limpa (verificada)

O read-model **`ANIMALINFO_CADASTRO`** desnormaliza ambas, batendo **exatamente** com a listagem do Ideagri:
- `ANIMALINFO_CADASTRO.SETOR` → setor físico (= o que já temos).
- `ANIMALINFO_CADASTRO.GRUPO` → lote de manejo atual (singular). Conferido: #2="1", #3="Vacas secas", #17="Receptoras / Descartes", #23="Novilhas Prenhas", #42="Recria 3 - Pasto Bambu".

Distribuição (ativos): **271 sem grupo**, Bezerreiro 39, "2" 34, "1" 31, "3" 31, Receptoras/Descartes 29, Verde-Pré IA 22, Vacas secas 21, Roxo-Recria 1 11, Novilhas Prenhas 10, Azul-Recria 2 9, Tratamento 7, Recria 3 6, "4" 1. (`GRUPOS` plural = lista CSV de todos os grupos do animal; **não** usamos por ora — só o `GRUPO` primário.)

## 3. Mudanças

**Extração (`scripts/rebanho-dump.sql`):** no bloco `@A@`, trocar o `LEFT JOIN SETOR` por `LEFT JOIN ANIMALINFO_CADASTRO c` e emitir `c.SETOR` (setor) **e** `c.GRUPO` (grupo, novo campo). 15 campos no `@A@` (era 14): …, setor(12), pelagem/raça(13), **grupo(14)**.

**Transformador (`scripts/build-rebanho-json.mjs`):** `parseAnimal` lê `setor=f[12]`, `raca=racaDe(f[13])`, **`grupo=s(f[14])`** (null quando vazio = "sem grupo"). Remover `a.grupo = a.setor` do `main()`. Atualizar o teste (linha de exemplo passa a ter 15 campos + caso de grupo).

**Importador (`server/prisma/import-rebanho.ts`):** já cria `Grupo` por upsert de nome e seta `Animal.grupoId`/`Animal.setor` a partir do JSON — **nenhuma mudança de lógica**, só passa a receber lotes reais. Animais "sem grupo" → `grupoId=null`. Grupos antigos com nome de setor podem ficar órfãos no `Grupo` (não deletamos por causa de `MovimentoEstoque.grupoId`); são linhas inertes — deixar (catalogado). `Animal.setor` continua texto.

**API (`server/src/services/rebanho/animais.*`):** o schema de **listagem** hoje tem `status/grupoId/q` mas **não** `setor`. Adicionar `setor: z.string().max(40).optional()` ao schema de query e ao `where` do service (`setor: { equals: setor }` quando presente). Novo endpoint pequeno **`GET /rebanho/setores`** → `string[]` de setores distintos (não-nulos, ordenados) para popular o dropdown.

**UI (`client/src/rebanho/components/AnimalTab.tsx`):** ao lado do filtro Ativos/Baixados/Todos, um **dropdown de Setor** ("Todos os setores" + os 5), espelhando o Ideagri. Passa `setor` ao `useAnimais({ status, setor })`. Fonte das opções: novo hook `useSetores()` (bate em `/rebanho/setores`). A coluna/realce de grupo na listagem passa a mostrar o **lote real** (já vem do `grupoNome`).

## 4. Verificação
- **Extração/JSON:** `grupo` distinto agora = lotes reais (Vacas secas, Bezerreiro, "1"…), `setor` = 5 setores; ~271 ativos com `grupo=null`. Contagens batem com a §2.
- **Postgres:** `Grupo` ganha os ~14 lotes reais; `Animal.grupoId` aponta pra eles; `Animal.setor` intacto.
- **Navegador:** dropdown de Setor filtra os animais (ex.: Principal - Leite → 266); a coluna de grupo mostra o lote real; Nutrição agrupa por lote real. Custo/litro inalterado (não depende de setor/grupo).
- Server/client build + testes verdes; transformador (node --test) verde.

## 5. Decisões deferidas
- `GRUPOS` (múltiplos grupos por animal) — só o primário por ora.
- Limpeza dos grupos órfãos com nome de setor — inertes, deixar.
- Setor → centro de custo (`SETOR.CDCENTROCUSTO`) para custo por setor — **vazio na 777**; quando preencherem, vira fatia própria.
- `LOTE` (tipo 3 do `MOVGRUPOANIMAL`) como dimensão separada — o `ANIMALINFO_CADASTRO.GRUPO` já cobre o "grupo atual" que a fazenda usa.
- Design da reclassificação "Animal Aquisição" — segue guardado.
