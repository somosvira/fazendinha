import { Prisma } from "@prisma/client";
import { dinheiro } from "../financeiro/regras.js";

export type MetodoValorizacao = "MEDIA_SALDO_V1" | "FIFO_AQUISICAO_V1";
export type EstadoValor = "CONHECIDO" | "DESCONHECIDO";
export type BaseValorizacao = {
  id: string;
  quantidade: Prisma.Decimal.Value;
  valor: Prisma.Decimal.Value | null;
  estadoValor: EstadoValor;
  data: string;
  ordem: number;
};
export class ValorizacaoError extends Error {
  constructor(public code: "VALIDACAO" | "SALDO_INSUFICIENTE" | "SEM_LASTRO" | "CONFLITO", mensagem: string) {
    super(mensagem);
    this.name = "ValorizacaoError";
  }
}
export type ParcelaSaida = { baseId: string; quantidade: Prisma.Decimal; valorTotal: Prisma.Decimal };
export type SaldoValorizado = { baseId: string; quantidade: Prisma.Decimal; valor: Prisma.Decimal | null; estadoValor: EstadoValor };

function decimal(valor: Prisma.Decimal.Value, casas: number, campo: string) {
  let numero: Prisma.Decimal;
  try { numero = new Prisma.Decimal(valor); }
  catch { throw new ValorizacaoError("VALIDACAO", `${campo} inválido`); }
  if (!numero.isFinite() || numero.lt(0) || numero.decimalPlaces() > casas)
    throw new ValorizacaoError("VALIDACAO", `${campo} deve ser não negativo e ter até ${casas} casas decimais`);
  return numero;
}
function dataValida(data: string) {
  const instante = new Date(`${data}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(data) && Number.isFinite(instante.getTime()) && instante.toISOString().slice(0, 10) === data;
}

/** Cada base média é um grupo produto/validade/sítio. FIFO usa uma base por aquisição. */
export function valorizarSaida(input: {
  quantidade: Prisma.Decimal.Value; metodo: MetodoValorizacao; bases: BaseValorizacao[]; dataReferencia: string;
}) {
  const quantidade = decimal(input.quantidade, 3, "Quantidade");
  if (quantidade.isZero()) throw new ValorizacaoError("VALIDACAO", "A quantidade da saída deve ser positiva");
  if (!dataValida(input.dataReferencia)) throw new ValorizacaoError("VALIDACAO", "Data de referência inválida");
  if (!["MEDIA_SALDO_V1", "FIFO_AQUISICAO_V1"].includes(input.metodo)) throw new ValorizacaoError("VALIDACAO", "Método de valorização inválido");
  if (new Set(input.bases.map(b => b.id)).size !== input.bases.length) throw new ValorizacaoError("VALIDACAO", "Base de valorização repetida");
  if (input.metodo === "MEDIA_SALDO_V1" && input.bases.length !== 1)
    throw new ValorizacaoError("VALIDACAO", "Selecione um único grupo para calcular a média do saldo");
  const bases = input.bases.map(base => {
    if (!base.id || !dataValida(base.data) || !Number.isSafeInteger(base.ordem) || base.ordem < 0)
      throw new ValorizacaoError("VALIDACAO", "Identidade ou ordem da base inválida");
    const saldo = decimal(base.quantidade, 3, "Quantidade da base");
    if (!["CONHECIDO", "DESCONHECIDO"].includes(base.estadoValor) || (base.estadoValor === "CONHECIDO") !== (base.valor != null))
      throw new ValorizacaoError("VALIDACAO", "Estado do valor incompatível com a evidência da base");
    const valor = base.valor == null ? null : decimal(base.valor, 2, "Valor da base");
    if (saldo.isZero() && valor != null && !valor.isZero())
      throw new ValorizacaoError("CONFLITO", "Base esgotada conserva valor residual; regularize antes de consumir");
    return { ...base, quantidade: saldo, valor };
  });
  const disponiveis = bases.filter(b => b.data <= input.dataReferencia && b.quantidade.gt(0))
    .sort((a, b) => a.data.localeCompare(b.data) || a.ordem - b.ordem || a.id.localeCompare(b.id));
  if (disponiveis.reduce((s, b) => s.plus(b.quantidade), new Prisma.Decimal(0)).lt(quantidade))
    throw new ValorizacaoError("SALDO_INSUFICIENTE", "Saldo disponível insuficiente na data do fato");
  const parcelas: ParcelaSaida[] = [];
  let restante = quantidade;
  for (const base of disponiveis) {
    if (restante.isZero()) break;
    if (base.valor == null) throw new ValorizacaoError("SEM_LASTRO", "Base sem valor comprovado: registre a abertura documentada antes de consumir");
    const retirada = Prisma.Decimal.min(restante, base.quantidade);
    // O total residual é autoritativo. A última saída leva todos os centavos.
    const valorTotal = retirada.eq(base.quantidade) ? base.valor : dinheiro(base.valor.mul(retirada).div(base.quantidade));
    parcelas.push({ baseId: base.id, quantidade: retirada, valorTotal });
    base.quantidade = base.quantidade.minus(retirada);
    base.valor = base.valor.minus(valorTotal);
    restante = restante.minus(retirada);
  }
  const valorTotal = parcelas.reduce((s, p) => s.plus(p.valorTotal), new Prisma.Decimal(0));
  return { metodo: input.metodo, quantidade, valorTotal, custoUnitarioExibicao: valorTotal.div(quantidade).toDecimalPlaces(4), parcelas,
    saldos: bases.map((b): SaldoValorizado => ({ baseId: b.id, quantidade: b.quantidade, valor: b.valor, estadoValor: b.estadoValor })) };
}

/** Maiores restos com desempate na ordem informada; não inventa pesos quando são zero. */
export function repartirValor(valorTotal: Prisma.Decimal.Value, pesosInformados: Prisma.Decimal.Value[], explicita?: Prisma.Decimal.Value[]) {
  const total = decimal(valorTotal, 2, "Valor total");
  const pesos = pesosInformados.map(p => decimal(p, 6, "Peso"));
  if (explicita) {
    const parcelas = explicita.map(p => decimal(p, 2, "Parcela"));
    if (parcelas.length !== pesos.length || !parcelas.reduce((s, p) => s.plus(p), new Prisma.Decimal(0)).eq(total))
      throw new ValorizacaoError("VALIDACAO", "Distribuição explícita deve fechar exatamente o valor total");
    return parcelas;
  }
  const soma = pesos.reduce((s, p) => s.plus(p), new Prisma.Decimal(0));
  if (total.isZero()) return pesos.map(() => new Prisma.Decimal(0));
  if (soma.isZero()) throw new ValorizacaoError("VALIDACAO", "Pesos zerados exigem distribuição explícita");
  const centavos = total.mul(100);
  const partes = pesos.map((peso, indice) => {
    const quota = centavos.mul(peso).div(soma);
    const inteiro = quota.toDecimalPlaces(0, Prisma.Decimal.ROUND_FLOOR);
    return { indice, inteiro, resto: quota.minus(inteiro) };
  });
  const faltam = centavos.minus(partes.reduce((s, p) => s.plus(p.inteiro), new Prisma.Decimal(0))).toNumber();
  [...partes].sort((a, b) => b.resto.comparedTo(a.resto) || a.indice - b.indice).slice(0, faltam)
    .forEach(p => { p.inteiro = p.inteiro.plus(1); });
  return partes.map(p => p.inteiro.div(100));
}

export function descontarItens(itens: { valor: Prisma.Decimal.Value; elegivel: boolean }[], desconto: Prisma.Decimal.Value, explicita?: Prisma.Decimal.Value[]) {
  const valores = itens.map(i => decimal(i.valor, 2, "Valor do item"));
  const total = decimal(desconto, 2, "Desconto");
  const indices = itens.flatMap((i, n) => i.elegivel ? [n] : []);
  const descontos = explicita
    ? repartirValor(total, valores, explicita)
    : valores.map(() => new Prisma.Decimal(0));
  if (explicita) {
    if (itens.some((item, i) => !item.elegivel && !descontos[i].isZero()))
      throw new ValorizacaoError("VALIDACAO", "Item não elegível não pode receber desconto");
  } else {
    const distribuicao = repartirValor(total, indices.map(i => valores[i]));
    indices.forEach((i, n) => { descontos[i] = distribuicao[n]; });
  }
  if (valores.some((valor, i) => descontos[i].gt(valor))) throw new ValorizacaoError("VALIDACAO", "Desconto não pode deixar item negativo");
  return valores.map((valor, i) => ({ valorBruto: valor, desconto: descontos[i], valorLiquido: valor.minus(descontos[i]) }));
}
