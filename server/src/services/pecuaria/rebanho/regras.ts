import { Prisma, type PrismaClient } from "@prisma/client";

export type DbPecuaria = Prisma.TransactionClient | PrismaClient;

export class RebanhoError extends Error {
  constructor(
    public code: "NAO_ENCONTRADO" | "VALIDACAO" | "BRINCO_DUPLICADO" | "ANIMAL_INATIVO" | "JA_ESTORNADA" | "CONFLITO",
    message: string,
    /** campo do formulário ao qual a mensagem se refere (para a UI exibir junto ao input) */
    public campo?: string,
  ) {
    super(message);
  }
}

/** Traduz violação de unicidade do Prisma (P2002) em RebanhoError apontando o campo. Relança o resto. */
export function traduzirConflitoUnico(erro: unknown, mensagens: Record<string, string>): never {
  if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
    const alvos = (erro.meta?.target as string[] | undefined) ?? [];
    for (const [campo, mensagem] of Object.entries(mensagens)) {
      if (alvos.includes(campo)) throw new RebanhoError("CONFLITO", mensagem, campo);
    }
  }
  throw erro;
}

export async function auditar(
  db: DbPecuaria,
  input: { entidade: string; entidadeId: string | number; acao: string; usuarioId?: number | null; antes?: unknown; depois?: unknown },
) {
  await db.auditoriaPecuaria.create({
    data: {
      entidade: input.entidade,
      entidadeId: String(input.entidadeId),
      acao: input.acao,
      usuarioId: input.usuarioId && input.usuarioId > 0 ? input.usuarioId : null,
      antes: input.antes == null ? Prisma.JsonNull : JSON.parse(JSON.stringify(input.antes)),
      depois: input.depois == null ? Prisma.JsonNull : JSON.parse(JSON.stringify(input.depois)),
    },
  });
}
