import { prisma } from "../../db.js";
import { env } from "../../env.js";
import { hashSenha, verificarSenha } from "./hash.js";
import { gerarToken, hashToken, tokenExpirado, expiraConvite, expiraReset } from "./token.js";
import { criarSessao, revogarSessoesDoUsuario } from "./sessao.js";
import { usuarioDTO, type UsuarioDTO } from "./usuarios.js";

function montarLink(tipo: "convite" | "senha", raw: string): string {
  const base = env.APP_BASE_URL.replace(/\/$/, "");
  return `${base}/${tipo}/${raw}`;
}

async function novoToken(usuarioId: number, tipo: "CONVITE" | "RESET"): Promise<string> {
  const { raw, hash } = gerarToken();
  const expiraEm = tipo === "CONVITE" ? expiraConvite() : expiraReset();
  // um token vivo por tipo: invalida os anteriores não usados
  await prisma.tokenAcesso.deleteMany({ where: { usuarioId, tipo, usadoEm: null } });
  await prisma.tokenAcesso.create({ data: { usuarioId, tipo, tokenHash: hash, expiraEm } });
  return raw;
}

export async function gerarLinkConvite(usuarioId: number): Promise<string> {
  return montarLink("convite", await novoToken(usuarioId, "CONVITE"));
}

export async function gerarLinkReset(usuarioId: number): Promise<string> {
  return montarLink("senha", await novoToken(usuarioId, "RESET"));
}

export async function autenticar(email: string, senha: string): Promise<UsuarioDTO | null> {
  const u = await prisma.usuario.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!u || u.status !== "ATIVO" || !u.senhaHash) return null;
  if (!verificarSenha(senha, u.senhaHash)) return null;
  return usuarioDTO(u);
}

async function acharTokenValido(rawToken: string, tipo: "CONVITE" | "RESET") {
  const t = await prisma.tokenAcesso.findUnique({ where: { tokenHash: hashToken(rawToken) }, include: { usuario: true } });
  if (!t || t.tipo !== tipo || t.usadoEm || tokenExpirado(t.expiraEm)) return null;
  return t;
}

export async function validarConvite(rawToken: string): Promise<{ nome: string; email: string } | null> {
  const t = await acharTokenValido(rawToken, "CONVITE");
  return t ? { nome: t.usuario.nome, email: t.usuario.email } : null;
}

export async function aceitarConvite(rawToken: string, senha: string): Promise<UsuarioDTO | null> {
  const t = await acharTokenValido(rawToken, "CONVITE");
  if (!t) return null;
  const u = await prisma.usuario.update({
    where: { id: t.usuarioId },
    data: { senhaHash: hashSenha(senha), status: "ATIVO" },
  });
  await prisma.tokenAcesso.update({ where: { id: t.id }, data: { usadoEm: new Date() } });
  return usuarioDTO(u);
}

export async function redefinirSenha(rawToken: string, senha: string): Promise<UsuarioDTO | null> {
  const t = await acharTokenValido(rawToken, "RESET");
  if (!t) return null;
  const u = await prisma.usuario.update({
    where: { id: t.usuarioId },
    data: { senhaHash: hashSenha(senha), status: "ATIVO" },
  });
  await prisma.tokenAcesso.update({ where: { id: t.id }, data: { usadoEm: new Date() } });
  await revogarSessoesDoUsuario(t.usuarioId); // reset invalida sessões antigas
  return usuarioDTO(u);
}
