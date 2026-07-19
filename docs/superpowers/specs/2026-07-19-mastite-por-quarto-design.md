# Saúde de úbere por quarto mamário — Design

**Data:** 2026-07-19
**Fatia:** V1 §3 (Sanidade) — "histórico de mastite por quarto" + "CMT como entrada rápida via tablet".
**Módulo:** rebanho.
**Relacionado:** `2026-06-17-rebanho-fatia17-eventos-sanidade-design.md` (pipeline sanitário), `2026-06-17-rebanho-fatia19-qualidade-mastite-design.md` (import legado de MAMITE/ANALISELEITE), `2026-07-19-rebanho-hoje-preditivo-design.md` (feed de Sugestões #167).

## 1. Problema / motivação

Hoje a mastite é registrada como `EventoSanitario` do tipo `MASTITE` com um campo `quarto String?` de texto livre. A Fatia 19 importou os `MAMITE` legados concatenando quartos como texto (ex.: `"AD, PE"`) — **órfão**: nenhum cálculo agrega por quarto. O CCS existe em `EventoSanitario.EXAME`, mas é do **animal inteiro** (composto/tanque), não por teta.

Consequência: a sugestão de mastite do feed preditivo (#167, `avaliarMastite`) dispara com sinais **grossos e agregados no animal** — `ccs` composto, `ccsTendencia`, `mastites12m` (contagem). Ela não sabe **qual quarto** está doente nem distingue um quarto crônico reincidente de casos espalhados. Isso enfraquece a decisão ("secar/tratar" vs "descartar a vaca") e é o pré-requisito real da predição de mastite subclínica do V2 §5.3.

## 2. Objetivo / decisão entregue

Estruturar o quarto mamário (AE/AD/PE/PD) e montar a **série histórica por quarto** (mastite clínica + rastreio CMT/CCS), entregando **uma decisão acionável**: detectar **quarto crônico** e sugerir *"secar/tratar o quarto {PE} de #1188 — não sara"*, substituindo o sinal grosso `mastites12m` no feed de Sugestões por um sinal fino por quarto.

Escopo desta fatia (aprovado): **mastite clínica por quarto + CMT/CCS por quarto** — fecha o V1 §3 de sanidade inteiro.

### Convenção de quarto
`AE / AD / PE / PD` = anterior esquerdo, anterior direito, posterior esquerdo, posterior direito. **Alinhado ao import legado da Fatia 19** (`MAMITE` usa AD/AE/PD/PE), para consistência de nomenclatura no domínio.

## 3. Não-objetivos (YAGNI)

- **Sem** predição de mastite 14d por IA (isso é V2 §5.3; esta fatia constrói o dado que a alimenta).
- **Sem** backfill do `quarto` legado (texto livre concatenado tipo `"AD, PE"` — parsing heurístico arriscado por pouco ganho). O `EventoSanitario.MASTITE` antigo permanece read-only na timeline.
- **Sem** sub-aba dedicada nova — entrada na SanidadeTab, histórico na ficha do animal.

## 4. Arquitetura (Abordagem A — tabela unificada `ExameQuarto`)

Um único fato próprio por teta/data. CMT (subclínico) e episódio clínico convivem na mesma tabela, distinguidos por `clinica`. Segue o padrão do domínio: **fato → `.recompute.ts` puro → `ResumoAnimal`**.

### 4.1 Schema Prisma

```prisma
enum QuartoMamario { AE  AD  PE  PD }        // anterior esq/dir, posterior esq/dir
enum ScoreCmt { NEGATIVO  TRACOS  UMA_CRUZ  DUAS_CRUZES  TRES_CRUZES }

model ExameQuarto {
  id               Int            @id @default(autoincrement())
  animal           Animal         @relation(fields: [animalId], references: [id], onDelete: Cascade)
  animalId         Int
  data             DateTime       @db.Date
  quarto           QuartoMamario
  scoreCmt         ScoreCmt?      // rastreio subclínico; null se registro só clínico
  ccs              Int?           // CCS individual do quarto, se houver
  clinica          Boolean        @default(false)   // episódio de mastite clínica neste quarto
  severidade       String?        // leve/moderada/grave (só clínica)
  resultadoCultivo String?        // agente isolado (só clínica)
  perdido          Boolean        @default(false)   // quarto seco/perdido (agênese funcional)
  observacao       String?
  propriedadeId    Int?           // multi-propriedade (nullable, padrão do projeto)
  createdAt        DateTime       @default(now())
  @@index([animalId, quarto, data])
  @@index([propriedadeId])
}
```

Campos derivados novos em `ResumoAnimal`:

```prisma
quartosCronicos  Int  @default(0)
quartosPerdidos  Int  @default(0)
```

Relação inversa `examesQuarto ExameQuarto[]` em `Animal`. Escopo de propriedade segue `docs/design/multi-propriedade.md` (coluna nullable + index + backfill no boot cobre a principal).

### 4.2 Fonte de verdade

- Episódios clínicos **novos** → `ExameQuarto` com `clinica=true` (estruturado por quarto).
- `EventoSanitario.MASTITE` legado → permanece, aparece na timeline, **read-only** (retrocompat). Não é migrado.

## 5. Lógica de cronicidade — `services/rebanho/quarto.recompute.ts` (puro)

Função pura testável. Entrada: lista de `ExameQuarto` de um animal (data ISO, quarto, scoreCmt, ccs, clinica, perdido). Saída: estado por quarto + agregados.

Parâmetros (defaults; exportados como constantes):

- `CCS_POSITIVO = 400` (mil/mL).
- Positivo subclínico firme: `scoreCmt ∈ {DUAS_CRUZES, TRES_CRUZES}` **ou** `ccs ≥ CCS_POSITIVO`. `UMA_CRUZ`/`TRACOS` = suspeita (não conta como positivo firme).
- `JANELA_MESES = 12`.
- **Quarto crônico:** no mesmo quarto, `≥3` eventos positivos (subclínico OU clínico) em 12m **ou** `≥2` `clinica=true` em 12m.
- **Quarto perdido:** qualquer `perdido=true` no quarto → conta em `quartosPerdidos`, sai do denominador tratável.
- **Estado do quarto** (precedência): `PERDIDO` > `CRONICO` > `ATIVO` (último positivo < 60d, não crônico) > `SADIO`.

Saída:
```
{
  porQuarto: { [AE|AD|PE|PD]: { estado, positivos12m, clinicas12m, ultimoPositivo: ISO|null } },
  quartosCronicos: number,   // → ResumoAnimal
  quartosPerdidos: number    // → ResumoAnimal
}
```

`recomputarSanidade(animalId)` passa a buscar também os `ExameQuarto` e persistir `quartosCronicos`/`quartosPerdidos` no upsert de `ResumoAnimal` (mantendo `ccs`/`ccsTendencia` atuais). A janela de 12m é relativa à data corrente (`lib/hoje`), passada como parâmetro para manter o calc puro/determinístico nos testes.

## 6. Ligação com Sugestões (#167)

`avaliarMastite` em `sugestoes.calc.ts` passa a preferir o sinal fino:

- Se `quartoCronico` presente (via `quartosCronicos ≥ 1`): sugestão vira **"Secar/tratar quarto {X} de #NNNN — crônico"**, ação apontando para o registro por quarto.
- Sem `ExameQuarto` no animal → **fallback** para o comportamento atual (`ccs alto + subindo + mastites12m ≥ 2`). Retrocompat: testes existentes de `sugestoes.calc.test.ts` continuam passando.

`AnimalSugestao` ganha campo opcional `quartoCronico?: { quarto: string }`; `sugestoes.ts` popula a partir do `ResumoAnimal`/derivação.

## 7. Backend

Split padrão rota fina → service → calc puro:

- `services/rebanho/quarto.recompute.ts` (+ `.test.ts`) — §5.
- `services/rebanho/exames-quarto.schemas.ts` — Zod da passada: `{ data, quartos: [{quarto, scoreCmt?, ccs?, clinica?, severidade?, resultadoCultivo?, perdido?}] }` (1–4 tetas, quarto único por passada).
- `services/rebanho/exames-quarto.ts` — `registrarExameQuarto` (grava 1–4 linhas), `listarExamesQuarto`, estende `recomputarSanidade`. Escopo de propriedade (`resolverEscopoEscrita`).
- `routes/rebanho/exames-quarto.ts` — `POST /animais/:id/exames-quarto`, `GET /animais/:id/exames-quarto`; montar em `index.ts`.

## 8. Frontend

- **Entrada (SanidadeTab):** modo "CMT por quarto" no registro do animal — grade das 4 tetas com botões de score (−/tr/+/++/+++), toggle clínica/perdido por teta, salvar a passada; fluxo otimizado para várias vacas seguidas. Reúsa o padrão de modal existente.
- **Histórico (AnimalCockpit / ficha):** **mapa de úbere** — 4 quadrantes coloridos por estado (sadio/ativo/crônico/perdido) + série temporal de CMT/CCS por quarto. Reúsa formatadores de `charts.tsx`.
- **`rebanho/api.ts`:** `registrarExameQuarto` + `useExamesQuarto`, sempre com `comPropriedade()`.

## 9. Testes & entrega

- Vitest: `quarto.recompute.test.ts` (crônico por 3 subclínicos; crônico por 2 clínicas; perdido; precedência de estado; janela 12m; animal sem exames) e `exames-quarto.schemas.test.ts`.
- Smoke render no front (`__smoke__/render.test.ts`) para os componentes novos.
- Smoke de rota no backend (`scripts/smoke-exames-quarto.ts`) no Postgres local.
- `pnpm build` verde nos dois workspaces.
- PR único fechando o V1 §3 de sanidade. Atualizar ROADMAP.md (marcar os dois ⬜ como ✅).

## 10. Reúso (exigência do roadmap §10)

- `recomputarSanidade` / `ResumoAnimal` / padrão `.recompute.ts` puro.
- Feed de Sugestões (#167) — `avaliarMastite`.
- Modal de registro da SanidadeTab; `AnimalCockpit` (timeline/ficha); `charts.tsx` (formatadores).
- `comPropriedade()` / `resolverEscopoEscrita` (multi-propriedade).
- Convenção AE/AD/PE/PD do import legado (Fatia 19).
