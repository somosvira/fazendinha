// Conversão entre unidades de medida da mesma base (KG/G/T, L/ML). As demais
// unidades (UN, SC, DOSE, CX, M, HA) são bases próprias, sem conversão entre
// si. Puro, sem I/O — usado pela baixa de estoque do plantio e por qualquer
// tela que precise exibir/validar unidade de Produto/DietaItem.
import { Prisma } from "@prisma/client";
import type { UnidadeMedida } from "@prisma/client";

export const UNIDADES: Record<UnidadeMedida, { rotulo: string; base: UnidadeMedida; fator: number }> = {
  UN: { rotulo: "un", base: "UN", fator: 1 },
  KG: { rotulo: "kg", base: "KG", fator: 1 },
  G: { rotulo: "g", base: "KG", fator: 0.001 },
  T: { rotulo: "t", base: "KG", fator: 1000 },
  L: { rotulo: "L", base: "L", fator: 1 },
  ML: { rotulo: "mL", base: "L", fator: 0.001 },
  SC: { rotulo: "sc", base: "SC", fator: 1 },
  DOSE: { rotulo: "dose", base: "DOSE", fator: 1 },
  CX: { rotulo: "cx", base: "CX", fator: 1 },
  M: { rotulo: "m", base: "M", fator: 1 },
  HA: { rotulo: "ha", base: "HA", fator: 1 },
};

export function rotuloUnidade(unidade: UnidadeMedida): string {
  return UNIDADES[unidade].rotulo;
}

export function mesmaBase(a: UnidadeMedida, b: UnidadeMedida): boolean {
  return UNIDADES[a].base === UNIDADES[b].base;
}

export function converterQuantidade(
  valor: Prisma.Decimal | number,
  de: UnidadeMedida,
  para: UnidadeMedida,
): Prisma.Decimal {
  if (!mesmaBase(de, para)) {
    throw new Error(
      `Não é possível converter de ${rotuloUnidade(de)} para ${rotuloUnidade(para)} — unidades de base diferente`,
    );
  }
  const decimal = valor instanceof Prisma.Decimal ? valor : new Prisma.Decimal(valor);
  if (de === para) return decimal;
  const fatorDe = new Prisma.Decimal(UNIDADES[de].fator);
  const fatorPara = new Prisma.Decimal(UNIDADES[para].fator);
  return decimal.mul(fatorDe).div(fatorPara);
}
