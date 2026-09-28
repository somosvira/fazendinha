import Decimal from "decimal.js";

export type ValorDecimal = number | string;

const D = (valor: ValorDecimal) => new Decimal(valor);

/** Arredonda a `casas` decimais, meio para longe do zero — mesmo arredondamento
 *  padrão (ROUND_HALF_UP) do `Prisma.Decimal` do servidor. */
export function arredondarDecimal(valor: ValorDecimal, casas: number): number {
  return D(valor).toDecimalPlaces(casas).toNumber();
}

/** Dinheiro em 2 casas, igual ao `dinheiro()` do servidor. */
export function arredondarDinheiro(valor: ValorDecimal): number {
  return arredondarDecimal(valor, 2);
}

/** Soma exata; arredonda só no final quando `casas` é informado. */
export function somarDecimais(valores: readonly ValorDecimal[], casas?: number): number {
  const soma = valores.reduce((total, valor) => total.plus(valor), new Decimal(0));
  return (casas === undefined ? soma : soma.toDecimalPlaces(casas)).toNumber();
}

/** Produto exato arredondado a `casas`. */
export function multiplicarDecimais(a: ValorDecimal, b: ValorDecimal, casas: number): number {
  return D(a).times(b).toDecimalPlaces(casas).toNumber();
}

/** (a × b) ÷ c exato, arredondado a `casas`. `b` omitido vale 1. */
export function dividirDecimais(a: ValorDecimal, c: ValorDecimal, casas: number, b: ValorDecimal = 1): number {
  const divisor = D(c);
  if (divisor.isZero()) throw new RangeError("Divisão por zero");
  return D(a).times(b).dividedBy(divisor).toDecimalPlaces(casas).toNumber();
}

/** Valor em centavos inteiros (arredondado). */
export function paraCentavos(valor: ValorDecimal): number {
  return D(valor).toDecimalPlaces(2).times(100).toNumber();
}

/** Dinheiro em 2 casas como texto (formato do servidor, ex. "1234.50"). */
export function dinheiro(valor: ValorDecimal): string {
  return D(valor).toDecimalPlaces(2).toFixed(2);
}

/** Soma um dinheiro em texto com um delta, devolvendo texto em 2 casas. */
export function somar(atual: ValorDecimal, delta: ValorDecimal): string {
  return D(atual).plus(delta).toDecimalPlaces(2).toFixed(2);
}
