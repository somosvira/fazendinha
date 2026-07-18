/* Agregação de volume físico (leite/café) a partir dos módulos operacionais,
 * para cruzar com o financeiro (R$/L, R$/saca). I/O Prisma isolado; o cálculo
 * puro vive em volumes.calc.ts. Espelha os filtros usados em
 * rebanho/custo-producao.ts e plantio/custo.ts. */
import { prisma } from "../db.js";
import { somarSacas } from "./volumes.calc.js";

const toNum = (x: any) => (x != null ? Number(x) : 0);

/** Taxa diária de leite da fazenda: Σ producaoMediaDia das vacas em lactação
 *  (ATIVO, com DEL preenchido = em lactação). Escopo por propriedade opcional. */
export async function litrosDiaAtual(propriedadeId?: number | null): Promise<number> {
  const animais = await prisma.animal.findMany({
    where: {
      status: "ATIVO",
      resumo: { del: { not: null } },
      ...(propriedadeId != null ? { propriedadeId } : {}),
    },
    select: { resumo: { select: { producaoMediaDia: true } } },
  });
  const litrosDia = animais.reduce((s, a) => s + toNum(a.resumo?.producaoMediaDia), 0);
  return Math.round(litrosDia * 10) / 10;
}

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
