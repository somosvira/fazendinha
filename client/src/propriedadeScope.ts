/* Sítio ativo (multi-propriedade) — fonte ÚNICA de verdade, compartilhada por
 * todas as camadas de fetch do app (rebanho, financeiro/dashboard, gastos).
 *
 * Vai como header `X-Propriedade-Id` em toda request; `null` = consolidado (sem
 * filtro) / fazenda de 1 sítio (o backend resolve a principal invisivelmente).
 * O seletor do shell (App) grava aqui via setPropriedadeAtiva; cada `req`/`fetch`
 * lê no momento da chamada. Módulo-global proposital: o valor precisa atravessar
 * módulos que não compartilham árvore React.
 *
 * `comPropriedade` também compõe o header `Authorization` do lib/auth (piloto):
 * um único helper cuida do envelope padrão de toda request pra API. */

import { comAuth, getUsuario } from "./lib/auth";

let _propriedadeAtiva: number | null = null;
let _usuarioAtivo: number | null | undefined;
const chaveEscopo = (usuarioId: number) => `terrano:sitio-ativo:${usuarioId}`;

// Preferência da aba por usuário; o servidor continua validando o escopo.
// Não guarda credenciais nem compartilha a escolha com outras contas.
function restaurarEscopo(): void {
  const usuarioId = getUsuario()?.id ?? null;
  if (_usuarioAtivo === usuarioId) return;
  _usuarioAtivo = usuarioId;
  _propriedadeAtiva = null;
  if (usuarioId == null) return;
  try {
    const raw = sessionStorage.getItem(chaveEscopo(usuarioId));
    const id = raw == null ? null : Number(raw);
    if (id != null && Number.isInteger(id) && id > 0 && id <= 2147483647) {
      _propriedadeAtiva = id;
    }
  } catch {
    // O seletor continua funcionando quando o armazenamento está indisponível.
  }
}

export const setPropriedadeAtiva = (id: number | null) => {
  restaurarEscopo();
  _propriedadeAtiva = id;
  if (_usuarioAtivo == null) return;
  try {
    if (id == null) sessionStorage.removeItem(chaveEscopo(_usuarioAtivo));
    else sessionStorage.setItem(chaveEscopo(_usuarioAtivo), String(id));
  } catch {
    // Conserva a seleção em memória nesta navegação.
  }
};
export const getPropriedadeAtiva = (): number | null => {
  restaurarEscopo();
  return _propriedadeAtiva;
};

// Injeta o header de escopo num objeto de headers, sem mutar o original. Com
// escopo consolidado (null) devolve os headers como estão — fazenda de 1 sítio
// nunca envia o header, mantendo retrocompat total das rotas.
export function comPropriedade(
  headers: Record<string, string> = {},
): Record<string, string> {
  const base = comAuth(headers);
  const propriedadeAtiva = getPropriedadeAtiva();
  return propriedadeAtiva != null
    ? { ...base, "X-Propriedade-Id": String(propriedadeAtiva) }
    : base;
}
