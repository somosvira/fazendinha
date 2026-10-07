import { prisma } from "../../../db.js";
import { auditar, RebanhoError } from "../rebanho/regras.js";

export function listarTiposAplicacao() {
  return prisma.tipoAplicacaoSanitaria.findMany({ orderBy: { nome: "asc" } });
}

export async function salvarTipoAplicacao(input: { nome?: string; ativo?: boolean }, usuarioId: number | null, id?: string) {
  return prisma.$transaction(async (tx) => {
    const antes = id ? await tx.tipoAplicacaoSanitaria.findUnique({ where: { id } }) : null;
    if (id && !antes) throw new RebanhoError("NAO_ENCONTRADO", "Tipo de aplicação não encontrado");
    if (!id && !input.nome) throw new RebanhoError("VALIDACAO", "Informe o nome", "nome");
    const depois = id ? await tx.tipoAplicacaoSanitaria.update({ where: { id }, data: input })
      : await tx.tipoAplicacaoSanitaria.create({ data: { nome: input.nome! } });
    await auditar(tx, { entidade: "TipoAplicacaoSanitaria", entidadeId: depois.id, acao: id ? "EDICAO" : "CADASTRO", usuarioId, antes, depois });
    return depois;
  });
}
