import { Prisma } from "@prisma/client";

// Motor puro de estoque (sem I/O; só Prisma.Decimal), testado por TDD.
// Saldo é computado (Σ entradas − Σ saídas). custo vaca/dia = consumo ÷ (vacas × dias).

export interface MovIn {
  tipo: "ENTRADA" | "SAIDA" | "AJUSTE";
  quantidade: number;
  valorTotal: number;
  data: string;
}

// SAIDA subtrai; ENTRADA e AJUSTE somam (AJUSTE pode ter quantidade/valor negativos).
const sinal = (t: MovIn["tipo"]) => (t === "SAIDA" ? -1 : 1);

export function saldoProduto(movs: MovIn[]): { saldo: number; valor: number } {
  let saldo = 0;
  let valor = 0;
  for (const m of movs) {
    saldo += sinal(m.tipo) * m.quantidade;
    valor += sinal(m.tipo) * m.valorTotal;
  }
  // saldo é quantidade (MovimentoEstoque.quantidade Decimal(12,3)) — 3 casas; valor é dinheiro — 2 casas.
  return { saldo: Math.round(saldo * 1000) / 1000, valor: Math.round(valor * 100) / 100 };
}

export function custoVacaDia(
  saidas: { valorTotal: number; data: string }[],
  vacasEmLactacao: number,
  hoje: string,
  periodoDias: number,
): number | null {
  if (vacasEmLactacao <= 0) return null;
  const limite = new Date(hoje);
  limite.setDate(limite.getDate() - periodoDias);
  const fim = new Date(hoje);
  const total = saidas
    .filter((s) => new Date(s.data) >= limite && new Date(s.data) <= fim)
    .reduce((a, s) => a + s.valorTotal, 0);
  return Math.round((total / (vacasEmLactacao * periodoDias)) * 100) / 100;
}

// ── Custo médio ponderado ────────────────────────────────────────────────────
// O preço sai do cadastro: o custo de um produto num sítio é a média ponderada
// das entradas valorizadas (compra, bonificação, produção, inventário inicial e
// ajuste positivo com valor). Estornos (original REVERTIDO + inverso com
// reversaoDeId) e saídas não entram na base.
//
// Precisão: a base é guardada como (Σ quantidade, Σ valor) e o valor de uma
// saída é calculado direto dela (valorSaidaPreciso), com uma única divisão e um
// único arredondamento no final. O custoMedio arredondado a 4 casas serve só
// para exibição — multiplicá-lo pela quantidade erra muito em produtos vendidos
// em g/mL (0,00045/g vira 0,0005/g: +11% no valor da baixa).
export const ORIGENS_CUSTO_MEDIO = ["COMPRA", "BONIFICACAO", "PRODUCAO", "INVENTARIO_INICIAL"] as const;

export interface MovCustoIn {
  tipo: "ENTRADA" | "SAIDA" | "AJUSTE";
  origem: string;
  status: "CONFIRMADO" | "REVERTIDO";
  reversaoDeId: number | null;
  quantidade: Prisma.Decimal | number | string;
  valorTotal: Prisma.Decimal | number | string;
}

/** Base do custo médio: somas das entradas valorizadas do produto no sítio. */
export interface BaseCusto {
  quantidade: Prisma.Decimal;
  valor: Prisma.Decimal;
}

export interface CustoMedio extends BaseCusto {
  /** Só para exibição (4 casas). Saídas usam valorSaidaPreciso sobre a base. */
  custoMedio: Prisma.Decimal | null;
}

/**
 * Decide se um movimento compõe a base do custo médio.
 *
 * ENTRADA e AJUSTE seguem a mesma regra: quantidade > 0 E valorTotal > 0.
 * Uma entrada sem valor (ex.: inventário inicial lançado sem custo) diluiria a
 * média silenciosamente — o saldo físico cresce, mas o preço de toda saída
 * futura cai. Como o objetivo é não diluir por lançamento incompleto, todas as
 * origens de ENTRADA são tratadas como o AJUSTE. Isso inclui a bonificação com
 * valor 0: em tese é custo real zero (deveria zerar a média junto com a
 * quantidade recebida), mas se esse for um caso real de negócio ele precisa de
 * modelagem própria (ex.: valorizar a bonificação pelo custo médio ou lançar a
 * contrapartida como doação), não de uma ENTRADA sem valor — fora de escopo aqui.
 */
export function entraNoCustoMedio(m: MovCustoIn): boolean {
  if (m.status !== "CONFIRMADO" || m.reversaoDeId != null) return false;
  const valorizada = () => new Prisma.Decimal(m.quantidade).greaterThan(0) && new Prisma.Decimal(m.valorTotal).greaterThan(0);
  if (m.tipo === "ENTRADA") return (ORIGENS_CUSTO_MEDIO as readonly string[]).includes(m.origem) && valorizada();
  if (m.tipo === "AJUSTE") return valorizada();
  return false;
}

/** custoMedio (exibição) a partir da base; null quando não há quantidade. */
export function custoMedioDaBase(base: BaseCusto): Prisma.Decimal | null {
  // Mesma precisão da coluna MovimentoEstoque.custoUnitario (14,4).
  return base.quantidade.greaterThan(0) ? base.valor.div(base.quantidade).toDecimalPlaces(4) : null;
}

export function custoMedioProduto(movimentos: MovCustoIn[]): CustoMedio {
  let quantidade = new Prisma.Decimal(0);
  let valor = new Prisma.Decimal(0);
  for (const m of movimentos) {
    if (!entraNoCustoMedio(m)) continue;
    quantidade = quantidade.plus(m.quantidade);
    valor = valor.plus(m.valorTotal);
  }
  return { custoMedio: custoMedioDaBase({ quantidade, valor }), quantidade, valor };
}

export interface ValorSaidaIn {
  quantidadeSaida: Prisma.Decimal | number | string;
  /** Σ quantidade da base; 0 (ou base ausente) → saída sem custo. */
  quantidadeBase: Prisma.Decimal | number | string;
  valorBase: Prisma.Decimal | number | string;
}

/**
 * Valor de uma saída pelo custo médio, sem arredondamento intermediário:
 * valorTotal = quantidadeSaida × valorBase ÷ quantidadeBase, 2 casas só no fim.
 * custoUnitario = valorTotal ÷ quantidadeSaida (4 casas) — apenas para gravar/
 * exibir no movimento; não deve alimentar nenhum outro cálculo.
 * Sem base (quantidadeBase ≤ 0) → 0/0: a baixa física vale, o custo é desconhecido.
 */
export function valorSaidaPreciso({ quantidadeSaida, quantidadeBase, valorBase }: ValorSaidaIn): { custoUnitario: Prisma.Decimal; valorTotal: Prisma.Decimal } {
  const qtdSaida = new Prisma.Decimal(quantidadeSaida);
  const qtdBase = new Prisma.Decimal(quantidadeBase);
  if (!qtdBase.greaterThan(0)) return { custoUnitario: new Prisma.Decimal(0), valorTotal: new Prisma.Decimal(0) };
  const valorTotal = qtdSaida.mul(valorBase).div(qtdBase).toDecimalPlaces(2);
  const custoUnitario = qtdSaida.isZero() ? new Prisma.Decimal(0) : valorTotal.div(qtdSaida).toDecimalPlaces(4);
  return { custoUnitario, valorTotal };
}

/** Atalho: valor da saída a partir de uma base opcional (null → 0/0). */
export function valorSaidaDaBase(quantidadeSaida: Prisma.Decimal | number | string, base: BaseCusto | null | undefined) {
  return valorSaidaPreciso({ quantidadeSaida, quantidadeBase: base?.quantidade ?? 0, valorBase: base?.valor ?? 0 });
}

export interface SaldoSitio {
  /** Saldo físico do produto no sítio (Σ entradas − Σ saídas). */
  saldo: number;
  /** Base do custo médio do sítio; null = sem entrada valorizada. */
  base: BaseCusto | null;
}

/**
 * Saldo, valor e custo médio de um produto somando sítios. Cada sítio tem o seu
 * custo médio, então o valor total é a soma dos valores de cada sítio (saldo do
 * sítio × base do sítio) — aplicar um custo médio combinado ao saldo total não
 * bateria com a soma das telas de cada sítio. Com um sítio só, é o cálculo de
 * sempre.
 *
 * custoMedio (exibição, 4 casas): com um sítio, o da base; com vários e saldo
 * positivo, valor ÷ saldo (custo médio do que está em estoque, coerente com a
 * coluna Valor); sem saldo positivo, a média das bases somadas. null quando
 * nenhum sítio tem base.
 */
export function consolidarSaldo(sitios: SaldoSitio[]): { saldo: number; valor: number; custoMedio: Prisma.Decimal | null } {
  let saldo = 0;
  let valor = new Prisma.Decimal(0);
  let baseQtd = new Prisma.Decimal(0);
  let baseValor = new Prisma.Decimal(0);
  for (const s of sitios) {
    saldo += s.saldo;
    if (s.base == null) continue;
    valor = valor.plus(valorSaidaDaBase(new Prisma.Decimal(s.saldo), s.base).valorTotal);
    baseQtd = baseQtd.plus(s.base.quantidade);
    baseValor = baseValor.plus(s.base.valor);
  }
  saldo = Math.round(saldo * 1000) / 1000;
  const combinada = custoMedioDaBase({ quantidade: baseQtd, valor: baseValor });
  const comBase = sitios.filter((s) => s.base != null);
  const custoMedio = combinada == null ? null
    : comBase.length === 1 ? custoMedioDaBase(comBase[0].base!)
      : saldo > 0 ? valor.div(saldo).toDecimalPlaces(4)
        : combinada;
  return { saldo, valor: valor.toNumber(), custoMedio };
}

export interface FaltaSaldo {
  produtoId: number;
  saldo: Prisma.Decimal;
  retirada: Prisma.Decimal;
}

/**
 * Quais produtos ficariam negativos: soma a retirada por produto (a mesma
 * operação pode ter dois itens do mesmo produto) e compara com o saldo do
 * sítio. Saldo ausente conta como 0.
 */
export function faltasDeSaldo(retiradas: { produtoId: number; quantidade: Prisma.Decimal.Value }[], saldos: Map<number, Prisma.Decimal>): FaltaSaldo[] {
  const total = new Map<number, Prisma.Decimal>();
  for (const r of retiradas) total.set(r.produtoId, (total.get(r.produtoId) ?? new Prisma.Decimal(0)).plus(r.quantidade));
  const faltas: FaltaSaldo[] = [];
  for (const [produtoId, retirada] of total) {
    const saldo = saldos.get(produtoId) ?? new Prisma.Decimal(0);
    if (retirada.greaterThan(saldo)) faltas.push({ produtoId, saldo, retirada });
  }
  return faltas;
}

/** "1.234,5" — quantidade com até 3 casas, no formato das mensagens ao usuário. */
export const fmtQuantidade = (q: Prisma.Decimal.Value) => new Prisma.Decimal(q).toNumber().toLocaleString("pt-BR", { maximumFractionDigits: 3 });

/**
 * Saldo de cada produto depois de estornar estes movimentos: o estorno de uma
 * ENTRADA retira, o de uma SAIDA devolve e o de um AJUSTE aplica o sinal
 * contrário. Usado para avisar, antes de cancelar uma entrada já consumida,
 * que o estoque vai ficar negativo (o cancelamento não é bloqueado: a correção
 * de uma operação exige cancelar a original antes).
 */
export function saldosAposEstorno(movimentos: { produtoId: number; tipo: "ENTRADA" | "SAIDA" | "AJUSTE"; quantidade: Prisma.Decimal.Value }[], saldos: Map<number, Prisma.Decimal>): Map<number, Prisma.Decimal> {
  const apos = new Map<number, Prisma.Decimal>();
  for (const m of movimentos) {
    const atual = apos.get(m.produtoId) ?? saldos.get(m.produtoId) ?? new Prisma.Decimal(0);
    const q = new Prisma.Decimal(m.quantidade);
    apos.set(m.produtoId, m.tipo === "SAIDA" ? atual.plus(q) : atual.minus(q));
  }
  return apos;
}
