/* Fábrica genérica de mutation offline-aware sobre listas em cache do
 * TanStack Query (camada 1 do plano offline — ver
 * docs/design/offline/OFFLINE_STRATEGY.md). Cada tela só descreve *o quê*:
 * quais queryKeys a escrita afeta, como identificar o item nelas e que
 * operação é (create/update/delete/upsert). O *como* — patch otimista das
 * listas em cache, rollback se der erro, reconciliação com o servidor após
 * sync, sobrevivência a fechar o app offline e reconciliação de id
 * temporário — fica centralizado aqui, escrito uma vez só.
 *
 * DUAS COISAS SÓ FUNCIONAM SE FOR REGISTRADO CERTO, NÃO SÓ USADO NO HOOK:
 *
 * 1. `getMutationDefaults(mutationKey)` — verificado no source do TanStack
 *    (queryClient.ts, defaultMutationOptions): o merge é
 *    `{...defaults_globais, ...getMutationDefaults(mutationKey), ...options}`.
 *    Isso vale tanto pra uma mutation nova (`useMutation`) quanto pra uma
 *    restaurada do IndexedDB (hydration usa o mesmo `mutationCache.build`).
 *    Só que se a gente registrar SÓ `mutationFn`, uma mutation restaurada
 *    sem componente montado roda a chamada HTTP crua e mais nada — sem
 *    `onMutate`/`onError`/`onSettled`. Por isso `montarOpcoes` monta o
 *    objeto INTEIRO e `registrarMutationDefaults` registra ele inteiro,
 *    não só o `mutationFn`.
 * 2. Registro tem que rodar em ESCOPO DE MÓDULO (não só dentro do hook) —
 *    o hook só roda se o componente dono estiver montado, e um resume
 *    pode acontecer com o app aberto numa aba diferente da que criou a
 *    escrita pendente. `registrarMutationDefaults` deve ser chamada uma
 *    vez, no topo do módulo de domínio (ex.: equipe/api.ts) — roda
 *    garantido no carregamento do bundle, já que os módulos de tela são
 *    importados estaticamente (sem `React.lazy`) a partir de App.tsx.
 *
 * RECONCILIAÇÃO DE ID TEMPORÁRIO — pra quando uma mutation cria algo
 * offline (ganha id local, `ID_TEMPORARIO_PREFIXO`) e outra mutation,
 * ainda offline, referencia esse id antes dele existir de verdade no
 * servidor (ex.: cria X, edita esse mesmo X, tudo offline, antes de
 * sincronizar). Dois mecanismos, um dependendo do outro:
 *
 * - `scope: { id: scopeId }` — TanStack serializa mutations do mesmo
 *   scope: uma de cada vez, na ordem em que foram criadas, mesmo que
 *   `resumePausedMutations()` dispare `.continue()` em todas via
 *   `Promise.all` no reconnect. Testado com atraso artificial: confirmado
 *   que a segunda mutation não começa até a primeira terminar (zero
 *   sobreposição de horário). Fonte: `mutationCache.ts#canRun` — acha a
 *   primeira mutation `status:"pending"` do scope, só ela pode rodar; as
 *   outras ficam bloqueadas até essa resolver.
 * - `idsResolvidos` (Map global) + `resolverId`/`resolverIds` — quando
 *   uma mutation de create/upsert resolve de verdade, `onSuccess` grava
 *   `tempId -> idReal` no mapa. A garantia de ordem do `scope` acima é o
 *   que torna isso seguro: a próxima mutation do mesmo scope só começa a
 *   rodar DEPOIS desse `onSuccess`, então quando `resolverIds` (fornecido
 *   por quem configura a mutation dependente) roda dentro do `mutationFn`
 *   dela, o id já está resolvido no mapa.
 *
 * Limitação conhecida, não resolvida aqui: o mapa `idsResolvidos` é só em
 * memória (não persiste em IndexedDB). Se o app fechar entre o create
 * resolver e a mutation dependente ainda não ter rodado (uma janela
 * estreita — só existe enquanto as duas ainda estão na fila do mesmo
 * scope), a reconciliação se perde nesse caso específico. Registrado
 * como próximo passo se aparecer um caso real que precise disso.
 */
import {
  useMutation,
  useMutationState,
  useQueryClient,
  type QueryKey,
  type MutationOptions,
} from "@tanstack/react-query";
import { queryClient as clienteGlobal } from "./queryClient";

// RECONCILIAÇÃO DE ID TEMPORÁRIO -------------------------------------------

/** Prefixo de id gerado no client pra um item ainda não confirmado pelo
 * servidor — nunca colide com id real (sempre numérico, `Int autoincrement`
 * do Postgres, stringificado sem prefixo nenhum nos DTOs). */
export const ID_TEMPORARIO_PREFIXO = "local:";

/** Gera um id temporário único — usar dentro de `criarOtimista` pra
 * create/upsert que podem inserir item novo. */
export function criarIdTemporario(): string {
  return `${ID_TEMPORARIO_PREFIXO}${crypto.randomUUID()}`;
}

const idsResolvidos = new Map<string, string>();

/** Resolve um id — se for temporário e já tiver sido reconciliado, devolve
 * o real; senão devolve como veio (já é real, ou ainda não resolveu).
 * Usar dentro de `resolverIds` da mutation dependente. */
export function resolverId<T extends string | undefined>(id: T): T {
  if (id == null) return id;
  return (idsResolvidos.get(id) ?? id) as T;
}

// CONFIG ---------------------------------------------------------------

export type OfflineOp = "create" | "update" | "delete" | "upsert";

/** Campos comuns a toda operação — o que muda por `op` (`criarOtimista`)
 * fica no tipo discriminado abaixo, não aqui. */
interface UseOfflineMutationBase<TInput, TItem extends { id: string }> {
  /** Identifica esta mutation na mutation cache — fixo, não varia por item
   * (é o que permite filtrar "toda escrita de X pendente", venha de onde vier). */
  mutationKey: readonly unknown[];
  mutationFn: (input: TInput) => Promise<TItem>;
  /** Quais listas em cache esta escrita afeta com patch otimista de verdade
   * (a mesma operação é aplicada em cada uma). Normalmente uma só; mais de
   * uma serve pro caso do mesmo item, sem cálculo nenhum envolvido, aparecer
   * em mais de uma lista (ex.: lista geral + lista filtrada). */
  queryKeys: (input: TInput) => QueryKey[];
  /** Outras queries que só devem ser invalidadas (sem patch, sem chute) —
   * pra dado derivado/calculado a partir do que foi escrito (ex.: resumo
   * agregado recomputado no servidor, tipo ResumoLote após uma pesagem).
   * Nunca dispara enquanto a mutation está pausada offline: só roda em
   * `onSettled`, que só acontece quando ela sai de `paused` de verdade —
   * ou seja, já com rede de novo. */
  queryKeysRelacionadas?: (input: TInput) => QueryKey[];
  /** Identidade do item dentro da lista (chave natural ou id). */
  match: (item: TItem, input: TInput) => boolean;
  /** Agrupa mutations que podem referenciar id gerado por outra da mesma
   * família de entidade (ex.: criar/editar/excluir pesagem) — todas com o
   * mesmo `scopeId` rodam em fila, uma de cada vez, na ordem de criação,
   * nunca em paralelo (nem no resume). Default: isolada por `mutationKey`
   * (comportamento correto quando a mutation nunca depende de outra). */
  scopeId?: string;
  /** Reescreve id temporário no input pro id real já resolvido, se houver
   * — roda logo antes do `mutationFn`, já dentro da garantia de ordem do
   * `scopeId`. Ex.: `(input) => ({...input, loteId: resolverId(input.loteId)})` */
  resolverIds?: (input: TInput) => TInput;
}

/** Discriminado por `op`: `criarOtimista` é exigido pelo *tipo* quando a
 * operação pode inserir um item novo na lista (`create`/`upsert`) — sem
 * ele não dá pra saber o que mostrar otimisticamente antes do servidor
 * confirmar. Errar isso agora é erro de compilação, não um objeto vazio
 * silencioso em runtime nem um crash na primeira escrita. */
export type UseOfflineMutationConfig<TInput, TItem extends { id: string }> =
  | (UseOfflineMutationBase<TInput, TItem> & {
      op: "create" | "upsert";
      /** Constrói o item otimista a mostrar antes da confirmação do
       * servidor — `id` deve vir de `criarIdTemporario()`. Campos
       * computados pelo backend (ex.: horas apuradas) entram
       * aproximados/zerados aqui — corrigem sozinhos no refetch pós-sync. */
      criarOtimista: (input: TInput) => TItem;
    })
  | (UseOfflineMutationBase<TInput, TItem> & {
      op: "update" | "delete";
      /** Não usado nessas operações (o item já existe na lista) — aceito
       * como opcional só pra não obrigar quem migrar `op` a apagar a linha. */
      criarOtimista?: (input: TInput) => TItem;
    });

function aplicarOtimista<TInput, TItem extends { id: string }>(
  anterior: TItem[] | undefined,
  input: TInput,
  cfg: UseOfflineMutationConfig<TInput, TItem>,
  itemOtimista: TItem | undefined,
  existe: boolean,
): TItem[] {
  const lista = anterior ?? [];
  const patch = (item: TItem) => ({
    ...item,
    ...(input as unknown as Partial<TItem>),
  });
  switch (cfg.op) {
    case "delete":
      return lista.filter((item) => !cfg.match(item, input));
    case "create":
      return [...lista, itemOtimista!];
    case "update":
      return lista.map((item) => (cfg.match(item, input) ? patch(item) : item));
    case "upsert":
      return existe
        ? lista.map((item) => (cfg.match(item, input) ? patch(item) : item))
        : [...lista, itemOtimista!];
  }
}

interface Snapshot<TItem> {
  queryKey: QueryKey;
  anterior: TItem[] | undefined;
}

interface Contexto<TItem> {
  snapshots: Snapshot<TItem>[];
  idTemporario: string | undefined;
}

/** Monta o `options` completo de `useMutation` pra essa config — usado
 * tanto pelo hook (caminho interativo) quanto registrado em
 * `setMutationDefaults` (caminho de restauração, sem componente montado).
 * Precisa ser o MESMO objeto nos dois caminhos — ver comentário do topo. */
function montarOpcoes<TInput, TItem extends { id: string }>(
  cfg: UseOfflineMutationConfig<TInput, TItem>,
): MutationOptions<TItem, Error, TInput, Contexto<TItem>> {
  return {
    mutationKey: cfg.mutationKey as unknown[],
    mutationFn: (input: TInput) =>
      cfg.mutationFn(cfg.resolverIds ? cfg.resolverIds(input) : input),
    scope: { id: cfg.scopeId ?? JSON.stringify(cfg.mutationKey) },
    onMutate: async (input) => {
      const queryKeys = cfg.queryKeys(input);
      await Promise.all(
        queryKeys.map((queryKey) => clienteGlobal.cancelQueries({ queryKey })),
      );
      const snapshots: Snapshot<TItem>[] = queryKeys.map((queryKey) => ({
        queryKey,
        anterior: clienteGlobal.getQueryData<TItem[]>(queryKey),
      }));
      // "upsert" só é criação de verdade se o item ainda não existe em
      // nenhuma das listas afetadas — computado uma vez aqui (não por
      // lista) pra ficar consistente com o `itemOtimista` único abaixo.
      const existe = snapshots.some(({ anterior }) =>
        (anterior ?? []).some((item) => cfg.match(item, input)),
      );
      const vaiCriar = cfg.op === "create" || (cfg.op === "upsert" && !existe);
      // Calculado uma vez só (não por queryKey) — criarOtimista pode usar
      // criarIdTemporario() internamente (aleatório); chamar mais de uma
      // vez pra mesma escrita geraria ids diferentes em cada lista.
      const itemOtimista = vaiCriar ? cfg.criarOtimista!(input) : undefined;
      for (const { queryKey, anterior } of snapshots) {
        clienteGlobal.setQueryData<TItem[]>(
          queryKey,
          aplicarOtimista(anterior, input, cfg, itemOtimista, existe),
        );
      }
      return { snapshots, idTemporario: itemOtimista?.id };
    },
    onSuccess: (item, _input, ctx) => {
      if (ctx?.idTemporario && ctx.idTemporario !== item.id) {
        idsResolvidos.set(ctx.idTemporario, item.id);
      }
    },
    onError: (_err, _input, ctx) => {
      for (const { queryKey, anterior } of ctx?.snapshots ?? [])
        clienteGlobal.setQueryData(queryKey, anterior);
    },
    onSettled: (_data, _err, input) => {
      for (const queryKey of cfg.queryKeys(input))
        clienteGlobal.invalidateQueries({ queryKey });
      for (const queryKey of cfg.queryKeysRelacionadas?.(input) ?? [])
        clienteGlobal.invalidateQueries({ queryKey });
    },
  };
}

/** Registra as opções completas (não só `mutationFn`) como default da
 * `mutationKey` — chamar uma vez, em escopo de módulo (fora de qualquer
 * componente/hook). Ver comentário do topo do arquivo. */
export function registrarMutationDefaults<TInput, TItem extends { id: string }>(
  cfg: UseOfflineMutationConfig<TInput, TItem>,
) {
  clienteGlobal.setMutationDefaults(
    cfg.mutationKey as unknown[],
    montarOpcoes(cfg),
  );
}

export function useOfflineMutation<TInput, TItem extends { id: string }>(
  cfg: UseOfflineMutationConfig<TInput, TItem>,
) {
  const queryClient = useQueryClient();

  // Reforço, não a garantia principal — ver comentário do topo do arquivo.
  // Quem garante correção mesmo com o componente não montado é a chamada
  // de escopo de módulo (registrarMutationDefaults).
  queryClient.setMutationDefaults(
    cfg.mutationKey as unknown[],
    montarOpcoes(cfg),
  );

  const mutation = useMutation(montarOpcoes(cfg));

  // Itens com escrita em voo OU pausada (por falta de rede OU esperando a
  // vez no scope — mesmo status "pending" pros dois, ver comentário do
  // topo). Cada tela filtra pro seu recorte (ex.: funcionário+mês atual).
  const pendentesRaw = useMutationState({
    filters: { mutationKey: cfg.mutationKey as unknown[], status: "pending" },
    select: (m) => m.state.variables as TInput | undefined,
  });

  return {
    mutate: mutation.mutate,
    mutation,
    pendentes: pendentesRaw.filter((v): v is TInput => v != null),
  };
}
