import { carregarAcompanhamentosNaDataTx } from "./acompanhamento.js";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { obterElegibilidadesNaDataTx } from "./elegibilidade.js";
import { carregarFilasAptidaoTx } from "./filas-aptidao.js";

/** A mesma projeção da ficha/visita para o conjunto autorizado na data. Leitura sem adoção de políticas. */
export async function consultarManejoAptidaoTx(tx: Prisma.TransactionClient, propriedadeId: number, data: string) {
  const referencia = new Date(`${data}T00:00:00Z`);
  const animais = await tx.animal.findMany({ where: {
    sexo: "F", dataEntrada: { lte: referencia }, dataNascimento: { lte: referencia },
    baixas: { none: { estornadaEm: null, data: { lte: referencia } } },
    localizacoes: { some: { propriedadeId, desde: { lte: referencia }, OR: [{ ate: null }, { ate: { gt: referencia } }] } },
  }, select: { id: true }, orderBy: { id: "asc" } });
  const ids = animais.map(a => a.id);
  if (!ids.length) return { propriedadeId, dataReferencia: data, itens: [] };
  const [elegibilidades, demandas] = await Promise.all([
    obterElegibilidadesNaDataTx(tx, ids, propriedadeId, referencia),
    carregarAcompanhamentosNaDataTx(tx, ids, referencia),
  ]);
  const filas = await carregarFilasAptidaoTx(tx, ids, propriedadeId, referencia, elegibilidades);
  const porId = new Map(filas.map(f => [f.animalId, f]));
  return { propriedadeId, dataReferencia: data, itens: ids.flatMap(id => {
    const item = elegibilidades.get(id);
    const demandasAcompanhamento = demandas.flatMap(d => {
      if (d.animalId !== id || d.estado !== "PENDENTE" || (d.finalidade !== "DIAGNOSTICO" && d.finalidade !== "RECONFIRMACAO")) return [];
      return [{ id: d.id, finalidade: d.finalidade, ocorrencia: d.ocorrencia,
        tentativaId: d.tentativaId, gestacaoId: d.gestacaoId,
        dataReferencia: d.dataReferencia.toISOString().slice(0, 10), previstaPara: d.previstaPara?.toISOString().slice(0, 10) ?? null,
        pendencias: d.pendencias }];
    });
    return item ? [{ ...item, acompanhamentoAptidao: porId.get(id) ?? null, demandasAcompanhamento }] : [];
  }) };
}

export function consultarManejoAptidao(propriedadeId: number, data: string) {
  return prisma.$transaction(tx => consultarManejoAptidaoTx(tx, propriedadeId, data), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
