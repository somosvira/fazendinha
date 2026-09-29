import { setSessao, type UsuarioSessao } from "../auth";
import { garantirProcessamento } from "./fila";
import { persister } from "./persister";
import { queryClient } from "./queryClient";

// A fila para num 401 e só volta a andar com a sessão nova.
export function iniciarSessao(token: string, u: UsuarioSessao): void {
  setSessao(token, u);
  garantirProcessamento();
}

// Não toca na fila de envios pendentes.
export function limparCacheDaSessao(): void {
  queryClient.clear();
  void persister.removeClient();
}
