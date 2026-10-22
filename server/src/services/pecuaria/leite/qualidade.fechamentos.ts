import { Prisma } from "@prisma/client";
import { obterAmostraQualidadeTx, amostraQualidadeDTO } from "./qualidade.js";
import { RebanhoError } from "../rebanho/regras.js";
/** Não cria amostra nem exige laudo/resultado para fechar. Cada versão comercial escolhe seus vínculos. */
export async function prepararVinculosQualidadeFechamentoTx(tx: Prisma.TransactionClient,
  selecao: { amostraId: string; versaoEsperada: number }[],
  periodo: { propriedadeId: number; inicio: Date; fim: Date }, usuarioId: number | null) {
  const vinculos: { amostraId: string; versaoAmostra: number; snapshot: Prisma.InputJsonValue; criadoPorId: number | null }[] = [];
  for (const item of [...selecao].sort((a, b) => a.amostraId.localeCompare(b.amostraId))) {
    await tx.$queryRaw`SELECT id FROM pecuaria."AmostraQualidadeLeite" WHERE id=${item.amostraId} FOR SHARE`;
    const a = await obterAmostraQualidadeTx(tx, item.amostraId, periodo.propriedadeId);
    if (a.exameAnimalId) await tx.$queryRaw`SELECT id FROM pecuaria."ExameAnimal" WHERE id=${a.exameAnimalId} FOR SHARE`;
    const dto = amostraQualidadeDTO(a);
    if (a.versao !== item.versaoEsperada || dto.status !== "VALIDO") throw new RebanhoError("CONFLITO", "A amostra mudou ou foi anulada; confira a seleção do fechamento");
    if (a.data < periodo.inicio || a.data > periodo.fim) throw new RebanhoError("VALIDACAO", "A amostra deve pertencer ao período comercial selecionado");
    vinculos.push({ amostraId: a.id, versaoAmostra: a.versao, snapshot: JSON.parse(JSON.stringify(dto)), criadoPorId: usuarioId && usuarioId > 0 ? usuarioId : null });
  }
  return vinculos;
}
