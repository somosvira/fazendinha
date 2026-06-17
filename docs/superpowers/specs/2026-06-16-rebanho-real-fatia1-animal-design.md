# Rebanho — Fase Real, Fatia 1: Backend + Animal (ponta a ponta) — Design

**Data:** 2026-06-16
**Status:** aprovado no brainstorming, pronto pra virar plano
**Antecede:** protótipo mock (specs/2026-06-16-modulo-rebanho-design.md), já mergeado na `main`.

---

## 1. Contexto e objetivo

O módulo Rebanho hoje é um **protótipo mock, read-only** (6 abas navegáveis, dados hardcoded). Esta fase o torna **real e utilizável**, usando o Ideagri como base. Estratégia: **fundo-e-estreito** — uma aba 100% real por vez, começando por **Animal** (é a base de tudo zootécnico; eventos das outras abas dependem de animais existirem). **A IA fica pra depois de tudo funcionar e validar.**

A Fatia 1 prova a stack inteira (schema → migração → API → formulário → UI) e cria o **molde** que as fatias seguintes (Reprodução, Sanidade, Nutrição) repetem.

## 2. Escopo

**Dentro:**
- Modelo Prisma do animal + apoio (`Animal`, `Raca`, `Grupo`, `ResumoAnimal`).
- Persistência no Neon (via `prisma db push`).
- API REST do animal: listar/filtrar, detalhar, criar, editar, dar baixa.
- A aba **Animal** e a **ficha-cockpit** passam a ler do backend (fim do mock de animal).
- **Formulário** "Novo / Editar animal" (drawer lateral, inputs controlados).
- **Seed** com os animais já validados (Jurema #1234 & cia) + `ResumoAnimal` correspondente.
- Testes de service no backend.

**Fora (fatias futuras):**
- Eventos (reprodução/sanidade/nutrição) e a **timeline** alimentada por eles — a timeline da ficha mostra **estado vazio** ("nenhum lançamento ainda") na Fatia 1.
- `ResumoAnimal` **computado a partir de eventos** — na Fatia 1 ele é **semeado/editável**, não calculado (vira calculado na Fatia 3).
- Multi-fazenda, autenticação, migrations formais (usamos `db push`), IA real.
- As abas Reprodução/Sanidade/Nutrição/Dashboard/IA continuam **mock** até suas fatias.

## 3. Arquitetura

Segue o padrão existente do repo:
- **Backend:** Hono **router fino → service** (espelha `routes/dashboard.ts` → `services/dashboard.ts`). Prisma 6 (client singleton `db.ts`), validação de payload com `@hono/zod-validator`. ESM, imports relativos com `.js`.
- **Client:** fetchers tipados em `client/src/rebanho/api.ts` no estilo de `client/src/api.ts` (`getJson`/`sendJson` sobre `/api`, proxiado pra :41873). Sem libs novas — formulário com inputs controlados na mão (estilo minimalista do projeto).
- **Estado de transição:** o app fica **híbrido** — Animal real, demais abas mock. Esperado e aceitável.

## 4. Modelo de dados (Prisma — adicionar ao `server/prisma/schema.prisma`)

Subset enxuto dos 86 campos do Ideagri (YAGNI). Decimais financeiros não se aplicam aqui.

```prisma
enum SexoAnimal { F M }
enum CategoriaAnimal { BEZERRA NOVILHA VACA BEZERRO TOURO }
enum StatusAnimal { ATIVO BAIXADO }
enum StatusReprodutivo { PEV VAZIA INSEMINADA PRENHE }

model Raca {
  id        Int      @id @default(autoincrement())
  nome      String   @unique
  animais   Animal[]
}

model Grupo {
  id        Int      @id @default(autoincrement())
  nome      String   @unique
  animais   Animal[]
}

model Animal {
  id               Int             @id @default(autoincrement())
  numero           String          @unique         // identificação visível (brinco de manejo)
  nome             String?
  sexo             SexoAnimal
  categoria        CategoriaAnimal
  raca             Raca?           @relation(fields: [racaId], references: [id])
  racaId           Int?
  grauSangue       String?                         // ex. "Girolando 5/8"
  dataNascimento   DateTime?       @db.Date
  dataEntrada      DateTime        @db.Date
  brincoEletronico String?
  sisbov           String?
  // genealogia auto-relacional
  mae              Animal?         @relation("Maternidade", fields: [maeId], references: [id])
  maeId            Int?
  pai              Animal?         @relation("Paternidade", fields: [paiId], references: [id])
  paiId            Int?
  filhosMae        Animal[]        @relation("Maternidade")
  filhosPai        Animal[]        @relation("Paternidade")
  grupo            Grupo?          @relation(fields: [grupoId], references: [id])
  grupoId          Int?
  setor            String?
  status           StatusAnimal    @default(ATIVO)
  dataBaixa        DateTime?       @db.Date
  motivoBaixa      String?
  resumo           ResumoAnimal?
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  @@index([status])
  @@index([grupoId])
}

// Read-model. Fatia 1: semeado/editável. Fatia 3: recalculado de eventos.
model ResumoAnimal {
  animal              Animal            @relation(fields: [animalId], references: [id], onDelete: Cascade)
  animalId            Int               @id
  statusReprodutivo   StatusReprodutivo @default(VAZIA)
  del                 Int?
  ordemLactacao       Int?
  producaoMediaDia    Decimal?          @db.Decimal(6, 2)
  producao305         Int?
  ccs                 Int?
  ccsTendencia        String?           // "subindo" | "estavel" | "caindo"
  ultimoDgData        DateTime?         @db.Date
  ultimoDgResultado   String?           // "positivo" | "negativo"
  iepProjetado        Int?
  diasGestacao        Int?
  previsaoSecagem     DateTime?         @db.Date
  atualizadoEm        DateTime          @updatedAt
}
```

Notas: **baixa, não delete** (mantém histórico, igual Ideagri). Genealogia aponta pra `Animal` (auto-relacional). `numero` único.

## 5. API (`server/src/routes/rebanho/animais.ts` → `server/src/services/rebanho/animais.ts`)

Montado com `app.route("/api", animaisRouter)`. Validação Zod via `@hono/zod-validator`.

- `GET /api/rebanho/animais?status=ATIVO&grupoId=&q=` → lista (com `resumo` embutido), filtrável por status/grupo/busca textual em numero|nome.
- `GET /api/rebanho/animais/:id` → animal + resumo + genealogia resolvida (mãe/pai/filhos como `{id,numero,nome}`).
- `POST /api/rebanho/animais` → cria (Zod: `numero` obrigatório+único, `sexo`, `categoria`, `dataEntrada`; resto opcional). Cria `ResumoAnimal` default junto.
- `PATCH /api/rebanho/animais/:id` → edita campos de cadastro.
- `POST /api/rebanho/animais/:id/baixa` → seta `status=BAIXADO`, `dataBaixa`, `motivoBaixa` (Zod). Não deleta.
- `GET /api/rebanho/grupos` e `GET /api/rebanho/racas` → para popular selects do formulário.

Erros: 404 quando `:id` não existe; 409 em `numero` duplicado; 400 em payload inválido (o zValidator já formata). Service lança erros tipados; router traduz pra status HTTP.

## 6. Client

- `client/src/rebanho/api.ts`: `getJson`/`postJson`/`patchJson` + fetchers tipados (`listarAnimais`, `obterAnimal`, `criarAnimal`, `editarAnimal`, `darBaixa`, `listarGrupos`, `listarRacas`). Tipos compartilham forma com `rebanho/types.ts` (estender se preciso).
- **Aba Animal** (`HerdDomainView` no domínio animal) e **ficha** (`AnimalCockpit`) passam a buscar do backend, com **estados de loading/erro/vazio**. O mock de animal (`mock/animais.ts`) deixa de alimentar essas telas (mantido só pro que ainda é mock — eventos/insights).
- **Formulário** `AnimalForm` (drawer lateral): campos de cadastro + selects de raça/grupo; botão "Novo animal" na aba Animal e "Editar" na ficha; ação "Dar baixa" (com motivo). Inputs controlados, submit → API → revalida a lista/ficha.
- **Ficha na Fatia 1:** identidade + genealogia + grupo + faixa de estado (`ResumoAnimal` semeado) = **reais**; a **timeline** mostra **estado vazio** ("nenhum lançamento ainda — comece pela aba Reprodução") até a Fatia 2.

## 7. Migração e seed

- **Schema → DB:** `pnpm --filter rionovo-server exec prisma db push` (cria as tabelas via pooler; sem shadow DB nem `DIRECT_URL`). `prisma generate` roda junto. Migration formal fica registrada como dívida pra antes de produção.
- **Seed:** script `server/prisma/seed-rebanho.ts` (idempotente, upsert por `numero`) populando `Raca`, `Grupo`, os ~8 `Animal` validados (Jurema, Aurora, Bonita, Cravina, Dália, Estrela, Jandira, Bezerra 1442) e seus `ResumoAnimal` — mesmos números dos mocks atuais, pra continuidade visual. Rodável via `pnpm --filter rionovo-server exec tsx --env-file=.env prisma/seed-rebanho.ts`.

## 8. Validação e regras

- Zod nos payloads (campos obrigatórios, enums, datas ISO).
- `numero` único (constraint no banco + 409 amigável).
- Baixa não deleta; animal baixado some das listas `status=ATIVO` por padrão.
- Genealogia: `maeId`/`paiId` opcionais; se informados, devem existir (valida no service).

## 9. Testes

- **Backend:** adicionar **Vitest** ao workspace server. Testar o **service** (`services/rebanho/animais.ts`) com um Prisma mockado/stub ou um cliente de teste: criação (gera resumo default), `numero` duplicado → erro, baixa muda status sem deletar, filtros. (Sem bater no Neon real nos testes unitários.)
- **Client:** os render smokes existentes continuam; ajustar o que dependia do mock de animal pra tolerar dados via prop/fetch (ou cobrir o `AnimalForm` com um render smoke).

## 10. Decisões deferidas (anotadas, não nesta fatia)

- Eventos + timeline real (Fatia 2) · `ResumoAnimal` computado (Fatia 3).
- Multi-fazenda (`Propriedade` como dimensão) — fica single-tenant agora; reavaliar antes de virar dívida.
- Autenticação real · migrations formais (hoje `db push`) · IA real.
