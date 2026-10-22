import { Prisma } from "@prisma/client";
import { dinheiro } from "../../financeiro/regras.js";
import { RebanhoError } from "../rebanho/regras.js";

export type OrigemNutricionalLeite = { entradaId: string; produtoId: string; natureza: string; data: string; ordem: number; quantidade: Prisma.Decimal.Value; valor: Prisma.Decimal.Value | null };
/** Prioridade operacional confirmada: não comercial disponível; complemento comercial, FIFO em cada natureza. */
export function planejarFornecimentoLeite(origens: OrigemNutricionalLeite[], quantidade: Prisma.Decimal.Value) {
  const total = new Prisma.Decimal(quantidade);
  if (!total.isFinite() || total.lte(0) || total.decimalPlaces() > 3) throw new RebanhoError("VALIDACAO", "Informe litros positivos com até três casas decimais");
  const elegiveis = origens.filter(o => ["NAO_COMERCIAL", "COMERCIAL"].includes(o.natureza) && new Prisma.Decimal(o.quantidade).gt(0))
    .sort((a,b) => Number(a.natureza === "COMERCIAL") - Number(b.natureza === "COMERCIAL") || a.data.localeCompare(b.data) || a.ordem - b.ordem || a.entradaId.localeCompare(b.entradaId));
  if (new Set(origens.map(o => o.entradaId)).size !== origens.length) throw new RebanhoError("VALIDACAO", "Origem repetida no fornecimento");
  const disponivel = elegiveis.reduce((s,o) => s.plus(o.quantidade), new Prisma.Decimal(0));
  if (disponivel.lt(total)) throw new RebanhoError("CONFLITO", `Saldo elegível insuficiente: ${disponivel.toFixed(3)} L disponíveis; confira a quantidade efetivamente fornecida e justifique a diferença`);
  let restante = total;
  const parcelas = [];
  for (const origem of elegiveis) {
    if (restante.isZero()) break;
    const litros = Prisma.Decimal.min(restante, origem.quantidade);
    const valor = origem.valor == null ? null : litros.eq(origem.quantidade) ? new Prisma.Decimal(origem.valor) : dinheiro(new Prisma.Decimal(origem.valor).mul(litros).div(origem.quantidade));
    parcelas.push({ ...origem, quantidade: litros, valor }); restante = restante.minus(litros);
  }
  return { quantidade: total, disponivel, restante: disponivel.minus(total), parcelas,
    custoProducao: parcelas.every(p => p.valor != null) ? parcelas.reduce((s,p) => s.plus(p.valor!), new Prisma.Decimal(0)) : null };
}
export function valorGerencialLeite(quantidade: Prisma.Decimal.Value, preco: Prisma.Decimal.Value) {
  const q = new Prisma.Decimal(quantidade), p = new Prisma.Decimal(preco);
  if (!q.isFinite() || q.lt(0) || !p.isFinite() || p.lt(0) || p.decimalPlaces() > 4) throw new RebanhoError("VALIDACAO", "Quantidade ou referência comercial inválida");
  return dinheiro(q.mul(p));
}
