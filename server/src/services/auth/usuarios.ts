import { prisma } from "../../db.js";
import { env } from "../../env.js";
import { aplicarPreset } from "./papeis.js";
import { revogarSessoesDoUsuario } from "./sessao.js";
import { gerarLinkConvite } from "./contas.js";

export type UsuarioDTO = {
  id: number;
  nome: string;
  email: string;
  papel: string;
  abas: string[];
  flags: string[];
  status: string;
  dono: boolean;
  ultimoAcesso: string | null;
};

export class UsuarioError extends Error {
  constructor(public code: "EMAIL_DUPLICADO" | "NAO_ENCONTRADO" | "DONO_IRREVOGAVEL", m: string) {
    super(m);
  }
}

export function usuarioDTO(u: {
  id: number; nome: string; email: string; papel: string; abas: string[]; flags: string[]; status: string; dono: boolean; ultimoAcesso: Date | null;
}): UsuarioDTO {
  return {
    id: u.id, nome: u.nome, email: u.email, papel: u.papel, abas: u.abas, flags: u.flags,
    status: u.status, dono: u.dono, ultimoAcesso: u.ultimoAcesso ? u.ultimoAcesso.toISOString() : null,
  };
}

export async function listarUsuarios(): Promise<UsuarioDTO[]> {
  const us = await prisma.usuario.findMany({ orderBy: [{ dono: "desc" }, { id: "asc" }] });
  return us.map(usuarioDTO);
}

export async function criarUsuario(input: { nome: string; email: string; papel: string }): Promise<UsuarioDTO> {
  const email = input.email.trim().toLowerCase();
  if (await prisma.usuario.findUnique({ where: { email } }))
    throw new UsuarioError("EMAIL_DUPLICADO", `já existe um acesso com o e-mail ${email}`);
  const preset = aplicarPreset(input.papel);
  const u = await prisma.usuario.create({
    data: { nome: input.nome.trim(), email, papel: input.papel, abas: preset.abas, flags: preset.flags, status: "PENDENTE" },
  });
  return usuarioDTO(u);
}

export async function atualizarUsuario(
  id: number,
  patch: { papel?: string; abas?: string[]; flags?: string[]; status?: "PENDENTE" | "ATIVO" | "INATIVO" },
): Promise<UsuarioDTO> {
  const atual = await prisma.usuario.findUnique({ where: { id } });
  if (!atual) throw new UsuarioError("NAO_ENCONTRADO", "usuário não encontrado");
  // Espelha a proteção de revogarUsuario: o dono não pode ser desativado nem
  // por essa rota, senão um admin não-dono poderia trocar o status do
  // proprietário para INATIVO via PATCH e travar o acesso dele.
  if (atual.dono && patch.status && patch.status !== "ATIVO")
    throw new UsuarioError("DONO_IRREVOGAVEL", "o acesso do proprietário não pode ser desativado");
  const u = await prisma.usuario.update({
    where: { id },
    data: {
      papel: patch.papel ?? undefined,
      abas: patch.abas ?? undefined,
      flags: patch.flags ?? undefined,
      status: patch.status ?? undefined,
    },
  });
  return usuarioDTO(u);
}

export async function revogarUsuario(id: number): Promise<void> {
  const u = await prisma.usuario.findUnique({ where: { id } });
  if (!u) throw new UsuarioError("NAO_ENCONTRADO", "usuário não encontrado");
  if (u.dono) throw new UsuarioError("DONO_IRREVOGAVEL", "o acesso do proprietário é irrevogável");
  await prisma.usuario.update({ where: { id }, data: { status: "INATIVO" } });
  await revogarSessoesDoUsuario(id);
}

export async function garantirDonoBootstrap(): Promise<void> {
  if (!env.AUTH_BOOTSTRAP_EMAIL) return;
  const total = await prisma.usuario.count();
  if (total > 0) return;
  const preset = aplicarPreset("proprietario");
  const dono = await prisma.usuario.create({
    data: {
      nome: env.AUTH_BOOTSTRAP_NOME,
      email: env.AUTH_BOOTSTRAP_EMAIL.toLowerCase(),
      papel: "proprietario",
      abas: preset.abas,
      flags: preset.flags,
      status: "PENDENTE",
      dono: true,
    },
  });
  const link = await gerarLinkConvite(dono.id);
  console.log(`\n[auth] Dono criado (${dono.email}). Link único para definir a senha:\n  ${link}\n`);
}
