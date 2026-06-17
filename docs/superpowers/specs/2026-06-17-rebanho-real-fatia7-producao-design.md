# Rebanho — Fase Real, Fatia 7: Configurações + Produção (3 modos) — Design

**Data:** 2026-06-17
**Status:** aprovado no brainstorming (usuário pediu os 3 modos de medição + aba Configurações, com rateio no modo tanque/lote)
**Antecede:** Fatias 1–6 (Animal, Reprodução, Sanidade, Nutrição, Dashboard, IA) + navegação unificada — todas na `main`.

---

## 1. Contexto e objetivo

A conversa com a especialista (Tássila) apontou **Produção** como aba central que ainda falta, e o usuário decidiu que o **modo de medição do leite é configurável** (o sistema será revendido a outras fazendas). Esta fatia entrega: (a) uma **aba Configurações** mínima com o ajuste do modo de produção; (b) a **Produção real** nos 3 modos, alimentando o `ResumoAnimal` (hoje os campos `producaoMediaDia`/`producao305` são mock).

Base no Ideagri: tabela `LEITE` (controle por animal, `PESO1/2/3`, `PESOTOTAL`, flags de origem) e `PRODUCAOLEITERATEIO` (rateio do tanque para o animal).

## 2. Escopo

**Dentro:**
- **Configurações:** modelo `Configuracao` (linha única) com `producaoModo`; aba Configurações no rodapé do sidebar; endpoints GET/PATCH.
- **Produção — 3 modos:**
  - `ORDENHA` (controle leiteiro por animal, peso por ordenha 1/2/3),
  - `TOTAL_DIARIO` (um total/dia por animal),
  - `TANQUE_LOTE` (litros por lote ou tanque da fazenda; per-animal vem por **rateio**).
- **Motor de recálculo puro (TDD)** que alimenta `ResumoAnimal.producaoMediaDia`, `producao305` e o novo `producaoTendencia`.
- **Aba Produção (rebanho)** que se adapta ao modo (KPIs por vaca/ranking nos modos por animal; totais por lote/tanque no modo tanque).
- **Cockpit:** timeline de produção real (modos por animal) + "+ Registrar controle"; no modo tanque, média estimada por rateio.
- Seed de produção da Jurema & cia (continuidade visual). Testes do motor + schemas + API smoke + navegador.

**Fora (YAGNI / fatias futuras):**
- Importação por integração/ordenhadeira (só o campo `origem` fica pronto).
- **Multi-fazenda de verdade** (auth/tenant por fazenda) — a `Configuracao` é de **uma** fazenda nesta fatia. **Pendência registrada:** a revenda multi-tenant precisa de um projeto próprio (escopo por fazenda em todas as tabelas + auth) antes de produção.
- Curva de lactação corrigida (CORRECAO305 do Ideagri) — projeção 305d é linear simples no MVP; refino deferido.
- Edição de controle (só criar/excluir; corrigir = excluir+recriar), como nas outras fatias.

## 3. Arquitetura

Mesmo padrão das fatias anteriores: Hono **router→service** + Prisma (`db push`) + Zod; client fetchers/hooks + drawers; **motor de recálculo puro** separado do Prisma (testado exaustivamente). Acrescenta uma leitura de **configuração**: o recálculo de produção de um animal depende do `producaoModo` ativo.

## 4. Modelo de dados (adicionar ao `server/prisma/schema.prisma`)

```prisma
enum ModoProducao { ORDENHA TOTAL_DIARIO TANQUE_LOTE }

model Configuracao {
  id           Int          @id @default(1)   // linha única (singleton)
  producaoModo ModoProducao @default(ORDENHA)
  atualizadoEm DateTime     @updatedAt
}

model ControleLeiteiro {
  id        Int      @id @default(autoincrement())
  animal    Animal   @relation(fields: [animalId], references: [id], onDelete: Cascade)
  animalId  Int
  data      DateTime @db.Date
  peso1     Decimal? @db.Decimal(6, 2)   // ordenha manhã
  peso2     Decimal? @db.Decimal(6, 2)   // tarde
  peso3     Decimal? @db.Decimal(6, 2)   // noite
  pesoTotal Decimal  @db.Decimal(6, 2)   // total do dia (soma das ordenhas ou o total diário)
  origem    String   @default("manual")  // manual | integracao (gancho p/ ordenhadeira)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([animalId, data])
}

model ProducaoLote {
  id        Int      @id @default(autoincrement())
  grupo     Grupo?   @relation(fields: [grupoId], references: [id])
  grupoId   Int?                         // null = tanque da fazenda inteira
  data      DateTime @db.Date
  litros    Decimal  @db.Decimal(10, 2)
  origem    String   @default("manual")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([grupoId, data])
  @@index([data])
}
```

- `Animal` ganha a relação inversa `controlesLeiteiros ControleLeiteiro[]`; `Grupo` ganha `producoesLote ProducaoLote[]`.
- `ResumoAnimal` ganha **um** campo novo: `producaoTendencia String?` (espelha `ccsTendencia`). `producaoMediaDia`/`producao305` já existem — passam a ser **escritos pelo motor**.

## 5. Motor de recálculo (puro — `producao.recompute.ts`)

Constantes: `JANELA_CONTROLES = 3` (média dos últimos N controles), `DIAS_LACTACAO_PADRAO = 305`.

```ts
export interface ControleIn { data: string; pesoTotal: number }
export interface ResumoProducao { producaoMediaDia: number | null; producao305: number | null; producaoTendencia: string | null }

// modos por animal (ORDENHA / TOTAL_DIARIO)
export function recomputarProducaoAnimal(controles: ControleIn[], temLactacaoAberta: boolean): ResumoProducao;
// modo tanque/lote: rateio
export function ratearProducao(litros: number, vacasEmLactacao: number): number | null; // litros / vacas (null se 0)
```

Regras:
- **`producaoMediaDia`** (modos por animal) = média de `pesoTotal` dos últimos `JANELA_CONTROLES` controles (ordenados por data desc); `null` se nenhum.
- **`producao305`** = se há lactação aberta e `producaoMediaDia != null`: `round(producaoMediaDia * DIAS_LACTACAO_PADRAO)`; senão `null`. (Projeção linear simples — refino via curva deferido.)
- **`producaoTendencia`** = comparando a média dos 2 controles mais recentes vs os 2 anteriores: `"subindo"` / `"descendo"` / `"estavel"`; `null` se < 2 controles.
- **`ratearProducao`** (modo tanque) = `litros / vacasEmLactacao` (arredondado 1 casa); `null` se `vacasEmLactacao == 0`. `producao305` no modo tanque = `round(rateio * 305)`; `producaoTendencia` = null (não há série por vaca).

O service `recomputarProducaoDoAnimal(animalId)`:
1. lê `Configuracao.producaoModo`.
2. **ORDENHA/TOTAL_DIARIO:** lê `ControleLeiteiro` do animal → `recomputarProducaoAnimal` → grava os 3 campos de produção do resumo.
3. **TANQUE_LOTE:** acha o `grupoId` do animal → último `ProducaoLote` desse grupo (ou, se modo de fazenda inteira / grupo sem registro, o último `ProducaoLote` com `grupoId = null`) → conta vacas em lactação no escopo → `ratearProducao` → grava.
4. Grava **apenas** os campos de produção (`producaoMediaDia`, `producao305`, `producaoTendencia`) — nunca os de reprodução/CCS.

Gatilhos:
- `ControleLeiteiro` criar/excluir → recomputa **aquele** animal.
- `ProducaoLote` criar/excluir → recomputa **todos os animais** do lote (ou todos em lactação, se `grupoId = null`).
- **Troca de modo** (PATCH config) → recomputa **todos os animais ativos** (a fonte mudou).

## 6. API (`routes/rebanho/`)

- **Config:** `GET /api/rebanho/config` → `{ producaoModo }`; `PATCH /api/rebanho/config` (Zod: `producaoModo ∈ enum`) → atualiza (upsert da linha única) e dispara o recálculo geral; retorna o config.
- **Produção por animal:** `POST /api/rebanho/animais/:id/producao` (Zod discriminado por modo: ORDENHA exige ≥1 de peso1/2/3 → `pesoTotal = soma`; TOTAL_DIARIO exige `pesoTotal`); `DELETE /api/rebanho/producao/:id`. Ambos reconciliam e recomputam. `data` não-futura.
- **Produção de lote/tanque:** `POST /api/rebanho/producao-lote` (Zod: `grupoId?`, `data`, `litros>0`); `DELETE /api/rebanho/producao-lote/:id`.
- **Agregado da aba:** `GET /api/rebanho/producao` → adapta ao modo: por animal → `{ modo, totalDia, mediaVaca, emLactacao, ranking:[{numero,nome,litros}] }`; tanque → `{ modo, totalDia, emLactacao, lotes:[{grupo,litros,vacas,rateio}] }`.
- **Timeline:** `montarTimeline` passa a costurar `ControleLeiteiro` (domínio `producao`) junto de reprodução/sanidade.

`toTimeline(controle)` → `"Controle leiteiro — X L/dia"` (detalhe com as ordenhas se houver).

## 7. Client

- `rebanho/api.ts`: `obterConfig`/`salvarConfig` (+ `useConfig`); `registrarControle(animalId, payload)`/`excluirControle`; `registrarProducaoLote`/`excluirProducaoLote`; `obterProducao` (+ `useProducao`).
- **Aba Configurações** (`ConfiguracoesView`): controle (radio/cards) "Como a fazenda mede o leite?" → salva o modo. Item no **rodapé do sidebar** (perto de Acessos), ícone engrenagem; chave de nav `config`.
- **Aba Produção** (`ProducaoTab`): lê `useConfig` + `useProducao`; modos por animal → KPIs (produção total/dia, média/vaca, nº em lactação) + ranking; modo tanque → totais por lote/tanque. Botão de registrar adapta ao modo (controle por animal abre na ficha; lote/tanque tem form próprio na aba).
- **Cockpit:** timeline real inclui os controles (modos por animal) + "+ Registrar controle" (abre `ControleForm` — peso por ordenha ou total, conforme o modo); no modo tanque, mostra "produção estimada por rateio do lote" no card de estado.
- Sidebar: novo item **Configurações** no rodapé (a fatia da navegação unificada deixou o rodapé com Acessos + chip — acrescentar Configurações ali).

## 8. Seed

`seed-rebanho.ts` ganha controles leiteiros recentes da Jurema #1234 e algumas vacas (3–4 controles cada, coerentes com os números que o cockpit já mostra, ex.: Jurema ~28 L/d subindo) e roda o recálculo de produção no modo padrão `ORDENHA`. Idempotente (limpa controles do animal e recria). Mantém os números de reprodução/CCS já semeados.

## 9. Validação e regras

- Zod discriminado por modo no POST de produção por animal; `litros > 0` no lote; `data` não-futura (400).
- Trocar o modo recomputa todos os ativos; excluir registros reconcilia/recomputa.
- O motor grava só os campos de produção do resumo (preserva reprodução/CCS — verificável em teste).

## 10. Testes

- **Motor (`recomputarProducaoAnimal`, `ratearProducao`)** — TDD: 0 controles → tudo null; 1 controle → média = ele, tendência null; 3+ controles subindo → média + tendência "subindo"; lactação fechada → producao305 null; rateio litros/vacas (e /0 → null). Sequência da Jurema bate com ~28 L/d.
- **toTimeline** + Zod discriminado.
- **API smoke:** setar cada modo via PATCH config; registrar controle/lote; ver `/producao` adaptar; ver o resumo recomputado; excluir. Verificar que trocar o modo recomputa.
- **Client:** render smoke de `ConfiguracoesView`/`ProducaoTab`/`ControleForm`; verificação no navegador (trocar modo em Configurações → aba Produção e cockpit mudam; registrar controle → número real no cockpit).

## 11. Decisões deferidas

- Multi-fazenda/tenant (config por fazenda) · importação por integração · curva de lactação corrigida (305 real) · edição de controle · modo tanque com analise de tanque (gordura/CCS do tanque) · curva de lactação na aba Produção (MVP foca KPIs + ranking).
