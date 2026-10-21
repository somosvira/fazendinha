import { gmdEntre } from "./peso.calc.js";
type BaseOrdenacao = { id: string; brinco: string; pesagens: Array<{ data: Date; pesoKg: { toString(): string } | number | string }> };
/** Mesmas duas pesagens da lista; desconhecidos sempre ao final e desempate estável. */
export function ordenarPorPeso<T extends BaseOrdenacao>(animais: T[], campo: "ultimoPeso" | "gmd", direcao: "asc" | "desc"): T[] {
  const valor = (a: T) => campo === "ultimoPeso" ? a.pesagens[0] ? Number(a.pesagens[0].pesoKg) : null : a.pesagens[0] && a.pesagens[1] ? gmdEntre({ data: a.pesagens[1].data, pesoKg: Number(a.pesagens[1].pesoKg) }, { data: a.pesagens[0].data, pesoKg: Number(a.pesagens[0].pesoKg) }) : null;
  return animais.map(a => ({ a, valor: valor(a) })).sort((x, y) => {
    const desempate = () => x.a.brinco.localeCompare(y.a.brinco) || x.a.id.localeCompare(y.a.id);
    if (x.valor == null || y.valor == null) return x.valor == null && y.valor == null ? desempate() : x.valor == null ? 1 : -1;
    return (direcao === "asc" ? x.valor - y.valor : y.valor - x.valor) || desempate();
  }).map(v => v.a);
}
