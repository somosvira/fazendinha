export type LinhaCusto = { classe: "CUSTEIO" | "INVESTIMENTO"; valor: number; horasMaquina?: number | null; areaCultivoId?: number | null };
export type LinhaProducao = { tipo: "GRAO" | "SILAGEM"; quantidade: number; areaCultivoId?: number | null };
export type ResumoInput = { areaHaTotal: number; areas: { id: number; areaHa: number }[]; custos: LinhaCusto[]; producoes: LinhaProducao[] };
export type ResumoCalc = {
  custeioTotal: number; investimentoTotal: number; areaHa: number;
  producaoGraoSc: number; producaoSilagemTon: number;
  custoHa: number | null; custoSaca: number | null; custoTonelada: number | null;
  horasMaquinaTotal: number; nota: string | null;
};

const soma = (ns: number[]) => ns.reduce((a, b) => a + b, 0);
const div = (a: number, b: number): number | null => (b > 0 ? a / b : null);

export function calcularResumoSafra(input: ResumoInput): ResumoCalc {
  const { areas, custos, producoes } = input;

  const custeioTotal = soma(custos.filter((c) => c.classe === "CUSTEIO").map((c) => c.valor));
  const investimentoTotal = soma(custos.filter((c) => c.classe === "INVESTIMENTO").map((c) => c.valor));
  const horasMaquinaTotal = soma(custos.map((c) => c.horasMaquina ?? 0));
  const areaHa = areas.length > 0 ? soma(areas.map((a) => a.areaHa)) : input.areaHaTotal;
  const producaoGraoSc = soma(producoes.filter((p) => p.tipo === "GRAO").map((p) => p.quantidade));
  const producaoSilagemTon = soma(producoes.filter((p) => p.tipo === "SILAGEM").map((p) => p.quantidade));

  const custoHa = div(custeioTotal, areaHa);

  let custoSaca: number | null = null;
  let custoTonelada: number | null = null;
  let nota: string | null = null;

  if (areas.length > 0) {
    const temGrao = producaoGraoSc > 0;
    const temSilagem = producaoSilagemTon > 0;
    if (temGrao && temSilagem) {
      const areasGrao = new Set(producoes.filter((p) => p.tipo === "GRAO").map((p) => p.areaCultivoId));
      const areasSilagem = new Set(producoes.filter((p) => p.tipo === "SILAGEM").map((p) => p.areaCultivoId));
      const areaMista = [...areasGrao].some((id) => id != null && areasSilagem.has(id));
      const custeioSemArea = soma(
        custos.filter((c) => c.classe === "CUSTEIO" && c.areaCultivoId == null).map((c) => c.valor),
      );
      if (areaMista || custeioSemArea > 0) {
        // Custo por unidade exigiria atribuir cada custeio a um único balde de saída.
        // Área de saída mista ou custeio compartilhado (sem área) não podem ser rateados
        // sem alocação (fora do escopo) → null + nota, em vez de valores errados.
        nota =
          "Custos compartilhados ou de áreas com saída mista impedem o custo por unidade — atribua os custos a áreas de saída única (grão OU silagem).";
      } else {
        const custeioDe = (set: Set<number | null | undefined>) =>
          soma(
            custos
              .filter((c) => c.classe === "CUSTEIO" && c.areaCultivoId != null && set.has(c.areaCultivoId))
              .map((c) => c.valor),
          );
        custoSaca = div(custeioDe(areasGrao), producaoGraoSc);
        custoTonelada = div(custeioDe(areasSilagem), producaoSilagemTon);
      }
    } else if (temGrao) {
      custoSaca = div(custeioTotal, producaoGraoSc);
    } else if (temSilagem) {
      custoTonelada = div(custeioTotal, producaoSilagemTon);
    }
  } else {
    const temGrao = producaoGraoSc > 0;
    const temSilagem = producaoSilagemTon > 0;
    if (temGrao && temSilagem) {
      nota = "Safra mista (grão + silagem) sem áreas — cadastre áreas para custo por unidade.";
    } else if (temGrao) {
      custoSaca = div(custeioTotal, producaoGraoSc);
    } else if (temSilagem) {
      custoTonelada = div(custeioTotal, producaoSilagemTon);
    }
  }

  return { custeioTotal, investimentoTotal, areaHa, producaoGraoSc, producaoSilagemTon, custoHa, custoSaca, custoTonelada, horasMaquinaTotal, nota };
}

import { prisma } from "../../db.js";
import { Prisma } from "@prisma/client";

const n = (d: Prisma.Decimal | null | undefined): number => (d == null ? 0 : Number(d));
const dec = (x: number | null): Prisma.Decimal | null => (x == null ? null : new Prisma.Decimal(x.toFixed(2)));
const dec3 = (x: number): Prisma.Decimal => new Prisma.Decimal(x.toFixed(3));

export async function recomputarResumoSafra(safraCultivoId: number): Promise<void> {
  const safra = await prisma.safraCultivo.findUnique({
    where: { id: safraCultivoId },
    include: { areas: true, custos: true, producoes: true },
  });
  if (!safra) return;

  const calc = calcularResumoSafra({
    areaHaTotal: n(safra.areaHaTotal),
    areas: safra.areas.map((a) => ({ id: a.id, areaHa: n(a.areaHa) })),
    custos: safra.custos.map((c) => ({
      classe: c.classe as "CUSTEIO" | "INVESTIMENTO",
      valor: n(c.valor),
      horasMaquina: n(c.horasMaquina),
      areaCultivoId: c.areaCultivoId,
    })),
    producoes: safra.producoes.map((p) => ({
      tipo: p.tipo as "GRAO" | "SILAGEM",
      quantidade: n(p.quantidade),
      areaCultivoId: p.areaCultivoId,
    })),
  });

  const dados = {
    custeioTotal: new Prisma.Decimal(calc.custeioTotal.toFixed(2)),
    investimentoTotal: new Prisma.Decimal(calc.investimentoTotal.toFixed(2)),
    areaHa: new Prisma.Decimal(calc.areaHa.toFixed(2)),
    producaoGraoSc: dec3(calc.producaoGraoSc),
    producaoSilagemTon: dec3(calc.producaoSilagemTon),
    custoHa: dec(calc.custoHa),
    custoSaca: dec(calc.custoSaca),
    custoTonelada: dec(calc.custoTonelada),
    horasMaquinaTotal: new Prisma.Decimal(calc.horasMaquinaTotal.toFixed(2)),
  };

  await prisma.resumoSafraCultivo.upsert({
    where: { safraCultivoId },
    create: { safraCultivoId, ...dados },
    update: dados,
  });
}
