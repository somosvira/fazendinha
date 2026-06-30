# Plantio — Fase Real + Camada Operacional Ideagri (design)

**Data:** 2026-06-30 · **Autor:** sessão autônoma · **Status:** aprovado para execução (autonomia total, PRs sem merge)

## Contexto

O módulo **Plantio · café** já existe na `main` como **protótipo navegável 100% mock**
(PR #66, branch PLANTAS). Ele está no mesmo estágio em que o Rebanho esteve antes da
"Fase Real": schema Prisma café-arábica completo (`Talhao`, `Lavoura`, `PlanoAdubacao`,
`VariedadeCafe`, `OperacaoAgricola`, `InspecaoMIP`, `AmostraSolo`, `AmostraFoliar`,
`PassadaColheita`, `SafraTalhao`, `ResumoTalhao`), client com todas as abas (Fenologia,
Fitossanidade, Nutrição, Colheita, Custo, Estoque, Dashboard, IA) e rotas `/api/plantio/*`
— **mas servindo de `services/plantio/mock.ts`, sem banco e sem persistência.**

### Análise do Ideagri (módulo agrícola)

O Ideagri tem um módulo agrícola (`SAFRA`, `PROJETOAGRICOLA` [área/ha, planta/ha],
`MANEJOAGRICOLA` [operação reutilizável, 6 unidades de medida], `MANEJOAGRICOLATAREFA`
[tarefa: insumo, responsável, **qtd/ha e total previsto×realizado**, datas previsto×realizado,
6 valores de custo], `USOMAQUINA`, `HORAMAQUINAHOMEM`, `CENTROCUSTOSAFRA` [centro de custo
× safra × tipo de cultivo]). **Está vazio na fazenda 777** (SAFRA=1 default, tipos=3, resto
zerado) — **não há dado operacional real de plantio para importar.** O único dado real de
plantio é **financeiro**: ~188 lançamentos de café (R$ 381 mil, quase tudo investimento de
formação da lavoura: "Plantio Café", "Plantio Café - investimento").

Conclusão: o modelo café-arábica do protótipo é **mais rico** que o modelo genérico do
Ideagri. O que vale aproveitar do Ideagri é o que o café-modelo **não tem**: rastreio
**planejado × realizado** de tarefas, e **hora-máquina/hora-homem** (custo de mecanização
e mão-de-obra). Isso entra na Fatia P3.

## Objetivo

Tornar o módulo Plantio **real e usável**, espelhando a trajetória do Rebanho, em três
fatias (PR por fatia, sem merge):

- **P1 — Persistência do núcleo** (este PR): talhões/resumos/lavouras/planos/variedades no
  Postgres; rotas lendo/gravando Prisma; client batendo em `/api/plantio` real; CRUD de
  talhão; dashboard derivado de dados reais; seed café representativo; destravar o sidebar.
- **P2 — Eventos + colheita + custo real**: operações/inspeções/amostras/passadas persistidas,
  timeline costurada no cockpit, aba Colheita real (passadas + `SafraTalhao`), custo/saca
  ligado aos lançamentos financeiros reais de café (ponte como no Rebanho fatia 11/13).
- **P3 — Camada operacional Ideagri**: `Safra`, `ManejoAgricola`, `TarefaAgricola`
  (planejado×realizado), `HoraMaquinaHomem` (mecanização/mão-de-obra), safra↔centro de custo.

## Princípio-guia (igual ao Rebanho)

**A forma do DTO retornado ao cliente não muda.** O client já espera `Talhao`, `ResumoTalhao`,
`EventoTimeline`, `Lavoura`, `PlanoAdubacao` (ver `client/src/plantio/types.ts`). A Fase Real
troca a fonte (mock → Prisma) preservando a forma — exatamente como o backend e o client
mock já anunciam nos comentários ("quando o Prisma for plugado, a forma não muda").

---

## Fatia P1 — Persistência do núcleo (escopo deste PR)

### Backend

1. **Plumbing de banco**
   - Adicionar `DIRECT_URL` ao `server/.env` (local = `DATABASE_URL`, Postgres não-pooled) e
     ao `server/.env.example`.
   - `prisma db push` (cria as tabelas de plantio + corte que já estão no schema) + `prisma generate`.

2. **`server/prisma/seed-plantio.ts`** (idempotente, script `seed:plantio`)
   - Upsert de `VariedadeCafe` (cultivares do mock; `resistenteFerrugem` para Acauã/Arara/Icatu
     resistentes), `PlanoAdubacao` (5 do mock), `Lavoura` (6 do mock, ligando plano por nome),
     `Talhao` (15 do mock; resolve `variedadeId`/`lavouraId` por nome) e `ResumoTalhao` (14 do mock).
   - Não toca em nada do financeiro/rebanho. `codigo` do talhão é a chave natural de upsert.

3. **`server/src/services/plantio/`** (real, importando `prisma` de `../../db.js`)
   - `mappers.ts` — `toTalhaoDTO(row)` (resolve `variedade.nome`, `lavoura.nome`, `Decimal→number`,
     `Date→YYYY-MM-DD`, `id→String(id)`), `toResumoDTO(row)`.
   - `schemas.ts` — Zod: `criarTalhaoSchema`, `editarTalhaoSchema` (`.partial()`), `baixaSchema`,
     `listFiltrosSchema` (`estado` ATIVO/RECEPADO/FORMACAO/BAIXADO/TODOS default ATIVO, `lavoura`, `q`).
   - `talhoes.ts` — `listarTalhoes(f)`, `obterTalhao(id)`, `criarTalhao`, `editarTalhao`, `darBaixa`
     (baixa = `estado=BAIXADO` + `dataBaixa`/`motivoBaixa`, **não deleta** — preserva histórico, igual
     ao Rebanho). Classe `TalhaoError` com `NAO_ENCONTRADO`/`CODIGO_DUPLICADO`/`REF_INVALIDA`.
     `criarTalhao` cria o `ResumoTalhao` vazio junto (fase REPOUSO).
   - `cadastros.ts` — `listarLavouras()` (agrega `numTalhoes`/`areaHa`/`produtividadeMedia` por talhões),
     `listarPlanos()`, `listarVariedades()`.
   - Testes Vitest: `mappers.test.ts`, `cadastros.calc.test.ts` (agregação da lavoura).

4. **Rotas** (`server/src/routes/plantio/talhoes.ts`, `cadastros.ts`) — trocam mock por service,
   chained `new Hono().get().post().patch()`, `zValidator`, mapeamento de erro 404/409/400/500.
   Endpoints: `GET /plantio/talhoes`, `GET /plantio/talhoes/:id`, `POST /plantio/talhoes`,
   `PATCH /plantio/talhoes/:id`, `POST /plantio/talhoes/:id/baixa`, `GET /plantio/lavouras`,
   `GET /plantio/planos`, `GET /plantio/variedades`.

### Client

5. **`client/src/plantio/api.ts`** — trocar implementação mock por `fetch("/api/plantio/*")`,
   **mantendo as assinaturas e a forma dos DTOs**. `listarTalhoes/obterTalhao/obterResumo/
   listarLavouras/listarPlanos` viram reais; adicionar `criarTalhao/editarTalhao/darBaixa`.
   `useDashboard` passa a derivar dos resumos **anexados aos talhões reais** (em vez de `mockResumos`).
   `listarEventos` retorna `[]` por enquanto (timeline é P2 → cockpit mostra empty-state, igual ao
   Rebanho antes dos eventos); `useCustoPlantio` e `perguntarIA` seguem mock (viram reais em P2).

6. **`TalhaoForm.tsx`** — ligar aos endpoints `criarTalhao/editarTalhao/darBaixa` (hoje o form
   provavelmente não persiste). `TalhaoTab` recarrega após salvar.

7. **Destravar o sidebar** — `client/src/components/AppSidebar.tsx`: módulo `plantio` `disabled: false`.

### Verificação
- `tsc --noEmit` limpo (server + client), `vitest run` verde (server + client), `vite build` ok.
- Browser (chrome-devtools): seed → lista de talhões real, cockpit abre, criar/editar/baixa
  persistem, dashboard com números reais, sidebar Plantio navegável.

## Não-objetivos (P1)
- Timeline/eventos reais, colheita real, custo ligado ao financeiro (→ P2).
- Manejo/tarefa planejado×realizado, hora-máquina/hora-homem (→ P3).
- Multi-tenant, IA real (modo IA), integração de máquina.

## Riscos
- **Sem dado operacional real do Ideagri** → o seed é representativo (Sul de Minas, Embrapa/Conab),
  claramente sinalizado como demonstração, não dado da fazenda. (O custo real vem do financeiro em P2.)
- `id` Int do Prisma vs `id` string do client → resolvido no mapper (`String(id)`, opaco para o client).
