import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { consultarPopulacaoPeriodoLeiteTx, type EstadoPopulacaoLeite } from "./populacao-periodo.js";
import { linhasProducaoGeralTx } from "./producao-geral-consulta.js";
import { consultaCustosLeiteSchema } from "./custos.schemas.js";
export interface LinhaPainelLeite {
  fonte?: "GERAL" | "INDIVIDUAL";
  esperadas?: number;
  propriedadeId: number;
  data: Date;
  ordenhas: bigint | number;
  animais: bigint | number;
  medidas: bigint | number;
  resolvidas: bigint | number;
  litros: Prisma.Decimal | string | null;
  finalidadesPendentes?: bigint | number;
}
export function resumirPainelLeite(
  linhas: LinhaPainelLeite[],
  sitios: number[],
  inicio: string,
  fim: string,
  populacoes: { propriedadeId: number; data: string; estado: EstadoPopulacaoLeite }[] = [],
) {
  const dias =
    Math.round((Date.parse(fim) - Date.parse(inicio)) / 86400000) + 1;
  const diasSitioEsperados = dias * sitios.length;
  const medidas = linhas.reduce((s, l) => s + Number(l.medidas), 0);
  const litros = medidas
    ? linhas
        .reduce((s, l) => s.plus(l.litros ?? 0), new Prisma.Decimal(0))
        .toFixed(3)
    : null;
  const parciais = linhas.filter(
    (l) => (l.esperadas ?? Number(l.animais) * Number(l.ordenhas)) > Number(l.resolvidas),
  ).length;
  const semParticipantes = linhas.filter((l) => (l.fonte === "GERAL" ? l.esperadas === 0 : Number(l.animais) === 0)).length;
  const semElegiveis = populacoes.filter(p => p.estado === "SEM_ANIMAIS_ELEGIVEIS" && !linhas.some(l => l.propriedadeId === p.propriedadeId && l.data.toISOString().slice(0, 10) === p.data && (l.fonte === "GERAL" || Number(l.animais) > 0))).length;
  const finalidadePendente = new Set([
    ...populacoes.filter(p => p.estado === "FINALIDADE_PENDENTE" && !linhas.some(l => l.fonte === "GERAL" && l.propriedadeId === p.propriedadeId && l.data.toISOString().slice(0,10) === p.data)).map(p => `${p.propriedadeId}:${p.data}`),
    ...linhas.filter(l => Number(l.finalidadesPendentes ?? 0) > 0).map(l => `${l.propriedadeId}:${l.data.toISOString().slice(0, 10)}`),
  ]).size;
  const semParticipantesNaoComprovados = linhas.filter(l => l.fonte === "GERAL" ? !l.esperadas : Number(l.animais) === 0 && !populacoes.some(p => p.propriedadeId === l.propriedadeId && p.data === l.data.toISOString().slice(0, 10) && p.estado === "SEM_ANIMAIS_ELEGIVEIS")).length;
  const semFolha = Math.max(0, diasSitioEsperados - linhas.length - populacoes.filter(p => p.estado === "SEM_ANIMAIS_ELEGIVEIS" && !linhas.some(l => l.propriedadeId === p.propriedadeId && l.data.toISOString().slice(0, 10) === p.data)).length);
  return {
    litros,
    unidade: "L",
    diasSitioEsperados,
    diasSitioInformados: linhas.length,
    diasSitioSemFolha: semFolha,
    diasSitioSemAnimaisElegiveis: semElegiveis,
    diasSitioFinalidadePendente: finalidadePendente,
    diasSitioParciais: parciais,
    diasSitioSemParticipantes: semParticipantes,
    medicoesPendentes: linhas.reduce(
      (s, l) =>
        s +
        Math.max(
          0,
          (l.esperadas ?? Number(l.animais) * Number(l.ordenhas)) - Number(l.resolvidas),
        ),
      0,
    ),
    completa:
      sitios.length > 0 &&
      semFolha === 0 && finalidadePendente === 0 &&
      parciais === 0 &&
      semParticipantesNaoComprovados === 0,
    rotinas: [...new Set(linhas.map((l) => Number(l.ordenhas)))].sort(
      (a, b) => a - b,
    ),
  };
}
/** Agregado físico, sem materializar células ou carregar custos no painel. */
export function consultarPainelLeite(
  propriedadeId: number | null,
  inicio: string,
  fim: string,
) {
  consultaCustosLeiteSchema.parse({ inicio, fim });
  return prisma.$transaction(
    async (tx) => {
      const sitios = await tx.propriedade.findMany({
        where: propriedadeId === null ? { ativo: true } : { id: propriedadeId },
        select: { id: true },
      });
      const ids = sitios.map((s) => s.id);
      const linhas = ids.length
        ? await tx.$queryRaw<LinhaPainelLeite[]>(Prisma.sql`
      SELECT d."propriedadeId", d."dataOperacional" AS data,
        (SELECT count(*) FROM pecuaria."SessaoOrdenha" s WHERE s."diaId" = d.id) AS ordenhas,
        (SELECT count(*) FROM pecuaria."ParticipanteProducaoLeite" p WHERE p."diaId" = d.id AND p."excluidoEm" IS NULL) AS animais,
        (SELECT count(*) FROM pecuaria."MedicaoLeite" m JOIN pecuaria."ParticipanteProducaoLeite" p ON p.id=m."participanteId" WHERE p."diaId"=d.id AND p."excluidoEm" IS NULL AND m.estado='MEDIDO') AS medidas,
        (SELECT count(*) FROM pecuaria."MedicaoLeite" m JOIN pecuaria."ParticipanteProducaoLeite" p ON p.id=m."participanteId" WHERE p."diaId"=d.id AND p."excluidoEm" IS NULL AND m.estado IN ('MEDIDO','NAO_ORDENHADO')) AS resolvidas,
        (SELECT count(*) FROM pecuaria."ParticipanteProducaoLeite" p WHERE p."diaId"=d.id AND p."excluidoEm" IS NULL AND (p."finalidadeId" IS NULL OR p."finalidadeSnapshot" IS NULL OR p."finalidadeSnapshot"->>'regra' IS DISTINCT FROM 'FINALIDADE_LEITE_V1' OR p."finalidadeSnapshot"->>'aptidao' IS DISTINCT FROM 'LEITE' OR p."finalidadeSnapshot"->>'dataOperacional' IS DISTINCT FROM to_char(d."dataOperacional",'YYYY-MM-DD'))) AS "finalidadesPendentes",
        (SELECT sum(m.litros) FROM pecuaria."MedicaoLeite" m JOIN pecuaria."ParticipanteProducaoLeite" p ON p.id=m."participanteId" WHERE p."diaId"=d.id AND p."excluidoEm" IS NULL AND m.estado='MEDIDO') AS litros
      FROM pecuaria."DiaProducaoLeite" d JOIN pecuaria."ConfiguracaoOrdenha" c ON c.id=d."configuracaoId"
      WHERE c."fonteProducao" = 'INDIVIDUAL' AND d."propriedadeId" IN (${Prisma.join(ids)}) AND d."dataOperacional">=${new Date(inicio)} AND d."dataOperacional"<=${new Date(fim)}
      ORDER BY d."dataOperacional",d."propriedadeId"
    `)
        : [];
      // A fonte diária define o agregado; controles individuais nunca se somam aos tanques.
      for (const id of ids) {
        const diasGerais = await tx.diaProducaoLeite.findMany({ where: { propriedadeId: id, dataOperacional: { gte: new Date(inicio), lte: new Date(fim) }, configuracao: { fonteProducao: "GERAL" } }, include: { configuracao: true, sessoes: true } });
        const gerais = await linhasProducaoGeralTx(tx, diasGerais);
        for (const d of diasGerais) {
          const medidas = gerais.filter(l => l.data === d.dataOperacional.toISOString().slice(0,10));
          const conhecidas = medidas.filter(l => l.litros !== null);
          linhas.push({ fonte: "GERAL", propriedadeId: id, data: d.dataOperacional, ordenhas: d.sessoes.length, animais: 0, esperadas: medidas.length, medidas: conhecidas.length, resolvidas: conhecidas.length, litros: conhecidas.length ? conhecidas.reduce((s,l)=>s.plus(l.litros!),new Prisma.Decimal(0)) : null });
        }
      }
      const populacoes = [];
      for (const id of ids) populacoes.push(...(await consultarPopulacaoPeriodoLeiteTx(tx, id, inicio, fim)).map(p => ({ ...p, propriedadeId: id })));
      return {
        propriedadeId,
        periodo: { inicio, fim },
        corte: new Date().toISOString(),
        sitios: ids,
        ...resumirPainelLeite(linhas, ids, inicio, fim, populacoes),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
