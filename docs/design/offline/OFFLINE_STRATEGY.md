# Estratégia offline-first — resumo e decisões

Consolidado da conversa sobre dar suporte offline ao Rio Novo (leitura +
escrita), cruzando o plano genérico (TanStack Query + IndexedDB + fila de
mutação) com a arquitetura real do repo. Feito em 2026-08-24.

Companheiro do [OFFLINE_AREAS.md](OFFLINE_AREAS.md) (que tem a tabela
tela-a-tela de dificuldade/utilidade). Este aqui é a estratégia; aquele é
o levantamento. Atualizar conforme cada fatia da camada 3 for implementada
(ver PRs referenciados abaixo).

## Objetivo

Cobrir o app inteiro com offline, mas rolando por área/feature — não tudo de
uma vez — seguindo um padrão único construído uma vez e reaplicado.

## Estado atual (ponto de partida)

- Zero infra de offline hoje: sem service worker, sem IndexedDB, sem fila de
  mutação.
- Sem TanStack Query. Cada módulo (`rebanho/corte/plantio/cultivo/equipe/financeiro`)
  tem seu próprio `client/src/<modulo>/api.ts`, com um `req()` **duplicado**
  (não compartilhado) e hooks hand-rolled (`useState`+`useEffect`+`fetch`).
- Verificado no código: os hooks são **realmente isolados por módulo** —
  migrar o `api.ts` do rebanho não afeta corte/plantio/etc. Único
  acoplamento cross-module real: `usePropriedades` (seletor de sítio) e
  `Lancar.tsx` importando `financeiro/api`.
- Todo fetch já passa por `comPropriedade()` (`client/src/propriedadeScope.ts`),
  que injeta `Authorization` + `X-Propriedade-Id`. A fila de mutação offline
  precisa persistir qual propriedade estava ativa no momento da escrita, não
  reler a ativa na hora do sync.

## As 4 camadas (não pensar em "módulo por módulo")

1. **Fundação** (uma vez): `QueryClient` + persister IndexedDB + wrapper de
   mutação offline (`networkMode: "offlineFirst"` + `resumePausedMutations()`
   no reconnect) + convenção de UI pra "resumo pendente de sincronizar".
2. **Dado de referência compartilhado** (uma vez, beneficia todo mundo de
   graça): cache de leitura de `Produto`, `CentroCusto`, `Categoria`,
   `Propriedade`. Leitura não tem custo de id/fila — puro ganho colateral
   pra rebanho/corte/plantio/cultivo ao mesmo tempo.
3. **Escritas de campo isoladas, priorizadas por valor** (cruzando módulos,
   não módulo por módulo) — ver ordem abaixo.
4. **Leituras agregadas por último** (dashboard, ficha do animal, sugestões)
   — só depois que os endpoints que elas agregam já estão cacheados.

## Ordem de rollout sugerida (camada 3)

1. **Ponto** (equipe) — mais simples de todas: `upsert` por chave natural
   (`funcionarioId`+`data`), sem recompute, horas calculadas por função pura
   no read. Candidata a nem precisar de id gerado no client.
2. **Pesagem + Sanidade** (corte)
3. **Sanidade + Produção-tanque** (rebanho)
4. **Fitossanidade + Nutrição + Colheita** (café)
5. **Produção** (milho)

Fora do escopo por ora: IA/chat, WhatsApp bot, OCR de nota (dependem de
serviço externo — impossível offline por definição) e telas administrativas
(Acessos, Config, Plano de contas — baixa utilidade offline).

## Achados técnicos que mudam a estimativa de dificuldade

- **A dificuldade real não é "quantas tabelas o endpoint toca"** — quase
  todo endpoint de campo segue o padrão *grava evento bruto → chama
  `*.recompute.ts`*, que atualiza um resumo agregado (ex.: `criarPesagem`
  chama `recomputarResumo(loteId)`). Não é impossível, mas exige a
  convenção de "pendente de sincronizar" da camada 1, reaplicada em cada
  tela — não reinventada por tela.
- **Id gerado no client (UUID/cuid) só é necessário quando uma escrita
  offline cria uma entidade-PAI que outra escrita offline, na mesma sessão
  sem sinal, vai referenciar antes de sincronizar.** Testado contra o
  escopo real da camada 3 (Ponto, Pesagem, Sanidade, Fitossanidade,
  Colheita, Produção): nenhum caso cria um pai novo offline — sempre
  referenciam `Animal`/`Lote`/`Talhão`/`Funcionário` já existente,
  cadastrado no escritório. Pro piloto atual, dá pra nem usar id
  client-gerado — só invalidar/recarregar a lista depois do sync resolve.
  Isso só passa a importar de verdade se o escopo expandir pra "cadastrar
  entidade-pai nova estando offline".
- **Escopo de um PR "módulo completo"** (ex.: rebanho): só mexer em
  tabelas exclusivas do módulo (`Animal`, `EventoReprodutivo`,
  `EventoSanitario`, `Lactacao`, `Dieta`). Tabelas compartilhadas
  (`Produto` etc.) ficam só como leitura cacheada dentro desse PR — a
  escrita nelas (cadastrar produto novo) continua exigindo internet, sem
  bloquear o PR.

## Decisão: manter `Int autoincrement` — reconciliar id temporário na fila

Revertido em 2026-08-24: em vez de mudar qualquer tabela pra `cuid`/UUID,
a escolha é **não mexer no tipo de id em lugar nenhum do schema** e lidar
com o id na camada da fila offline — id temporário local até o sync
confirmar, aí sim o registro ganha o id real (o `Int autoincrement` que o
Postgres sempre gerou).

**Mecanismo:** ao criar um registro offline, a UI mostra o item na lista
otimisticamente com uma chave só-local (nunca mandada pro servidor, só
serve de `key` de lista/React). Quando a mutation sai da fila e o servidor
responde, a lista é invalidada/recarregada — o registro real (com o `id`
verdadeiro, sequencial, gerado pelo Postgres na hora do insert de
verdade) substitui o item otimista. Não precisa de nenhuma troca de id
"manual" espalhada pelo código, porque a query só refaz o fetch.

**Por que isso é barato pro escopo atual (camada 3):** nenhuma das
candidatas (Ponto, Pesagem, Sanidade, Fitossanidade, Colheita, Produção)
cria uma entidade-PAI offline que outra escrita offline, na mesma sessão
sem sinal, precisaria referenciar antes de sincronizar — todas apontam pra
`Animal`/`Lote`/`Talhão`/`Funcionário` já existente. Ou seja: **não precisa
de rastreamento de dependência entre mutations nem de cascata de
falha/rollback** — é só o padrão padrão de "optimistic create → invalida →
refetch" que o TanStack Query já resolve de fábrica.

**Bônus de quebra:** essa escolha também resolve de graça o achado abaixo
(ordem de id importando em `Produção`) — como o id real continua sendo o
`Int autoincrement` de sempre, gerado pelo Postgres no momento real do
insert (só que atrasado até o sync), o desempate `[data desc, id desc]`
continua funcionando exatamente igual a hoje. Nenhuma tabela precisa de
tratamento especial por causa disso.

**Quando isso deixa de ser barato (não é o caso agora, mas registrar pro
futuro):** se o escopo um dia expandir pra "cadastrar `Animal`/`Lote`/
`Talhão` novo estando offline" **e** alguém, ainda offline, criar um
segundo registro que referencia esse pai recém-criado (ex.: cadastrar
animal → já lançar evento reprodutivo nele, tudo sem sinal) — aí sim vira
necessário: (1) rastrear no payload da fila que aquele campo é "aponta pro
id que a mutation N vai gerar", (2) reescrever esse campo quando a
mutation N sincronizar de verdade, (3) cascatear falha/cancelamento pros
filhos se a criação do pai for rejeitada. Nenhuma candidata da camada 3
cai nesse caso hoje.

**Pesquisa de "a ordem de id importa" feita antes de decidir (2026-08-24)
— mantida aqui como contexto, ainda que não seja mais bloqueante:**

`grep` de `orderBy` em todo `server/src/services/{ponto,corte,rebanho,plantio,cultivo}`
mostrou um padrão real e recorrente: várias listagens ordenam
`[{ data: "desc" }, { id: "desc" }]` — a data manda, e o **id desempata
registros do mesmo dia**, fazendo "o lançado por último no mesmo dia
vence/aparece primeiro". Isso está em produção hoje, silenciosamente. Por
candidata da camada 3:

| Feature | Depende de ordem de id? | Onde |
|---|---|---|
| **Rebanho > Produção (tanque)** | **Sim** — `[grupoId asc, data desc, id desc]`; o código pega o primeiro após essa ordenação como "a produção do dia" por grupo. Se dois lançamentos existirem no mesmo dia pro mesmo grupo (correção de valor), o `id desc` decide qual vale. | `services/rebanho/producao.ts:106` |
| **Cultivo > Produção** | **Sim** — mesma forma, ordena listagem por `[data desc, id desc]`. | `services/cultivo/producao.ts:20` |
| Ponto | Não — só `upsert` por `(funcionarioId, data)`, sem `orderBy` por id em lugar nenhum | `services/ponto/pontos.ts` |
| Corte > Pesagem | Não — `orderBy: { data: ... }` puro | `services/corte/pesagens.ts` |
| Corte > Sanidade (manejo) | Não — `orderBy: { data: "desc" }` puro | `services/corte/manejo.ts` |
| Plantio > Colheita | Não — `orderBy: { data: "desc" }` puro | `services/plantio/colheita.ts` |
| Plantio > Fitossanidade/Nutrição | Não — sem `orderBy` por id em `eventos.ts` | `services/plantio/eventos.ts` |

(Fora da camada 3 mas no mesmo padrão, achado de bônus: `cultivo/custos.ts`,
`cultivo/silos.ts` e `plantio/planejamento.ts` — apontamento de
hora-máquina — também desempatam por `id desc`.)

**Conclusão prática:** as duas telas de "Produção" da camada 3 **dependem
de verdade** de id sortável pra continuar funcionando certo — é por isso
que mudar o tipo de id era arriscado (UUID v4 aleatório quebraria
silenciosamente qual lançamento do dia "vence" no dashboard). Como a
decisão final foi **não mudar o tipo de id em nenhuma tabela**, esse risco
nem existe mais — o desempate continua usando o `Int` sequencial real,
gerado pelo Postgres. A pesquisa fica registrada porque foi o que revelou
que mexer no tipo de id tinha um custo escondido, o que ajudou a decidir
não mexer.

## Piloto recomendado

- **Estratégico:** Rebanho → Relatórios/Folha de campo (`FolhaCampoView.tsx`)
  — já existe o problema real (imprime, preenche a mão, digita depois);
  trocar por fila offline é ganho tangível imediato.
- **Tecnicamente mais simples pra validar o padrão primeiro:** Ponto —
  entidade única, sem recompute, sem trava tipo `FechamentoMensal`, e
  candidata a nem precisar de id client-gerado.

## Progresso

| Fatia | Status | PR |
|---|---|---|
| Fundação (QueryClient + persister IndexedDB + retomada automática) | ✅ Feito | [#228](https://github.com/piubellofelipe/fazendinha/pull/228) |
| Piloto: Ponto (equipe) | ✅ Feito — inclui fix incidental de `funcionarioId` no schema | [#228](https://github.com/piubellofelipe/fazendinha/pull/228) |
| Corte > Pesagem + Sanidade | ⬜ Não iniciado | — |
| Rebanho > Sanidade + Produção-tanque | ⬜ Não iniciado | — |
| Plantio (café) > Fitossanidade + Nutrição + Colheita | ⬜ Não iniciado | — |
| Cultivo (milho) > Produção | ⬜ Não iniciado | — |

Atualizar esta tabela a cada fatia da camada 3 que entrar.

## Ver também

[OFFLINE_AREAS.md](OFFLINE_AREAS.md) — tabela completa (dificuldade ×
utilidade) de toda tela do app, organizada pelos 8 grupos do menu.
