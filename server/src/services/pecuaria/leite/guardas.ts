import type { Prisma } from "@prisma/client";
import { RebanhoError } from "../rebanho/regras.js";

/** Não invalida silenciosamente a origem de uma medição resolvida. Exclusão explícita mantém a trilha. */
export async function conferirLactacaoComProducaoTx(tx: Prisma.TransactionClient, animalId: string, lactacaoId: string, inicio: Date, fim: Date | null) {
  const foraDoIntervalo: Prisma.DiaProducaoLeiteWhereInput[] = [{ dataOperacional: { lt: inicio } }];
  if (fim) foraDoIntervalo.push({ dataOperacional: { gte: fim } });
  const participantes = await tx.participanteProducaoLeite.findMany({ where: {
    animalId, excluidoEm: null, medicoes: { some: { estado: "MEDIDO" } },
    OR: [
      { lactacaoId, dia: { OR: foraDoIntervalo } },
      // Uma lactação antes ausente não pode ser conciliada como seca sobre litros existentes.
      ...(fim ? [{ lactacaoId: null, dia: { dataOperacional: { gte: fim } } }] : []),
    ],
  }, select: { lactacaoId: true, dia: { select: { dataOperacional: true } } } });
  if (!participantes.length) return;
  const outras = participantes.some(p => p.lactacaoId === null)
    ? await tx.lactacaoAnimal.findMany({ where: { animalId, id: { not: lactacaoId } }, select: { inicio: true, encerradaEm: true } }) : [];
  if (participantes.some(p => p.lactacaoId !== null || !outras.some(l => l.inicio <= p.dia.dataOperacional &&
      (l.encerradaEm === null || l.encerradaEm > p.dia.dataOperacional))))
    throw new RebanhoError("CONFLITO", "A alteração da lactação invalida produção já medida; regularize explicitamente a folha antes", "encerradaEm");
}
