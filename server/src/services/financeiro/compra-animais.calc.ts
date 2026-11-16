import { Prisma } from "@prisma/client";

export type UnidadePrecoAnimal = "CABECA" | "KG" | "ARROBA";

export const KG_POR_ARROBA = 15;

export const UNIDADE_ITEM_ANIMAL: Record<UnidadePrecoAnimal, "cab" | "kg" | "@"> = {
  CABECA: "cab",
  KG: "kg",
  ARROBA: "@",
};

export class CompraAnimaisCalcError extends Error {
  constructor(message: string, public readonly campo: string) {
    super(message);
    this.name = "CompraAnimaisCalcError";
  }
}

export function unidadePrecoDoItem(unidade: string): UnidadePrecoAnimal | null {
  for (const [chave, valor] of Object.entries(UNIDADE_ITEM_ANIMAL)) {
    if (valor === unidade) return chave as UnidadePrecoAnimal;
  }
  return null;
}

function decimalFinito(valor: Prisma.Decimal.Value | null | undefined): Prisma.Decimal | null {
  if (valor === null || valor === undefined) return null;
  try {
    const decimal = new Prisma.Decimal(valor);
    return decimal.isFinite() ? decimal : null;
  } catch {
    return null;
  }
}

export function itemPrecoAnimal(input: {
  unidade: UnidadePrecoAnimal;
  preco: Prisma.Decimal.Value;
  pesoPagoKg?: Prisma.Decimal.Value | null;
}): { quantidade: Prisma.Decimal; unidade: "cab" | "kg" | "@"; valorUnitario: Prisma.Decimal; valorTotal: Prisma.Decimal } {
  const preco = decimalFinito(input.preco);
  if (!preco || preco.isNegative()) throw new CompraAnimaisCalcError("Informe um preço válido", "preco");
  const unidade = UNIDADE_ITEM_ANIMAL[input.unidade];
  const arredondar = Prisma.Decimal.ROUND_HALF_UP;

  if (input.unidade === "CABECA") {
    return {
      quantidade: new Prisma.Decimal(1),
      unidade,
      valorUnitario: preco.toDecimalPlaces(4, arredondar),
      valorTotal: preco.toDecimalPlaces(2, arredondar),
    };
  }

  const peso = decimalFinito(input.pesoPagoKg);
  if (!peso || !peso.greaterThan(0)) {
    throw new CompraAnimaisCalcError("Informe o peso pago para preço por kg ou arroba", "pesoPagoKg");
  }

  if (input.unidade === "KG") {
    return {
      quantidade: peso.toDecimalPlaces(3, arredondar),
      unidade,
      valorUnitario: preco.toDecimalPlaces(4, arredondar),
      valorTotal: peso.mul(preco).toDecimalPlaces(2, arredondar),
    };
  }

  return {
    quantidade: peso.div(KG_POR_ARROBA).toDecimalPlaces(3, arredondar),
    unidade,
    valorUnitario: preco.toDecimalPlaces(4, arredondar),
    valorTotal: peso.mul(preco).div(KG_POR_ARROBA).toDecimalPlaces(2, arredondar),
  };
}

export function ratearValorLote(total: Prisma.Decimal.Value, quantidadeAnimais: number): Prisma.Decimal[] {
  if (!Number.isInteger(quantidadeAnimais) || quantidadeAnimais < 1) {
    throw new CompraAnimaisCalcError("Informe uma quantidade de animais inteira, maior que zero", "quantidadeAnimais");
  }
  const decimal = decimalFinito(total);
  if (!decimal || decimal.isNegative()) throw new CompraAnimaisCalcError("Informe um valor total válido", "valorTotal");
  const totalCentavos = decimal.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).mul(100);
  const base = totalCentavos.div(quantidadeAnimais).floor();
  const sobra = totalCentavos.minus(base.mul(quantidadeAnimais - 1));
  return Array.from({ length: quantidadeAnimais }, (_, i) => (i === quantidadeAnimais - 1 ? sobra : base).div(100));
}
