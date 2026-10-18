import { dinheiro } from "../financeiro/regras.js";

/** Ausência de lastro não se transforma em valor zero; vazio e zero comprovado são completos. */
export function consolidarValorEstoque(itens: { valor: string | null }[]) {
  const conhecidos = itens.filter((item): item is { valor: string } => item.valor != null);
  const situacao = conhecidos.length === itens.length ? "COMPLETO" as const
    : conhecidos.length ? "PARCIAL" as const : "DESCONHECIDO" as const;
  return {
    valorConhecido: itens.length && !conhecidos.length ? null : conhecidos.reduce((total, item) => total.plus(item.valor), dinheiro(0)).toFixed(2),
    situacao,
  };
}
