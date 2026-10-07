import type { Prisma } from "@prisma/client";

/** A criação de vínculos e a retirada de usos precisam conferir a mesma versão do Produto. */
export async function travarUsosProduto(tx: Prisma.TransactionClient, produtoIds: string[]) {
  for (const id of [...new Set(produtoIds)].sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`produto-usos:${id}`}))`;
  }
}
