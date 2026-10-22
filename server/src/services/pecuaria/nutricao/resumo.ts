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
export async function consultarResumo(loteId: string | undefined, propriedadeId: number | null, verValores: boolean) {
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
        WITH por_fechamento AS (
          SELECT f.id, f."loteId", f."animalDias",
            CASE WHEN COUNT(i.id) FILTER (WHERE i."quantidadeConfirmada" = 0 OR (i."situacaoCusto" = 'CONHECIDO' AND m."valorTotal" IS NOT NULL)) > 0
              THEN ROUND(SUM(CASE WHEN i."quantidadeConfirmada" = 0 THEN 0 WHEN i."situacaoCusto" = 'CONHECIDO' THEN m."valorTotal" END), 2) END AS custo,
            BOOL_AND(i.id IS NULL OR i."quantidadeConfirmada" = 0 OR (i."situacaoCusto" = 'CONHECIDO' AND m."valorTotal" IS NOT NULL)) AS completa
          FROM pecuaria."FechamentoConsumo" f
          LEFT JOIN pecuaria."ItemFechamentoConsumo" i ON i."fechamentoId" = f.id
          LEFT JOIN public."MovimentoEstoque" m ON m.id = i."movimentoEstoqueId"
          WHERE f.status = 'CONFIRMADO' AND f."loteId" IN (${Prisma.join(ids)})
            ${propriedadeId == null ? Prisma.empty : Prisma.sql`AND f."propriedadeId" = ${propriedadeId}`}
          GROUP BY f.id
        )
        SELECT "loteId", COUNT(*) AS fechamentos, SUM("animalDias")::bigint AS "animalDias",
          SUM(custo) AS "custoConhecido", BOOL_AND(completa) AS "coberturaCustoCompleta"
        FROM por_fechamento GROUP BY "loteId"`),
    ]);
    const vigentes = new Map(atuais.map(v => [v.loteId, v]));
    const programadas = new Map(futuras.map(v => [v.loteId, v]));
    const porLote = new Map(custos.map(c => [c.loteId, c]));
    return { verValores, lotes: ids.map(id => ({ loteId: id, vigente: vigentes.get(id) ?? null, programada: programadas.get(id) ?? null, custos: apresentarResumoCusto(porLote.get(id), verValores) })) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
