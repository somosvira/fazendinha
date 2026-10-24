import type { CadastroProtocoloMeta } from "./cadastros-api";
type Tipo = CadastroProtocoloMeta["tipo"];
export const caminhoCadastroProtocolo = (tipo: Tipo) => `/configuracoes/pecuaria/${tipo === "SANITARIO" ? "sanidade" : "reproducao"}/protocolos`;
export function urlCadastroProtocolo(tipo: Tipo, baseId?: string, editar = false) {
  const raiz = caminhoCadastroProtocolo(tipo);
  const atual = window.location.pathname === raiz ? window.location.pathname + window.location.search : raiz;
  const params = new URLSearchParams({ retorno: atual });
  if (baseId) params.set(editar ? "editar" : "base", baseId);
  return `${raiz}/novo?${params}`;
}
