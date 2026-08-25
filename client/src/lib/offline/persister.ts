/* Persister do cache (queries lidas com sucesso + mutations pausadas) em
 * IndexedDB via idb-keyval — evita o limite de tamanho do localStorage.
 * Mutation pausada é incluída na persistência por padrão pelo TanStack
 * (`defaultShouldDehydrateMutation` checa só `mutation.state.isPaused`,
 * sem config extra) — é assim que uma escrita feita offline sobrevive a
 * fechar/recarregar o app antes de sincronizar. */
import { get, set, del } from "idb-keyval";
import type { Persister, PersistedClient } from "@tanstack/react-query-persist-client";

const CHAVE = "rionovo-query-cache";

export const persister: Persister = {
  persistClient: async (client: PersistedClient) => {
    await set(CHAVE, client);
  },
  restoreClient: async () => {
    return (await get<PersistedClient>(CHAVE)) ?? undefined;
  },
  removeClient: async () => {
    await del(CHAVE);
  },
};
