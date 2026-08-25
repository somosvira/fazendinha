import { prisma } from "../../db.js";
import { env } from "../../env.js";
import { gerarToken, hashToken, tokenExpirado } from "./token.js";
import { normalizarAreas } from "./papeis.js";

export type UsuarioContexto = {
  id: number;
  nome: string;
  email: string;
  papel: string;
  abas: string[];
  areas: string[];
  flags: string[];
  status: string;
  dono: boolean;
};

function expiraSessao(agora: Date = new Date()): Date {
  return new Date(agora.getTime() + env.AUTH_SESSAO_DIAS * 24 * 60 * 60 * 1000);
}

export async function criarSessao(usuarioId: number, userAgent?: string): Promise<string> {
  const { raw, hash } = gerarToken();
  await prisma.sessao.create({
    data: { usuarioId, tokenHash: hash, expiraEm: expiraSessao(), userAgent: userAgent ?? null },
  });
  return raw;
}

export async function resolverSessao(rawToken: string): Promise<UsuarioContexto | null> {
  const hash = hashToken(rawToken);
  const s = await prisma.sessao.findUnique({ where: { tokenHash: hash }, include: { usuario: true } });
  if (!s) return null;
  if (tokenExpirado(s.expiraEm)) {
    await prisma.sessao.delete({ where: { id: s.id } }).catch(() => {});
    return null;
  }
  if (s.usuario.status !== "ATIVO") return null;
  const agora = new Date();
  await prisma.sessao.update({ where: { id: s.id }, data: { ultimoUso: agora, expiraEm: expiraSessao(agora) } });
  await prisma.usuario.update({ where: { id: s.usuarioId }, data: { ultimoAcesso: agora } });
  const u = s.usuario;
  return { id: u.id, nome: u.nome, email: u.email, papel: u.papel, abas: u.abas, areas: normalizarAreas(u.areas), flags: u.flags, status: u.status, dono: u.dono };
}

export async function revogarSessao(rawToken: string): Promise<void> {
  await prisma.sessao.deleteMany({ where: { tokenHash: hashToken(rawToken) } });
}

export async function revogarSessoesDoUsuario(usuarioId: number): Promise<void> {
  await prisma.sessao.deleteMany({ where: { usuarioId } });
}
