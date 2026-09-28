// Aritmética decimal exata (BigInt) com o mesmo resultado do Prisma.Decimal
// (arredondamento ROUND_HALF_UP) sem depender de @prisma/client.

export type ValorDecimal = number | string;

interface Dec { n: bigint; e: number }

const DEZ = 10n;
const pot = (e: number) => DEZ ** BigInt(e);

function parse(valor: ValorDecimal): Dec {
  const texto = typeof valor === "number" ? String(valor) : valor.trim();
  const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(texto);
  if (!m || (m[2] === "" && !m[3]) || !Number.isFinite(Number(texto))) throw new RangeError(`Valor decimal inválido: ${texto}`);
  const fracao = m[3] ?? "";
  let n = BigInt(`${m[2] || "0"}${fracao}`);
  let e = fracao.length - Number(m[4] ?? 0);
  if (e < 0) { n *= pot(-e); e = 0; }
  return { n: m[1] === "-" ? -n : n, e };
}

function escala(d: Dec, e: number): bigint {
  return d.n * pot(e - d.e);
}

function somar(a: Dec, b: Dec): Dec {
  const e = Math.max(a.e, b.e);
  return { n: escala(a, e) + escala(b, e), e };
}

function dividirArredondado(num: bigint, den: bigint): bigint {
  const negativo = (num < 0n) !== (den < 0n);
  const an = num < 0n ? -num : num;
  const ad = den < 0n ? -den : den;
  let q = an / ad;
  if ((an % ad) * 2n >= ad) q += 1n;
  return negativo ? -q : q;
}

function arredondar(d: Dec, casas: number): Dec {
  if (d.e <= casas) return d;
  return { n: dividirArredondado(d.n, pot(d.e - casas)), e: casas };
}

function paraNumero(d: Dec): number {
  const negativo = d.n < 0n;
  const digitos = (negativo ? -d.n : d.n).toString().padStart(d.e + 1, "0");
  const inteiro = digitos.slice(0, digitos.length - d.e);
  const fracao = digitos.slice(digitos.length - d.e);
  return Number(`${negativo ? "-" : ""}${inteiro}${fracao ? `.${fracao}` : ""}`);
}

/** Arredonda a `casas` decimais, meio para longe do zero. */
export function arredondarDecimal(valor: ValorDecimal, casas: number): number {
  return paraNumero(arredondar(parse(valor), casas));
}

/** Dinheiro em 2 casas, igual ao `dinheiro()` do servidor. */
export function arredondarDinheiro(valor: ValorDecimal): number {
  return arredondarDecimal(valor, 2);
}

/** Soma exata; arredonda só no final quando `casas` é informado. */
export function somarDecimais(valores: readonly ValorDecimal[], casas?: number): number {
  const soma = valores.reduce<Dec>((total, valor) => somar(total, parse(valor)), { n: 0n, e: 0 });
  return paraNumero(casas === undefined ? soma : arredondar(soma, casas));
}

/** Produto exato arredondado a `casas`. */
export function multiplicarDecimais(a: ValorDecimal, b: ValorDecimal, casas: number): number {
  const x = parse(a), y = parse(b);
  return paraNumero(arredondar({ n: x.n * y.n, e: x.e + y.e }, casas));
}

/** (a × b) ÷ c exato, arredondado a `casas`. `b` omitido vale 1. */
export function dividirDecimais(a: ValorDecimal, c: ValorDecimal, casas: number, b: ValorDecimal = 1): number {
  const x = parse(a), y = parse(b), z = parse(c);
  if (z.n === 0n) throw new RangeError("Divisão por zero");
  // valor = (x.n·y.n / 10^(x.e+y.e)) ÷ (z.n / 10^z.e); escalado por 10^casas.
  const expoente = z.e + casas - x.e - y.e;
  const num = x.n * y.n * (expoente > 0 ? pot(expoente) : 1n);
  const den = z.n * (expoente < 0 ? pot(-expoente) : 1n);
  return paraNumero({ n: dividirArredondado(num, den), e: casas });
}

/** Valor em centavos inteiros (arredondado). */
export function paraCentavos(valor: ValorDecimal): number {
  return Number(escala(arredondar(parse(valor), 2), 2));
}
