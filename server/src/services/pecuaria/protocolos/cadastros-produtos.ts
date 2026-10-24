import type { Prisma } from "@prisma/client";
import { RebanhoError } from "../rebanho/regras.js";

/** Resolve somente vínculos declarados. O padrão do produto auxilia a nova configuração. */
export async function resolverTipoAplicacaoCadastroTx(
  tx: Prisma.TransactionClient,
  explicito: string | null | undefined,
  padrao: string | null | undefined,
  automatizada: boolean,
  campo: string,
) {
  const id = explicito ?? padrao;
  if (!id) {
    if (automatizada) throw new RebanhoError("VALIDACAO", "Configure o tipo de aplicação no produto ou utilize atendimento manual", campo);
    return null;
  }
  const tipo = await tx.tipoAplicacaoSanitaria.findFirst({ where: { id, ativo: true }, select: { id: true, nome: true } });
  if (!tipo) throw new RebanhoError("VALIDACAO", "Tipo de aplicação inativo ou inexistente", campo);
  return tipo;
}
