/* Fábrica genérica de mutation offline-aware sobre listas em cache do
 * TanStack Query (camada 1 do plano offline — ver
 * docs/design/offline/OFFLINE_STRATEGY.md). Cada tela só descreve *o quê*:
 * quais queryKeys a escrita afeta, como identificar o item nelas e que
 * operação é (create/update/delete/upsert). O *como* — patch otimista das
 * listas em cache, rollback se der erro, reconciliação com o servidor após
 * sync e sobrevivência a fechar o app offline — fica centralizado aqui,
 * escrito uma vez só, em vez de reimplementado por componente.
 *
 * `setMutationDefaults` (doc do TanStack: funções não sobrevivem à
 * serialização pro IndexedDB, então uma mutation restaurada do storage só
 * sabe o que executar se um default tiver sido registrado por mutationKey
 * ANTES do resume) precisa rodar `registrarMutationDefaults` abaixo — de
 * ESCOPO DE MÓDULO, não de dentro do hook. Registrar só dentro do hook não
 * basta: o hook só roda se o componente dono dele estiver montado, e um
 * resume pode acontecer com o app tendo aberto em outra aba (a mutation
 * pausada de uma tela pode ser retomada no boot antes do usuário nunca ter
 * visitado aquela tela nesta sessão). `registrarMutationDefaults` deve ser
 * chamada uma vez, no topo do módulo do domínio (ex.: equipe/api.ts) — isso
 * roda garantidamente no carregamento do bundle, já que os módulos de tela
 * são importados estaticamente (sem `React.lazy`) a partir de App.tsx. O
 * hook também registra de novo a cada render, como reforço — barato e
 * inofensivo, mas não é o que garante correção no caso "app abriu numa
 * tela diferente"; quem garante isso é a chamada de escopo de módulo.
 */
import { useMutation, useMutationState, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { queryClient as clienteGlobal } from "./queryClient";

/** Registra o mutationFn default pra uma mutationKey — chamar uma vez, no
 * escopo do módulo que define a mutation (não dentro de um componente/hook).
 * Ver comentário do topo do arquivo. */
export function registrarMutationDefaults<TInput, TItem>(
  mutationKey: readonly unknown[],
  mutationFn: (input: TInput) => Promise<TItem>,
) {
  clienteGlobal.setMutationDefaults(mutationKey as unknown[], { mutationFn });
}

export type OfflineOp = "create" | "update" | "delete" | "upsert";

export interface UseOfflineMutationConfig<TInput, TItem> {
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
  op: OfflineOp;
  /** Identidade do item dentro da lista (chave natural ou id). */
  match: (item: TItem, input: TInput) => boolean;
  /** Constrói o item otimista a mostrar antes da confirmação do servidor.
   * Obrigatório pra "create"/"upsert" (quando o item pode não existir ainda
   * na lista). Campos computados pelo servidor (ex.: horas apuradas) entram
   * aproximados/zerados aqui — corrigem sozinhos no refetch pós-sync. */
  criarOtimista?: (input: TInput) => TItem;
}

function aplicarOtimista<TInput, TItem>(
  anterior: TItem[] | undefined,
  input: TInput,
  cfg: UseOfflineMutationConfig<TInput, TItem>,
): TItem[] {
  const lista = anterior ?? [];
  const existe = lista.some((item) => cfg.match(item, input));
  const patch = (item: TItem) => ({ ...item, ...(input as unknown as Partial<TItem>) });
  switch (cfg.op) {
    case "delete":
      return lista.filter((item) => !cfg.match(item, input));
    case "create":
      return [...lista, cfg.criarOtimista!(input)];
    case "update":
      return lista.map((item) => (cfg.match(item, input) ? patch(item) : item));
    case "upsert":
      return existe ? lista.map((item) => (cfg.match(item, input) ? patch(item) : item)) : [...lista, cfg.criarOtimista!(input)];
  }
}

interface Snapshot<TItem> {
  queryKey: QueryKey;
  anterior: TItem[] | undefined;
}

export function useOfflineMutation<TInput, TItem>(cfg: UseOfflineMutationConfig<TInput, TItem>) {
  const queryClient = useQueryClient();

  // Reforço, não a garantia principal — ver comentário do topo do arquivo.
  // Quem garante correção mesmo com o componente não montado é a chamada
  // de escopo de módulo (registrarMutationDefaults).
  queryClient.setMutationDefaults(cfg.mutationKey as unknown[], { mutationFn: cfg.mutationFn });

  const mutation = useMutation<TItem, Error, TInput, { snapshots: Snapshot<TItem>[] }>({
    mutationKey: cfg.mutationKey as unknown[],
    mutationFn: cfg.mutationFn,
    onMutate: async (input) => {
      const queryKeys = cfg.queryKeys(input);
      await Promise.all(queryKeys.map((queryKey) => queryClient.cancelQueries({ queryKey })));
      const snapshots: Snapshot<TItem>[] = queryKeys.map((queryKey) => ({
        queryKey,
        anterior: queryClient.getQueryData<TItem[]>(queryKey),
      }));
      for (const { queryKey, anterior } of snapshots) {
        queryClient.setQueryData<TItem[]>(queryKey, aplicarOtimista(anterior, input, cfg));
      }
      return { snapshots };
    },
    onError: (_err, _input, ctx) => {
      for (const { queryKey, anterior } of ctx?.snapshots ?? []) queryClient.setQueryData(queryKey, anterior);
    },
    onSettled: (_data, _err, input) => {
      for (const queryKey of cfg.queryKeys(input)) queryClient.invalidateQueries({ queryKey });
      for (const queryKey of cfg.queryKeysRelacionadas?.(input) ?? []) queryClient.invalidateQueries({ queryKey });
    },
  });

  // Itens com escrita em voo OU pausada por falta de rede (mesma
  // mutationKey, de qualquer componente) — "pending" cobre os dois casos,
  // o TanStack não distingue no status (só em isPaused, que não precisamos
  // aqui: a UI trata os dois igual). Cada tela filtra pro seu recorte
  // (ex.: funcionário+mês atual) por cima disso.
  const pendentesRaw = useMutationState({
    filters: { mutationKey: cfg.mutationKey as unknown[], status: "pending" },
    select: (m) => m.state.variables as TInput | undefined,
  });

  return { mutate: mutation.mutate, mutation, pendentes: pendentesRaw.filter((v): v is TInput => v != null) };
}
