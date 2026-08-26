// Persister da query cache (leitura) em IndexedDB via idb-keyval — evita o
// limite de tamanho do localStorage. Escrita pendente vive em fila.ts, não
// aqui (fila própria, não mutation do TanStack).
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
