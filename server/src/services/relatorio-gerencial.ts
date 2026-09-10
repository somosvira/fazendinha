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

  const [movimentos, compromissos, contas, anteriores, fechamentos, propriedade] = await Promise.all([
    querRealizado ? prisma.movimentoConta.findMany({
      where: { transacao: { ...escopo, data: { gte: de, lte: ate } } },
      include: {
        transacao: {
          include: {
            parceiro: true,
            documentos: true,
            operacao: { include: { parceiro: true, categoria: { include: { grupoCategoria: true } }, centroCusto: true, documentos: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }) : Promise.resolve([]),
    querPrevisto ? prisma.compromissoFinanceiro.findMany({
      where: { status: { in: ["PENDENTE", "PARCIAL"] }, dataVencimento: { gte: de, lte: ate }, operacao: escopo },
      include: {
        parceiro: true,
        liquidacoes: true,
        documentos: true,
        operacao: { include: { parceiro: true, categoria: { include: { grupoCategoria: true } }, centroCusto: true, documentos: true } },
      },
      orderBy: [{ dataVencimento: "asc" }, { numeroParcela: "asc" }],
    }) : Promise.resolve([]),
    querRealizado
      ? prisma.contaFinanceira.findMany({ where: escopo, select: { id: true, nome: true, instituicao: true, saldoAbertura: true }, orderBy: { nome: "asc" } })
      : Promise.resolve([]),
    querRealizado
      ? prisma.movimentoConta.groupBy({
          by: ["contaId", "direcao"],
          where: { transacao: { ...escopo, status: "CONFIRMADA", data: { lt: de } } },
          _sum: { valor: true },
        })
      : Promise.resolve([]),
    prisma.periodoFinanceiro.findMany({ where: { ...escopo, status: "FECHADO" }, select: { ano: true, mes: true } }),
    propriedadeId != null
      ? prisma.propriedade.findUnique({ where: { id: propriedadeId }, select: { id: true, nome: true } })
      : Promise.resolve(null),
  ]);

  const linhaBase = (operacao: (typeof movimentos)[number]["transacao"]["operacao"]) => ({
    categoria: {
      nome: operacao?.categoria?.nome ?? "Sem categoria",
      classificacao: operacao?.categoria?.classificacao ?? null,
      grupo: operacao?.categoria?.grupoCategoria.nome ?? "Sem grupo",
    },
    centroCusto: {
      nome: operacao?.centroCusto?.nome ?? "(Sem centro de custo)",
      ehInvestimento: operacao?.centroCusto?.ehInvestimento ?? false,
    },
  });

  const linhasRealizadas: LinhaLancamento[] = movimentos.map((movimento) => {
    const { transacao } = movimento;
    const documentos = [...transacao.documentos, ...(transacao.operacao?.documentos ?? [])];
    return {
      id: movimento.id,
      natureza: movimento.direcao === "ENTRADA" ? "CREDITO" : "DEBITO",
      valor: toNum(movimento.valor),
      situacao: "LIQUIDADO",
      estornado: transacao.status === "REVERTIDA",
      dataLiquidacao: iso(transacao.data),
      dataVencimento: iso(transacao.data)!,
      descricao: transacao.descricao ?? transacao.operacao?.descricao ?? null,
      numeroDocumento: documentos.find((documento) => documento.numero)?.numero ?? null,
      ...linhaBase(transacao.operacao),
      contaBancariaId: movimento.contaId,
      fornecedor: transacao.parceiro?.nome ?? transacao.operacao?.parceiro?.nome ?? null,
      temNotaFiscal: documentos.some((documento) => documento.tipo === "NOTA_FISCAL"),
    };
  });
  const linhasPrevistas: LinhaLancamento[] = compromissos.map((compromisso) => {
    const documentos = [...compromisso.documentos, ...compromisso.operacao.documentos];
    const liquidado = compromisso.liquidacoes.reduce((total, item) => total + toNum(item.valor), 0);
    return {
      id: compromisso.id,
      natureza: compromisso.tipo === "RECEBER" ? "CREDITO" : "DEBITO",
      valor: Math.max(0, toNum(compromisso.valorOriginal) - liquidado),
      situacao: "ABERTO",
      estornado: false,
      dataLiquidacao: null,
      dataVencimento: iso(compromisso.dataVencimento)!,
      descricao: compromisso.operacao.descricao,
      numeroDocumento: documentos.find((documento) => documento.numero)?.numero ?? null,
      ...linhaBase(compromisso.operacao),
      contaBancariaId: null,
      fornecedor: compromisso.parceiro?.nome ?? compromisso.operacao.parceiro?.nome ?? null,
      temNotaFiscal: documentos.some((documento) => documento.tipo === "NOTA_FISCAL"),
    };
  });
  const linhas = [...linhasRealizadas, ...linhasPrevistas];

  const hoje = new Date().toISOString().slice(0, 10);
  const realizado = querRealizado ? agregarRealizado(linhas, inicio, fim) : null;
  const saldoContas = querRealizado
    ? agregarSaldoContas(
        contas.map((c) => ({ id: c.id, nome: c.nome, banco: c.instituicao, saldoInicial: toNum(c.saldoAbertura) })),
        anteriores.map((a) => ({ contaBancariaId: a.contaId, natureza: a.direcao === "ENTRADA" ? "CREDITO" as const : "DEBITO" as const, total: toNum(a._sum.valor ?? 0) })),
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
