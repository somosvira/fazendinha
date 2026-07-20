# Biblioteca de reprodutores + central de sêmen + índices genéticos — Design

**Data:** 2026-07-20
**Fatia:** IDEagri-gaps (prioridade média, 65 + 25 + 271). Genética.
**Relacionado:** evento INSEMINACAO (`reprodutor` texto livre); base para recomendação de acasalamento (M11); `docs/design/ideagri-gaps.md` "Biblioteca de reprodutores + central de sêmen + índices genéticos".

## 1. Problema

O touro/sêmen usado na inseminação é hoje **texto livre** (`EventoReprodutivo.reprodutor`). Não há um **catálogo de reprodutores** com origem (central de sêmen) e índices genéticos (PTAs) — que é a base para escolher touro e, depois, recomendar acasalamento. O IDEagri tem `ANIMALINFO_REPRODUTOR` (65), `CENTRALSEMEN` (25), `GENCATALOGOINDICADOR` (271).

## 2. Objetivo / decisão entregue

Um **catálogo de reprodutores** (touros): nome/código, raça, central de sêmen, e índices genéticos comuns (PTA leite, gordura, proteína, tipo/TPI). CRUD + tela. Base reutilizável para M11.

## 3. Não-objetivos (YAGNI)

- Sem importar as centenas de indicadores do IDEagri — guardamos os índices operacionais mais usados como colunas tipadas (leite/gordura/proteína/TPI); indicadores extras ficam para quando houver demanda.
- Sem ligar automaticamente o `reprodutor` texto livre da inseminação ao catálogo (continuação — o front pode sugerir o catálogo no EventoForm depois).
- Sem estoque de doses de sêmen (central é só a origem; controle de doses é outra fatia).

## 4. Arquitetura

### 4.1 Schema (aditivo)

- `CentralSemen` — `nome`, `ativo`, `propriedadeId?` (catálogo simples de origens).
- `Reprodutor` — `nome`, `codigo?`, `racaId?` (FK Raca), `centralSemenId?` (FK), `ptaLeite?`, `ptaGordura?`, `ptaProteina?`, `tpi?`, `ativo`, `propriedadeId?`.

### 4.2 Cálculo puro (TDD)

`reprodutor.calc.ts` — `resumoIndices(reprodutores)`: médias dos PTAs do catálogo + melhor por índice (leite/TPI). Determinístico. (Leve — dá base ao painel e à M11.)

### 4.3 Serviço + rota

`reprodutores.ts` — CRUD de central de sêmen + CRUD de reprodutor + `resumo`. Rotas: `GET/POST /rebanho/centrais-semen`, `DELETE /:id`; `GET/POST /rebanho/reprodutores`, `PATCH/DELETE /:id`.

### 4.4 Frontend

- `api.ts` — DTOs + hooks + funcs.
- `ReprodutoresSection` na aba Reprodução (topo): lista de touros com raça/central/PTAs + cadastro; gestão de centrais.

## 5. Testes & entrega

- Vitest: `reprodutor.calc.test.ts` (médias; melhor por índice; ignora nulos; vazio).
- Smoke local (Postgres): cria central + reprodutor com PTAs → lista → resumo → exclui.
- Build verde + suítes.
- PR único.

## 6. Reúso

`Raca` (FK), padrão catálogo configurável, calc-puro-TDD, aba Reprodução. Base para M11.
