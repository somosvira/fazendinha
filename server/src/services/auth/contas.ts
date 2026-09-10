import { prisma } from "../../db.js";
import { env } from "../../env.js";
import { hashSenha, verificarSenha } from "./hash.js";
import { gerarToken, hashToken, tokenExpirado, expiraConvite, expiraReset } from "./token.js";
import { usuarioDTO, type UsuarioDTO } from "./usuarios.js";
import { enviarLinkRecuperacao, type EmailRecuperacao } from "./email.js";

export class LinkAcessoError extends Error {}

function montarLink(tipo: "convite" | "senha", raw: string): string {
  const path = tipo === "convite" ? "invite" : "reset-password";
  const relativo = `/${path}/${raw}`;
  return env.APP_BASE_URL ? new URL(relativo, env.APP_BASE_URL).toString() : relativo;
}

async function novoToken(usuarioId: number, tipo: "CONVITE" | "RESET"): Promise<{ raw: string; hash: string }> {
  const { raw, hash } = gerarToken();
  const expiraEm = tipo === "CONVITE" ? expiraConvite() : expiraReset();
  // um token vivo por tipo: invalida os anteriores não usados
  await prisma.tokenAcesso.deleteMany({ where: { usuarioId, tipo, usadoEm: null } });
  await prisma.tokenAcesso.create({ data: { usuarioId, tipo, tokenHash: hash, expiraEm } });
  return { raw, hash };
}

export async function gerarLinkConvite(usuarioId: number): Promise<string> {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { status: true } });
  if (!usuario) throw new LinkAcessoError("usuário não encontrado");
  if (usuario.status !== "PENDENTE") throw new LinkAcessoError("convite disponível somente para usuário pendente");
  const { raw } = await novoToken(usuarioId, "CONVITE");
  return montarLink("convite", raw);
}

export async function gerarLinkReset(usuarioId: number): Promise<string> {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { status: true, senhaHash: true } });
  if (!usuario) throw new LinkAcessoError("usuário não encontrado");
  if (usuario.status !== "ATIVO" || !usuario.senhaHash) {
    throw new LinkAcessoError("redefinição disponível somente para usuário ativo com senha cadastrada");
  }
  const { raw } = await novoToken(usuarioId, "RESET");
  return montarLink("senha", raw);
}

export async function solicitarRecuperacaoSenha(
  email: string,
  entregar: (mensagem: EmailRecuperacao) => Promise<void> = enviarLinkRecuperacao,
): Promise<boolean> {
  const usuario = await prisma.usuario.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, email: true, status: true, senhaHash: true },
  });
  if (!usuario || usuario.status !== "ATIVO" || !usuario.senhaHash) return false;

  const { raw, hash } = await novoToken(usuario.id, "RESET");
  try {
    await entregar({ destinatario: usuario.email, link: montarLink("senha", raw), idempotencyKey: hash });
  } catch (error) {
    // Um link que não foi entregue não deve invalidar a próxima tentativa nem
    // permanecer utilizável caso o provedor tenha recusado a mensagem.
    await prisma.tokenAcesso.deleteMany({ where: { tokenHash: hash, usadoEm: null } });
    throw error;
  }
  return true;
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
  if (tipo === "CONVITE" && t.usuario.status !== "PENDENTE") return null;
  if (tipo === "RESET" && (t.usuario.status !== "ATIVO" || !t.usuario.senhaHash)) return null;
  return t;
}

export async function validarConvite(rawToken: string): Promise<{ nome: string; email: string } | null> {
  const t = await acharTokenValido(rawToken, "CONVITE");
  return t ? { nome: t.usuario.nome, email: t.usuario.email } : null;
}

export async function validarReset(rawToken: string): Promise<boolean> {
  return !!(await acharTokenValido(rawToken, "RESET"));
}

export async function aceitarConvite(rawToken: string, senha: string): Promise<UsuarioDTO | null> {
  return prisma.$transaction(async (tx) => {
    const agora = new Date();
    const t = await tx.tokenAcesso.findUnique({ where: { tokenHash: hashToken(rawToken) }, include: { usuario: true } });
    if (!t || t.tipo !== "CONVITE" || t.usadoEm || tokenExpirado(t.expiraEm, agora) || t.usuario.status !== "PENDENTE") return null;
    const consumo = await tx.tokenAcesso.updateMany({
      where: { id: t.id, usadoEm: null, expiraEm: { gt: agora } },
      data: { usadoEm: agora },
    });
    if (consumo.count !== 1) return null;
    const usuario = await tx.usuario.update({
      where: { id: t.usuarioId },
      data: { senhaHash: hashSenha(senha), status: "ATIVO" },
    });
    return usuarioDTO(usuario);
  });
}

export async function redefinirSenha(rawToken: string, senha: string): Promise<UsuarioDTO | null> {
  return prisma.$transaction(async (tx) => {
    const agora = new Date();
    const t = await tx.tokenAcesso.findUnique({ where: { tokenHash: hashToken(rawToken) }, include: { usuario: true } });
    if (!t || t.tipo !== "RESET" || t.usadoEm || tokenExpirado(t.expiraEm, agora) || t.usuario.status !== "ATIVO" || !t.usuario.senhaHash) return null;
    const consumo = await tx.tokenAcesso.updateMany({
      where: { id: t.id, usadoEm: null, expiraEm: { gt: agora } },
      data: { usadoEm: agora },
    });
    if (consumo.count !== 1) return null;
    const usuario = await tx.usuario.update({
      where: { id: t.usuarioId },
      // Reset voluntário altera apenas o hash; não promove status, papel ou acessos.
      data: { senhaHash: hashSenha(senha) },
    });
    await tx.sessao.deleteMany({ where: { usuarioId: t.usuarioId } });
    return usuarioDTO(usuario);
  });
}
