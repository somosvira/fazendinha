/* Relatório financeiro gerencial — I/O Prisma.
 *
 * Carrega SÓ o recorte do período (nunca a base inteira): lançamentos cujo
 * caixa (dataLiquidacao) ou vencimento cai no intervalo, mais os saldos
 * acumulados de cada conta ATÉ a véspera do início (groupBy no banco).
 * Toda a aritmética fica em `relatorio-gerencial.calc.ts`.
 */
import type { Prisma } from "@prisma/client";
import { ratearCompromissos, ratearTransacao, incluirClassificacao } from "./financeiro/classificacao.js";
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
import { tituloCompromisso } from "./financeiro/titulos.js";
import { filtroVazio, operacaoPassa, partePassa, type FiltroRelatorio } from "./financeiro/relatorios.calc.js";

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
const SEM_CENTRO_GERENCIAL = "(Sem centro de custo)";

/** `filtro` recorta receitas, despesas, compromissos, tipos e rastreabilidade.
 * O saldo das contas é sempre integral: saldo filtrado não corresponde a extrato.
 * A situação da operação não recorta o caixa: pagamento de operação cancelada
 * depois (e seu estorno) e pagamento avulso movimentaram a conta de verdade. */
export async function gerarRelatorioGerencial(query: RelatorioGerencialQuery, propriedadeId: number | null, filtro?: FiltroRelatorio | null): Promise<RelatorioGerencialDTO> {
  const { inicio, fim, regime } = query;
  const filtroCaixa = filtro ? { ...filtro, status: [] } : filtro;
  const escopo = propriedadeId != null ? { propriedadeId } : {};
  const de = dataUtc(inicio);
  const ate = dataUtc(fim);
  const querRealizado = regime !== "previsto";
  const querPrevisto = regime !== "realizado";

  const [movimentos, compromissos, contas, anteriores, fechamentos, propriedade, centrosCusto] = await Promise.all([
    querRealizado ? prisma.movimentoConta.findMany({
      where: { transacao: { ...escopo, data: { gte: de, lte: ate } } },
      include: {
        transacao: {
          include: {
            reversaoDe: { select: { tipo: true } },
            parceiro: true,
            documentos: true,
            operacao: { include: { parceiro: true, ...incluirClassificacao, centroCusto: true, documentos: true } },
          },
        },
      },
      orderBy: { seq: "asc" },
    }) : Promise.resolve([]),
    querPrevisto ? prisma.compromissoFinanceiro.findMany({
      where: { status: { in: ["PENDENTE", "PARCIAL"] }, dataVencimento: { gte: de, lte: ate }, operacao: escopo },
      include: {
        parceiro: true,
        liquidacoes: { include: { transacao: true } },
        documentos: true,
        operacao: { include: { parceiro: true, ...incluirClassificacao, centroCusto: true, documentos: true } },
      },
      orderBy: { seq: "asc" },
    }) : Promise.resolve([]),
    querRealizado
      ? prisma.contaFinanceira.findMany({ where: escopo, select: { id: true, nome: true, instituicao: true, saldoAbertura: true }, orderBy: [{ ordem: "asc" }, { nome: "asc" }, { id: "asc" }] })
      : Promise.resolve([]),
    querRealizado
      ? prisma.movimentoConta.groupBy({
          by: ["contaId", "direcao"],
          where: { transacao: { ...escopo, data: { lt: de } } },
          _sum: { valor: true },
        })
      : Promise.resolve([]),
    prisma.periodoFinanceiro.findMany({ where: { ...escopo, status: "FECHADO" }, select: { ano: true, mes: true } }),
    propriedadeId != null
      ? prisma.propriedade.findUnique({ where: { id: propriedadeId }, select: { id: true, nome: true } })
      : Promise.resolve(null),
    prisma.centroCusto.findMany({ select: { id: true, nome: true } }),
  ]);
  // Nome vivo por id: o snapshot de um item pode estar desatualizado se o
  // centro foi renomeado depois — agrupamento (agregarRealizado) é por id,
  // mas o rótulo exibido precisa ser o nome atual, não o congelado no item.
  const nomesCentro = new Map(centrosCusto.map((c) => [c.id, c.nome]));

  // Base do extrato (por lançamento): centro da operação. As linhas analíticas
  // abaixo substituem categoria e centro pelos da PARTE rateada (item ?? operação).
  const linhaBase = (operacao: (typeof movimentos)[number]["transacao"]["operacao"]) => {
    const id = operacao?.centroCustoId ?? operacao?.centroCusto?.id ?? null;
    return {
      categoria: { nome: operacao?.categoriaNome ?? "Sem categoria", classificacao: operacao?.classificacao ?? null },
      centroCusto: { id, nome: id ? nomesCentro.get(id) ?? operacao?.centroCusto?.nome ?? SEM_CENTRO_GERENCIAL : SEM_CENTRO_GERENCIAL },
    };
  };
  const linhaParte = (parte: { categoriaNome: string; classificacao: "CUSTEIO" | "INVESTIMENTO" | null; centroCustoId: string | null; centroCustoNome: string | null }) => {
    const id = parte.centroCustoId ?? null;
    return {
      categoria: { nome: parte.categoriaNome, classificacao: parte.classificacao },
      centroCusto: { id, nome: id ? nomesCentro.get(id) ?? parte.centroCustoNome ?? SEM_CENTRO_GERENCIAL : SEM_CENTRO_GERENCIAL },
    };
  };

  const linhasRealizadas: LinhaLancamento[] = movimentos.map((movimento) => {
    const { transacao } = movimento;
    const documentos = [...transacao.documentos, ...(transacao.operacao?.documentos ?? [])];
    return {
      id: movimento.id,
      seq: movimento.seq,
      natureza: movimento.direcao === "ENTRADA" ? "CREDITO" : "DEBITO",
      valor: toNum(movimento.valor),
      situacao: "LIQUIDADO",
      estornado: false,
      transferencia: transacao.tipo === "TRANSFERENCIA" || transacao.reversaoDe?.tipo === "TRANSFERENCIA",
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
    const liquidado = compromisso.liquidacoes.filter((l) => l.transacao.status === "CONFIRMADA").reduce((total, item) => total + toNum(item.valor), 0);
    return {
      id: compromisso.id,
      seq: compromisso.seq,
      natureza: compromisso.tipo === "RECEBER" ? "CREDITO" : "DEBITO",
      valor: Math.max(0, toNum(compromisso.valorOriginal) - liquidado),
      situacao: "ABERTO",
      estornado: false,
      dataLiquidacao: null,
      dataVencimento: iso(compromisso.dataVencimento)!,
      descricao: tituloCompromisso(compromisso),
      numeroDocumento: documentos.find((documento) => documento.numero)?.numero ?? null,
      ...linhaBase(compromisso.operacao),
      contaBancariaId: null,
      fornecedor: compromisso.parceiro?.nome ?? compromisso.operacao.parceiro?.nome ?? null,
      temNotaFiscal: documentos.some((documento) => documento.tipo === "NOTA_FISCAL"),
    };
  });
  // O extrato mantém entradas/saídas reais; a análise devolve o estorno à
  // categoria original como valor negativo, sem transformá-lo em receita.
  const linhasAnaliticas = linhasRealizadas.flatMap((linha, index) => {
    const movimento = movimentos[index];
    if (!operacaoPassa(filtroCaixa, movimento.transacao.operacao)) return [];
    const reversao = movimento.transacao.tipo === "REVERSAO";
    return ratearTransacao(movimento.transacao.operacao, movimento.transacao.id, linha.valor * (reversao ? -1 : 1)).filter((parte) => partePassa(filtroCaixa, parte)).map((parte) => ({
      ...linha, valor: parte.valor.toNumber(),
      natureza: reversao ? (linha.natureza === "CREDITO" ? "DEBITO" as const : "CREDITO" as const) : linha.natureza,
      ...linhaParte(parte),
    }));
  });
  const linhasPrevistasAnaliticas = linhasPrevistas.flatMap((linha, index) => operacaoPassa(filtroCaixa, compromissos[index].operacao)
    ? (ratearCompromissos(compromissos[index].operacao).get(compromissos[index].id) ?? []).filter((parte) => partePassa(filtroCaixa, parte)).map((parte) => ({ ...linha, valor: parte.valor.toNumber(), ...linhaParte(parte) }))
    : []);
  const linhas = [...linhasAnaliticas, ...linhasPrevistasAnaliticas];
  // A auditoria classifica a reversão como evento próprio; não usa o sinal
  // negativo criado exclusivamente para calcular despesas líquidas.
  const idsEstorno = new Set(movimentos.filter((m) => m.transacao.tipo === "REVERSAO").map((m) => m.id));
  const linhasPorTipo = [...linhasAnaliticas.map((linha) => {
    return idsEstorno.has(linha.id)
      ? { ...linha, estornado: true, valor: Math.abs(linha.valor) }
      : linha;
  }), ...linhasPrevistasAnaliticas];


  // Com filtro, a auditoria conta só os lançamentos que sobraram no recorte.
  const idsNoRecorte = new Set(linhas.map((l) => l.id));
  const noRecorte = (id: string) => filtroVazio(filtroCaixa) || idsNoRecorte.has(id);

  const hoje = new Date().toISOString().slice(0, 10);
  const realizado = querRealizado ? agregarRealizado(linhas, inicio, fim) : null;
  const saldoContas = querRealizado
    ? agregarSaldoContas(
        contas.map((c) => ({ id: c.id, nome: c.nome, banco: c.instituicao, saldoInicial: toNum(c.saldoAbertura) })),
        anteriores.map((a) => ({ contaBancariaId: a.contaId, natureza: a.direcao === "ENTRADA" ? "CREDITO" as const : "DEBITO" as const, total: toNum(a._sum.valor ?? 0) })),
        linhasRealizadas,
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
    operacoes: agregarOperacoesPorTipo(linhasPorTipo),
    rastreabilidade: agregarRastreabilidade([
      ...linhasRealizadas.map((l, i) => ({ ...l, estornado: movimentos[i].transacao.status === "REVERTIDA" || movimentos[i].transacao.tipo === "REVERSAO" })).filter((l) => noRecorte(l.id)),
      ...linhasPrevistas.filter((l) => noRecorte(l.id)),
    ], fechamentos, inicio, fim),
  };
}
