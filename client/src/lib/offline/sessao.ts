import { setSessao, type UsuarioSessao } from "../auth";
import { garantirProcessamento } from "./fila";

// A fila para num 401 e só volta a andar com a sessão nova.
export function iniciarSessao(token: string, u: UsuarioSessao): void {
  setSessao(token, u);
  garantirProcessamento();
}
