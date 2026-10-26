const CHAVE_USER = "rionovo:usuario";
let tokenDeCompatibilidade: string | null = null;

export interface UsuarioSessao {
  id: number;
  nome: string;
  email: string;
  papel: string;
  abas: string[];
  areas: string[];
  flags: string[];
  status: string;
  dono: boolean;
  ultimoAcesso?: string | null;
}

export function getUsuario(): UsuarioSessao | null {
  try {
    const valor = localStorage.getItem(CHAVE_USER);
    return valor ? JSON.parse(valor) as UsuarioSessao : null;
  } catch {
    return null;
  }
}

export function setSessao(_token: string, usuario: UsuarioSessao) {
  try {
    localStorage.setItem(CHAVE_USER, JSON.stringify(usuario));
  } catch {}
}

/** Mantido para testes e guardas locais; nunca é enviado como credencial HTTP. */
export function setToken(token: string) {
  tokenDeCompatibilidade = token;
}

export function clearToken() {
  tokenDeCompatibilidade = null;
}

export function getToken() {
  const usuario = getUsuario();
  return usuario ? `clerk:${usuario.id}` : tokenDeCompatibilidade;
}

export function clearSessao() {
  clearToken();
  try {
    localStorage.removeItem(CHAVE_USER);
  } catch {}
}

export function comAuth(headers: Record<string, string> = {}) {
  return headers;
}
