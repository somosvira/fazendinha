/* Listagem geral paginada de Lancamento (leitura) para a TABELA da aba Gastos.
 *
 * Diferente do drill do dashboard (buildLancamentos), que só olha LIQUIDADO de
 * UMA categoria, aqui a listagem é genérica: qualquer natureza/situação, com
 * filtros opcionais e paginação.
 *
 * Regime de caixa (CLAUDE.md): a "data de caixa" de um lançamento é
 *   dataLiquidacao ?? dataCompetencia
 * — LIQUIDADO usa a data em que o dinheiro entrou/saiu; ABERTO (a vencer, ainda
 * sem liquidação) cai na competência. O dashboard só filtra por dataLiquidacao
 * porque só lida com LIQUIDADO; como aqui a lista inclui ABERTO, coalescemos.
 *
 * Sempre exclui estornado (estornado=false) — coerente com dashboard.ts e
 * vencimentos.ts, que tratam estornado como "não conta".
 *
 * `montarWhereLancamentos` é núcleo PURO (sem Prisma runtime) → unit-testável.
 * Decimal→number só na borda do DTO.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";

export type NaturezaLancamento = "DEBITO" | "CREDITO";
export type SituacaoLancamento = "ABERTO" | "LIQUIDADO" | "LIQUIDADO_PARCIAL";

export type OrdemLancamentos = "data" | "dataVencimento" | "valor" | "categoria" | "fornecedor";
export type DirecaoOrdem = "asc" | "desc";

export interface FiltrosLancamentos {
  /** Início do range de data de caixa (dataLiquidacao ?? dataCompetencia), UTC. */
  from?: Date;
  /** Fim do range de data de caixa (inclusive — datas são @db.Date à meia-noite UTC). */
  to?: Date;
  natureza?: NaturezaLancamento;
  situacao?: SituacaoLancamento;
  categoriaId?: number;
  /** Escopo do sítio (multi-propriedade). null/ausente = consolidado (sem filtro). */
  propriedadeId?: number | null;
  /** Texto livre: casa em descricao OU nome do fornecedor (case-insensitive). */
  q?: string;
  /** Filtro por data de vencimento — permite separar "vencidas" (< hoje) de "a vencer" (>= hoje). */
  vencimentoDe?: Date;
  /** Filtro por data de vencimento (limite superior inclusivo). */
  vencimentoAte?: Date;
  /** Coluna de ordenação. Ausente = default (data de caixa desc). */
  orderBy?: OrdemLancamentos;
  /** Direção da ordenação (default: asc para data/nome, desc para valor). */
  orderDir?: DirecaoOrdem;
  /** default 50, máx 200. */
  limit?: number;
  offset?: number;
}

export interface LancamentoLinhaDTO {
  id: number;
  /** ISO (YYYY-MM-DD) da data de caixa = dataLiquidacao ?? dataCompetencia. */
  data: string;
  dataVencimento: string; // ISO
  natureza: NaturezaLancamento;
  valor: number; // sempre positivo — sinal vem da natureza
  situacao: SituacaoLancamento;
  categoriaNome: string;
  grupoNome?: string;
  fornecedorNome: string | null;
  descricao: string | null;
  temNota: boolean;
}

export interface ListaLancamentos {
  itens: LancamentoLinhaDTO[];
  total: number;
  temMais: boolean;
}

const LIMIT_DEFAULT = 50;
const LIMIT_MAX = 200;

const iso = (d: Date): string => d.toISOString().slice(0, 10);
const toNum = (d: Prisma.Decimal | number): number =>
  typeof d === "number" ? d : d.toNumber();

/**
 * Monta o `where` do Prisma a partir dos filtros. PURO (sem I/O) — a montagem
 * dos ANDs (data de caixa e busca textual) é a parte com lógica não-trivial e
 * por isso é testada isoladamente.
 *
 * A data de caixa é um COALESCE(dataLiquidacao, dataCompetencia); no Prisma isso
 * vira um OR: ou a liquidação existe e cai no range, ou não existe e a
 * competência cai no range. Combina com a busca textual (outro OR) via AND para
 * não colidirem num único OR.
 */
export function montarWhereLancamentos(f: FiltrosLancamentos): Prisma.LancamentoWhereInput {
  const where: Prisma.LancamentoWhereInput = { estornado: false };
  if (f.natureza) where.natureza = f.natureza;
  if (f.situacao) where.situacao = f.situacao;
  if (f.categoriaId != null) where.categoriaId = f.categoriaId;
  if (f.propriedadeId != null) where.propriedadeId = f.propriedadeId;

  const and: Prisma.LancamentoWhereInput[] = [];

  // Range sobre a data de caixa (dataLiquidacao ?? dataCompetencia).
  if (f.from || f.to) {
    const range: { gte?: Date; lte?: Date } = {};
    if (f.from) range.gte = f.from;
    if (f.to) range.lte = f.to;
    and.push({
      OR: [
        { dataLiquidacao: { not: null, ...range } },
        { dataLiquidacao: null, dataCompetencia: { ...range } },
      ],
    });
  }

  // Range sobre a data de vencimento (independente da data de caixa).
  if (f.vencimentoDe || f.vencimentoAte) {
    const vRange: { gte?: Date; lte?: Date } = {};
    if (f.vencimentoDe) vRange.gte = f.vencimentoDe;
    if (f.vencimentoAte) vRange.lte = f.vencimentoAte;
    and.push({ dataVencimento: vRange });
  }

  // Busca universal: descrição, nome do fornecedor, nome da categoria e — se o
  // termo parece um valor monetário — o próprio valor (equality). Case-insensitive.
  const termo = f.q?.trim();
  if (termo) {
    const or: Prisma.LancamentoWhereInput[] = [
      { descricao: { contains: termo, mode: "insensitive" } },
      { clienteFornecedor: { nome: { contains: termo, mode: "insensitive" } } },
      { categoria: { nome: { contains: termo, mode: "insensitive" } } },
    ];
    const valorNum = parseValorTermo(termo);
    if (valorNum != null) {
      or.push({ valor: new Prisma.Decimal(valorNum) });
    }
    and.push({ OR: or });
  }

  if (and.length > 0) where.AND = and;
  return where;
}

/**
 * Interpreta um termo de busca como valor monetário. Aceita formatos BR
 * ("1.500,50", "1500,50", "R$ 1.500,00") e "1500.50". Retorna null se o termo
 * não for interpretável como número positivo — o chamador cai fora do filtro
 * por valor e mantém só a busca textual.
 *
 * Ambiguidade conhecida: "1.500" sem vírgula é lido como 1.5 (ponto = decimal),
 * não como 1500. Quem quer 1500 exato pode digitar "1500" ou "1500,00".
 */
export function parseValorTermo(termo: string): number | null {
  const t = termo.trim().replace(/^r\$\s*/i, "").replace(/\s+/g, "");
  if (!t || !/^[\d.,]+$/.test(t)) return null;
  const normalizado = t.includes(",")
    ? t.replace(/\./g, "").replace(",", ".")
    : t;
  const n = Number(normalizado);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Normaliza limit/offset (default 50, máx 200, não-negativos). */
export function normalizarPaginacao(f: Pick<FiltrosLancamentos, "limit" | "offset">): {
  limit: number;
  offset: number;
} {
  const limit = Math.min(Math.max(Math.trunc(f.limit ?? LIMIT_DEFAULT), 1), LIMIT_MAX);
  const offset = Math.max(Math.trunc(f.offset ?? 0), 0);
  return { limit, offset };
}

/**
 * Ordem padrão (sem orderBy explícito): data de caixa desc — liquidados por
 * dataLiquidacao, ABERTO por dataCompetencia. `id` desc desempata.
 * Quando orderBy é explícito, aplica a coluna pedida + `id` desc como tie-break.
 */
export function montarOrderBy(f: Pick<FiltrosLancamentos, "orderBy" | "orderDir">): Prisma.LancamentoOrderByWithRelationInput[] {
  if (!f.orderBy) {
    return [
      { dataLiquidacao: { sort: "desc", nulls: "last" } },
      { dataCompetencia: "desc" },
      { id: "desc" },
    ];
  }
  const dir: Prisma.SortOrder = f.orderDir === "desc" ? "desc" : "asc";
  const tieBreak = { id: "desc" as const };
  switch (f.orderBy) {
    case "dataVencimento": return [{ dataVencimento: dir }, tieBreak];
    case "valor":          return [{ valor: dir }, tieBreak];
    case "categoria":      return [{ categoria: { nome: dir } }, tieBreak];
    case "fornecedor":     return [{ clienteFornecedor: { nome: dir } }, tieBreak];
    case "data":           return [
      { dataLiquidacao: { sort: dir, nulls: "last" } },
      { dataCompetencia: dir },
      tieBreak,
    ];
  }
}

/**
 * Lista lançamentos com filtros, ordenação e paginação. Ordem default = data
 * de caixa desc; pode ser sobrescrita via `orderBy`/`orderDir`.
 */
export async function listarLancamentos(f: FiltrosLancamentos): Promise<ListaLancamentos> {
  const where = montarWhereLancamentos(f);
  const { limit, offset } = normalizarPaginacao(f);
  const orderBy = montarOrderBy(f);

  const [total, rows] = await Promise.all([
    prisma.lancamento.count({ where }),
    prisma.lancamento.findMany({
      where,
      select: {
        id: true,
        natureza: true,
        valor: true,
        dataCompetencia: true,
        dataVencimento: true,
        dataLiquidacao: true,
        situacao: true,
        descricao: true,
        categoria: { select: { nome: true, grupoCategoria: { select: { nome: true } } } },
        clienteFornecedor: { select: { nome: true } },
        _count: { select: { notasFiscais: true } },
      },
      orderBy,
      take: limit,
      skip: offset,
    }),
  ]);

  const itens: LancamentoLinhaDTO[] = rows.map((r) => {
    const caixa = r.dataLiquidacao ?? r.dataCompetencia;
    return {
      id: r.id,
      data: iso(caixa),
      dataVencimento: iso(r.dataVencimento),
      natureza: r.natureza,
      valor: toNum(r.valor),
      situacao: r.situacao,
      categoriaNome: r.categoria.nome,
      grupoNome: r.categoria.grupoCategoria?.nome,
      fornecedorNome: r.clienteFornecedor?.nome ?? null,
      descricao: r.descricao ?? null,
      temNota: r._count.notasFiscais > 0,
    };
  });

  return { itens, total, temMais: offset + itens.length < total };
}
