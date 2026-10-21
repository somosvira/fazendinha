import { getUsuario } from "../lib/auth";

/** A sessão sintética de desenvolvimento não é persistida no cliente. */
export function podeVerValoresFinanceiros() {
  const usuario = getUsuario();
  return !usuario || usuario.dono || usuario.flags.includes("verValores");
}
