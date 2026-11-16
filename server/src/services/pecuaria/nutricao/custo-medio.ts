import { Prisma } from "@prisma/client";
import { hojeFazendaDate } from "../rebanho/regras.js";
import { consultarResumo } from "./resumo.js";

type BaseCusto = { custos: { animalDias: number; custoConhecido: string | null; coberturaCustoCompleta: boolean } };
/** Média ponderada; uma base parcialmente valorizada não reduz artificialmente a média. */
export function calcularCustoMedio(lotes: BaseCusto[]) {
  const elegiveis = lotes.filter(l => l.custos.animalDias > 0 && l.custos.coberturaCustoCompleta && l.custos.custoConhecido !== null);
  const animalDias = elegiveis.reduce((n, l) => n + l.custos.animalDias, 0);
  const total = elegiveis.reduce((n, l) => n.plus(l.custos.custoConhecido!), new Prisma.Decimal(0));
  return { custoPorAnimalDia: animalDias ? total.div(animalDias).toFixed(2) : null,
    custoConhecido: animalDias ? total.toFixed(2) : null, animalDias,
    lotesIncluidos: elegiveis.length, lotesTotal: lotes.length };
}
/** Mês anterior fechado ou mês atual até ontem, com o que já foi baixado e confirmado. */
export async function consultarCustoMedio(propriedadeId: number | null, permitido: boolean, mes: "anterior" | "atual" = "anterior") {
  if (!permitido) return null;
  const hoje = hojeFazendaDate();
  const atual = mes === "atual";
  const inicio = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - (atual ? 0 : 1), 1));
  const fim = atual ? new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() - 1)) : new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 0));
  // No mês atual entram também as baixas diárias já efetivadas, cada uma com seus animal-dias.
  const resumo = await consultarResumo(undefined, propriedadeId, true, false, { inicio, fim }, atual);
  return { inicio: inicio.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10), ...calcularCustoMedio(resumo.lotes) };
}
