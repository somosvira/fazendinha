// Preço dos animais de uma compra — espelho do cálculo do servidor
// (server/src/services/financeiro/compra-animais.calc.ts: `itemPrecoAnimal` e `ratearValorLote`).
// Serve à tela (valor de cada item e total antes de confirmar); o valor que vale é o do servidor.
// Usa inteiros (BigInt) para arredondar meio-para-cima sem o erro de ponto flutuante: 1,005 vira 1,01.

export type UnidadePrecoAnimal = "CABECA" | "KG" | "ARROBA" | "LOTE";
export type UnidadeItemAnimal = "cab" | "kg" | "@";

export const KG_POR_ARROBA = 15;

/** Unidade gravada no item. No lote cada animal é um item por cabeça, com a parte do valor total. */
export const UNIDADE_ITEM_ANIMAL: Record<UnidadePrecoAnimal, UnidadeItemAnimal> = { CABECA: "cab", KG: "kg", ARROBA: "@", LOTE: "cab" };

export const ROTULO_UNIDADE_PRECO: Record<UnidadePrecoAnimal, string> = { CABECA: "Por cabeça", KG: "Por kg", ARROBA: "Por arroba", LOTE: "Valor do lote" };

export type ValorItemAnimal = {
  /** Quantidade do item: 1 por cabeça; kg pagos; arrobas (peso pago ÷ 15). */
  quantidade: string;
  unidade: UnidadeItemAnimal;
  /** Valor do item em centavos. */
  centavos: number;
  /** Valor do item como o servidor recebe ("1428.57"). */
  valorTotal: string;
};

/** Número digitado ("12", "12.5", "12,5") em inteiro com `casas` decimais, arredondando meio-para-cima. */
export function paraEscalado(valor: unknown, casas: number): bigint | null {
  const texto = typeof valor === "number" ? (Number.isFinite(valor) ? String(valor) : "") : typeof valor === "string" ? valor.trim().replace(",", ".") : "";
  const partes = /^(\d+)(?:\.(\d*))?$/.exec(texto);
  if (!partes) return null;
  const decimais = partes[2] ?? "";
  const base = BigInt(partes[1] + decimais.slice(0, casas).padEnd(casas, "0"));
  return decimais.length > casas && decimais.charCodeAt(casas) >= 53 ? base + 1n : base; // "5" = 53
}

/** Divisão inteira de não negativos, arredondando meio-para-cima. */
const dividirArredondando = (numerador: bigint, divisor: bigint) => (2n * numerador + divisor) / (2n * divisor);

/** Inteiro com `casas` decimais → texto sem zeros à direita ("450", "450.5"); `minimo` mantém ao menos essas casas. */
function formatarEscalado(valor: bigint, casas: number, minimo = 0): string {
  const texto = valor.toString().padStart(casas + 1, "0");
  const inteira = texto.slice(0, texto.length - casas);
  let fracao = texto.slice(texto.length - casas);
  while (fracao.length > minimo && fracao.endsWith("0")) fracao = fracao.slice(0, -1);
  return fracao ? `${inteira}.${fracao}` : inteira;
}

export function formatarCentavos(centavos: number): string {
  return formatarEscalado(BigInt(centavos), 2, 2);
}

/** Valor em reais digitado → centavos (arredonda meio-para-cima); `null` se vazio ou inválido. */
export function reaisParaCentavos(valor: unknown): number | null {
  const escalado = paraEscalado(valor, 2);
  return escalado === null || escalado > BigInt(Number.MAX_SAFE_INTEGER) ? null : Number(escalado);
}

/**
 * Item de um animal comprado por cabeça, kg ou arroba. `null` quando falta o preço ou, em kg/arroba,
 * o peso pago. Por cabeça, a quantidade é 1; por kg, o peso pago; por arroba, o peso pago ÷ 15.
 */
export function itemPrecoAnimal(entrada: { unidade: Exclude<UnidadePrecoAnimal, "LOTE">; preco: unknown; pesoPagoKg?: unknown }): ValorItemAnimal | null {
  const preco = paraEscalado(entrada.preco, 4);
  if (preco === null) return null;
  const unidade = UNIDADE_ITEM_ANIMAL[entrada.unidade];
  if (entrada.unidade === "CABECA") return montar("1", unidade, dividirArredondando(preco, 100n));
  const peso = paraEscalado(entrada.pesoPagoKg, 3);
  if (peso === null || peso <= 0n) return null;
  if (entrada.unidade === "KG") return montar(formatarEscalado(peso, 3), unidade, dividirArredondando(peso * preco, 100000n));
  return montar(formatarEscalado(dividirArredondando(peso, BigInt(KG_POR_ARROBA)), 3), unidade, dividirArredondando(peso * preco, BigInt(KG_POR_ARROBA) * 100000n));
}

function montar(quantidade: string, unidade: UnidadeItemAnimal, centavos: bigint): ValorItemAnimal {
  return { quantidade, unidade, centavos: Number(centavos), valorTotal: formatarEscalado(centavos, 2, 2) };
}

/** Divide o valor do lote igualmente, em centavos; o que sobra fica no último animal. */
export function ratearValorLote(totalCentavos: number, quantidadeAnimais: number): number[] {
  if (!Number.isInteger(quantidadeAnimais) || quantidadeAnimais < 1 || !Number.isSafeInteger(totalCentavos) || totalCentavos < 0) return [];
  const base = Math.floor(totalCentavos / quantidadeAnimais);
  return Array.from({ length: quantidadeAnimais }, (_, indice) => indice === quantidadeAnimais - 1 ? totalCentavos - base * (quantidadeAnimais - 1) : base);
}

/** Preço médio por animal do lote, em centavos (só para exibir; o valor de cada item vem do rateio). */
export function precoMedioDoLote(totalCentavos: number, quantidadeAnimais: number): number | null {
  return quantidadeAnimais > 0 ? Number(dividirArredondando(BigInt(totalCentavos), BigInt(quantidadeAnimais))) : null;
}

/** O que o usuário digita por animal: preço e, em kg/arroba, o peso pago em kg. */
export type EntradaAnimal = { preco: unknown; pesoPago?: unknown };

/** Valor de cada animal, na ordem recebida; `null` no animal cujo preço ou peso está incompleto. */
export function valoresDosAnimais(unidade: UnidadePrecoAnimal, valorLote: unknown, animais: readonly EntradaAnimal[]): (ValorItemAnimal | null)[] {
  if (unidade !== "LOTE") return animais.map((animal) => itemPrecoAnimal({ unidade, preco: animal.preco, pesoPagoKg: animal.pesoPago }));
  const total = reaisParaCentavos(valorLote);
  const partes = total === null ? [] : ratearValorLote(total, animais.length);
  return animais.map((_, indice) => indice < partes.length ? { quantidade: "1", unidade: "cab", centavos: partes[indice], valorTotal: formatarCentavos(partes[indice]) } : null);
}
