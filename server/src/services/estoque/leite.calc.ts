import { Prisma } from "@prisma/client";
import { dinheiro } from "../financeiro/regras.js";
import { ValorizacaoError } from "./valorizacao.calc.js";

const D = (valor: Prisma.Decimal.Value) => new Prisma.Decimal(valor);
export type SaldoOrigemLeite = {
  entradaId: string; data: string; ordem: number;
  quantidade: Prisma.Decimal.Value; valor: Prisma.Decimal.Value | null;
};
export type ParcelaBaixaLeite = { entradaId: string; quantidade: Prisma.Decimal; valorTotal: Prisma.Decimal | null };
export type FinalidadeLeite = "VENDA" | "CONSUMO" | "DESCARTE";

export function selecionarOrigensLeite<T extends { natureza: string }>(bases: T[], finalidade: FinalidadeLeite): T[] {
  return finalidade === "VENDA" ? bases.filter(b => b.natureza === "COMERCIAL") : [...bases];
}
export function conferirMudancaNaturezaLeite(anterior: string, proxima: string): boolean {
  if (!["COMERCIAL", "COLOSTRO", "NAO_COMERCIAL"].includes(proxima))
    throw new ValorizacaoError("VALIDACAO", "Escolha uma declaração explícita para a entrada de leite");
  if (anterior === proxima) return false;
  if (anterior === "COLOSTRO" || anterior === "NAO_COMERCIAL")
    throw new ValorizacaoError("CONFLITO", "Uma entrada restrita não pode ser desbloqueada ou reclassificada neste fluxo");
  if (anterior !== "NAO_INFORMADA" && anterior !== "COMERCIAL")
    throw new ValorizacaoError("CONFLITO", "Classificação anterior inválida; regularize a origem");
  return true;
}

function quantidade(valor: Prisma.Decimal.Value, permitirZero = false) {
  const qtd = D(valor);
  if (!qtd.isFinite() || qtd.lt(0) || !permitirZero && qtd.isZero() || qtd.decimalPlaces() > 3 || qtd.gt("999999999.999"))
    throw new ValorizacaoError("VALIDACAO", "Informe litros válidos com até três casas decimais");
  return qtd;
}
function valorMonetario(valor: Prisma.Decimal.Value) {
  const total = D(valor);
  if (!total.isFinite() || total.lt(0) || total.decimalPlaces() > 2 || total.gt("999999999999.99"))
    throw new ValorizacaoError("VALIDACAO", "Informe valor comprovado válido com até duas casas decimais");
  return total;
}

/** FIFO físico por origem de ordenha. Ausência de custo conserva null. */
export function planejarBaixaLeite(input: { quantidade: Prisma.Decimal.Value; bases: SaldoOrigemLeite[] }) {
  const total = quantidade(input.quantidade);
  if (new Set(input.bases.map(b => b.entradaId)).size !== input.bases.length)
    throw new ValorizacaoError("VALIDACAO", "Origem de produção repetida");
  const bases = input.bases.map(b => ({ ...b, quantidade: quantidade(b.quantidade, true), valor: b.valor == null ? null : valorMonetario(b.valor) }))
    .sort((a, b) => a.data.localeCompare(b.data) || a.ordem - b.ordem || a.entradaId.localeCompare(b.entradaId));
  if (bases.reduce((s, b) => s.plus(b.quantidade), D(0)).lt(total))
    throw new ValorizacaoError("SALDO_INSUFICIENTE", "Saldo de leite insuficiente na data da retirada");
  let restante = total;
  const parcelas: ParcelaBaixaLeite[] = [];
  for (const base of bases) {
    if (restante.isZero()) break;
    if (base.quantidade.isZero()) continue;
    const retirada = Prisma.Decimal.min(restante, base.quantidade);
    const valorTotal = base.valor == null ? null : retirada.eq(base.quantidade) ? base.valor : dinheiro(base.valor.mul(retirada).div(base.quantidade));
    parcelas.push({ entradaId: base.entradaId, quantidade: retirada, valorTotal });
    restante = restante.minus(retirada);
  }
  const conhecido = parcelas.every(p => p.valorTotal != null);
  return { quantidade: total, valorTotal: conhecido ? parcelas.reduce((s, p) => s.plus(p.valorTotal!), D(0)) : null, parcelas };
}

/** Apropriação por origem: consumo na ordem congelada e resíduo no saldo. */
export function repartirCustoProducaoLeite(input: {
  quantidadeProduzida: Prisma.Decimal.Value; valorTotal: Prisma.Decimal.Value;
  consumos: { id: string; quantidade: Prisma.Decimal.Value }[];
}) {
  const produzida = quantidade(input.quantidadeProduzida);
  const total = valorMonetario(input.valorTotal);
  if (new Set(input.consumos.map(c => c.id)).size !== input.consumos.length)
    throw new ValorizacaoError("VALIDACAO", "Consumo repetido na apuração");
  let saldoQuantidade = produzida;
  let saldoValor = total;
  const parcelas = input.consumos.map(consumo => {
    const qtd = quantidade(consumo.quantidade);
    if (qtd.gt(saldoQuantidade)) throw new ValorizacaoError("CONFLITO", "Consumos superam a produção da origem");
    const valorTotal = qtd.eq(saldoQuantidade) ? saldoValor : dinheiro(saldoValor.mul(qtd).div(saldoQuantidade));
    saldoQuantidade = saldoQuantidade.minus(qtd);
    saldoValor = saldoValor.minus(valorTotal);
    return { id: consumo.id, quantidade: qtd, valorTotal };
  });
  return { parcelas, quantidadeRemanescente: saldoQuantidade, valorRemanescente: saldoValor };
}
