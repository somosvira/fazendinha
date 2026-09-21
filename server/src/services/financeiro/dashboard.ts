import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { ratearTransacao, incluirClassificacao } from "./classificacao.js";
import { resumoSaldos } from "./contas.js";

export function serieFluxo(movimentos: { direcao: string; valor: Prisma.Decimal; transacao: { data: Date } }[], inicio: Date, fim: Date) {
  const inicioMes = inicio.toISOString().slice(0, 7);
  const fimMes = fim.toISOString().slice(0, 7);
  const mensal = inicioMes !== fimMes;
  const pontos = new Map<string, { data: string; entradas: Prisma.Decimal; saidas: Prisma.Decimal }>();
  if (mensal) {
    let cursor = new Date(`${inicioMes}-01T00:00:00Z`);
    while (cursor.toISOString().slice(0, 7) <= fimMes) {
      const mes = cursor.toISOString().slice(0, 7);
      pontos.set(mes, { data: `${mes}-01`, entradas: new Prisma.Decimal(0), saidas: new Prisma.Decimal(0) });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  } else {
    let cursor = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate()));
    const ultimo = new Date(Date.UTC(fim.getUTCFullYear(), fim.getUTCMonth(), fim.getUTCDate()));
    while (cursor <= ultimo) {
      const dia = cursor.toISOString().slice(0, 10);
      pontos.set(dia, { data: dia, entradas: new Prisma.Decimal(0), saidas: new Prisma.Decimal(0) });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  for (const movimento of movimentos) {
    const chave = movimento.transacao.data.toISOString().slice(0, mensal ? 7 : 10);
    const ponto = pontos.get(chave);
    if (!ponto) continue;
    const campo = movimento.direcao === "ENTRADA" ? "entradas" : "saidas";
    ponto[campo] = ponto[campo].plus(movimento.valor);
  }
  return [...pontos.values()];
}

export async function obterDashboard(propriedadeId: number | null, inicio: Date, fim: Date) {
  const escopoTransacao = propriedadeId ? { propriedadeId } : {};
  const [saldos, movimentos, compromissos] = await Promise.all([
    resumoSaldos(propriedadeId),
    prisma.movimentoConta.findMany({
      where: { transacao: { ...escopoTransacao, data: { gte: inicio, lte: fim } } },
      include: { transacao: { include: { reversaoDe: { select: { tipo: true } }, operacao: { include: { ...incluirClassificacao, centroCusto: true } } } }, conta: true },
    }),
    prisma.compromissoFinanceiro.findMany({
      where: { ...(propriedadeId ? { operacao: { propriedadeId } } : {}), status: { in: ["PENDENTE", "PARCIAL"] } },
      include: { liquidacoes: { include: { transacao: true } } },
    }),
  ]);
  // Transferências apenas redistribuem disponibilidade entre contas próprias e
  // não podem inflar os indicadores de recebimentos e pagamentos realizados.
  const realizados = movimentos.filter((m) => m.transacao.tipo !== "TRANSFERENCIA" && m.transacao.reversaoDe?.tipo !== "TRANSFERENCIA");
  const entradas = realizados.filter((m) => m.direcao === "ENTRADA").reduce((s, m) => s.plus(m.valor), new Prisma.Decimal(0));
  const saidas = realizados.filter((m) => m.direcao === "SAIDA").reduce((s, m) => s.plus(m.valor), new Prisma.Decimal(0));
  const pendente = (tipo: "PAGAR" | "RECEBER") => compromissos.filter((c) => c.tipo === tipo).reduce((total, c) => {
    const pago = c.liquidacoes.filter((l) => l.transacao.status === "CONFIRMADA").reduce((s, l) => s.plus(l.valor), new Prisma.Decimal(0));
    return total.plus(c.valorOriginal.minus(pago));
  }, new Prisma.Decimal(0));
  const porCategoria = new Map<string, Prisma.Decimal>();
  for (const movimento of movimentos.filter((m) => m.transacao.tipo !== "TRANSFERENCIA" && m.transacao.reversaoDe?.tipo !== "TRANSFERENCIA" && m.transacao.operacao?.tipo !== "VENDA")) {
    const sinal = movimento.direcao === "SAIDA" ? 1 : -1;
    for (const parte of ratearTransacao(movimento.transacao.operacao, movimento.transacao.id, movimento.valor)) {
      porCategoria.set(parte.categoriaNome, (porCategoria.get(parte.categoriaNome) ?? new Prisma.Decimal(0)).plus(parte.valor.abs().mul(sinal)));
    }
  }
  return {
    periodo: { inicio, fim }, saldoGeral: saldos.saldoGeral, contas: saldos.contas,
    realizado: { entradas, saidas, resultado: entradas.minus(saidas) },
    fluxo: serieFluxo(realizados, inicio, fim),
    compromissos: { aPagar: pendente("PAGAR"), aReceber: pendente("RECEBER") },
    // `isPositive()` do decimal.js considera zero positivo — usar greaterThan(0)
    // para não listar categoria cuja despesa foi totalmente estornada.
    despesasPorCategoria: [...porCategoria.entries()].filter(([, valor]) => valor.greaterThan(0)).map(([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor.comparedTo(a.valor)),
  };
}
