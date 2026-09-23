/* Agregação de volume físico (café) a partir dos módulos operacionais,
 * para cruzar com o financeiro (R$/L, R$/saca). I/O Prisma isolado; o cálculo
 * puro vive em volumes.calc.ts. Espelha os filtros usados em
 * plantio/custo.ts. */
import { prisma } from "../db.js";
import { somarSacas } from "./volumes.calc.js";

const toNum = (x: any) => (x != null ? Number(x) : 0);

/** Sacas beneficiadas colhidas num período [from, to]. PassadaColheita não tem
 *  propriedadeId próprio — escopa via talhão. */
export async function sacasColhidasPeriodo(
  from: Date,
  to: Date,
  propriedadeId?: number | null,
): Promise<number> {
  const passadas = await prisma.passadaColheita.findMany({
    where: {
      data: { gte: from, lte: to },
      ...(propriedadeId != null ? { talhao: { propriedadeId } } : {}),
    },
    select: { sacasBeneficiadas: true },
  });
  return somarSacas(passadas.map((p) => toNum(p.sacasBeneficiadas)));
}
