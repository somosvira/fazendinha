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

1. **Fundação** (uma vez): `QueryClient` + persister IndexedDB + `useOfflineMutation`
   (patch otimista + `resumePausedMutations()` no reconnect, `networkMode`
   no default `"online"` — pausa em vez de falhar quando sem rede, sem
   round-trip fadado a falhar; ver seção abaixo) + convenção de UI pra
   "resumo pendente de sincronizar".
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

**Também fora do escopo da fundação (#228), registrado aqui de propósito
pra não ficar implícito:** service worker/app shell (PWA). O que existe
hoje cobre "o app já estava aberto com rede e no meio do uso a conexão
cai" — não cobre "abrir o navegador do zero sem nenhuma rede" (confirmado:
reload de página offline sem visita prévia falha com
`net::ERR_INTERNET_DISCONNECTED`, não tem nada servindo o HTML/JS
localmente). Caminho padrão pra resolver isso quando for priorizado:
`vite-plugin-pwa` (Workbox) só pra precache do shell — granularidade
grossa está ok (telas fora do escopo da camada 3 podem ficar
desabilitadas offline, não precisa cobrir tudo).

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

**Atualização (2026-08-25): o mecanismo abaixo foi construído na própria
fundação, não deixado pra depois.** Apesar de nenhuma candidata da camada
3 precisar hoje — nem entidade-pai cross-entity (Lote→Pesagem), nem o
caso mais simples e mais provável de acontecer de verdade (criar um item
offline e editar esse **mesmo** item de novo, ainda offline, antes de
sincronizar) — a lógica de reconciliação de id temporário é parte da
fábrica `useOfflineMutation` desde o início, porque é PR de fundação: a
lógica base tem que estar certa aqui, não remendada quando o primeiro
módulo real precisar. Ver seção "Reconciliação de id temporário" abaixo
pro mecanismo completo (`scope` + mapa `idsResolvidos` + `resolverIds`).

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

## Padrão de mutation offline: `useOfflineMutation`

Toda escrita offline-aware usa a fábrica genérica em
`client/src/lib/offline/useOfflineMutation.ts` — nenhuma tela implementa
optimistic update na mão. Cada chamador só declara:

- `mutationKey` — fixo, identifica a mutation na mutation cache.
- `queryKeys(input)` — quais listas em cache a escrita afeta com patch
  otimista de verdade (array — normalmente uma só; mais de uma serve pro
  caso do mesmo item, sem cálculo nenhum, aparecer em mais de uma lista ao
  mesmo tempo, ex.: lista geral + lista filtrada).
- `queryKeysRelacionadas?(input)` — opcional: outras queries que só levam
  `invalidateQueries` (sem patch, sem chute) — pra dado **derivado**,
  calculado a partir do que foi escrito (ex.: um resumo agregado
  recomputado no servidor). Nunca dispara enquanto pausado offline — só
  roda em `onSettled`, que só acontece quando a mutation sai de `paused`
  de verdade (já com rede).
- `op` — `"create" | "update" | "delete" | "upsert"`.
- `match(item, input)` — identidade do item na lista (chave natural ou id).
- `criarOtimista(input)` — **exigido pelo tipo** quando `op` é
  `"create"`/`"upsert"` (tipo discriminado por `op` — esquecer é erro de
  compilação, não crash em runtime nem objeto vazio silencioso): monta o
  item a mostrar antes da confirmação do servidor, `id` sempre via
  `criarIdTemporario()`. Campos computados pelo backend entram
  aproximados/zerados, corrigem no refetch pós-sync.
- `scopeId?` — opcional: agrupa mutations que podem referenciar id gerado
  por outra da mesma família de entidade (ver "Reconciliação de id
  temporário" abaixo). Default: isolada por `mutationKey`.
- `resolverIds?(input)` — opcional: reescreve id temporário no input pro
  id real já resolvido, antes do `mutationFn` rodar de verdade.

A fábrica cuida do resto sozinha: patch otimista de cada lista em
`onMutate` (com snapshot por key, pra rollback certo mesmo com mais de uma
afetada), rollback em `onError`, `invalidateQueries` em `onSettled` (nas
`queryKeys` e nas `queryKeysRelacionadas`) pra reconciliar com o servidor
(troca o item otimista pelo real, com `id` verdadeiro — funciona sem
UUID/cuid por causa da decisão acima), e a reconciliação de id temporário
entre mutations relacionadas (`scope` + mapa de resolução — ver seção
própria abaixo).

`TItem` precisa ter `id: string` (convenção já seguida por todo DTO do
projeto) — é o que permite a fábrica gerenciar reconciliação de id sem
cada config precisar de um acessor `idDoItem` a mais.

**Passo obrigatório, não automático — fácil de esquecer:** todo módulo que
usa a fábrica precisa **também** chamar `registrarMutationDefaults(config)`
(a config inteira, não só `mutationKey`+`mutationFn`) uma vez, **em
escopo de módulo** (fora de qualquer hook/componente — ex.: logo após
definir a config em `equipe/api.ts`). O hook sozinho registra de novo a
cada render, mas isso é só reforço — não cobre o caso "app abriu numa aba
diferente da que criou a escrita pendente" (ver achado abaixo, é bug real
que já aconteceu aqui, duas vezes). Sem essa chamada de escopo de módulo,
a fatia nova reproduz o mesmo bug do zero.

Usada pelo Ponto (`equipe/api.ts` → `useUpsertRegistro`, `op:"upsert"` —
chave natural `funcionarioId+data`, sem `scopeId`/`resolverIds` porque
nada referencia um registro de Ponto por id). A próxima fatia
(Pesagem/Sanidade) usa `op:"create"` — mesma fábrica, sem reescrever a
lógica de optimistic/rollback.

### Achado: `setMutationDefaults` — bug corrigido antes de fechar a fundação

Funções não sobrevivem à serialização pro IndexedDB — a doc oficial do
TanStack é explícita: "only the state of mutations is persisted, as
functions cannot be serialized." Sem `setMutationDefaults` registrado por
`mutationKey` antes da hidratação, uma mutation restaurada do storage após
um reload fica sem `mutationFn` pra executar (`"No mutationFn found"`). A
primeira versão do piloto não registrava isso — funcionava no caso
"reconecta sem fechar a aba" (mutation viva em memória, nunca precisou ser
reidratada) mas quebraria no caso real "fecha o app offline com algo
pendente, reabre depois".

**Segunda volta desse mesmo achado:** a primeira correção registrava o
default só *dentro* do hook `useOfflineMutation` — o que não basta,
porque o hook só roda se o componente dono estiver montado. Se o app
reabre numa aba diferente da que criou a mutation pendente (ex.: fecha
offline na tela de Ponto, reabre e cai no Dashboard), o resume tenta
rodar no boot e quebra de novo, porque `PontoTab` nunca montou nesta
sessão pra registrar o default. Corrigido com `registrarMutationDefaults`
— função **de escopo de módulo**, chamada uma vez no topo de `equipe/api.ts`
(não dentro de hook nenhum). Funciona porque `App.tsx` importa os módulos
de tela estaticamente (sem `React.lazy`) — o módulo é avaliado no
carregamento do bundle, antes de qualquer render, independente de qual
aba o usuário está vendo. Testado de verdade: salvar offline no Ponto,
reconectar e abrir o app **direto no Dashboard** (nunca voltando pro
Ponto) — sincronizou sozinho, confirmado no Postgres.

**Terceira volta — a mais séria: registrar só `mutationFn` não bastava.**
Verificado no source do TanStack (`queryClient.ts#defaultMutationOptions`):
o merge que toda mutation passa (nova OU restaurada — ambas passam por
`mutationCache.build()`) é
`{...defaults_globais, ...getMutationDefaults(mutationKey), ...options_passadas}`.
`getMutationDefaults` devolve o **objeto inteiro** que foi registrado, não
só `mutationFn`. Como `registrarMutationDefaults` registrava só
`{mutationFn}`, uma mutation restaurada sem componente montado rodava a
chamada HTTP crua e mais nada — sem `onMutate` (patch otimista), sem
`onError` (rollback), sem `onSettled` (reconciliar cache). O teste do
Dashboard acima "passou" porque o `POST` chega no servidor de qualquer
jeito — mas não provava que o resto da lógica rodava junto. Corrigido:
`montarOpcoes(config)` monta o objeto completo uma vez, usado tanto pelo
hook quanto por `registrarMutationDefaults` — nunca mais diverge entre os
dois caminhos. Testado de novo com log temporário: `onSuccess` e
`onSettled` disparam no cenário do Dashboard, confirmado.

### Convenção: query key factory por módulo

Cada módulo declara suas próprias keys num objeto único (`pontoKeys` em
`equipe/api.ts`), `as const` — não um mapa global do app. Módulos não se
enxergam entre si (verificado — ver "Estado atual" acima), então uma
factory por app inteiro seria abstração sem uso; o ganho é só dentro do
módulo, ter uma fonte única pra `queryKey`/`mutationKey` em vez de arrays
literais repetidos em cada hook (risco: duas chamadas montam "a mesma" key
com formato levemente diferente, viram duas entradas de cache separadas,
silenciosamente). Repetir esse padrão em cada `api.ts` migrado.

### Escrita afetando mais de uma query

Dois casos, dois mecanismos diferentes (implementados, sem consumidor real
ainda no Ponto — ele só toca uma lista — mas prontos pra próxima fatia):

- **Mesmo dado, sem cálculo, em duas listas** (ex.: `FuncionarioDTO` numa
  lista geral e numa lista filtrada; provável ao migrar Funcionários ou a
  ficha do Animal no Rebanho). Usa `queryKeys` retornando mais de uma key
  — a mesma operação (`op`/`match`/`criarOtimista`) é aplicada em cada
  uma, com patch otimista de verdade nas duas, porque não tem chute
  envolvido: é o próprio input.
- **Dado derivado em outra query** (ex.: Corte > Pesagem escreve na lista
  de pesagens **e** dispara recompute do `ResumoLote` no servidor — o
  padrão "grava evento bruto → recompute" já descrito acima). Não dá pra
  patch otimista no resumo (duplicaria a conta do servidor). Usa
  `queryKeysRelacionadas` — só invalida, sem tentar adivinhar o valor.

Limitação que continua real (sem consumidor, não construída): o cache
alvo do patch otimista é sempre uma **lista** (`TItem[]`). Um write que
afetasse um objeto único em cache (não uma lista) precisaria de outro
caminho — não vale generalizar sem um caso de uso real.

### Reconciliação de id temporário

Cenário: cria um item offline (ganha `id` temporário, via
`criarIdTemporario()` → `"local:<uuid>"`, prefixo que nunca colide com o
`id` real, sempre numérico) e **edita esse mesmo item de novo**, ainda
offline, antes de sincronizar. Quando a rede volta, a criação sincroniza e
ganha o `id` real do Postgres — mas a edição, se já estava na fila
referenciando o `id` temporário, precisa saber o `id` novo antes de
disparar pro servidor, senão o servidor não sabe o que é `"local:<uuid>"`.

Descartado desde a decisão original (seção acima): gerar o id real no
client (UUID/cuid) pra mandar como input do create — o Postgres continua
gerando o `id` real sempre. Sobrando só reconciliação: substituir o id
temporário pelo real depois que ele existe de verdade.

Dois mecanismos, o segundo só é seguro por causa do primeiro:

1. **`scope: { id: scopeId }`** — opção nativa do `useMutation` (TanStack
   v5). Mutations com o mesmo `scopeId` rodam **em fila, uma de cada vez,
   na ordem em que foram criadas** — mesmo que `resumePausedMutations()`
   dispare `.continue()` em todas via `Promise.all` no reconnect. Fonte
   verificada em `mutationCache.ts#canRun`: acha a primeira mutation
   `status:"pending"` do scope (por ordem de inserção no array — a ordem
   real de criação); só ela pode rodar, as outras ficam bloqueadas até
   essa resolver. **Testado empiricamente** (não só lido no source): duas
   mutations do mesmo scope, `mutationFn` com atraso artificial de 2s —
   confirmado que a segunda só começa (`START`) depois da primeira
   terminar (`END`) por completo, zero sobreposição de horário.
   `scopeId` é configurável por `useOfflineMutation`, default isolado por
   `mutationKey` (mutations sem relação entre si não esperam umas pelas
   outras à toa — só entram na mesma fila quando o config pede
   explicitamente, ex.: `criar`/`editar`/`excluir` da mesma entidade
   compartilhando `scopeId`).
2. **Mapa `idsResolvidos` (em memória) + `resolverId`/`resolverIds`** —
   quando uma mutation de `create`/`upsert` resolve de verdade, o
   `onSuccess` da fábrica grava `idTemporario -> idReal` no mapa. A
   garantia de ordem do `scope` acima é o que torna isso seguro: a
   próxima mutation do mesmo `scopeId` só começa a rodar **depois** desse
   `onSuccess` ter terminado — então quando `resolverIds` (fornecido no
   config de quem depende do id) roda dentro do `mutationFn` da mutation
   seguinte, o id já está no mapa.

Limitação conhecida, não resolvida: `idsResolvidos` é só em memória, não
persiste em IndexedDB. Se o app fechar bem no meio — depois do create
resolver, antes da mutation dependente ter rodado — a reconciliação se
perde nessa janela específica (estreita: só existe enquanto as duas ainda
estão na fila do mesmo scope). Registrado como próximo passo se aparecer
um caso real que precise disso (persistir o mapa via `idb-keyval`, mesmo
mecanismo já usado pro cache de queries).

Nenhum consumidor real hoje (Ponto usa chave natural, nunca referencia um
registro por id) — construído na fundação mesmo assim, porque é PR de
fundação: a lógica base precisa estar certa aqui, não remendada depois.

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
