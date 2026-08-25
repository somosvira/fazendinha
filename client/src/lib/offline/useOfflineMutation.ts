/* Fábrica genérica de mutation offline-aware sobre uma lista em cache do
 * TanStack Query (camada 1 do plano offline — ver
 * docs/design/offline/OFFLINE_STRATEGY.md). Cada tela só descreve *o quê*:
 * qual queryKey a escrita afeta, como identificar o item na lista e que
 * operação é (create/update/delete/upsert). O *como* — patch otimista da
 * lista em cache, rollback se der erro, reconciliação com o servidor após
 * sync e sobrevivência a fechar o app offline — fica centralizado aqui,
 * escrito uma vez só, em vez de reimplementado por componente.
 *
 * `setMutationDefaults` é chamado aqui dentro (não em cada tela) porque a
 * própria doc do TanStack exige isso pra uma mutation pausada sobreviver a
 * um reload: funções não sobrevivem à serialização pro IndexedDB, então uma
 * mutation restaurada do storage só sabe o que executar se o mutationFn já
 * tiver sido registrado por mutationKey ANTES da hidratação
 * (PersistQueryClientProvider em main.tsx). Registrar dentro da fábrica
 * garante que isso nunca fica esquecido por quem só quer usar o hook.
 */
import { useMutation, useMutationState, useQueryClient, type QueryKey } from "@tanstack/react-query";

export type OfflineOp = "create" | "update" | "delete" | "upsert";

export interface UseOfflineMutationConfig<TInput, TItem> {
  /** Identifica esta mutation na mutation cache — fixo, não varia por item
   * (é o que permite filtrar "toda escrita de X pendente", venha de onde vier). */
  mutationKey: readonly unknown[];
  mutationFn: (input: TInput) => Promise<TItem>;
  /** Qual lista em cache esta escrita afeta. */
  queryKey: (input: TInput) => QueryKey;
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

export function useOfflineMutation<TInput, TItem>(cfg: UseOfflineMutationConfig<TInput, TItem>) {
  const queryClient = useQueryClient();

  // Ver comentário do topo do arquivo — precisa rodar antes de qualquer
  // hidratação de mutation pausada vinda do IndexedDB.
  queryClient.setMutationDefaults(cfg.mutationKey as unknown[], { mutationFn: cfg.mutationFn });

  const mutation = useMutation<TItem, Error, TInput, { anterior: TItem[] | undefined; queryKey: QueryKey }>({
    mutationKey: cfg.mutationKey as unknown[],
    mutationFn: cfg.mutationFn,
    onMutate: async (input) => {
      const queryKey = cfg.queryKey(input);
      await queryClient.cancelQueries({ queryKey });
      const anterior = queryClient.getQueryData<TItem[]>(queryKey);
      queryClient.setQueryData<TItem[]>(queryKey, aplicarOtimista(anterior, input, cfg));
      return { anterior, queryKey };
    },
    onError: (_err, _input, ctx) => {
      if (ctx) queryClient.setQueryData(ctx.queryKey, ctx.anterior);
    },
    onSettled: (_data, _err, input) => {
      queryClient.invalidateQueries({ queryKey: cfg.queryKey(input) });
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
