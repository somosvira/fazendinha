# Rebanho — Histórico de Lactações (Fatia 1)

**Data:** 2026-07-14 · **Módulo:** Rebanho (leite) · **Origem:** catálogo Ideagri, fila #1 (ver `docs/design/ideagri-catalogo-features.md`).

## Problema

Hoje o módulo Rebanho mostra apenas a **lactação atual** de cada vaca (via `ResumoAnimal`, espelho do read-model `ANIMALINFO_PRODUCAO` do Ideagri). Não há **histórico**: quantas lactações a vaca já teve, quando começou/terminou cada uma, por que foi seca, qual a produção de cada ciclo. O model Prisma `Lactacao` existe mas é **anêmico** (só `numero`, `dtInicio`, `dtFim`) e **não é lido por lugar nenhum** — nem a timeline do cockpit, nem qualquer service. O Ideagri tem **335 lactações reais** (`LACTACAO`: 173 animais, 232 encerradas + 103 abertas) que nunca importamos.

Sem histórico de lactações não conseguimos falar de **persistência**, **vida produtiva**, comparação entre ciclos, nem exibir a linha do tempo reprodutiva completa da vaca (parto → lactação → secagem → parto).

## Objetivo

Importar o histórico de lactações do Ideagri, enriquecer o model `Lactacao`, costurar as lactações na **timeline do cockpit** do animal, e adicionar uma **seção "Lactações" no cockpit** com a lista de ciclos (ordem, início, fim, duração, DEL, motivo de secagem, produção quando disponível).

## Descobertas de dados (Ideagri 777, verificado 2026-07-14)

- **`LACTACAO`** (335 linhas) — o fato histórico. Colunas úteis: `CDANIMAL`, `DTINICIO`, `DTFIM` (null = aberta), `CDMOTIVOSECAGEM` (→ `MOTIVOSECAGEM.DESCRICAO`), `TIPOALEITAMENTO` ('A' natural/…), `INDUZIDA` (0/1), `CRIADESMAMADA`.
- **`MOTIVOSECAGEM`** (10 valores reais): Rotina, Baixa produção, Mastite, Animal doente, Comportamento, Problemas de casco, Baixa/Venda da cria, Baixa/Venda do animal, Movimentação própria ou da cria, Outros.
- **Produção por lactação:** só existe detalhada para a **última** lactação, no read-model `ANIMALINFO_PRODUCAO` (`PRODUCAOTOTALULTLAC`, `PRODUCAO305ULTLAC`, `MEDIAPRODULTLAC`, `DURACAOLACTACAO`, `ORDEMLACTACAO`). Para lactações **anteriores** o Ideagri não guarda os totais num campo direto — teriam de ser derivados dos controles `LEITE` por janela `[DTINICIO, DTFIM]`.

**Decisão de escopo (honesta):** nesta fatia importamos o **histórico completo de datas + motivo de secagem + flags** (335 lactações), e a **produção detalhada apenas da última lactação** (já disponível no read-model, sem derivação). Produção por lactação anterior fica como **débito explícito** (derivar de `LEITE` é uma fatia própria — "produção informada na lactação", fila do catálogo). A UI mostra a produção quando existe e um traço quando não — sem número inventado (mesmo princípio honesto das fatias de custo).

## Abordagens consideradas

**A) Enriquecer `Lactacao` + costurar na timeline + seção no cockpit (recomendada).**
Segue exatamente o pipeline consagrado do módulo (extração → JSON → import → model → service puro → cockpit). Baixo risco, aditivo, testável. É a forma como todas as fatias anteriores (repro, sanidade, pesagens) entraram.

**B) Nova aba "Lactações" no nível do rebanho (lista de todas as vacas × ciclos).**
Mais ambicioso: uma aba dedicada com ranking de persistência, vida produtiva média do rebanho. Maior valor analítico, porém maior escopo e sem o gancho natural do cockpit. Melhor como **fatia 1b** depois que o dado estiver dentro.

**C) Só timeline (sem seção dedicada).**
Menor esforço, mas subutiliza o dado — a lista de ciclos com motivo de secagem é o que o produtor quer ver de relance.

**Recomendação: A.** Entrega o valor central (histórico visível e costurado) com o menor risco, e deixa B como evolução natural.

## Design (Abordagem A)

### 1. Schema Prisma — enriquecer `Lactacao`

```prisma
model Lactacao {
  id             Int       @id @default(autoincrement())
  animal         Animal    @relation(fields: [animalId], references: [id], onDelete: Cascade)
  animalId       Int
  numero         Int       // ordem da lactação (1ª, 2ª…) = ORDEMLACTACAO
  dtInicio       DateTime  @db.Date
  dtFim          DateTime? @db.Date   // null = em curso
  motivoSecagem  String?               // MOTIVOSECAGEM.DESCRICAO
  tipoAleitamento String?              // TIPOALEITAMENTO
  induzida       Boolean   @default(false)
  // produção — preenchida só quando disponível (última lactação via read-model)
  producaoTotal  Decimal?  @db.Decimal(10, 2)  // litros no ciclo
  producao305    Decimal?  @db.Decimal(10, 2)  // litros corrigidos a 305d
  duracaoDias    Int?                            // DEL final do ciclo
  propriedadeId  Int?      // multi-propriedade (default principal no boot)

  @@index([animalId, numero])
}
```

Migração **aditiva** (colunas nullable + default). Como prod roda `db push`, não há backfill de SQL — mas aqui não é preciso backfill (colunas novas nascem null; o import repopula tudo). `propriedadeId` segue o padrão multi-propriedade (`garantir…` no boot preenche as existentes com a principal).

### 2. Pipeline de extração (reproduzível)

Estender o pipeline existente (`scripts/rebanho-dump.sql` → `build-rebanho-json.mjs` → `import-rebanho.ts`), seguindo o padrão dos blocos delimitados `@X@`:

- **`rebanho-dump.sql`**: novo bloco `@Y@` com `SELECT` de `LACTACAO` LEFT JOIN `MOTIVOSECAGEM`, mais um LEFT JOIN em `ANIMALINFO_PRODUCAO` para trazer produção/duração **apenas quando `ORDEMLACTACAO` = número da lactação corrente** (a última). Campos: cdanimal, numero(ordem), dtInicio, dtFim, motivoSecagem, tipoAleitamento, induzida, e (só última) producaoTotal/producao305/duracaoDias.
- **`build-rebanho-json.mjs`**: `parseLactacao(f)` puro (TDD, latin1→utf8, datas ISO, `induzida` 0/1→bool, decimais). Emite `lactacoes[]` no JSON.
- **`import-rebanho.ts`**: `createMany` de `Lactacao` (idempotente via cascade do animal, como os outros eventos). Ordena por `numero` dentro do animal.

O número da lactação (`numero`) vem de `ORDEMLACTACAO` quando disponível; se o Ideagri não numerar as históricas, derivar por ordem cronológica de `DTINICIO` dentro do animal (regra pura, testada).

### 3. Backend — service + timeline + API

- **`services/rebanho/lactacoes.ts`**: `listarLactacoes(animalId)` (ordenado por numero desc), com cálculo puro `resumoLactacoes(lactacoes, hoje)` em arquivo `.calc.ts` separado e testado: deriva **DEL da lactação em curso** (hoje − dtInicio), **duração** das encerradas, **vida produtiva** (Σ durações), **nº de lactações**, **produção média por ciclo** (das que têm produção). Nada de I/O no `.calc.ts`.
- **`services/rebanho/timeline.ts`**: adicionar `prisma.lactacao.findMany` às fontes costuradas e um mapper `toTimelineLactacao` → eventos "Início de lactação (Nª)" e "Secagem — motivo" no domínio `producao`. Isso enriquece o cockpit com os marcos de início/fim de cada ciclo, entrelaçados com parto/controles/pesagens já existentes.
- **Rota**: `GET /api/rebanho/animais/:id/lactacoes` (router fino → service; respeita escopo de propriedade via `resolverEscopoLeitura`).

### 4. Frontend — seção no cockpit

- **`rebanho/api.ts`**: `fetchLactacoes(animalId)` com `comPropriedade()` nos headers.
- **`AnimalCockpit.tsx`**: nova seção **"Lactações"** (abaixo de Genealogia), renderizando a lista de ciclos: `Nª · início → fim · duração (DEL) · motivo de secagem · produção total / 305d (ou "—")`, mais um mini-resumo no topo (nº de lactações, vida produtiva, produção média/ciclo). A lactação em curso é destacada ("em curso · DEL X").
- A timeline do cockpit já refletirá os marcos automaticamente (via #3).

### 5. Testes e verificação

- **Puro/TDD**: `parseLactacao` (transformer), `resumoLactacoes.calc` (DEL/duração/vida produtiva, incluindo lactação aberta e casos sem produção).
- **Server vitest**: service `listarLactacoes` + timeline inclui lactações.
- **Idempotência**: rodar `import:rebanho` 2× → 335 lactações estáveis.
- **Browser**: cockpit de uma vaca multípara (ex.: CATARINA/CAROLINA) mostra vários ciclos com motivo de secagem real; timeline entrelaça início/secagem com parto.

## Não-objetivos (débitos explícitos)

- **Produção por lactação anterior** (derivar de `LEITE` por janela) — fatia própria ("produção informada na lactação").
- **Correção 305 oficial** (`CORRECAO305`) — fila #5 do catálogo.
- **Aba "Lactações" no nível do rebanho** (ranking de persistência) — evolução B, fatia 1b.
- **Work-list "a secar"** (vacas próximas de secagem) — encaixa depois, usando `dtPrevistaSecagem` do resumo.

## Impacto

Aditivo. Toca: `schema.prisma` (enriquece `Lactacao`), pipeline de extração (+1 bloco), `import-rebanho.ts`, 1 service novo + `timeline.ts`, 1 rota, `rebanho/api.ts` + `AnimalCockpit.tsx`. Não altera custo/produção/reprodução existentes. Segue o padrão multi-propriedade.
