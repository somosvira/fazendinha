# Offline — fundação

Motor genérico de leitura/escrita offline (TanStack Query + IndexedDB + fila
de mutação própria), destilado da primeira rodada do epic offline
(`epic/offline-first`, nunca mergeado — divergiu demais do `main` depois do
rebuild do Financeiro e da unificação Rebanho/Corte). Esta fundação porta só
o motor (`client/src/lib/offline/`), sem nenhuma cobertura de feature. A
próxima fatia a usar isso é o Financeiro.

Este doc é a versão curta: convenções obrigatórias + armadilhas já batidas.
Se uma decisão daqui precisar de mais contexto histórico (por que foi feita
assim, o que foi descartado), procurar no PR que a introduziu — não duplicar
narrativa de mudança em comentário de código nem aqui.

## Como funciona, em uma leitura

1. **Leitura** — todo hook de leitura usa `useQuery` (TanStack). O
   `queryClient` (`lib/offline/queryClient.ts`) tem `gcTime` de 72h; o
   `persister` (`persister.ts`, `idb-keyval` por baixo) grava o cache em
   IndexedDB via `PersistQueryClientProvider` (montado em `main.tsx`). Um
   hook `useState`+`useEffect`+`fetch` direto **nunca** passa por isso — não
   sobrevive a um F5 offline, mesmo que o app já tenha rodado online antes.
2. **Escrita** — toda mutation offline-aware usa a fábrica
   `useOfflineMutation` (`useOfflineMutation.ts`). Nenhuma tela implementa
   optimistic update na mão.
3. **Fila** — `lib/offline/fila.ts` é a fila de escritas pendentes, persistida
   em IndexedDB (`idb-keyval`, chave própria, separada do cache de leitura).
   Cada item é **dado puro** (`path`/`method`/`body`, nenhuma função) — não
   é `useMutation` do TanStack. `processarFila` drena um item de cada vez,
   sequencial, com `await` real (ordem garantida sem depender de nenhum
   mecanismo interno de terceiro).
4. **Choke point** — `req.ts` é o único `fetch` usado por qualquer módulo
   (substituiu as cópias de `req<T>` que cada `api.ts` tinha). Todo `req()`
   espera `aguardarFilaLivre()` — nenhum fetch roda fora de ordem enquanto a
   fila está sincronizando.
5. **UI de sincronização** — `ShellOffline` (montado uma vez em `main.tsx`)
   bloqueia a tela inteira (overlay) enquanto a fila está drenando, pra
   ninguém disparar uma ação nova por cima do que ainda está sincronizando.
6. **Trava de área sem suporte** — `App.tsx` define `TABS_OFFLINE`
   (`Set<Tab>`) + `useOnlineStatus()`. Fora dessa lista, sem rede, a aba
   renderiza `OfflineGatedTab` em vez da tela real. **Hoje o set está vazio**
   — a fundação sozinha não cobre feature nenhuma; cada fatia nova precisa
   adicionar suas próprias abas aqui.
7. **App shell offline** — `vite-plugin-pwa` (`vite.config.ts`,
   `generateSW`) faz precache do HTML/JS/CSS, senão abrir o app offline sem
   visita prévia (ou dar reload numa aba deep-linked) falha com
   `net::ERR_INTERNET_DISCONNECTED` — não tem nada servindo o shell
   localmente. `navigateFallbackDenylist: [/^\/api\//]` garante que isso
   nunca intercepta `/api/*` — dado continua 100% por conta da fila.

## Decisão de id: UUID gerado no cliente

Financeiro e estoque usam UUID como id (#302). Um create offline gera o id
**definitivo** no cliente (`crypto.randomUUID()`) e o manda no `body`; o
servidor cria o registro com esse id. Não há id temporário nem troca de id na
fila: uma escrita seguinte, ainda offline, já referencia o id certo (ex.:
criar uma operação e liquidar o compromisso dela antes de reconectar).

Requisito no servidor antes da primeira fatia com create offline: o endpoint
aceita `id` opcional e é idempotente por ele — reenviar o mesmo create (a fila
reenvia se a rede cair depois do servidor gravar) devolve o registro existente
em vez de duplicar.

## Convenções obrigatórias por módulo

Ao dar suporte offline a uma feature nova, nessa ordem:

1. **Migrar pra `useQuery` todo hook de leitura do qual a tela depende** —
   não só o formulário de escrita, mas dropdowns/listas de apoio que a tela
   também lê. Um hook hand-rolled nunca persiste, mesmo depois de rodar
   online por meses.
2. **Pré-validar antes de enfileirar**, reusando o schema Zod do server via
   `packages/shared` (quando esse workspace existir de novo neste repo — ver
   nota abaixo) — nunca reescrever a regra no client. Reduz a classe de erro
   mais comum que contamina a fila; não elimina (erro de regra de negócio
   que depende de estado do servidor, tipo período fechado, nunca dá pra
   prevenir 100% no client — é o mundo mudando entre o enfileiramento e o
   envio, não falha de validação).
3. **Cobrir toda operação que a feature já tem em algum lugar do app**
   (create **e** editar **e** excluir), não só create — checar antes de
   assumir que "é o mesmo escopo" de outra feature parecida. Deixar um botão
   visível que falha cru é pior que não oferecer.
4. **Query key factory por módulo** — um objeto `as const` só daquele
   módulo (não um mapa global do app); evita duas chamadas montarem "a
   mesma" key em formato levemente diferente e virarem cache separado sem
   ninguém perceber.
5. **Modal de escrita usa `useSalvarOffline`**, não `mutate()` direto.
   `mutate()` sozinho aplica o otimista e enfileira na hora, sem esperar
   rede — certo pra edição inline, errado pra modal (fecha antes de saber se
   deu erro real). `useSalvarOffline`: online espera `onSuccess`/`onError`
   antes de fechar (erro aparece dentro do modal); offline fecha direto (não
   dá pra esperar por tempo indeterminado — erro tardio vira toast).
6. **`queryKeys` por cache afetado, cada um decide se tem `aplicar`.**
   Entrada sem `aplicar` = só `invalidateQueries` (dado **derivado**,
   recomputado no servidor — resumo agregado, saldo, ranking — não dá pra
   patch otimista sem duplicar a conta do servidor). Entrada com `aplicar`
   = patch otimista de verdade, usando os helpers prontos:
   `appendItemToCacheList`/`prependItemToCacheList` (escolher pela ordem
   real da listagem no servidor — ver armadilha abaixo),
   `removeItemFromCacheList`, `updateItemInCacheList`/`upsertItemInCacheList`
   (merge **profundo**, não raso — um patch parcial com spread raso apaga
   campo irmão de objeto aninhado que não veio no input).
7. **Semear ficha de detalhe com `initialData` de uma lista já cacheada**
   quando lista e ficha usam o mesmo DTO — cobre offline "lista foi
   visitada, ficha nunca foi aberta individualmente" de graça, e renderiza
   instantâneo mesmo online. Precisa de uma queryKey de "família" curta
   (prefixo, tipo `xTodos()`) que case qualquer combinação de filtro.

## Armadilhas já batidas (não repetir)

- **`appendItemToCacheList` numa lista "mais recente primeiro"
  (`orderBy: {data: "desc"}` no servidor) deixa o item novo invisível no
  final.** Usar `prependItemToCacheList` sempre que o servidor ordenar
  desc — conferir o `orderBy` real antes de escolher qual helper usar.
- **`query.data ?? []` sem memoizar cria array novo a cada render.** Se um
  efeito depende desse valor e a query está pausada offline (nunca visitada
  — `networkMode` padrão nem chega a tentar o fetch, fica em `pending` pra
  sempre), o efeito reexecuta em loop infinito. Usar uma constante de módulo
  (`const X_VAZIO: T[] = [];`), nunca um literal `[]` inline no retorno do
  hook.
- **`isPending` fica `true` pra sempre numa query pausada offline nunca
  visitada** — não é erro, é `fetchStatus: "paused"`; sem tratar isso à
  parte, a tela mostra "Carregando..." infinito em vez de uma mensagem
  clara ou de cair no fallback certo (ex.: via `initialData` de outra
  lista). Usar `ehOfflineSemDados(query)` (`lib/offline/estadoQuery.ts`).
- **Ordem de listagem não usa o id** — UUID não é sequencial. Desempate por
  `numero`/`seq`/`ordem`, que o servidor atribui na hora do insert real
  (mesmo atrasado até o sync).
- **Erro de sessão (401) para a fila inteira** — não vai pro log de erros
  (senão todo item atrás acumularia entradas repetidas da mesma causa).
  `entrar()` em `App.tsx` grava a sessão nova e chama
  `garantirProcessamento()`, sem reload — um reload quebraria o áudio da
  abertura Terrano, ancorado no gesto do clique de login.
- **Erro de item (validação/regra de negócio, qualquer não-2xx que não seja
  401) não contamina os outros** — sai da fila, vai pro registro auditável
  (`idb-keyval`, chave `rionovo-fila-erros`), a fila segue com o resto. Sem
  UI pra ler isso ainda — hoje é abrir DevTools → IndexedDB.

## Checklist: quando uma fatia está "pronta"

1. Regressão automatizada que prova o bug (escrever o teste, confirmar que
   falha sem o fix, passa com o fix).
2. **Browser real, offline de verdade**, contra o **build de produção** —
   `pnpm dev` não serve pra validar o service worker (`devOptions.enabled`
   não está ligado, então offline em `vite dev` sempre dá
   `ERR_INTERNET_DISCONNECTED` mesmo com tudo funcionando em produção):
   ```bash
   pnpm --filter rionovo-client run build
   pnpm --filter rionovo-client exec vite preview --port 41875
   # abrir, navegar ONLINE pelo menos uma vez (registra o SW), então offline + reload/deep-link
   ```
3. Testar o caso "nunca visitado" (combinação de filtro/seleção que nunca
   foi buscada online), não só o caso feliz.
4. Ciclo completo de escrita offline: criar/editar → aparece otimista →
   reconectar → confirma com o mesmo id, sem duplicar nem sumir.
5. Confirmar que todo hook de leitura que a tela usa está em `useQuery`, não
   só o do formulário de escrita.

## Pontos de revisão (pra quem revisa um PR que toca a fundação ou uma fatia)

Checklist rápido pra ler o diff, não pra quem está implementando (isso já
está nas convenções acima):

- Algum hook de leitura novo é `useState`+`fetch` cru em vez de `useQuery`?
  Não sobrevive a F5 offline, mesmo que pareça funcionar no teste manual
  online.
- Alguma escrita nova chama `fetch`/`useMutation` puro em vez de
  `useOfflineMutation`? Mesmo problema, mais grave (perde o dado, não só a
  tela).
- Alguma entrada de `queryKeys` tem `aplicar` pra um dado **agregado**
  recomputado no servidor (saldo, resumo, ranking)? Isso duplicaria a conta
  do servidor — deveria ser invalidate-only, a menos que o autor tenha
  checado o cálculo real no servidor e confirmado que é uma soma simples
  (sem regra própria) que um patch por delta reproduz sem duplicar nada.
- Algum gate de loading (`isPending`/`!dados`) depende de uma query
  **diferente** da que a tela realmente precisa? Sintoma: mostra resultado
  vazio/zerado em vez de "carregando" quando só uma das duas queries
  irmãs está pausada offline.
- A PR alega ter testado offline — foi contra o **build de produção**
  (`vite preview`), com offline disparado de verdade, ou só contra
  `pnpm dev`/emulação de rede do DevTools (que não bloqueia `localhost`,
  não prova nada aqui)?
- Testou o caso "nunca visitado" offline, não só o caminho já com cache
  aquecido?
- Algum comentário de código narra a mudança ("nesta fatia", "o fix de
  hoje", referência a PR/commit) em vez de só explicar a lógica atual? O
  teste: continua igualmente verdadeiro e útil sem nenhum contexto de
  quando foi escrito?

## Nota: `packages/shared`

O epic original moveu schema/cálculo puro compartilhado (client+server) pra
um workspace `packages/shared` (`@rionovo/shared`), principalmente pra
pré-validação (convenção 2 acima). Esse workspace **não existe hoje neste
branch** — não foi portado porque era acoplado às features antigas
(Rebanho/Corte). Recriar quando a fatia do Financeiro precisar reusar um
schema Zod do server no client; não é pré-requisito da fundação.
