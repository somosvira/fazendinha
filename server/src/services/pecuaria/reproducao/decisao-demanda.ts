import type { Prisma } from "@prisma/client";
export async function registrarDecisaoDemandaTx(
  tx: Prisma.TransactionClient,
  input: {
    demandaId: string;
    necessidadeId: string;
    chave: string;
    tipo: string;
    data: Date | null;
    destino: string | null;
    motivo: string;
    usuarioId: number;
  },
) {
  const demanda = await tx.demandaAcompanhamentoReprodutivo.findUniqueOrThrow({
    where: { id: input.demandaId },
  });
  const decisao = await tx.decisaoOperacionalAcompanhamento.create({
    data: { ...input, versaoAnterior: demanda.versao },
  });
  await tx.demandaAcompanhamentoReprodutivo.update({
    where: { id: demanda.id },
    data: { decisaoOperacionalId: decisao.id, versao: { increment: 1 } },
  });
  return decisao;
}
