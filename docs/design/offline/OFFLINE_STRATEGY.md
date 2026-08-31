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
  tem seu próprio `client/src/<modulo>/api.ts`, com hooks hand-rolled
  (`useState`+`useEffect`+`fetch`). **Atualização 2026-08-25:** `req()` era
  duplicado por módulo até esta mudança — agora é `lib/offline/req.ts`,
  compartilhado, o choke point único que espera a fila liberar (ver
  "Fila de escritas pendentes" abaixo).
- Verificado no código: os hooks são **realmente isolados por módulo** —
  migrar o `api.ts` do rebanho não afeta corte/plantio/etc. Único
  acoplamento cross-module real: `usePropriedades` (seletor de sítio) e
  `Lancar.tsx` importando `financeiro/api`.
- Todo fetch já passa por `comPropriedade()` (`client/src/propriedadeScope.ts`),
  que injeta `Authorization` + `X-Propriedade-Id`. A fila de mutação offline
  precisa persistir qual propriedade estava ativa no momento da escrita, não
  reler a ativa na hora do sync.

## As 4 camadas (não pensar em "módulo por módulo")

1. **Fundação** (uma vez): `QueryClient` + persister IndexedDB (leitura) +
   fila própria de escritas pendentes (`lib/offline/fila.ts`, não mutation
   do TanStack — ver seção "Padrão de mutation offline" abaixo) + `req()`
   compartilhado que espera a fila liberar antes de qualquer fetch +
   `useOfflineMutation` (patch otimista) + convenção de UI pra "resumo
   pendente de sincronizar" (`ShellOffline` bloqueia a tela durante o
   replay).
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
3. **Sanidade + Produção-tanque** (rebanho) — nome herdado do mapeamento
   original; **corrigido em `docs/design/offline/REBANHO_SANIDADE_PRODUCAO_NOTAS.md`**:
   `producaoModo` é um toggle único pra fazenda inteira (`ORDENHA` vs.
   `TANQUE_LOTE`, tabelas/endpoints diferentes por modo — não é só
   UI, muda inclusive a fórmula de cálculo no servidor). O dado real
   importado (`rebanho_real.json`) confirma que a Rio Novo usa `ORDENHA`
   (controle por vaca, `ControleForm`) — **não** o modo tanque/lote que o
   nome desta fatia sugere. O modo tanque (`ProducaoTab`→`LoteForm`) não
   tem uso real e fica fora de escopo.
4. **Fitossanidade + Nutrição + Colheita** (café)
5. **Produção** (milho)

Fora do escopo por ora: IA/chat, WhatsApp bot, OCR de nota (dependem de
serviço externo — impossível offline por definição) e telas administrativas
(Acessos, Config, Plano de contas — baixa utilidade offline).

**Fora do escopo da fundação (#228), resolvido no PR seguinte:** service
worker/app shell (PWA). O que existia até #228 cobria "o app já estava
aberto com rede e no meio do uso a conexão cai" — não cobria "abrir o
navegador do zero sem nenhuma rede" (confirmado: reload de página offline
sem visita prévia falhava com `net::ERR_INTERNET_DISCONNECTED`, não tinha
nada servindo o HTML/JS localmente).

**Implementado com `vite-plugin-pwa`** (`client/vite.config.ts`), estratégia
`generateSW` (Workbox por baixo), `registerType: "autoUpdate"`, `manifest:
false` (não é sobre instalar como app, só sobre o shell carregar sem rede —
granularidade grossa está ok). `navigateFallback: "/index.html"` com
`navigateFallbackDenylist: [/^\/api\//]` — só intercepta navegação de
página, nunca `/api/*` (esse continua 100% por conta da fundação, sem
nenhum cache do Workbox no meio). Registrado em `main.tsx` via
`virtual:pwa-register` (`registerSW({ immediate: true })`) — só ativo no
build de produção, sem efeito em `vite dev`.

Testado: `vite build && vite preview`, reload com `Network.emulateNetworkConditions
offline:true` (zero rede de verdade, não só sem `/api`) tanto na raiz quanto
num deep link (`/equipe/ponto`) — os dois carregam o shell normal (tela de
login) em vez de `net::ERR_INTERNET_DISCONNECTED`.

## Trava de UI pra área sem suporte offline

Com o shell podendo carregar offline (seção acima), toda tela do app abre
mesmo sem rede — mas só o Ponto tem escrita enfileirada de verdade; o resto
tentaria buscar/gravar dado e falharia de forma confusa (spinner preso,
erro genérico, ou pior, deixar clicar "salvar" e perder a alteração
silenciosamente). Decisão: travar a aba inteira em vez de deixar renderizar
quebrada.

Implementado em `App.tsx`: `TABS_OFFLINE` (um `Set<Tab>`, hoje só
`eqp-ponto`) + `useOnlineStatus()`. Fora da lista, sem rede, `conteudo`
renderiza `OfflineGatedTab` no lugar da tela real — mesmo padrão que já
existia pra falta de permissão (`GatedTab`/`canAccessTab`), só reusado.
Testado no browser real: offline, abrir Rebanho mostra a trava; abrir Ponto
funciona normal (mesmo aviso "sem conexão" de sempre). Atualizar
`TABS_OFFLINE` conforme cada fatia da camada 3 ganhar fila própria.

Outras formas consideradas (checagem por query, banner sem travar, overlay
por cima do conteúdo, interceptar no service worker) ficaram de fora por
serem mais trabalho pro mesmo resultado, ou por não atenderem "travar de
verdade" — comparação detalhada num scratch local, não versionado.

## Convenção: densidade de comentário

Registrado em 2026-08-27, revisando o PR de Corte (#235) — vale pra todo PR
do epic, não só esse. Comentário bom é o que é **necessário pra entender a
lógica** (uma armadilha real, um porquê não-óbvio) — não o que narra a
história da mudança ("movida pra cá", "mesmo motivo do X acima", "espelha o
PR #Y"). Esse tipo de nota pertence à descrição do PR, não ao código — ela
apodrece conforme o código muda e some da PR depois do merge de qualquer
forma. Preferir uma linha curta a um bloco de várias; se dois arquivos
acabam com o mesmo comentário explicando a mesma coisa (achado comum entre
telas irmãs, ex.: Pesagem/Sanidade), é sinal de que a explicação deveria
estar num lugar só (o código compartilhado, não repetida por chamador).

## Convenção obrigatória por módulo: pré-validar antes de enfileirar

Registrado em 2026-08-25, pra valer a partir da próxima fatia (Pesagem/Sanidade):
todo formulário que usa `useOfflineMutation` precisa validar o máximo de erro de
**input** possível antes de chamar `mutate` — reduz a classe de erro mais comum
que poderia envenenar a fila (ver limitação abaixo). Erro de **regra de negócio**
que depende de estado do servidor (ex.: `FechamentoMensal` — a competência podia
estar aberta quando o usuário editou offline e fechar antes do sync rodar) nunca
dá pra prevenir no client — não é falha de validação, é o mundo mudando entre o
enfileiramento e o envio. Pré-validação reduz a frequência do problema, não
elimina — o mecanismo de recuperação abaixo continua necessário mesmo com
validação perfeita.

**Como validar: reusar o schema Zod do server via `packages/shared`
(`@rionovo/shared`), não reescrever regra no client.** Primeiro caso, também
em 2026-08-25: `PontoTab.tsx` roda `upsertRegistroSchema.safeParse(body)`
antes de enfileirar — mesmo schema que o server usa em `zValidator`. Achado
retroativo: Ponto (único módulo já em produção) tinha exatamente esse gap
(intervalo negativo, observação sem limite de tamanho) — a convenção não é
só pra fatia nova, vale corrigir módulo já shippado quando achar o caso.

**Recuperação de erro na fila — metade resolvida em 2026-08-25.** Erro de
item (validação/regra de negócio — qualquer status não-2xx que não seja 401)
não contamina os outros: `fetchCru` lança `ErroHttp` (com `status`),
`processarFila` tira só esse item da fila, move pro registro auditável
(`idb-keyval`, chave `rionovo-fila-erros` — item inteiro + `erro` +
`falhouEm`) e **segue com o resto**, sem bloquear mais nada. Testado em
`fila.test.ts`: item com 400 vai pro log, o item seguinte sincroniza normal.
Nenhuma UI pra ler/apagar/mandar pro time ainda — de propósito, fica pra bem
depois; hoje auditar é abrir DevTools → IndexedDB → `rionovo-fila-erros`.

**401 — resolvido em 2026-08-25, via `window.location.reload()` pós-login.**
Continua parando a fila inteira (de propósito: é erro da sessão, não do
item — não vai pro log de erros, senão todo item atrás acumularia entradas
repetidas da mesma causa). `entrar()` em `App.tsx` persiste a sessão nova e
recarrega a página — o boot (`main.tsx`) roda de novo com o token novo no
`localStorage`, `iniciarFila()` retoma a fila sozinha, sem lógica de retry
nova (este app usa sessão de expiração deslizante — `AUTH_SESSAO_DIAS`, sem
refresh token separado — ver `services/auth/sessao.ts`). Trade-off aceito por
ora: reload perde a "sticky activation" do clique, então a música/animação
da abertura Terrano não toca mais logo após o login — revisitar antes de
mergear a PR.

## Convenção obrigatória por módulo: hooks de leitura em `useQuery` antes de qualquer escrita offline

Achado analisando a próxima fatia (Corte > Pesagem/Sanidade, 2026-08-27): a
convenção de pré-validação acima cobre a **escrita**, mas faltava
documentar uma pré-condição da **leitura** — só query registrada no
`queryClient` (`useQuery`) é persistida pelo `persister` em IndexedDB (ver
`client/src/lib/offline/persister.ts`/`main.tsx`). Um hook hand-rolled
(`useState`+`useEffect`+`fetch` direto — o padrão original de todo
`api.ts` antes da fundação) nunca passa pelo `queryClient`: não importa
quanto tempo o app já rodou online, o dado nunca sobrevive a um F5 offline.

Isso já aconteceu uma vez em produção: `useFuncionarios` (dropdown de
funcionário do Ponto) ficou nesse padrão antigo mesmo depois da fundação
(#228) — só foi pego testando F5 offline de verdade, não por revisão de
código (ver tabela de Progresso abaixo). **Regra, a partir de agora:**
antes de dar suporte offline de escrita a um módulo, migrar pra `useQuery`
todo hook de leitura do qual a tela depende — não só o formulário de
escrita em si, mas dropdowns/listas de apoio que a tela também lê (ex.: o
seletor de lote/funcionário/animal).

**Verificado nesta análise (2026-08-27): `client/src/corte/api.ts` inteiro
ainda está no padrão antigo** — `useLotes`, `useLote` e `useEventos` usam
`useState`+`useEffect`+`fetch` direto, zero uso de `useQuery` no arquivo.
Migrar esses três hooks é pré-requisito da fatia Pesagem/Sanidade, não
trabalho à parte — sem isso, o mesmo bug do Ponto reaparece (dropdown de
lote fica vazio depois de F5 offline).

**Armadilha companheira, já resolvida uma vez e fácil de repetir:**
`query.data ?? []` sem memoizar cria um array novo a cada render. Se algum
efeito depende desse valor (ex.: recalcular algo derivado da lista) e a
query está pausada offline (nunca visitada — `networkMode` padrão
(`"online"`) nem chega a tentar o fetch, fica em `pending` pra sempre), o
efeito re-executa a cada render em loop infinito — trava real da tela, não
só "carregando pra sempre". Fix: constante de módulo (ex.: `const
LOTES_VAZIO: Lote[] = [];`), nunca um literal `[]` inline no retorno do
hook.

## Convenção obrigatória: cobrir toda operação da feature, não só create

Achado numa revisão pós-#237 (2026-08-29): a primeira versão de "Rebanho >
Evento sanitário" só cobriu `create` offline, com um comentário no código
justificando isso como "mesmo escopo do Corte > Sanidade". A analogia era
falsa — Corte > Sanidade/Pesagem nunca tiveram editar/excluir em lugar
nenhum do app (create sempre foi 100% da feature ali), enquanto Evento
sanitário **já tinha** editar e excluir online antes desta fatia existir.
Cobrir só create deixou os botões "Editar"/"Excluir" visíveis e clicáveis
offline (a ficha do animal já estava em `TABS_OFFLINE`), só que eles
falhavam com o erro cru do `fetch` em vez de enfileirar — pior que não
oferecer o botão, porque parece que devia funcionar.

**Regra, a partir de agora:** ao dar suporte offline a uma feature, checar
quais operações ela já tem em algum lugar do app (create/editar/excluir) —
não assumir que create sozinho é "o mesmo padrão" de outra feature sem
conferir se essa outra feature de fato não tem as demais operações também.
Cobrir todas as que existirem, não só create. Quando alguma ficar de fora
por complexidade real (não por prazo), documentar o motivo técnico
específico no lugar certo (nota de design da fatia), nunca só "fora de
escopo" sem explicação — isso é exatamente o tipo de comentário que a
convenção de densidade de comentário (acima) pede pra evitar.

**Aplicado nesta mesma revisão:** editar e excluir de Evento sanitário
passaram a usar `useOfflineMutation` como o create. Editar dá patch
otimista real só na timeline (título/detalhe recalculados) — saldo e
movimento de estoque ficam invalidate-only, porque reconciliar uma troca
de produtoId/quantidade exigiria conhecer o vínculo anterior pra reverter
e reaplicar, e isso não valia a complexidade extra pro ganho (corrige
sozinho no refetch pós-sync). Excluir devolve a quantidade ao saldo na
hora (o dado já vem no `dadosEdicao` que a timeline carrega, sem precisar
buscar nada a mais) e remove o evento da lista; o movimento de estoque
vinculado só some da lista depois do sync.

## Checklist: o que "testado" significa pra uma fatia offline

Consolidado depois de verificar #233/#234 na prática — testar no navegador
real pegou dois gaps (`useFuncionarios` fora do `queryClient`, loop
infinito offline) que nenhuma leitura de código nem teste automatizado
isolado tinha capturado antes. Antes de marcar uma fatia como "Feito" na
tabela de Progresso abaixo:

1. **Regressão automatizada que prova o bug** — escrever o teste, confirmar
   que ele falha sem o fix (isolar via `git stash` do arquivo do fix,
   mantendo o teste) e passa com o fix restaurado. Não confiar só em
   "parece corrigido lendo o código".
2. **Browser real, offline de verdade** — DevTools → Network → Offline (ou
   `Network.emulateNetworkConditions offline:true`), não só desconectar o
   Wi-Fi (cache do SO pode mascarar o resultado). Reload (F5) tanto na
   raiz quanto num deep link da tela (`/equipe/ponto`, `/corte/...`) — os
   dois caminhos carregam o shell de formas diferentes.
   **`pnpm dev` não serve pra isso** — o `VitePWA` (`client/vite.config.ts`)
   não tem `devOptions.enabled`, então o service worker não roda no Vite
   dev server; qualquer reload/navegação offline nesse modo vai dar
   `ERR_INTERNET_DISCONNECTED` mesmo com o app funcionando perfeitamente
   em produção. Pra validar o service worker (reload/deep-link/cold-start
   offline), tem que ser contra o build de produção — ver comandos abaixo.
   Interagir com a SPA já carregada (clicar, preencher formulário, sem
   reload) pode ser feito em `pnpm dev` mesmo sem o worker — essa parte
   depende só da fila (`lib/offline/fila.ts` + IndexedDB), não do SW.

   ```bash
   pnpm --filter rionovo-client run build   # gera dist/sw.js
   pnpm --filter rionovo-client exec vite preview --port 41875
   # abrir http://localhost:41875, navegar ONLINE pelo menos uma vez
   # (registra o SW e faz o precache), então offline + reload/deep-link
   ```
3. **Caso "nunca visitado" além do caso feliz "já visitado online"** —
   toda combinação de filtro/seleção (funcionário×mês no Ponto; lote no
   Corte) que nunca foi buscada enquanto online precisa de comportamento
   explícito offline (mensagem clara), não um spinner que gira pra
   sempre — a query fica pausada, nunca chega a errar sozinha.
4. **Ciclo completo de escrita** — criar/editar offline → item aparece
   otimista na lista → reconectar → confirma e (se foi `create`) o id
   temporário some, substituído pelo id real, sem duplicar nem sumir da
   lista.
5. **Todo hook de leitura que a tela usa está em `useQuery`** — não só o
   hook do formulário de escrita (ver convenção acima).

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
sincronizar) — a reconciliação de id temporário é parte da fundação desde
o início, porque é PR de fundação: a lógica base tem que estar certa
aqui, não remendada quando o primeiro módulo real precisar. Ver seção
"Reconciliação de id temporário" abaixo pro mecanismo completo (substring
replace na fila, sem callback nenhum por módulo).

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

## Fila de escritas pendentes (`lib/offline/fila.ts`)

**Mudança de arquitetura em 2026-08-25**, registrada abaixo com o motivo:
a fundação **não usa mais `useMutation`/`resumePausedMutations`/`scope`
do TanStack para escrita**. Em vez de uma mutation do TanStack (que
precisa sobreviver à serialização, retomar sozinha no reconnect e
serializar via mecanismo interno de terceiro), toda escrita pendente é um
**item de dado puro** — path/method/body, nenhuma função — numa lista
persistida em IndexedDB (`idb-keyval`, chave própria, separada do cache
de leitura). Motivo da virada: um callback por config (`resolverIds`) pra
resolver id temporário exigia que cada módulo lembrasse de escrever a
substituição certa; ficando esquecido, quebra silenciosamente. Com a fila
sendo dado puro, a reconciliação de id vira um mecanismo genérico — roda
igual pra qualquer módulo, sem nenhum módulo precisar declarar nada a
mais (ver "Reconciliação de id temporário" abaixo).

- Um único loop (`processarFila`, com `await` sequencial de verdade — não
  depende de nenhum mecanismo interno de terceiro pra garantir ordem)
  drena a fila item a item, na ordem em que foram enfileirados.
- Enquanto drena, `aguardarFilaLivre()` trava qualquer outro `fetch` do
  app (ver `req.ts`) — nenhum fetch roda fora de ordem, nem os automáticos
  do TanStack (`refetchOnReconnect`).
- `ShellOffline` bloqueia a tela inteira (overlay fixo, tela toda) nesse
  mesmo intervalo — usuário não consegue disparar uma ação nova por cima
  do que ainda está sincronizando.
- Todo `req()` de todo módulo (não só quem usa `useOfflineMutation`)
  espera essa mesma trava — ver `client/src/lib/offline/req.ts`,
  substituiu as 6 cópias de `req<T>` que cada `api.ts` tinha.

## Padrão de mutation offline: `useOfflineMutation`

Toda escrita offline-aware usa a fábrica genérica em
`client/src/lib/offline/useOfflineMutation.ts` — nenhuma tela implementa
optimistic update na mão. Cada chamador só declara:

- `mutationKey` — string fixa, só usada pra filtrar `pendentes` na UI (não
  é mais chave de mutation cache do TanStack).
- `path(input)` / `method` / `body?(input)` — a requisição em si. Isso
  (não uma função arbitrária) é o que vira o item da fila — é o que
  permite a fila ser dado puro, sem registro de função nenhum por tipo.
- `criarOtimista?(input)` — opcional (omitido quando a escrita não cria
  nada novo — delete, update puro): ponto único de criação do item
  otimista, roda **uma vez** por `mutate()`, nunca por queryKey (evita id
  divergente entre entradas). `id` sempre via `criarIdTemporario()`.
  Campos computados pelo backend entram aproximados/zerados, corrigem no
  refetch pós-sync.
- `queryKeys(input, itemOtimista)` — lista de entradas `{ queryKey,
  aplicar? }`, uma por cache afetado. `aplicar` **ausente** = só
  `invalidateQueries` depois do sync, sem patch (dado **derivado**,
  recomputado no servidor — ex.: resumo agregado). `aplicar` **presente**
  recebe o valor atual do cache (`T | undefined` — a query pode nunca ter
  rodado offline) e o item otimista já pronto (2º argumento — nunca gerado
  de novo dentro do `aplicar`), devolve o novo valor. Anotado na mão por
  quem escreve (`aplicar: (atual: SaldoDTO[] | undefined) => ...`), sem
  wrapper genérico — o tipo `T` não precisa ser lista, pode ser qualquer
  formato de cache (objeto agregado único, por exemplo).

A fábrica cuida do resto: snapshot de cada entrada antes de aplicar (pra
rollback certo mesmo com mais de uma afetada), enfileiramento
(`enfileirarMutation`, em `fila.ts`), rollback em erro real do servidor
(restaura o `anterior` de toda entrada), `invalidateQueries` em toda
entrada quando a fila confirma a escrita.

**Helpers diretos pro caso comum de cache em lista** (não curried, nunca
devolvem função — chamados de dentro do `aplicar` já anotado):
`appendItemToCacheList`, `removeItemFromCacheList`,
`updateItemInCacheList` (merge profundo — ver abaixo) e
`upsertItemInCacheList` (merge se já existe, senão acrescenta). Cada um
normaliza seu próprio "vazio" (`atual ?? []`) — nunca devolve `undefined`,
mesmo recebendo `atual: T | undefined`; é a mesma regra que todo `aplicar`
customizado tem que seguir (bloquear a escrita nesse caso seria errado —
ela tem efeito real, vai pra fila, independente do que dá pra mostrar
otimista).

**Merge é profundo, não raso.** `updateItemInCacheList`/
`upsertItemInCacheList` usam `mesclarProfundo(item, patch)` — recursiva,
escrita na mão (sem virar dependência de `lodash`): objeto plano em objeto
plano recursa campo a campo, array e primitivo substituem o valor inteiro.
Motivo: um patch parcial com spread raso (`{...item, ...input}`) perde
qualquer campo irmão dentro de um objeto aninhado que não veio no
`input` — ex.: mandar só `input.endereco.rua` apagaria
`input.endereco.numero` se `item.endereco` fosse sobrescrito inteiro pelo
spread em vez de mesclado campo a campo. Testado em
`useOfflineMutation.test.ts`.

Usada pelo Ponto (`equipe/api.ts` → `useUpsertRegistro`, via
`upsertItemInCacheList` — chave natural `funcionarioId+data`) e pelo Corte
(`corte/api.ts` → `useRegistrarPesagem`/`useRegistrarManejo`, via
`appendItemToCacheList` na Timeline + entradas sem `aplicar` pro
Resumo/lista de lotes) — mesma fábrica pros dois formatos de escrita, sem
reescrever a lógica de optimistic/rollback.

### Convenção: query key factory por módulo

Cada módulo declara suas `queryKey`s num objeto único (`pontoKeys` em
`equipe/api.ts`), `as const` — não um mapa global do app. Módulos não se
enxergam entre si (verificado — ver "Estado atual" acima), então uma
factory por app inteiro seria abstração sem uso; o ganho é só dentro do
módulo, ter uma fonte única em vez de arrays literais repetidos em cada
hook (risco: duas chamadas montam "a mesma" key com formato levemente
diferente, viram duas entradas de cache separadas, silenciosamente).
`mutationKey` é só uma string literal na config (não faz parte da mutation
cache do TanStack mais — ver seção acima), não precisa de factory.
Repetir esse padrão em cada `api.ts` migrado.

### Convenção: modal de escrita usa `useSalvarOffline`

Registrado em 2026-08-27, revisando o PR de Corte (#235). `mutate()` do
`useOfflineMutation` nunca espera a rede (aplica o otimista e enfileira na
hora, sempre) — certo pra edição inline (Ponto), mas um **modal** que fecha
na hora, mesmo online, perde a rede de segurança do padrão antigo: se o
POST falhar (erro que o schema client não pegou), o usuário já saiu da tela
e só sabe pelo toast, sem chance de corrigir sem perder o que digitou.

`client/src/lib/offline/useSalvarOffline.ts` resolve isso: online, espera
`onSuccess`/`onError` do `mutate` antes de fechar (erro aparece dentro do
próprio modal, dá pra corrigir na hora); offline, fecha direto — não dá pra
esperar por tempo indeterminado, erro tardio (raro, só depois do sync) vira
toast. Usado por `PesagemForm`/`ManejoForm` (Corte) — todo modal de escrita
offline-aware futuro deveria reusar em vez de reimplementar o branch
online/offline na mão.

### Escrita afetando mais de uma query

Um único mecanismo — `queryKeys` devolve uma entrada por cache afetado,
cada uma decide por si se tem `aplicar` ou não:

- **Mesmo dado, sem cálculo, em mais de uma lista** (ex.: `FuncionarioDTO`
  numa lista geral e numa lista filtrada; a Timeline de eventos do Corte).
  Cada entrada correspondente tem seu próprio `aplicar` (normalmente o
  mesmo helper chamado várias vezes) — patch otimista de verdade em todas,
  porque não tem chute envolvido: é o próprio `input`/`itemOtimista`.
- **Dado derivado em outra query** (ex.: Corte > Pesagem escreve na lista
  de pesagens **e** dispara recompute do `ResumoLote` no servidor — o
  padrão "grava evento bruto → recompute" já descrito acima). Não dá pra
  patch otimista no resumo (duplicaria a conta do servidor). A entrada
  correspondente simplesmente **não** declara `aplicar` — só é invalidada
  quando a fila confirma a escrita.

O cache alvo do patch otimista não precisa ser uma lista — `aplicar` pode
mirar qualquer formato (objeto agregado único, por exemplo), já que quem
escreve `aplicar` anota o tipo `T` na mão; a fábrica não assume `TItem[]`
em nenhum ponto.

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

Mecanismo genérico, sem callback por módulo — vive inteiro em `fila.ts`:

1. **Ordem sequencial por construção.** `processarFila` é um único loop
   com `await` — a próxima escrita só começa depois que a anterior
   terminou (sucesso, erro real, ou rede caiu de novo). Não depende de
   nenhuma opção/mecanismo interno do TanStack pra garantir isso — é só a
   semântica normal de `await` num `while`, o que também é o motivo de
   não precisar mais de `scope` (removido nesta mudança de arquitetura).
2. **Substituição por replace, não por callback.** Cada item da fila que
   *cria* algo carrega `idTemporarioGerado` (o id local usado no item
   otimista). Quando esse item sincroniza e o servidor devolve o `id`
   real, `substituirIdNaFila` faz um replace — string em `path`, walk
   recursivo em `body` — em **todos os itens restantes da fila**, trocando
   toda ocorrência do id temporário pelo real antes deles serem enviados.
   Não precisa de registro nenhum por `mutationKey`/módulo: funciona pra
   qualquer item futuro que referencie o id, sem ninguém precisar
   declarar `resolverIds` ou equivalente.

Como cada item é dado puro (path/method/body, sem função), a substituição
funciona mesmo que o app feche e reabra no meio — o id temporário já
substituído fica persistido na própria fila via `idb-keyval`, não depende
de um mapa em memória que se perderia num fechamento no meio do processo
(limitação real da versão anterior, baseada em `scope`+mapa em memória;
resolvida de graça por esta mudança de arquitetura).

Nenhum consumidor real hoje (Ponto usa chave natural, nunca referencia um
registro por id) — construído na fundação mesmo assim, porque é PR de
fundação: a lógica base precisa estar certa aqui, não remendada depois.
Sem consumidor real, a cobertura vem de `lib/offline/fila.test.ts`: mocka
`fetch`/`idb-keyval` e prova as duas coisas que Ponto sozinho não
exercitaria — substituição de id temporário entre dois itens da fila, e
ordem estritamente sequencial (a segunda escrita só começa depois que a
primeira responde, não em paralelo).

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
| Fix: `useFuncionarios` (dropdown de funcionário do Ponto) lia via `useState`+`fetch` direto, fora do `queryClient` — nunca persistia em IndexedDB, então F5 offline zerava a lista. Migrado pra `useQuery` (mesmo padrão de `useRegistros`) | ✅ Feito — achado testando F5 offline de verdade | [#233](https://github.com/piubellofelipe/fazendinha/pull/233) |
| Fix: `query.data ?? []` sem memoizar em `useFuncionarios`/`useRegistros` criava array novo a cada render; offline, com a query de registros pausada (funcionário/mês nunca cacheado), o `useEffect` de `PontoTab` que depende de `registros` entrava em loop infinito de render (trava real, não só "carregando pra sempre"). Corrigido com referência estável (`FUNCIONARIOS_VAZIO`/`REGISTROS_VAZIO`) | ✅ Feito — achado escrevendo o teste de regressão do item acima | [#233](https://github.com/piubellofelipe/fazendinha/pull/233) |
| Fix: "Preencher grade com horário padrão" chamava `preencherGrade()` direto (fora da fila de escrita offline — é bulk/idempotente no backend, não um upsert único enfileirável); offline o clique só falhava com erro genérico sem enfileirar nada. Botão agora fica desabilitado sem conexão | ✅ Feito | [#233](https://github.com/piubellofelipe/fazendinha/pull/233) |
| `gcTime` (queryClient) + `maxAge` (persistQueryClient) aumentados de 24h → 72h — 24h era curto pra fazenda sem sinal por alguns dias | ✅ Feito | [#233](https://github.com/piubellofelipe/fazendinha/pull/233) |
| Fix: trocar de mês offline pra uma combinação funcionário/mês nunca cacheada ficava com `<Loader/>` girando pra sempre — a query fica pausada (networkMode padrão nunca chega a tentar o fetch, então nunca erra). Mês já cacheado continua mostrando na hora, mesmo offline. Mensagem específica no lugar do spinner infinito | ✅ Feito — achado testando a troca de mês offline | [#233](https://github.com/piubellofelipe/fazendinha/pull/233) |
| App shell offline (service worker, `vite-plugin-pwa`) + trava de UI pra área não coberta | ✅ Feito | [#234](https://github.com/piubellofelipe/fazendinha/pull/234) |
| Corte > Pesagem + Sanidade — inclui migração de `useLotes`/`useLote`/`useEventos` pra `useQuery` (pré-requisito) e schemas movidos pra `packages/shared` | ✅ Feito — testado no navegador com build de produção + rede offline real | [#235](https://github.com/piubellofelipe/fazendinha/pull/235) |
| Revisão pós-#235: limpeza de comentários históricos (narravam a mudança, não a lógica) + `TITULO_SANITARIO`/`"Pesagem do lote"` (duplicados byte a byte entre `client/src/corte/api.ts` e `server/.../timeline.ts`) movidos pra `packages/shared/src/corte.constants.ts` | ✅ Feito | epic/offline-first |
| `useOfflineMutation` — `op`/`match`/`queryKeysRelacionadas` substituídos por uma lista única `{ queryKey, aplicar? }`: `aplicar` ausente = só invalida (antigo `queryKeysRelacionadas`); presente, dá patch otimista de verdade com `atual`/`itemOtimista` anotados na mão, sem wrapper genérico. Helpers diretos (`appendItemToCacheList`, `removeItemFromCacheList`, `updateItemInCacheList`, `upsertItemInCacheList`) cobrem os casos de lista; cache-objeto-agregado (não-lista) já é suportado sem mecanismo extra. Corte e Ponto migrados pra config nova | ✅ Feito | [#236](https://github.com/piubellofelipe/fazendinha/pull/236) |
| Rebanho > Sanidade + Produção — Evento sanitário (create+editar+excluir), Exame de quarto e Produção (modo `ORDENHA`, confirmado por dado real — create é 100% da feature nos dois, nunca tiveram editar/excluir). Achados corrigidos junto: `BaixaEstoqueCard` era código morto (removido) e `reb-animal` faltava em `TABS_OFFLINE` | ✅ Feito | [#237](https://github.com/piubellofelipe/fazendinha/pull/237) |
| Revisão pós-#237: `rebanho.schemas.ts` (shared) dividido por sub-feature espelhando o server; `useConfig` migrado pra `useQuery` (mesma convenção de leitura, achado real: `AnimalCockpit` dependia dele pra decidir o botão de Produção); `EventoForm.tsx` dividido em `EventoForm.sanidade.tsx`; limpeza de comentário que narrava escopo da PR (incluindo um com analogia falsa ao Corte); achado nessa mesma revisão — Evento sanitário só cobria create, editar/excluir foram cobertos na sequência (ver convenção nova abaixo); item otimista do create nasceu sem `editavel`/`dadosEdicao` (corrigido); `useAnimais` (lista de Animais) ainda era `fetch` cru e quebrava com `"Erro: Failed to fetch"` num reload offline — só apareceu testando com o service worker (build de produção), não em `pnpm dev`; migrado pra `useQuery`; `useAnimal` (ficha) travava em "Carregando..." pra sempre offline num animal nunca aberto individualmente (mesma classe de bug do item de `useRegistros`/Ponto em #233 — `isPending` fica `true` com a query pausada, nunca chega a errar sozinha) — corrigido em duas partes: `initialData` lê o animal de qualquer lista (`useAnimais`) já cacheada (mesmo DTO nos dois endpoints, `toAnimalDTO`), e `loading` agora também considera `fetchStatus === "paused"` como "não está mais carregando", caindo no fallback "Animal não encontrado" em vez de girar pra sempre | ✅ Feito | epic/offline-first |
| Pré-aquecer `useProdutos` (cadastro compartilhado — Rebanho/Corte/Plantio) assim que a tela que precisa dele abre, não só quando o formulário de evento é aberto. Achado testando Sanidade > Aplicação/Vacina offline: `Produto` é `@@unique` global (não exclusivo do Rebanho), usado em qualquer formulário com baixa de estoque; hoje só cacheia quando o modal específico é aberto — se isso nunca aconteceu online, o dropdown fica vazio offline (mesmo o resto da tela funcionando). Tabela pequena e pouco mutável — custo baixo de pré-buscar mais cedo | ⬜ Não iniciado | — |
| Plantio (café) > Fitossanidade + Nutrição + Colheita | ⬜ Não iniciado | — |
| Cultivo (milho) > Produção | ⬜ Não iniciado | — |

Atualizar esta tabela a cada fatia da camada 3 que entrar.

## Ver também

[OFFLINE_AREAS.md](OFFLINE_AREAS.md) — tabela completa (dificuldade ×
utilidade) de toda tela do app, organizada pelos 8 grupos do menu.
