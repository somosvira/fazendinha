/* Relatório financeiro gerencial — I/O Prisma.
 *
 * Carrega SÓ o recorte do período (nunca a base inteira): lançamentos cujo
 * caixa (dataLiquidacao) ou vencimento cai no intervalo, mais os saldos
 * acumulados de cada conta ATÉ a véspera do início (groupBy no banco).
 * Toda a aritmética fica em `relatorio-gerencial.calc.ts`.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import {
  agregarOperacoesPorTipo,
  agregarPrevisto,
  agregarRastreabilidade,
  agregarRealizado,
  agregarSaldoContas,
  type LinhaLancamento,
  type OperacaoPorTipo,
  type PrevistoAgregado,
  type Rastreabilidade,
  type RealizadoAgregado,
  type SaldoContasAgregado,
} from "./relatorio-gerencial.calc.js";
import type { RegimeRelatorio, RelatorioGerencialQuery } from "./relatorio-gerencial.schemas.js";

export interface RelatorioGerencialDTO {
  meta: {
    geradoEm: string;
    propriedade: { id: number; nome: string } | null;
    periodo: { inicio: string; fim: string };
    regime: RegimeRelatorio;
    hoje: string;
  };
  resumo: {
    entradas: number | null;
    saidas: number | null;
    resultado: number | null;
    saldoContasFinal: number | null;
    nLancamentos: number | null;
    aPagar: number | null;
    aReceber: number | null;
  };
  saldoContas: SaldoContasAgregado | null;
  entradasSaidas: { meses: RealizadoAgregado["meses"]; total: RealizadoAgregado["totais"] } | null;
  resultado: RealizadoAgregado["resultado"] | null;
  compromissos: PrevistoAgregado | null;
  categorias: RealizadoAgregado["categorias"] | null;
  operacoes: OperacaoPorTipo[];
  rastreabilidade: Rastreabilidade;
}

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const dataUtc = (s: string) => new Date(`${s}T00:00:00Z`);
const toNum = (d: Prisma.Decimal | number) => (typeof d === "number" ? d : d.toNumber());

export async function gerarRelatorioGerencial(query: RelatorioGerencialQuery, propriedadeId: number | null): Promise<RelatorioGerencialDTO> {
  const { inicio, fim, regime } = query;
  const escopo = propriedadeId != null ? { propriedadeId } : {};
  const de = dataUtc(inicio);
  const ate = dataUtc(fim);
  const querRealizado = regime !== "previsto";
  const querPrevisto = regime !== "realizado";

  const [rows, contas, anteriores, fechamentos, propriedade] = await Promise.all([
    prisma.lancamento.findMany({
      where: {
        ...escopo,
        OR: [
          ...(querRealizado ? [{ dataLiquidacao: { gte: de, lte: ate } }] : []),
          ...(querPrevisto ? [{ situacao: "ABERTO" as const, dataVencimento: { gte: de, lte: ate } }] : []),
        ],
      },
      select: {
        id: true,
        natureza: true,
        valor: true,
        situacao: true,
        estornado: true,
        dataLiquidacao: true,
        dataVencimento: true,
        descricao: true,
        numeroDocumento: true,
        contaBancariaId: true,
        categoria: { select: { nome: true, classificacao: true, grupoCategoria: { select: { nome: true } } } },
        centroCusto: { select: { nome: true, ehInvestimento: true } },
        clienteFornecedor: { select: { nome: true } },
        _count: { select: { notasFiscais: true } },
      },
      orderBy: { id: "asc" },
    }),
    querRealizado
      ? prisma.contaBancaria.findMany({ select: { id: true, nome: true, banco: true, saldoInicial: true }, orderBy: { id: "asc" } })
      : Promise.resolve([]),
    querRealizado
      ? prisma.lancamento.groupBy({
          by: ["contaBancariaId", "natureza"],
          where: { ...escopo, situacao: "LIQUIDADO", estornado: false, dataLiquidacao: { lt: de } },
          _sum: { valor: true },
        })
      : Promise.resolve([]),
    prisma.fechamentoMensal.findMany({ select: { ano: true, mes: true } }),
    propriedadeId != null
      ? prisma.propriedade.findUnique({ where: { id: propriedadeId }, select: { id: true, nome: true } })
      : Promise.resolve(null),
  ]);

  const linhas: LinhaLancamento[] = rows.map((r) => ({
    id: r.id,
    natureza: r.natureza,
    valor: toNum(r.valor),
    situacao: r.situacao,
    estornado: r.estornado,
    dataLiquidacao: iso(r.dataLiquidacao),
    dataVencimento: iso(r.dataVencimento)!,
    descricao: r.descricao,
    numeroDocumento: r.numeroDocumento,
    categoria: { nome: r.categoria.nome, classificacao: r.categoria.classificacao, grupo: r.categoria.grupoCategoria.nome },
    centroCusto: { nome: r.centroCusto.nome, ehInvestimento: r.centroCusto.ehInvestimento },
    contaBancariaId: r.contaBancariaId,
    fornecedor: r.clienteFornecedor?.nome ?? null,
    temNotaFiscal: r._count.notasFiscais > 0,
  }));

  const hoje = new Date().toISOString().slice(0, 10);
  const realizado = querRealizado ? agregarRealizado(linhas, inicio, fim) : null;
  const saldoContas = querRealizado
    ? agregarSaldoContas(
        contas.map((c) => ({ id: c.id, nome: c.nome, banco: c.banco, saldoInicial: toNum(c.saldoInicial) })),
        anteriores.map((a) => ({ contaBancariaId: a.contaBancariaId, natureza: a.natureza, total: toNum(a._sum.valor ?? 0) })),
        linhas,
        inicio,
        fim,
      )
    : null;
  const previsto = querPrevisto ? agregarPrevisto(linhas, hoje) : null;

  return {
    meta: {
      geradoEm: new Date().toISOString(),
      propriedade: propriedade ? { id: propriedade.id, nome: propriedade.nome } : null,
      periodo: { inicio, fim },
      regime,
      hoje,
    },
    resumo: {
      entradas: realizado?.totais.entradas ?? null,
      saidas: realizado?.totais.saidas ?? null,
      resultado: realizado?.totais.resultado ?? null,
      saldoContasFinal: saldoContas?.total.saldoFinal ?? null,
      nLancamentos: realizado?.nLancamentos ?? null,
      aPagar: previsto?.aPagar.total ?? null,
      aReceber: previsto?.aReceber.total ?? null,
    },
    saldoContas,
    entradasSaidas: realizado ? { meses: realizado.meses, total: realizado.totais } : null,
    resultado: realizado?.resultado ?? null,
    compromissos: previsto,
    categorias: realizado?.categorias ?? null,
    operacoes: agregarOperacoesPorTipo(linhas),
    rastreabilidade: agregarRastreabilidade(linhas, fechamentos, inicio, fim),
  };
}
