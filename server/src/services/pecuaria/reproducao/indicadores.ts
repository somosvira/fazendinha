import type { Prisma } from "@prisma/client";
import { transacaoPecuaria } from "../transacao.js";
import { carregarDadosElegibilidadeTx } from "./elegibilidade.js";
import { calcularIndicadoresReprodutivos, type DadosIndicadores } from "./indicadores.calc.js";
import { consultaIndicadoresSchema, type ConsultaIndicadoresInput } from "./indicadores.schemas.js";

export { exportarIndicadoresCsv } from "./indicadores.calc.js";
const dia = (s: string) => new Date(`${s}T00:00:00Z`);

/** Apenas leituras em lote. O corte é factual e os estados são os atualmente válidos. */
export async function carregarDadosIndicadoresTx(tx: Prisma.TransactionClient, filtros: ConsultaIndicadoresInput): Promise<DadosIndicadores> {
  const corte = dia(filtros.corte);
  // Inclui quem saiu do sítio, mudou de lote ou foi baixada; cada período decide sua participação.
  const locais = await tx.localizacaoAnimal.findMany({
    where: { propriedadeId: filtros.propriedadeId, desde: { lte: corte }, OR: [{ ate: null }, { ate: { gt: dia(filtros.inicio) } }] },
    select: { animal: { select: { id: true, brinco: true, nome: true } } },
    orderBy: { animalId: "asc" },
  });
  const identificacoes = [...new Map(locais.map(l => [l.animal.id, l.animal])).values()];
  const ids = identificacoes.map(a => a.id);
  const [elegibilidade, exames] = await Promise.all([
    carregarDadosElegibilidadeTx(tx, ids, corte),
    tx.exameAnimal.findMany({
      where: { animalId: { in: ids }, status: "VALIDO", data: { lte: corte }, interpretacao: { isNot: null } },
      select: { id: true, animalId: true, data: true, status: true, realizacao: true,
        interpretacao: { select: { tentativaId: true, gestacaoId: true } },
        resultados: { where: { vigente: true, campo: "CONCLUSAO_GESTACIONAL" }, select: { valor: true } } },
      orderBy: [{ data: "asc" }, { id: "asc" }],
    }),
  ]);
  return { elegibilidade, identificacoes,
    evidencias: exames.flatMap(e => e.interpretacao && e.realizacao === "REALIZADO" ? [{
      id: e.id, animalId: e.animalId, data: e.data, status: e.status, tentativaId: e.interpretacao.tentativaId,
      gestacaoId: e.interpretacao.gestacaoId, resultado: typeof e.resultados[0]?.valor === "string" ? e.resultados[0].valor : "INCONCLUSIVO",
      fonte: "EXAME_INTERPRETADO" as const,
    }] : []),
  };
}

export async function consultarIndicadoresReprodutivosTx(tx: Prisma.TransactionClient, input: ConsultaIndicadoresInput) {
  const filtros = consultaIndicadoresSchema.parse(input);
  return calcularIndicadoresReprodutivos(await carregarDadosIndicadoresTx(tx, filtros), filtros);
}
export async function consultarIndicadoresReprodutivos(input: ConsultaIndicadoresInput) {
  return transacaoPecuaria(tx => consultarIndicadoresReprodutivosTx(tx, input));
}
