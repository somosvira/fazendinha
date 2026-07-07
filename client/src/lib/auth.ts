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
