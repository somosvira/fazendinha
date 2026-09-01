import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { resumoSaldos } from "./contas.js";

export async function obterDashboard(propriedadeId: number | null, inicio: Date, fim: Date) {
  const escopoTransacao = propriedadeId ? { propriedadeId } : {};
  const [saldos, movimentos, compromissos] = await Promise.all([
    resumoSaldos(propriedadeId),
    prisma.movimentoConta.findMany({
      where: { transacao: { ...escopoTransacao, data: { gte: inicio, lte: fim } } },
      include: { transacao: { include: { operacao: { include: { categoria: true, centroCusto: true } } } }, conta: true },
    }),
    prisma.compromissoFinanceiro.findMany({
      where: { ...(propriedadeId ? { operacao: { propriedadeId } } : {}), status: { in: ["PENDENTE", "PARCIAL"] } },
      include: { liquidacoes: { include: { transacao: true } } },
    }),
  ]);
  // Transferências apenas redistribuem disponibilidade entre contas próprias e
  // não podem inflar os indicadores de recebimentos e pagamentos realizados.
  const realizados = movimentos.filter((m) => m.transacao.tipo !== "TRANSFERENCIA");
  const entradas = realizados.filter((m) => m.direcao === "ENTRADA").reduce((s, m) => s.plus(m.valor), new Prisma.Decimal(0));
  const saidas = realizados.filter((m) => m.direcao === "SAIDA").reduce((s, m) => s.plus(m.valor), new Prisma.Decimal(0));
  const pendente = (tipo: "PAGAR" | "RECEBER") => compromissos.filter((c) => c.tipo === tipo).reduce((total, c) => {
    const pago = c.liquidacoes.filter((l) => l.transacao.status === "CONFIRMADA").reduce((s, l) => s.plus(l.valor), new Prisma.Decimal(0));
    return total.plus(c.valorOriginal.minus(pago));
  }, new Prisma.Decimal(0));
  const porCategoria = new Map<string, Prisma.Decimal>();
  for (const movimento of movimentos.filter((m) => m.transacao.tipo !== "TRANSFERENCIA" && m.transacao.operacao?.tipo !== "VENDA")) {
    const nome = movimento.transacao.operacao?.categoria?.nome ?? "Sem categoria";
    const valor = movimento.direcao === "SAIDA" ? movimento.valor : movimento.valor.negated();
    porCategoria.set(nome, (porCategoria.get(nome) ?? new Prisma.Decimal(0)).plus(valor));
  }
  return {
    periodo: { inicio, fim }, saldoGeral: saldos.saldoGeral, contas: saldos.contas,
    realizado: { entradas, saidas, resultado: entradas.minus(saidas) },
    compromissos: { aPagar: pendente("PAGAR"), aReceber: pendente("RECEBER") },
    despesasPorCategoria: [...porCategoria.entries()].filter(([, valor]) => valor.isPositive()).map(([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor.comparedTo(a.valor)),
  };
}
