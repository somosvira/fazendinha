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
  return { saldo: Math.round(saldo * 100) / 100, valor: Math.round(valor * 100) / 100 };
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
export const ORIGENS_CUSTO_MEDIO = ["COMPRA", "BONIFICACAO", "PRODUCAO", "INVENTARIO_INICIAL"] as const;

export interface MovCustoIn {
  tipo: "ENTRADA" | "SAIDA" | "AJUSTE";
  origem: string;
  status: "CONFIRMADO" | "REVERTIDO";
  reversaoDeId: number | null;
  quantidade: Prisma.Decimal | number | string;
  valorTotal: Prisma.Decimal | number | string;
}

export interface CustoMedio {
  custoMedio: Prisma.Decimal | null;
  quantidade: Prisma.Decimal;
  valor: Prisma.Decimal;
}

export function entraNoCustoMedio(m: MovCustoIn): boolean {
  if (m.status !== "CONFIRMADO" || m.reversaoDeId != null) return false;
  if (m.tipo === "ENTRADA") return (ORIGENS_CUSTO_MEDIO as readonly string[]).includes(m.origem);
  if (m.tipo === "AJUSTE") return new Prisma.Decimal(m.quantidade).greaterThan(0) && new Prisma.Decimal(m.valorTotal).greaterThan(0);
  return false;
}

export function custoMedioProduto(movimentos: MovCustoIn[]): CustoMedio {
  let quantidade = new Prisma.Decimal(0);
  let valor = new Prisma.Decimal(0);
  for (const m of movimentos) {
    if (!entraNoCustoMedio(m)) continue;
    quantidade = quantidade.plus(m.quantidade);
    valor = valor.plus(m.valorTotal);
  }
  // Custo unitário na mesma precisão da coluna MovimentoEstoque.custoUnitario (14,4).
  const custoMedio = quantidade.greaterThan(0) ? valor.div(quantidade).toDecimalPlaces(4) : null;
  return { custoMedio, quantidade, valor };
}

/** Valor de uma saída pelo custo médio: quantidade × custo, 2 casas; sem custo → 0. */
export function valorSaida(quantidade: Prisma.Decimal | number, custoMedio: Prisma.Decimal | null): { custoUnitario: Prisma.Decimal; valorTotal: Prisma.Decimal } {
  const custoUnitario = custoMedio ?? new Prisma.Decimal(0);
  return { custoUnitario, valorTotal: new Prisma.Decimal(quantidade).mul(custoUnitario).toDecimalPlaces(2) };
}
