/** A prévia recalcula estimativas com inteiros escalados, preservando centavos. */
function fracao(valor: string) {
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(valor)) return null;
  const [mantissa, expoente = "0"] = valor.toLowerCase().split("e");
  const exp = Number(expoente);
  if (!Number.isSafeInteger(exp) || Math.abs(exp) > 100) return null;
  const [inteiro, decimal = ""] = mantissa.split(".");
  const casas = decimal.length - exp;
  const numerador = BigInt((inteiro || "0") + decimal);
  return { numerador: casas < 0 ? numerador * 10n ** BigInt(-casas) : numerador, denominador: casas > 0 ? 10n ** BigInt(casas) : 1n };
}
function texto(unidades: bigint, casas: number) {
  const s = unidades.toString().padStart(casas + 1, "0");
  return casas ? `${s.slice(0, -casas)}.${s.slice(-casas)}` : s;
}
export function estimativaConferida(valorPrevisto: string | null, quantidadePrevista: string, quantidadeConferida: string, casas: number) {
  const q = fracao(quantidadeConferida); const p = fracao(quantidadePrevista);
  if (!q || !p || p.numerador === 0n) return null;
  if (q.numerador === 0n) return texto(0n, casas);
  const v = valorPrevisto == null ? null : fracao(valorPrevisto);
  if (!v) return null;
  const n = v.numerador * q.numerador * p.denominador * 10n ** BigInt(casas);
  const d = v.denominador * q.denominador * p.numerador;
  return texto((n * 2n + d) / (d * 2n), casas);
}
export function somarEstimativas(valores: Array<string | null>, casas: number) {
  const escala = 10n ** BigInt(casas);
  return texto(valores.reduce((total, v) => { const f = v == null ? null : fracao(v); return total + (f ? f.numerador * escala / f.denominador : 0n); }, 0n), casas);
}
