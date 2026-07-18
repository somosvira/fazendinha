# Rebanho — Salvaguarda de secagem + retorno à fila · Plano de implementação

> Revisto em 2026-07-18 após constatar que o PR #149 (mergeado) já entregou a UI de worklists.
> Spec: `docs/superpowers/specs/2026-07-16-rebanho-worklist-a-secar-design.md`.
> Task 1 (planner puro `planejarSincronizacaoLactacoes`) já está feita e verde nesta branch.

## Restrições globais
- Server: imports relativos `.ts` terminam em `.js`. Client: sem extensão.
- Decimais Prisma nunca viram `number` cru em cálculo. Aqui só copiamos/preservamos, sem aritmética.
- `FechamentoMensal` não se aplica (Lactacao/EventoReprodutivo não são Lançamento).
- Nenhuma alteração de schema Prisma.

## Task 1 — Planner puro *(concluída)*
`planejarSincronizacaoLactacoes` + tipos + testes em `reproducao.recompute.ts/.test.ts`. 16/16 verdes.

## Task 2 — Aplicação transacional não destrutiva no service de eventos

**Arquivos:** `server/src/services/rebanho/eventos.ts`, `server/src/services/rebanho/eventos.test.ts` (novo).

- [ ] **Step 1 — Teste vermelho de preservação + comportamento.** Em `eventos.test.ts`, com Prisma mockado (harness que capture as chamadas), provar:
  - registrar `SECAGEM` encerra só a lactação aberta mais recente (`dtFim`, `motivoSecagem`) e **não** emite `deleteMany` sobre lactações;
  - registrar outro evento (`INSEMINACAO`/`DIAGNOSTICO`) **não** altera lactações;
  - registrar `PARTO` cria só o ciclo novo;
  - excluir `SECAGEM` reabre o ciclo (`dtFim`/`motivoSecagem` limpos);
  - excluir `PARTO` preserva o ciclo;
  - lactação ambígua (dois `dtInicio` iguais) → `ConflitoLactacaoError`;
  - toda a sequência roda dentro de `prisma.$transaction`.
- [ ] **Step 2 — RED.** `pnpm --filter rionovo-server exec vitest run src/services/rebanho/eventos.test.ts`.
- [ ] **Step 3 — Implementar.** Refatorar `recomputarAnimal` para:
  - assinatura `recomputarAnimal(tx, animalId, mutacao)` onde `tx` é o cliente transacional e `mutacao: MutacaoEvento`;
  - ler `lactacao.findMany` (estruturais: id, numero, dtInicio, dtFim, motivoSecagem) + eventos;
  - chamar `planejarSincronizacaoLactacoes(persistidas, mutacao, animal.numPartosEntrada)`;
  - aplicar `CRIAR`/`ENCERRAR`/`REABRIR` com `tx.lactacao.create/update` (nunca `deleteMany`); `ENCERRAR` grava `dtFim`+`motivoSecagem`, `REABRIR` seta ambos a `null`;
  - recomputar o resumo com `recomputarResumoReproducao` (as lactações para o resumo continuam derivadas dos eventos via `reconstruirLactacoes`, que não é persistência);
  - `registrarEvento`/`excluirEvento` abrem `prisma.$transaction(async (tx) => { …criar/deletar evento…; await recomputarAnimal(tx, animalId, mutacao); })` e deixam o `ConflitoLactacaoError` propagar (rollback automático);
  - preservar a flag sticky `ehReceptora` na TE dentro da mesma transação.
- [ ] **Step 4 — GREEN + regressões.** `vitest run src/services/rebanho/eventos.test.ts` e a suíte `src/services/rebanho`.

## Task 3 — Conflito estrutural → HTTP 409 na rota

**Arquivo:** `server/src/routes/rebanho/eventos.ts` (+ teste de rota, se houver harness pronto).

- [ ] **Step 1 — Mapear.** Ampliar `fail()` para `ConflitoLactacaoError` → `{ status: 409, body: { error: e.message } }` (o tipo de retorno passa a incluir `409`). Importar a classe de `services/rebanho/reproducao.recompute.js` (ou reexportada por `eventos.js`).
- [ ] **Step 2 — GREEN.** Rodar testes de rota do rebanho, se existirem; senão validado no runtime.

## Task 4 — Retorno à fila no frontend

**Arquivo:** `client/src/rebanho/RebanhoContent.tsx`.

- [ ] **Step 1 — Intenção de retorno.** Adicionar `retorno: "lista" | "cockpit"` ao estado `registroInline`. `registrarDaWorklist` seta `retorno: "lista"` (e `dataInicial` p/ secagem — Task 5). Os dois `setRegistroInline` genéricos setam `retorno: "cockpit"`.
- [ ] **Step 2 — Bifurcar `onSalvo`.** Se `retorno === "lista"`: `setRegistroInline(null)`, `setRecarga((n) => n + 1)`, **sem** `onNavReb("animal")`. Caso contrário: fluxo atual (flash + `onNavReb("animal")`).
- [ ] **Step 3 — Remontar a fila.** Aplicar `key={recarga}` ao ramo que renderiza `ReproducaoTab`/`SanidadeTab` quando há `worklistChave`, para o `WorklistCanonica` interno rebuscar após o save (o hook `useWorklist` refaz o fetch ao remontar).

## Task 5 — `dataInicial` no EventoForm

**Arquivo:** `client/src/rebanho/components/EventoForm.tsx`.

- [ ] **Step 1 — Prop opcional.** Aceitar `dataInicial?: string`; inicializar `f.data` com `dataInicial ?? ""` no `useState` inicial (one-shot, sem `useEffect` que sobrescreva digitação). Chamadas sem a prop seguem com `data: ""`.
- [ ] **Step 2 — Passar do worklist.** Em `registrarDaWorklist`, quando `worklist.acao.tipoEvento === "SECAGEM"`, incluir `dataInicial: HOJE` no `registroInline` e repassar ao `EventoForm`.

## Task 6 — Verificação final

- [ ] `pnpm --filter rionovo-server run test` e `pnpm --filter rionovo-client run test` verdes.
- [ ] `pnpm build` (tsc + vite) verde nos dois workspaces.
- [ ] Runtime local isolado (Postgres local + rebanho real): seguir os 6 passos da seção "Runtime / navegador" da spec. **Nunca** apontar o passo de escrita ao Neon de produção.
- [ ] Revisar o diff restrito à fatia (`/code-review`), corrigir achados confirmados.

## Verificação
Cada task fecha com seus testes verdes; a fatia inteira fecha com as suítes completas, build e o fluxo real observado no navegador provando preservação de metadados e retorno à fila.

## Não-objetivos
Ver a seção correspondente da spec. Em especial: sem renome de slug, sem janela +30d, sem pills de urgência, sem tocar em schema/import.
