/* Auth mínima do piloto (fase de teste com o dono).
 *
 * NÃO é sistema de usuários — é uma senha compartilhada guardada em
 * localStorage e enviada como `Authorization: Bearer <token>` em toda request.
 * O servidor compara com `env.SHARED_ACCESS_TOKEN` (server/src/middleware/auth.ts).
 *
 * Se o piloto crescer para vários usuários/roles, isto vira Firebase/Auth0/Supabase
 * — este arquivo é o único ponto do cliente que precisa mudar.
 */

const CHAVE = "rionovo:auth-token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

export function setToken(t: string): void {
  try {
    localStorage.setItem(CHAVE, t);
  } catch {
    /* storage cheio ou modo privado */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* ignore */
  }
}

/** Injeta o header Authorization (se houver token) sem mutar o objeto original. */
export function comAuth(headers: Record<string, string> = {}): Record<string, string> {
  const t = getToken();
  return t ? { ...headers, authorization: `Bearer ${t}` } : headers;
}

const CHAVE_USER = "rionovo:usuario";

export interface UsuarioSessao {
  id: number;
  nome: string;
  email: string;
  papel: string;
  abas: string[];
  flags: string[];
  status: string;
  dono: boolean;
  ultimoAcesso?: string | null;
}

export function getUsuario(): UsuarioSessao | null {
  try {
    const raw = localStorage.getItem(CHAVE_USER);
    return raw ? (JSON.parse(raw) as UsuarioSessao) : null;
  } catch {
    return null;
  }
}

export function setSessao(token: string, u: UsuarioSessao): void {
  setToken(token);
  try {
    localStorage.setItem(CHAVE_USER, JSON.stringify(u));
  } catch {
    /* storage cheio */
  }
}

export function clearSessao(): void {
  clearToken();
  try {
    localStorage.removeItem(CHAVE_USER);
  } catch {
    /* ignore */
  }
}
