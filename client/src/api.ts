const TOKEN_KEY = "rionovo_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

async function request(path: string, opts: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
  if (res.status === 401) {
    clearToken();
    onUnauthorized();
    throw new Error("Sessão expirada");
  }
  return res;
}

export async function apiGet<T>(path: string): Promise<T> {
  const r = await request(path);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? r.statusText);
  return r.json();
}

export async function apiSend<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await request(path, { method, body: body !== undefined ? JSON.stringify(body) : undefined });
  if (!r.ok) {
    const msg = (await r.json().catch(() => ({}))).error;
    throw new Error(typeof msg === "string" ? msg : "Falha na operação");
  }
  return r.status === 204 ? (undefined as T) : r.json();
}

export async function download(path: string, filename: string) {
  const r = await request(path);
  if (!r.ok) throw new Error("Falha ao gerar arquivo");
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function login(usuario: string, senha: string): Promise<void> {
  const r = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario, senha }),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Falha no login");
  const { token } = await r.json();
  setToken(token);
}
