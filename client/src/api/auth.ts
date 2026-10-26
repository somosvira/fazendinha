import { comPropriedade } from "../propriedadeScope";
import type { UsuarioSessao } from "../lib/auth";

const JSON_H = { "content-type": "application/json" };

async function ler<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error((body as { error?: string }).error ?? `erro ${res.status}`), { status: res.status });
  }
  return res.json() as Promise<T>;
}

export async function fetchMe(): Promise<UsuarioSessao | null> {
  const res = await fetch("/api/auth/me", { headers: comPropriedade() });
  if (res.status === 401) return null;
  const body = await ler<{ usuario: UsuarioSessao }>(res);
  return body.usuario;
}

export async function listarUsuarios(): Promise<UsuarioSessao[]> {
  const res = await fetch("/api/usuarios", { headers: comPropriedade() });
  const body = await ler<{ usuarios: UsuarioSessao[] }>(res);
  return body.usuarios;
}

export async function criarUsuario(nome: string, email: string, papel: string) {
  const res = await fetch("/api/usuarios", { method: "POST", headers: comPropriedade(JSON_H), body: JSON.stringify({ nome, email, papel }) });
  return ler<{ usuario: UsuarioSessao }>(res);
}

export async function atualizarUsuario(id: number, patch: { papel?: string; abas?: string[]; areas?: string[]; flags?: string[]; status?: string }) {
  const res = await fetch(`/api/usuarios/${id}`, { method: "PATCH", headers: comPropriedade(JSON_H), body: JSON.stringify(patch) });
  const body = await ler<{ usuario: UsuarioSessao }>(res);
  return body.usuario;
}

export async function revogarUsuario(id: number): Promise<void> {
  const res = await fetch(`/api/usuarios/${id}`, { method: "DELETE", headers: comPropriedade() });
  await ler<{ ok: true }>(res);
}
