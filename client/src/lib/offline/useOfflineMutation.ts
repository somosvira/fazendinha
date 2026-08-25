// Fábrica genérica de escrita offline-aware sobre listas em cache do
// TanStack Query. Cada tela declara o quê (path/method/body, queryKeys
// afetadas, identidade do item, como montar o item otimista); o como —
// patch otimista, rollback em erro, enfileiramento e substituição de id
// temporário — fica em fila.ts, escrito uma vez só.
import { useSyncExternalStore } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { enfileirarMutation, inscrever, obterFila } from "./fila";

export const ID_TEMPORARIO_PREFIXO = "local:";

export function criarIdTemporario(): string {
  return `${ID_TEMPORARIO_PREFIXO}${crypto.randomUUID()}`;
}

export type OfflineOp = "create" | "update" | "delete" | "upsert";

interface UseOfflineMutationBase<TInput, TItem extends { id: string }> {
  /** Identifica esta mutation na fila — usado só pra filtrar `pendentes`. */
  mutationKey: string;
  path: (input: TInput) => string;
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  body?: (input: TInput) => unknown;
  /** Listas em cache que recebem patch otimista de verdade. */
  queryKeys: (input: TInput) => QueryKey[];
  /** Só invalidadas (sem patch) — dado derivado recomputado no servidor. */
  queryKeysRelacionadas?: (input: TInput) => QueryKey[];
  match: (item: TItem, input: TInput) => boolean;
}

export type UseOfflineMutationConfig<TInput, TItem extends { id: string }> =
  | (UseOfflineMutationBase<TInput, TItem> & {
      op: "create" | "upsert";
      /** `id` deve vir de `criarIdTemporario()`. Campos computados pelo
       * backend entram aproximados/zerados — corrigem no refetch pós-sync. */
      criarOtimista: (input: TInput) => TItem;
    })
  | (UseOfflineMutationBase<TInput, TItem> & { op: "update" | "delete"; criarOtimista?: (input: TInput) => TItem });

function aplicarOtimista<TInput, TItem extends { id: string }>(
  anterior: TItem[] | undefined,
  input: TInput,
  cfg: UseOfflineMutationConfig<TInput, TItem>,
  itemOtimista: TItem | undefined,
  existe: boolean,
): TItem[] {
  const lista = anterior ?? [];
  const patch = (item: TItem) => ({ ...item, ...(input as unknown as Partial<TItem>) });
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

export function useOfflineMutation<TInput, TItem extends { id: string }>(
  cfg: UseOfflineMutationConfig<TInput, TItem>,
) {
  const queryClient = useQueryClient();
  const fila = useSyncExternalStore(inscrever, obterFila, obterFila);
  const pendentes = fila.filter((item) => item.mutationKey === cfg.mutationKey).map((item) => item.body as TInput);

  function mutate(
    input: TInput,
    opts?: { onSuccess?: (item: TItem) => void; onError?: (err: unknown) => void },
  ) {
    const queryKeys = cfg.queryKeys(input);
    const snapshots = queryKeys.map((queryKey) => ({
      queryKey,
      anterior: queryClient.getQueryData<TItem[]>(queryKey),
    }));
    // Computado uma vez (não por queryKey) pra ficar consistente entre listas
    // e pra criarOtimista() (que pode usar criarIdTemporario() internamente)
    // não gerar um id diferente por lista.
    const existe = snapshots.some(({ anterior }) => (anterior ?? []).some((item) => cfg.match(item, input)));
    const vaiCriar = cfg.op === "create" || (cfg.op === "upsert" && !existe);
    const itemOtimista = vaiCriar ? cfg.criarOtimista!(input) : undefined;
    for (const { queryKey, anterior } of snapshots) {
      queryClient.setQueryData(queryKey, aplicarOtimista(anterior, input, cfg, itemOtimista, existe));
    }

    enfileirarMutation({
      mutationKey: cfg.mutationKey,
      path: cfg.path(input),
      method: cfg.method,
      body: cfg.body?.(input),
      idTemporarioGerado: itemOtimista?.id,
    })
      .then((resposta) => {
        for (const queryKey of cfg.queryKeys(input)) queryClient.invalidateQueries({ queryKey });
        for (const queryKey of cfg.queryKeysRelacionadas?.(input) ?? []) queryClient.invalidateQueries({ queryKey });
        opts?.onSuccess?.(resposta as TItem);
      })
      .catch((err) => {
        for (const { queryKey, anterior } of snapshots) queryClient.setQueryData(queryKey, anterior);
        opts?.onError?.(err);
      });
  }

  return { mutate, pendentes };
}
