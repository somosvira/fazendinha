import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { ratearTransacao, incluirClassificacao } from "./classificacao.js";
import { dinheiro } from "./regras.js";
import { listarCompromissos } from "./operacoes.js";
import { movimentoRealizado } from "./dashboard.calc.js";
import { resumoSaldos } from "./contas.js";

export function serieFluxo(movimentos: { direcao: string; valor: Prisma.Decimal; transacao: { data: Date; tipo?: string; status?: string; reversaoDe?: { tipo: string } | null } }[], inicio: Date, fim: Date) {
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
    const realizado = movimentoRealizado({ ...movimento, transacao: { ...movimento.transacao, tipo: movimento.transacao.tipo ?? "", status: movimento.transacao.status ?? "CONFIRMADA" } });
    if (realizado) ponto[realizado.campo] = dinheiro(ponto[realizado.campo].plus(realizado.valor));
  }
  return [...pontos.values()];
}

export async function obterDashboard(propriedadeId: number | null, inicio: Date, fim: Date) {
  const escopo = propriedadeId ? { propriedadeId } : {};
  const data = { gte: inicio, lte: fim };
  const whereOperacao = { ...escopo, data };
  const whereTransacao = { ...escopo, data };
  const [saldos, movimentos, compromissos, estadosOperacoes, volumePorTipo, comEstoque, semParceiro, semEfeitos, transacoes] = await Promise.all([
    resumoSaldos(propriedadeId),
    prisma.movimentoConta.findMany({
      where: { transacao: whereTransacao },
      include: { transacao: { include: { reversaoDe: { select: { tipo: true } }, operacao: { include: incluirClassificacao } } } },
    }),
    listarCompromissos(propriedadeId, { inicio, fim }),
    prisma.operacao.groupBy({ by: ["status"], where: whereOperacao, _count: true }),
    prisma.operacao.groupBy({ by: ["tipo"], where: { ...whereOperacao, status: "CONFIRMADA" }, _sum: { valorTotal: true }, _count: true }),
    prisma.operacao.count({ where: { ...whereOperacao, movimentosEstoque: { some: {} } } }),
    prisma.operacao.count({ where: { ...whereOperacao, parceiroId: null } }),
    prisma.operacao.count({ where: { ...whereOperacao, compromissos: { none: {} }, transacoes: { none: {} }, movimentosEstoque: { none: {} } } }),
    prisma.transacaoFinanceira.findMany({ where: whereTransacao, select: { id: true, tipo: true, status: true, operacaoId: true, reversaoDe: { select: { tipo: true } }, _count: { select: { movimentos: true, liquidacoes: true } } } }),
  ]);
  let entradas = dinheiro(0); let saidas = dinheiro(0);
  const porCategoria = new Map<string, { categoriaId: number | null; categoria: string; valor: Prisma.Decimal }>();
  for (const movimento of movimentos) {
    const realizado = movimentoRealizado(movimento);
    if (!realizado) continue;
    if (realizado.campo === "entradas") entradas = dinheiro(entradas.plus(realizado.valor));
    else {
      saidas = dinheiro(saidas.plus(realizado.valor));
      for (const parte of ratearTransacao(movimento.transacao.operacao, movimento.transacao.id, movimento.valor)) {
        // ratearTransacao já preserva a categoria original nos estornos.
        const chave = `${parte.categoriaId ?? 0}:${parte.categoriaNome}`;
        const atual = porCategoria.get(chave) ?? { categoriaId: parte.categoriaId, categoria: parte.categoriaNome, valor: dinheiro(0) };
        atual.valor = dinheiro(atual.valor.plus(parte.valor.abs().mul(realizado.valor.isNegative() ? -1 : 1)));
        porCategoria.set(chave, atual);
      }
    }
  }
  const pendentes = compromissos.filter(c => ["PENDENTE", "PARCIAL"].includes(c.status));
  const pendente = (tipo: "PAGAR" | "RECEBER") => dinheiro(pendentes.filter(c => c.tipo === tipo).reduce((total, c) => total.plus(c.saldoPendente), dinheiro(0)));
  const estados = (registros: { status: string }[]) => registros.reduce<Record<string, number>>((acc, registro) => { acc[registro.status] = (acc[registro.status] ?? 0) + 1; return acc; }, {});
  const porTipo = volumePorTipo.filter(t => t._sum.valorTotal?.gt(0)).map(t => ({ tipo: t.tipo, valor: dinheiro(t._sum.valorTotal!) })).sort((a, b) => b.valor.comparedTo(a.valor));
  const transferenciaIncompleta = (t: typeof transacoes[number]) => (t.tipo === "TRANSFERENCIA" || t.reversaoDe?.tipo === "TRANSFERENCIA") && t._count.movimentos !== 2;
  return {
    periodo: { inicio, fim }, saldoGeral: saldos.saldoGeral, contas: saldos.contas,
    realizado: { entradas, saidas, resultado: dinheiro(entradas.minus(saidas)) },
    fluxo: serieFluxo(movimentos, inicio, fim),
    compromissos: { aPagar: pendente("PAGAR"), aReceber: pendente("RECEBER") },
    proximosCompromissos: pendentes,
    despesasPorCategoria: [...porCategoria.values()].filter(c => !c.valor.isZero()).sort((a, b) => b.valor.comparedTo(a.valor)),
    base: {
      operacoes: { total: estadosOperacoes.reduce((s, o) => s + o._count, 0), estados: Object.fromEntries(estadosOperacoes.map(o => [o.status, o._count])), comEstoque, semParceiro, semEfeitos },
      compromissos: { total: compromissos.length, estados: estados(compromissos) },
      transacoes: { total: transacoes.length, estados: estados(transacoes), estornos: transacoes.filter(t => t.tipo === "REVERSAO").length, avulsas: transacoes.filter(t => t.operacaoId == null).length, comLiquidacao: transacoes.filter(t => t._count.liquidacoes > 0).length, semMovimentos: transacoes.filter(t => t._count.movimentos === 0).length, transferenciasIncompletas: transacoes.filter(transferenciaIncompleta).length },
      movimentos: { total: movimentos.length, confirmados: movimentos.filter(m => m.transacao.status === "CONFIRMADA" && m.transacao.tipo !== "REVERSAO").length, revertidos: movimentos.filter(m => m.transacao.status === "REVERTIDA").length, estornos: movimentos.filter(m => m.transacao.tipo === "REVERSAO").length },
      volumeEconomico: dinheiro(porTipo.reduce((s, t) => s.plus(t.valor), dinheiro(0))),
      porTipo,
      vinculosAusentes: transacoes.filter(t => t._count.movimentos === 0 || transferenciaIncompleta(t)).slice(0, 20).map(t => ({ transacaoId: t.id, operacaoId: t.operacaoId, motivo: t._count.movimentos === 0 ? "Sem movimento de conta" : "Transferência sem as duas pontas" })),
    },
  };
}
