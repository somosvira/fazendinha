import { createClerkClient } from "@clerk/backend";
import { prisma } from "../../db.js";
import { env } from "../../env.js";
import { normalizarAreas } from "./papeis.js";
import type { UsuarioContexto } from "./sessao.js";

type UsuarioAutorizavel = {
  id: number;
  nome: string;
  email: string;
  papel: string;
  abas: string[];
  areas: string[];
  flags: string[];
  status: string;
  dono: boolean;
  clerkUserId: string | null;
};

function paraContexto(usuario: UsuarioAutorizavel): UsuarioContexto | null {
  if (usuario.status !== "ATIVO") return null;
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    papel: usuario.papel,
    abas: usuario.abas,
    areas: normalizarAreas(usuario.areas),
    flags: usuario.flags,
    status: usuario.status,
    dono: usuario.dono,
  };
}

function configurado(): boolean {
  return Boolean(env.CLERK_PUBLISHABLE_KEY && env.CLERK_SECRET_KEY && env.CLERK_JWT_KEY && env.CLERK_AUTHORIZED_PARTIES.length > 0);
}

function emailGoogleVerificado(user: {
  primaryEmailAddress?: { emailAddress?: string | null; verification?: { status?: string | null } | null } | null;
  externalAccounts?: Array<{ provider?: string | null; verification?: { status?: string | null } | null }>;
}): string | null {
  const email = user.primaryEmailAddress;
  const possuiGoogle = user.externalAccounts?.some((conta) => conta.provider === "google" && conta.verification?.status === "verified");
  if (!email?.emailAddress || email.verification?.status !== "verified" || !possuiGoogle) return null;
  return email.emailAddress.trim().toLowerCase();
}

export async function autenticarRequestClerk(request: Request): Promise<UsuarioContexto | null> {
  if (!configurado()) return null;
  const secretKey = env.CLERK_SECRET_KEY;
  const publishableKey = env.CLERK_PUBLISHABLE_KEY;
  const jwtKey = env.CLERK_JWT_KEY;
  if (!secretKey || !publishableKey || !jwtKey) return null;
  const clerk = createClerkClient({ secretKey, publishableKey });
  const estado = await clerk.authenticateRequest(request, {
    acceptsToken: "session_token",
    authorizedParties: env.CLERK_AUTHORIZED_PARTIES,
    jwtKey,
  });
  if (!estado.isAuthenticated) return null;
  const subject = estado.toAuth().userId;
  if (!subject) return null;

  const vinculado = await prisma.usuario.findUnique({ where: { clerkUserId: subject } });
  const contextoVinculado = vinculado ? paraContexto(vinculado) : null;
  if (vinculado) return contextoVinculado;

  const usuarioClerk = await clerk.users.getUser(subject);
  const email = emailGoogleVerificado(usuarioClerk);
  if (!email) return null;

  try {
    return await prisma.$transaction(async (tx) => {
      const candidato = await tx.usuario.findUnique({ where: { email } });
      if (!candidato || candidato.status !== "ATIVO") return null;
      if (candidato.clerkUserId && candidato.clerkUserId !== subject) return null;

      const associado = await tx.usuario.updateMany({
        where: { id: candidato.id, clerkUserId: null },
        data: { clerkUserId: subject, ultimoAcesso: new Date() },
      });
      if (associado.count === 0 && candidato.clerkUserId !== subject) return null;

      const usuario = await tx.usuario.findUnique({ where: { clerkUserId: subject } });
      return usuario ? paraContexto(usuario) : null;
    });
  } catch {
    // Corrida de associação ou indisponibilidade não pode autenticar outro usuário.
    return null;
  }
}
