import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { buscarLote, listarLotes } from "../rebanho/lotes.js";
import { hojeFazendaDate } from "../rebanho/regras.js";

type Agregado = { loteId: string; fechamentos: number; animalDias: number; custoConhecido: Prisma.Decimal | null; coberturaCustoCompleta: boolean };

export function apresentarResumoCusto(agregado: Agregado | undefined, verValores: boolean) {
  const custo = agregado?.custoConhecido ?? null;
  const animalDias = agregado?.animalDias ?? 0;
  return {
    fechamentos: agregado?.fechamentos ?? 0, animalDias,
    custoConhecido: verValores && custo != null ? custo.toFixed(2) : null,
    custoPorAnimalDia: verValores && custo != null && animalDias > 0 ? custo.div(animalDias).toFixed(2) : null,
    coberturaCustoCompleta: agregado?.coberturaCustoCompleta ?? false,
  };
}

/** Agrega primeiro cada fechamento para não multiplicar animal-dias pelos ingredientes.
 * Todo o histórico confirmado entra na base, independentemente da paginação da consulta.
 * Quantidade zero tem custo zero; SEM_BASE/SEM_BAIXA nunca representam gratuidade.
 */
async function custosPorLote(propriedadeId: number | null, loteId?: string) {
  return prisma.$queryRaw<Agregado[]>(Prisma.sql`
    WITH custos AS (
      SELECT f."id", f."loteId", f."animalDias",
        SUM(CASE WHEN i."quantidadeConfirmada" = 0 THEN 0
          WHEN i."situacaoCusto" = 'CONHECIDO' THEN m."valorTotal" ELSE NULL END) AS custo,
        BOOL_AND(i."id" IS NOT NULL AND (i."quantidadeConfirmada" = 0 OR
          (i."situacaoCusto" = 'CONHECIDO' AND m."valorTotal" IS NOT NULL))) AS completa
      FROM pecuaria."FechamentoConsumo" f
      LEFT JOIN pecuaria."ItemFechamentoConsumo" i ON i."fechamentoId" = f."id"
      LEFT JOIN public."MovimentoEstoque" m ON m."id" = i."movimentoEstoqueId"
      WHERE f."status" = 'CONFIRMADO'
        ${propriedadeId == null ? Prisma.empty : Prisma.sql`AND f."propriedadeId" = ${propriedadeId}`}
        ${loteId == null ? Prisma.empty : Prisma.sql`AND f."loteId" = ${loteId}`}
      GROUP BY f."id"
    )
    SELECT "loteId", COUNT(*)::int AS fechamentos, SUM("animalDias")::int AS "animalDias",
      SUM(custo) AS "custoConhecido", BOOL_AND(completa) AS "coberturaCustoCompleta"
    FROM custos GROUP BY "loteId"
  `);
}

async function vigenciasDosLotes(loteIds: string[]) {
  const hoje = hojeFazendaDate();
  const vigencias = await prisma.vigenciaDietaLote.findMany({
    where: { loteId: { in: loteIds }, OR: [{ ate: null }, { ate: { gt: hoje } }] },
    select: { id: true, loteId: true, desde: true, ate: true, dieta: { select: { id: true, nome: true, versao: true } } },
    orderBy: [{ desde: "asc" }, { id: "asc" }],
  });
  return new Map(loteIds.map((id) => [id, {
    vigente: vigencias.find((v) => v.loteId === id && v.desde <= hoje) ?? null,
    programada: vigencias.find((v) => v.loteId === id && v.desde > hoje) ?? null,
  }]));
}

export async function visaoGeral(propriedadeId: number | null, verValores: boolean) {
  const lotes = await listarLotes(propriedadeId);
  const [vigencias, custos] = await Promise.all([vigenciasDosLotes(lotes.map((l) => l.id)), custosPorLote(propriedadeId)]);
  const porLote = new Map(custos.map((c) => [c.loteId, c]));
  return { verValores, lotes: lotes.map((lote) => ({ lote, ...vigencias.get(lote.id)!, verValores, custos: apresentarResumoCusto(porLote.get(lote.id), verValores) })) };
}

export async function resumoLote(loteId: string, propriedadeId: number | null, verValores: boolean) {
  // Também permite consultar o histórico de lotes inativos, sem escapar do sítio.
  const lote = await buscarLote(loteId, propriedadeId);
  const [vigencias, custos] = await Promise.all([vigenciasDosLotes([loteId]), custosPorLote(propriedadeId, loteId)]);
  return { lote, ...vigencias.get(loteId)!, verValores, custos: apresentarResumoCusto(custos[0], verValores) };
}
