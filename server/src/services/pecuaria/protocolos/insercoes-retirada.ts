import { Prisma } from "@prisma/client";
import { z } from "zod";
import { dataOuHorario } from "../reproducao/schemas.js";
import { lerDataIatf } from "../reproducao/horarios.calc.js";

export const consultaInsercoesRetiradaSchema = z.object({
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  porPagina: z.coerce.number().int().min(1).max(10).default(10),
  realizadaEm: dataOuHorario.optional(),
}).strict();

/** Mesma ordem de anteriorIatf: comparar instantes só quando ambas as horas são conhecidas. */
export function limiteInsercaoRetirada(realizadaEm: string) {
  const retirada = lerDataIatf(realizadaEm);
  const dia = new Date(retirada.data);
  let limiteHora = retirada.instante;
  if (retirada.precisao === "DIA") {
    const formato = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
    // Busca a fronteira do dia local, inclusive em datas históricas com horário de verão.
    let inicio = dia.getTime() - 86400000;
    let fim = dia.getTime() + 2 * 86400000;
    while (fim - inicio > 1) {
      const meio = Math.floor((inicio + fim) / 2);
      if (formato.format(new Date(meio)) <= retirada.data) inicio = meio;
      else fim = meio;
    }
    limiteHora = new Date(inicio);
  }
  return { dia, limiteHora };
}

export function filtroInsercoesRetirada(animalId: string, realizadaEm?: string): Prisma.AplicacaoProdutoWhereInput {
  const limite = realizadaEm ? limiteInsercaoRetirada(realizadaEm) : null;
  return {
    animalId, status: "VALIDO",
    OR: [
      { tarefa: { etapa: { tipo: "APLICACAO", configuracao: { path: ["subtipo"], equals: "INSERCAO_DISPOSITIVO" } } } },
      { insercaoDispositivoSnapshot: { not: Prisma.DbNull } },
    ],
    retiradasDispositivo: { none: { OR: [{ status: "VALIDO" }, { realizacaoMantida: true }] } },
    ...(limite ? { AND: [{ OR: [
      { precisaoTemporal: { not: "HORA" }, data: { lte: limite.dia } },
      { precisaoTemporal: "HORA", aplicadaEm: { lte: limite.limiteHora } },
      { precisaoTemporal: "HORA", aplicadaEm: null, data: { lte: limite.limiteHora } },
    ] }] } : {}),
  };
}
