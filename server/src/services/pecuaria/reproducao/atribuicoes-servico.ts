import { Prisma } from "@prisma/client";

/** Consumo físico mantido conserva a atribuição financeira mesmo após anular a tentativa. */
export const tentativaComAtribuicaoServico = {
  OR: [{ status: "VALIDO" as const }, { consumoMantido: true }],
} satisfies Prisma.TentativaReprodutivaWhereInput;

export const aplicacaoComConsumoOuAtribuicao = {
  OR: [{ status: "VALIDO" as const }, { consumoMantido: true }],
} satisfies Prisma.AplicacaoProdutoWhereInput;

export async function totalAtribuidoServicoTx(tx: Prisma.TransactionClient, operacaoServicoId: string, propriedadeId: number) {
  const base = { operacaoServicoId, propriedadeId };
  const [aplicacoes, exames, protocolos, tentativas] = await Promise.all([
    tx.aplicacaoProduto.aggregate({ where: { ...base, ...aplicacaoComConsumoOuAtribuicao }, _sum: { valorServicoAtribuido: true } }),
    tx.exameAnimal.aggregate({ where: { ...base, status: "VALIDO" }, _sum: { valorServicoAtribuido: true } }),
    tx.execucaoProtocoloSanitario.aggregate({ where: { ...base, canceladaEm: null }, _sum: { valorServicoAtribuido: true } }),
    tx.tentativaReprodutiva.aggregate({ where: { ...base, ...tentativaComAtribuicaoServico }, _sum: { valorServicoAtribuido: true } }),
  ]);
  return [aplicacoes, exames, protocolos, tentativas].reduce((total, agregado) => total.plus(agregado._sum.valorServicoAtribuido ?? 0), new Prisma.Decimal(0));
}
