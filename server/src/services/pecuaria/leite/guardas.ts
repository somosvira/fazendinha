import type { Prisma } from "@prisma/client";
import { consultarOrigensGeraisTx } from "./origens-gerais.js";
import { lactacaoVigenteLeite } from "./populacao.calc.js";
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
  const gerais = await consultarOrigensGeraisTx(tx, [animalId]);
  if (gerais.length) {
    const anteriores = await tx.lactacaoAnimal.findMany({ where: { animalId }, select: { id: true, animalId: true, inicio: true, encerradaEm: true } });
    const proposta = { id: lactacaoId, animalId, inicio, encerradaEm: fim };
    const lactacoes = [...anteriores.filter(l => l.id !== lactacaoId), proposta];
    const antes = anteriores.find(l => l.id === lactacaoId);
    for (const geral of gerais) {
      const vigentes = lactacoes.filter(l => lactacaoVigenteLeite(l, geral.data));
      const vinculoAnterior = geral.evidencias.some(e => e.lactacaoId === lactacaoId) || Boolean(antes && lactacaoVigenteLeite(antes, geral.data));
      if ((vinculoAnterior && !lactacaoVigenteLeite(proposta, geral.data)) || vigentes.length > 1 ||
          (!vigentes.length && lactacoes.some(l => l.encerradaEm && l.encerradaEm <= geral.data)))
        throw new RebanhoError("CONFLITO", "A alteração da lactação invalida uma origem geral; regularize suas confirmações e corrija explicitamente os animais de origem antes", "encerradaEm");
    }
  }
  if (!participantes.length) return;
  const outras = participantes.some(p => p.lactacaoId === null)
    ? await tx.lactacaoAnimal.findMany({ where: { animalId, id: { not: lactacaoId } }, select: { inicio: true, encerradaEm: true } }) : [];
  if (participantes.some(p => p.lactacaoId !== null || !outras.some(l => l.inicio <= p.dia.dataOperacional &&
      (l.encerradaEm === null || l.encerradaEm > p.dia.dataOperacional))))
    throw new RebanhoError("CONFLITO", "A alteração da lactação invalida produção já medida; regularize explicitamente a folha antes", "encerradaEm");
}
