// Fábrica genérica de escrita offline-aware sobre caches do TanStack Query.
// Cada tela declara o quê (path/method/body, como criar o item otimista, como
// cada queryKey afetada deve ser corrigida — `aplicar`); o como — enfileiramento
// e refetch das queries afetadas em erro — fica aqui e em fila.ts, escrito uma vez só.
import { useSyncExternalStore } from "react";
import { useQueryClient, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { enfileirarMutation, inscrever, obterFila } from "./fila";
import { ApiError } from "./req";

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

// Insere mantendo a lista ordenada por `chaveOrdem` (string comparável, ex.:
// data em ISO). "desc" deixa o item novo à frente dos de chave igual; "asc"
// deixa depois — escolher conforme o `orderBy` real do servidor.
export function insertItemSortedInCacheList<T>(
  atual: T[] | undefined,
  item: T,
  chaveOrdem: (item: T) => string,
  direcao: "asc" | "desc",
): T[] {
  const lista = atual ?? [];
  const chave = chaveOrdem(item);
  const indice = lista.findIndex((existente) =>
    direcao === "desc" ? chaveOrdem(existente) <= chave : chaveOrdem(existente) > chave);
  return indice === -1 ? [...lista, item] : [...lista.slice(0, indice), item, ...lista.slice(indice)];
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

/** Uma entrada por query já em cache sob o prefixo — `setQueryData` exige a
 * chave exata, então cada combinação de filtro cacheada vira uma entrada. */
export function porPrefixo<T>(
  qc: QueryClient,
  prefixo: QueryKey,
  aplicar: (atual: T, queryKey: QueryKey) => T,
): EntradaPatch<T | undefined, unknown>[] {
  return qc.getQueriesData<T>({ queryKey: prefixo })
    .filter(([, dados]) => dados !== undefined)
    .map(([queryKey]) => ({ queryKey, aplicar: (atual: T | undefined) => atual === undefined ? atual : aplicar(atual, queryKey) }));
}

/** Entrada só de invalidação — dado derivado recomputado no servidor (saldo,
 * resumo, ranking), sem patch otimista possível. */
export const invalidar = (queryKey: QueryKey): EntradaPatch<unknown, unknown> => ({ queryKey });

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

  // Tudo ou nada: os valores novos são calculados antes de qualquer
  // `setQueryData`. Se algum cálculo lançar, o cache não muda, nada entra na
  // fila e o erro vai para `opts.onError`.
  function mutate(
    input: TInput,
    opts?: { onSuccess?: (item: TResp) => void; onError?: (err: unknown) => void },
  ) {
    let snapshots: { entrada: EntradaPatch<any, TItem>; novo: unknown }[];
    try {
      const itemOtimista = cfg.criarOtimista?.(input);
      const entradas = cfg.queryKeys(input, itemOtimista);
      snapshots = entradas.map((entrada) => {
        const anterior = queryClient.getQueryData(entrada.queryKey);
        return { entrada, novo: entrada.aplicar ? entrada.aplicar(anterior, itemOtimista) : undefined };
      });
    } catch (err) {
      opts?.onError?.(err);
      return;
    }

    for (const { entrada, novo } of snapshots) {
      if (entrada.aplicar) queryClient.setQueryData(entrada.queryKey, novo);
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
        for (const { entrada } of snapshots) queryClient.invalidateQueries({ queryKey: entrada.queryKey });
        opts?.onError?.(err);
      });
  }

  return { mutate, pendentes };
}

// ── Validação antes de enfileirar ───────────────────────────────────────────

/** Formato comum ao `safeParse` do Zod — evita depender do pacote no client. */
export type ResultadoZod<T> = { success: true; data: T } | { success: false; error: { issues: { message: string; path: (string | number)[] }[] } };

export function erroDeValidacao(mensagem: string, campo?: string): ApiError {
  return new ApiError(mensagem, 422, "VALIDACAO", campo);
}

/** Devolve `data` do resultado, ou lança `ApiError` 422 com o `campo` do
 * primeiro issue — usar antes de enfileirar, pra falhar cedo com a mesma
 * mensagem que o servidor daria. */
export function validado<T>(resultado: ResultadoZod<T>): T {
  if (resultado.success) return resultado.data;
  const [primeiro] = resultado.error.issues;
  throw erroDeValidacao(primeiro?.message ?? "Dados inválidos", primeiro?.path.length ? primeiro.path.join(".") : undefined);
}
