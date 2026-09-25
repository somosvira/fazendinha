// Fábrica genérica de escrita offline-aware sobre caches do TanStack Query.
// Cada tela declara o quê (path/method/body, como criar o item otimista, como
// cada queryKey afetada deve ser corrigida — `aplicar`); o como — snapshot
// pra rollback em erro e enfileiramento — fica em fila.ts, escrito uma vez só.
import { useSyncExternalStore } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { enfileirarMutation, inscrever, obterFila } from "./fila";

function ehObjetoPlano(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Merge profundo — array e primitivo substituem o valor inteiro (sem mesclar
// por índice); só objeto plano em objeto plano recursa. Evita perder campo
// irmão de um objeto aninhado que o spread raso ({...item, ...input}) perderia.
function mesclarProfundo<T extends object>(alvo: T, patch: Partial<T>): T {
  const resultado: any = { ...alvo };
  for (const [chave, valor] of Object.entries(patch)) {
    resultado[chave] = ehObjetoPlano(valor) && ehObjetoPlano(resultado[chave])
      ? mesclarProfundo(resultado[chave], valor)
      : valor;
  }
  return resultado;
}

// Helpers diretos (não curried, nunca devolvem função) pro caso comum de
// cache em lista — chamados de dentro de um `aplicar` já anotado na mão, ex.:
// `aplicar: (atual: Item[] | undefined) => appendItemToCacheList(atual, itemOtimista!)`.
// Cada helper normaliza seu próprio "vazio" — nunca devolve `undefined`.

export function appendItemToCacheList<T>(atual: T[] | undefined, item: T): T[] {
  return [...(atual ?? []), item];
}

// Pro caso de lista "mais recente primeiro" (mesmo orderBy do servidor,
// ex.: `data: "desc"` em listarMovimentos/timeline) — `append` deixaria o
// item novo no final, abaixo de tudo, contradizendo a ordem que a tela
// promete até o próximo fetch real corrigir.
export function prependItemToCacheList<T>(atual: T[] | undefined, item: T): T[] {
  return [item, ...(atual ?? [])];
}

export function removeItemFromCacheList<T>(atual: T[] | undefined, corresponde: (item: T) => boolean): T[] {
  return (atual ?? []).filter((item) => !corresponde(item));
}

export function updateItemInCacheList<T extends object>(
  atual: T[] | undefined,
  patch: Partial<T>,
  corresponde: (item: T) => boolean,
): T[] {
  return (atual ?? []).map((item) => (corresponde(item) ? mesclarProfundo(item, patch) : item));
}

// Upsert de lista: dá merge profundo de `patch` no item existente, ou
// acrescenta `itemNovo` quando `corresponde` não acha ninguém.
export function upsertItemInCacheList<T extends object>(
  atual: T[] | undefined,
  itemNovo: T,
  patch: Partial<T>,
  corresponde: (item: T) => boolean,
): T[] {
  const lista = atual ?? [];
  return lista.some(corresponde)
    ? updateItemInCacheList(lista, patch, corresponde)
    : appendItemToCacheList(lista, itemNovo);
}

/** Uma queryKey afetada por uma mutation + como corrigi-la no cache.
 * `aplicar` ausente = só invalida depois do sync (dado derivado recomputado
 * no servidor, sem patch otimista possível — antigo `queryKeysRelacionadas`).
 * Quando presente, nunca devolve `undefined`: `atual` chega `T | undefined`
 * (queryKey nunca visitada offline), mas o retorno é sempre `T` — normalizar
 * (`atual ?? VAZIO`) é responsabilidade de quem escreve `aplicar`, igual já
 * é feito pelos helpers de lista acima. */
export interface EntradaPatch<T, TItem> {
  queryKey: QueryKey;
  aplicar?: (atual: T | undefined, itemOtimista: TItem | undefined) => T;
}

export interface UseOfflineMutationConfig<TInput, TItem, TResp = TItem> {
  /** Identifica esta mutation na fila — usado só pra filtrar `pendentes`. */
  mutationKey: string;
  path: (input: TInput) => string;
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  body?: (input: TInput) => unknown;
  /** Ponto único de criação do item otimista — roda uma vez por `mutate()`,
   * nunca por queryKey (evita id divergente entre entradas). Omitir quando a
   * escrita não cria nada novo (delete, update puro). O `id` é o definitivo:
   * `crypto.randomUUID()`, enviado no `body` pro servidor criar o registro
   * com ele. Campos computados pelo backend entram aproximados/zerados —
   * corrigem no refetch pós-sync. */
  criarOtimista?: (input: TInput) => TItem;
  /** Cada entrada é uma queryKey afetada + como corrigi-la (`aplicar`, com o
   * item otimista já pronto como 2º argumento — nunca gerado de novo aqui). */
  queryKeys: (input: TInput, itemOtimista: TItem | undefined) => EntradaPatch<any, TItem>[];
}

// TResp é o corpo real da resposta HTTP, passado pro onSuccess do mutate.
// Por padrão é igual a TItem (o item otimista já é o que a lista espera de
// volta), mas some endpoints devolvem outra coisa (ex.: POST de movimento de
// estoque devolve {id, lancamentoCriado}, não o MovimentoDTO da lista) —
// nesse caso o config passa TResp explícito.
export function useOfflineMutation<TInput, TItem, TResp = TItem>(cfg: UseOfflineMutationConfig<TInput, TItem, TResp>) {
  const queryClient = useQueryClient();
  const fila = useSyncExternalStore(inscrever, obterFila, obterFila);
  const pendentes = fila.filter((item) => item.mutationKey === cfg.mutationKey).map((item) => item.body as TInput);

  function mutate(
    input: TInput,
    opts?: { onSuccess?: (item: TResp) => void; onError?: (err: unknown) => void },
  ) {
    const itemOtimista = cfg.criarOtimista?.(input);
    const entradas = cfg.queryKeys(input, itemOtimista);
    const snapshots = entradas.map((entrada) => ({ entrada, anterior: queryClient.getQueryData(entrada.queryKey) }));
    for (const { entrada, anterior } of snapshots) {
      if (entrada.aplicar) queryClient.setQueryData(entrada.queryKey, entrada.aplicar(anterior, itemOtimista));
    }

    enfileirarMutation({
      mutationKey: cfg.mutationKey,
      path: cfg.path(input),
      method: cfg.method,
      body: cfg.body?.(input),
    })
      .then((resposta) => {
        for (const { entrada } of snapshots) queryClient.invalidateQueries({ queryKey: entrada.queryKey });
        opts?.onSuccess?.(resposta as TResp);
      })
      .catch((err) => {
        for (const { entrada, anterior } of snapshots) queryClient.setQueryData(entrada.queryKey, anterior);
        opts?.onError?.(err);
      });
  }

  return { mutate, pendentes };
}
