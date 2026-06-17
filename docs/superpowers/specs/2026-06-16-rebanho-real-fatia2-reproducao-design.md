# Rebanho — Fase Real, Fatia 2: Reprodução ponta a ponta (eventos + estado derivado) — Design

**Data:** 2026-06-16
**Status:** aprovado no brainstorming ("tudo agora" — inclui o recálculo do resumo)
**Antecede:** Fatia 1 (Animal real), mergeada na `main` (specs/2026-06-16-rebanho-real-fatia1-animal-design.md).

---

## 1. Contexto e objetivo

A Fatia 1 tornou o **Animal** real (cadastro persistido). A ficha mostra a timeline em **estado vazio** e o `ResumoAnimal` é **semeado** (não calculado). Esta fatia torna a **Reprodução real ponta a ponta**: registrar eventos reprodutivos, vê-los na **timeline de verdade**, e — por decisão do usuário ("tudo agora") — **recalcular o estado reprodutivo derivado** a partir dos eventos (junta o que seria Fatia 2 + a parte reprodutiva da Fatia 3).

Fora desta fatia: domínios **Sanidade** e **Nutrição**; os campos de **produção/CCS** do resumo (vêm dos domínios leite/sanidade). IA segue por último.

## 2. Escopo

**Dentro:**
- Modelos `EventoReprodutivo` (cio/IA/DG/parto/secagem) e `Lactacao` (span parto→secagem).
- **Motor de recálculo** `recomputarResumoReproducao` — após qualquer mutação de evento, recomputa os campos **reprodutivos** do `ResumoAnimal`.
- API: registrar/listar/excluir eventos por animal; o GET da ficha já reflete o resumo recomputado.
- **Ficha:** timeline real (fim do estado-vazio) + botão **"+ Registrar evento"** (drawer com seletor de tipo).
- **Aba Reprodução nível-rebanho fica real:** work-lists (inseminar/DG/secar/partos) e KPIs computados dos resumos reais.
- Seed dos eventos da Jurema (continuidade visual com o mockup).
- Testes do motor de recálculo (TDD forte — é lógica pura) + schemas/mappers + API smoke.

**Fora (fatias futuras):**
- Sanidade, Nutrição; campos `producaoMediaDia`/`producao305`/`ccs`/`ccsTendencia` do resumo (continuam semeados/nulos).
- Edição de evento (só criar/excluir nesta fatia — corrigir = excluir + recriar).
- Multi-fazenda, auth, migrations formais (segue `db push`), IA.

## 3. Arquitetura

Mesmo padrão da Fatia 1: Hono **router→service**, Prisma (`db push`), client fetchers/hooks + drawer. O **motor de recálculo é uma função pura** (`recomputarResumoReproducao(eventos, lactacoes, hoje) → CamposResumoReprodutivo`), separada do Prisma, pra ser testada exaustivamente. O service: (1) grava o evento, (2) reconcilia `Lactacao` (parto abre, secagem fecha), (3) lê eventos+lactações do animal, (4) chama a função pura, (5) grava o resumo. "Hoje" = `new Date()` real do servidor (o ambiente roda em ~2026-06, coerente com os dados).

## 4. Modelo de dados (adicionar ao `server/prisma/schema.prisma`)

```prisma
enum TipoEventoReprodutivo { CIO INSEMINACAO DIAGNOSTICO PARTO SECAGEM }

model EventoReprodutivo {
  id              Int                   @id @default(autoincrement())
  animal          Animal                @relation(fields: [animalId], references: [id], onDelete: Cascade)
  animalId        Int
  tipo            TipoEventoReprodutivo
  data            DateTime              @db.Date
  observacao      String?
  // INSEMINACAO
  reprodutor      String?               // touro/sêmen
  protocolo       String?               // ex.: IATF 11d
  // DIAGNOSTICO
  resultado       String?               // "positivo" | "negativo"
  dtPartoPrevista DateTime?             @db.Date
  // PARTO
  tipoParto       String?               // normal | distocia | cesarea
  numCrias        Int?
  sexoCria        String?               // "F" | "M" | "FM" (gemelar)
  // SECAGEM
  motivoSecagem   String?
  createdAt       DateTime              @default(now())
  updatedAt       DateTime              @updatedAt
  @@index([animalId, data])
}

model Lactacao {
  id        Int       @id @default(autoincrement())
  animal    Animal    @relation(fields: [animalId], references: [id], onDelete: Cascade)
  animalId  Int
  numero    Int       // ordem de lactação (1ª, 2ª…)
  dtInicio  DateTime  @db.Date   // = data do parto
  dtFim     DateTime? @db.Date   // = data da secagem (null = lactação aberta)
  @@index([animalId])
}
```
O `Animal` ganha as relações inversas `eventosReprodutivos EventoReprodutivo[]` e `lactacoes Lactacao[]`. O `ResumoAnimal` **não muda de forma** — os campos reprodutivos já existem (statusReprodutivo, del, ordemLactacao, ultimoDgData/Resultado, iepProjetado, diasGestacao, previsaoSecagem, ultimaInseminacao); passam a ser **escritos pelo motor**.

## 5. Motor de recálculo (o coração)

Função pura `recomputarResumoReproducao(eventos: EventoReprodutivo[], lactacoes: Lactacao[], hoje: Date)`. Constantes: `PEV_DIAS = 50`, `GESTACAO_DIAS = 283`, `SECAGEM_ANTECEDENCIA_DIAS = 60`.

Regras:
- **Lactação atual** = lactação com `dtFim` nula (aberta); se nenhuma, a de maior `numero`. `ordemLactacao` = `numero` dela (ou null se nunca pariu). **DEL** = se há lactação aberta: `dias(dtInicio → hoje)`; senão null (seca/novilha).
- **`ultimoDg`** = DIAGNOSTICO mais recente; **`ultimaIa`** = INSEMINACAO mais recente. `ultimoDgData/Resultado` e `ultimaInseminacao` saem deles.
- **statusReprodutivo** (avalia os eventos após o último parto):
  - `PRENHE` se `ultimoDg.resultado === "positivo"` e não houve PARTO depois dele.
  - senão `INSEMINADA` se há `ultimaIa` posterior ao último DG (servida, aguardando DG).
  - senão `PEV` se DEL ≠ null e DEL < `PEV_DIAS`.
  - senão `VAZIA`.
- Se **PRENHE**:
  - `dtConcepcao` = a INSEMINACAO mais recente com data ≤ data do DG positivo (se não houver IA, usa a data do DG menos ~30d).
  - `diasGestacao` = `dias(dtConcepcao → hoje)`.
  - `dtPartoPrevista` = `ultimoDg.dtPartoPrevista` se gravada, senão `dtConcepcao + GESTACAO_DIAS`.
  - `previsaoSecagem` = `dtPartoPrevista − SECAGEM_ANTECEDENCIA_DIAS`.
  - `iepProjetado` = se há parto anterior: `dias(últimoParto → dtPartoPrevista)`; senão null.
- Se **não-PRENHE**: `diasGestacao`, `dtPartoPrevista`, `previsaoSecagem` = null; `iepProjetado` = média dos intervalos entre partos consecutivos se houver ≥2 partos, senão null.

A função retorna só os campos reprodutivos; o service faz `prisma.resumoAnimal.update` com eles (preservando produção/CCS).

**Reconciliação de `Lactacao`** (no service, ao gravar/excluir evento): recomputa as lactações do animal a partir dos eventos — cada PARTO abre uma lactação (`numero` sequencial, `dtInicio` = data); a SECAGEM seguinte fecha a aberta (`dtFim` = data). Implementação simples e idempotente: apaga as lactações do animal e reconstrói a partir dos PARTO/SECAGEM ordenados. (Volume pequeno por animal.)

## 6. API (`server/src/routes/rebanho/eventos.ts` → `services/rebanho/eventos.ts`)

- `GET /api/rebanho/animais/:id/eventos` → `EventoTimeline[]` (mapeado p/ a forma que o `<Timeline>` consome — `{id, animalId, data, dominio:"reproducao", titulo, detalhe?, alerta?, marcador?}`), ordem desc.
- `POST /api/rebanho/animais/:id/eventos` → cria evento (Zod **discriminado por `tipo`** — cada tipo exige seus campos), reconcilia lactação, **recomputa o resumo**, retorna o evento criado.
- `DELETE /api/rebanho/eventos/:id` → exclui, reconcilia, recomputa.

`toTimeline(evento)` monta `titulo`/`detalhe` legíveis: CIO→"Cio detectado"; INSEMINACAO→"Inseminação artificial" + reprodutor/protocolo; DIAGNOSTICO→"Diagnóstico — POSITIVO/NEGATIVO" (`alerta` se negativo após várias tentativas? não — simples); PARTO→"Parto — N cria(s) ♀/♂"; SECAGEM→"Secagem" + motivo. O PARTO recebe `marcador` "início da Nª lactação".

Erros: 404 animal/evento inexistente; 400 payload inválido (zValidator).

## 7. Client

- `rebanho/api.ts`: `listarEventos(animalId)`, `registrarEvento(animalId, payload)`, `excluirEvento(eventoId)` + hook `useEventos(animalId)`.
- **Ficha (`AnimalCockpit`)**: busca os eventos e renderiza o `<Timeline>` real (substitui o estado-vazio); botão **"+ Registrar evento"** abre `EventoForm` (drawer: seletor de tipo → campos do tipo). Ao salvar/excluir, refetch da ficha (o resumo e a timeline atualizam).
- **Aba Reprodução (`ReproducaoTab`)**: igual ao `AnimalTab` — busca os animais (com resumo real) e alimenta o `HerdDomainView` com a config `reproducao`; as work-lists (`aInseminar/dgPendente/aSecar/partosPrevistos`) e os KPIs passam a refletir os resumos reais. KPIs hardcoded da config (taxa prenhez, IEP médio) passam a computar dos resumos onde possível.

## 8. Seed

`seed-rebanho.ts` ganha os eventos da Jurema (#1234) — secagem 2ª lactação (17/12/2025), parto 3ª (22/01/2026), IA (28/04), DG+ (28/05) — e roda a reconciliação+recálculo no seed, de modo que a timeline e o resumo dela batam com o que mostrávamos no mockup. Idempotente (limpa eventos do animal e recria).

## 9. Validação e regras

- Zod **discriminado por tipo** no POST (ex.: PARTO exige `numCrias`; DIAGNOSTICO exige `resultado ∈ {positivo,negativo}`; INSEMINACAO exige `reprodutor`).
- `data` do evento não pode ser futura (> hoje) — 400.
- Excluir evento reconcilia/recomputa (não deixa lactação órfã).

## 10. Testes

- **Motor (`recomputarResumoReproducao`)** — TDD forte, vários cenários: novilha vazia; pós-parto dentro/fora do PEV; servida (IA sem DG); prenhe (DG+ → status/diasGestacao/prev. parto/secagem/IEP); seca (lactação fechada → DEL null); sequência parto→IA→DG+ da Jurema bate com os números do mock. (Pura, sem Prisma.)
- **`toTimeline`** mappers + Zod discriminado.
- **API smoke**: registrar cada tipo, ver a timeline, ver o resumo recomputado, excluir.
- **Client**: render smoke do `EventoForm`/`ReproducaoTab`; verificação no navegador (registrar evento → timeline + card de estado atualizam).

## 11. Decisões deferidas

- Edição de evento (hoje: excluir+recriar) · campos de produção/CCS do resumo (domínios futuros) · Sanidade/Nutrição · IEP por média móvel mais sofisticada · multi-fazenda/auth/migrations formais/IA.
