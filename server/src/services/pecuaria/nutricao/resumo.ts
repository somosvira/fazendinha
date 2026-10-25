import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { hojeFazendaDate, RebanhoError } from "../rebanho/regras.js";

type Agregado = { loteId: string; fechamentos: bigint; animalDias: bigint; custoConhecido: Prisma.Decimal | null; coberturaCustoCompleta: boolean };

/** O arredondamento por fechamento é o mesmo do DTO detalhado; null não vira zero. */
export function apresentarResumoCusto(r: Agregado | undefined, verValores: boolean) {
  const fechamentos = Number(r?.fechamentos ?? 0);
  const animalDias = Number(r?.animalDias ?? 0);
  const custo = verValores ? r?.custoConhecido ?? (fechamentos ? null : new Prisma.Decimal(0)) : null;
  return { fechamentos, animalDias, custoConhecido: custo?.toFixed(2) ?? null,
    custoPorAnimalDia: custo == null || !animalDias ? null : custo.div(animalDias).toFixed(2),
    coberturaCustoCompleta: r?.coberturaCustoCompleta ?? true };
}

/** Resposta cresce com os lotes, não com itens/participações de todo o histórico. */
export async function consultarResumo(loteId: string | undefined, propriedadeId: number | null, verValores: boolean, verReferenciasComerciais = false) {
  const hoje = hojeFazendaDate();
  return prisma.$transaction(async tx => {
    const lotes = await tx.lote.findMany({ where: { ...(loteId ? { id: loteId } : { ativo: true }), ...(propriedadeId == null ? {} : { propriedadeId }) }, select: { id: true } });
    if (loteId && !lotes.length) throw new RebanhoError("NAO_ENCONTRADO", "Lote não encontrado neste sítio");
    if (!lotes.length) return { lotes: [], verValores };
    const ids = lotes.map(l => l.id);
    const include = { dieta: { select: { id: true, nome: true, versao: true } } } satisfies Prisma.VigenciaDietaLoteInclude;
    const [atuais, futuras, custos] = await Promise.all([
      tx.vigenciaDietaLote.findMany({ where: { loteId: { in: ids }, desde: { lte: hoje }, OR: [{ ate: null }, { ate: { gt: hoje } }] }, include, distinct: ["loteId"], orderBy: [{ desde: "desc" }, { id: "asc" }] }),
      tx.vigenciaDietaLote.findMany({ where: { loteId: { in: ids }, desde: { gt: hoje } }, include, distinct: ["loteId"], orderBy: [{ desde: "asc" }, { id: "asc" }] }),
      tx.$queryRaw<Agregado[]>(Prisma.sql`
        WITH contexto AS (
          SELECT f.id AS "fechamentoId", f."loteId", f."animalDias", i.id AS "itemId",
            i."quantidadeConfirmada", i."situacaoCusto", m."valorTotal", fl.id AS "fornecimentoId"
          FROM pecuaria."FechamentoConsumo" f
          LEFT JOIN pecuaria."ItemFechamentoConsumo" i ON i."fechamentoId" = f.id
          LEFT JOIN public."MovimentoEstoque" m ON m.id = i."movimentoEstoqueId"
          LEFT JOIN pecuaria."FornecimentoNutricionalLeite" fl ON fl."itemId" = i.id AND fl."propriedadeId" = f."propriedadeId"
          WHERE f.status = 'CONFIRMADO' AND f."loteId" IN (${Prisma.join(ids)})
            ${propriedadeId == null ? Prisma.empty : Prisma.sql`AND f."propriedadeId" = ${propriedadeId}`}
        ), leite_por_fornecimento AS (
          -- Agrega somente os fornecimentos do contexto, sem varrer seu histórico por item.
          -- Mesmo valor vigente de valoresMovimentosLeiteTx: última apropriação por
          -- alocação, ou valor original. Uma parcela pendente mantém o leite pendente.
          SELECT mf."fornecimentoId", CASE WHEN BOOL_AND(mov.custo IS NOT NULL)
            THEN ROUND(SUM(mov.custo), 2) END AS custo
          FROM contexto c
          JOIN pecuaria."MovimentoFornecimentoNutricionalLeite" mf ON mf."fornecimentoId" = c."fornecimentoId"
          LEFT JOIN LATERAL (
            SELECT CASE WHEN COUNT(a.id) > 0 AND BOOL_AND(COALESCE(ap.valor, a."valorTotal") IS NOT NULL)
              THEN SUM(COALESCE(ap.valor, a."valorTotal")) END AS custo
            FROM public."MovimentoEstoque" ml
            JOIN pecuaria."AlocacaoLeiteEstoque" a ON a."movimentoId" = ml.id
            LEFT JOIN LATERAL (
              SELECT av."valorTotal" AS valor FROM pecuaria."ApropriacaoValorLeite" av
              JOIN pecuaria."ApuracaoValorLeite" al ON al.id = av."apuracaoId" AND al."entradaId" = a."entradaId"
              WHERE av."alocacaoId" = a.id ORDER BY al.versao DESC LIMIT 1
            ) ap ON true
            WHERE ml.id = mf."movimentoId" AND ml."metodoValorizacao" = 'LEITE_FIFO_V1'
          ) mov ON true
          GROUP BY mf."fornecimentoId"
        ), itens_contexto AS (
          SELECT c."fechamentoId", c."loteId", c."animalDias", c."itemId",
            CASE WHEN c."quantidadeConfirmada" = 0 THEN 0
              WHEN c."fornecimentoId" IS NOT NULL THEN leite.custo
              WHEN c."situacaoCusto" = 'CONHECIDO' THEN c."valorTotal" END AS valor
          FROM contexto c LEFT JOIN leite_por_fornecimento leite ON leite."fornecimentoId" = c."fornecimentoId"
        ), por_fechamento AS (
          SELECT "fechamentoId", "loteId", "animalDias", ROUND(SUM(valor), 2) AS custo,
            BOOL_AND("itemId" IS NULL OR valor IS NOT NULL) AS completa
          FROM itens_contexto GROUP BY "fechamentoId", "loteId", "animalDias"
        )
        SELECT "loteId", COUNT(*) AS fechamentos, SUM("animalDias")::bigint AS "animalDias",
          SUM(custo) AS "custoConhecido", BOOL_AND(completa) AS "coberturaCustoCompleta"
        FROM por_fechamento GROUP BY "loteId"`),
    ]);
    // Referência comercial tem gate próprio e nunca participa do custo produtivo.
    const referencias = verReferenciasComerciais ? await tx.$queryRaw<AgregadoReferenciaLeite[]>(Prisma.sql`
      SELECT f."loteId", SUM(fl."quantidadeLitros") AS litros,
        SUM(r."valorTotal") AS valor, COUNT(*) AS fornecimentos,
        COUNT(r.id) AS conhecidos, COUNT(*) FILTER (WHERE r.provisoria) AS provisorios
      FROM pecuaria."FechamentoConsumo" f
      JOIN pecuaria."ItemFechamentoConsumo" i ON i."fechamentoId" = f.id
      JOIN pecuaria."FornecimentoNutricionalLeite" fl ON fl."itemId" = i.id AND fl."propriedadeId" = f."propriedadeId"
      LEFT JOIN LATERAL (
        SELECT id, "valorTotal", provisoria FROM pecuaria."ReferenciaGerencialLeite"
        WHERE "fornecimentoId" = fl.id ORDER BY versao DESC LIMIT 1
      ) r ON true
      WHERE f.status = 'CONFIRMADO' AND fl.status = 'CONFIRMADO' AND f."loteId" IN (${Prisma.join(ids)})
        ${propriedadeId == null ? Prisma.empty : Prisma.sql`AND f."propriedadeId" = ${propriedadeId}`}
      GROUP BY f."loteId"`) : [];
    const referenciasPorLote = new Map(referencias.map(r => [r.loteId, r]));
    const vigentes = new Map(atuais.map(v => [v.loteId, v]));
    const programadas = new Map(futuras.map(v => [v.loteId, v]));
    const porLote = new Map(custos.map(c => [c.loteId, c]));
    return { verValores, lotes: ids.map(id => ({ loteId: id, vigente: vigentes.get(id) ?? null, programada: programadas.get(id) ?? null, custos: apresentarResumoCusto(porLote.get(id), verValores), referenciaLeite: apresentarResumoReferenciaLeite(referenciasPorLote.get(id), verReferenciasComerciais) })) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

type AgregadoReferenciaLeite = { loteId: string; litros: Prisma.Decimal; valor: Prisma.Decimal | null; fornecimentos: bigint; conhecidos: bigint; provisorios: bigint };

export function apresentarResumoReferenciaLeite(r: AgregadoReferenciaLeite | undefined, permitido: boolean) {
  if (!permitido || !r) return null;
  return { quantidadeLitros: r.litros.toFixed(3), valorConhecido: r.valor?.toFixed(2) ?? null,
    coberturaCompleta: r.conhecidos === r.fornecimentos, provisorios: Number(r.provisorios), pendentes: Number(r.fornecimentos - r.conhecidos) };
}
