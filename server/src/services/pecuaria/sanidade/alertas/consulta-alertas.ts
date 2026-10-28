import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../../db.js";
import { dataCivil, diaCivil } from "./datas.calc.js";
import { tiposDisponiveis } from "../../../alertas/registro.js";
import type { ConsultaAlertasDTO, CoberturaAlertaDTO, GrupoAlertaDTO, ParticipanteAlertaDTO, TotaisAlertas } from "../../../alertas/contratos.js";
export const consultaAlertasSchema = z.object({
  disposicao: z.enum(["ATENCAO","PROXIMOS","PROGRAMADOS","HISTORICO"]).default("ATENCAO"),
  busca: z.string().trim().max(120).optional(), animalId:z.string().uuid().optional(), loteId:z.string().uuid().optional(), regraId:z.string().uuid().optional(), programacaoId:z.string().uuid().optional(),
  situacao:z.string().max(40).optional(), pagina:z.coerce.number().int().min(1).default(1), tamanho:z.coerce.number().int().min(1).max(100).default(20), propriedadeId:z.coerce.number().int().positive().optional(),
});
export type ConsultaAlertas = z.infer<typeof consultaAlertasSchema>;
const totals = (row?: { cuidados: bigint; necessidades: bigint; animais: bigint }): TotaisAlertas => ({ cuidados:Number(row?.cuidados ?? 0), necessidades:Number(row?.necessidades ?? 0), animais:Number(row?.animais ?? 0) });
export async function coberturaAlertas(agora = new Date()): Promise<CoberturaAlertaDTO> {
  const cobertura = await prisma.avaliacaoAlertas.findUnique({where:{id:"sanidade"}});
  const dia = cobertura?.diaCoberto?.toISOString().slice(0,10) ?? null;
  return { estado: cobertura?.estado === "FALHA" ? "FALHA" : !dia ? (cobertura?.estado==="DESATUALIZADO"||cobertura?.ultimaConclusao?"DESATUALIZADA":"NAO_AVALIADO") : dia < diaCivil(agora) ? "DESATUALIZADA" : "ATUALIZADA", diaCoberto:dia, ultimaConclusao:cobertura?.ultimaConclusao?.toISOString() ?? null, erro:cobertura?.estado === "FALHA" ? "A avaliação sanitária não foi concluída. A lista pode estar incompleta." : null };
}
/** CTE única autoriza e filtra antes de agrupar/paginar; nunca resolve detalhes individuais para listar. */
function baseConsulta(propriedadeId: number | null, filtro: ConsultaAlertas, agora: Date, aplicarFiltros = true) {
  const hoje=dataCivil(diaCivil(agora));
  const referencia=Prisma.sql`COALESCE(a."dataReferencia",NULLIF(a."resumo"->>'inicioJanela','')::date)`;
  const operacional=Prisma.sql`CASE WHEN a."situacao"='ADIADO' THEN COALESCE(n."dataAtencao",a."prazo") ELSE COALESCE(n."dataAtencao",${referencia}) END`;
  const disposicao = filtro.disposicao === "HISTORICO" ? Prisma.sql`a."ciclo" <> 'ABERTO'` : filtro.disposicao === "PROXIMOS" ? Prisma.sql`a."ciclo" = 'ABERTO' AND a."situacao" = 'PROXIMO' AND ${referencia} > ${hoje}` : filtro.disposicao === "PROGRAMADOS" ? Prisma.sql`a."ciclo" = 'ABERTO' AND (a."situacao" = 'PROGRAMADO' OR (a."situacao"='ADIADO' AND ${operacional}>${hoje}))` : Prisma.sql`a."ciclo" = 'ABERTO' AND (a."situacao" NOT IN ('PROXIMO','PROGRAMADO','ADIADO') OR (a."situacao" = 'PROXIMO' AND ${referencia} <= ${hoje}) OR (a."situacao"='ADIADO' AND (${operacional}<=${hoje} OR ${operacional} IS NULL)))`;
  return Prisma.sql`WITH base AS (
    SELECT a.*, COALESCE(n."id", np."id") AS "necessidadeId", ${operacional} AS "dataAtencaoOperacional", an."brinco", an."nome" AS "animalNome", l."loteId", lt."nome" AS "loteNome",
      CASE WHEN a."situacao" IN ('PROXIMO','PENDENTE','ADIADO') AND ${operacional} <= ${hoje} THEN CASE WHEN a."prazo" < ${hoje} THEN 'ATRASADO' ELSE 'PENDENTE' END ELSE a."situacao" END AS "situacaoAtual"
    FROM "public"."Alerta" a
    LEFT JOIN "pecuaria"."NecessidadeSanitaria" n ON n."alertaId"=a."id"
    LEFT JOIN "pecuaria"."NecessidadeProgramacaoSanitaria" np ON np."alertaId"=a."id"
    LEFT JOIN "pecuaria"."Animal" an ON a."sujeitoTipo"='ANIMAL' AND an."id"=a."sujeitoId"
    LEFT JOIN "pecuaria"."LocalizacaoAnimal" l ON l."animalId"=an."id" AND l."ate" IS NULL
    LEFT JOIN "pecuaria"."Lote" lt ON lt."id"=l."loteId"
    WHERE a."proprietario"='fazendinha' AND a."produtor"='sanidade' AND ${propriedadeId == null ? Prisma.sql`TRUE` : Prisma.sql`a."propriedadeId"=${propriedadeId} AND (a."sujeitoTipo" <> 'ANIMAL' OR l."propriedadeId"=${propriedadeId})`}
      AND ${disposicao}
  ), filtrada AS (SELECT * FROM base WHERE ${!aplicarFiltros ? Prisma.sql`TRUE` : Prisma.sql`
    ${filtro.busca ? Prisma.sql`("titulo" ILIKE ${`%${filtro.busca}%`} OR "motivo" ILIKE ${`%${filtro.busca}%`} OR "brinco" ILIKE ${`%${filtro.busca}%`} OR "animalNome" ILIKE ${`%${filtro.busca}%`})` : Prisma.sql`TRUE`}
    AND ${filtro.animalId ? Prisma.sql`"sujeitoTipo"='ANIMAL' AND "sujeitoId"=${filtro.animalId}` : Prisma.sql`TRUE`}
    AND ${filtro.loteId ? Prisma.sql`"loteId"=${filtro.loteId}` : Prisma.sql`TRUE`}
    AND ${filtro.regraId ? Prisma.sql`"resumo"->>'regraId'=${filtro.regraId}` : Prisma.sql`TRUE`}
    AND ${filtro.programacaoId ? Prisma.sql`("resumo"->>'programacaoId'=${filtro.programacaoId} OR EXISTS(SELECT 1 FROM "pecuaria"."NecessidadeProgramacaoSanitaria" npf WHERE npf."alertaId"=base."id" AND npf."programacaoId"=${filtro.programacaoId}))` : Prisma.sql`TRUE`}
    AND ${filtro.situacao ? Prisma.sql`"situacaoAtual"=${filtro.situacao}` : Prisma.sql`TRUE`}`})`;
}
const totalsSql = Prisma.sql`SELECT count(DISTINCT "chaveAgrupamento") AS cuidados, count(*) AS necessidades, count(DISTINCT "sujeitoId") FILTER (WHERE "sujeitoTipo"='ANIMAL') AS animais FROM filtrada`;
type TotaisRow = { cuidados:bigint; necessidades:bigint; animais:bigint };
export async function consultarAlertas(propriedadeId:number|null, filtro:ConsultaAlertas, agora=new Date()):Promise<ConsultaAlertasDTO> {
  const base=baseConsulta(propriedadeId,filtro,agora);
  const [linhas, gerais, filtrados, cobertura] = await Promise.all([
    prisma.$queryRaw<Array<{chave:string;titulo:string;motivo:string;produtor:string;tipo:string;propriedadeId:number|null;produtoId:string|null;produtoNome:string|null;necessidades:bigint;animais:bigint;situacoes:Record<string,number>;primeiraData:Date|null}>>(Prisma.sql`${base}, grupos AS (
      SELECT "chaveAgrupamento" AS chave, min(titulo) AS titulo, min(motivo) AS motivo, min(produtor) AS produtor, min(tipo) AS tipo, min("propriedadeId") AS "propriedadeId", min("resumo"->>'produtoId') AS "produtoId", min("resumo"->>'produtoNome') AS "produtoNome", count(*) AS necessidades, count(DISTINCT "sujeitoId") FILTER (WHERE "sujeitoTipo"='ANIMAL') AS animais, min("dataReferencia") AS "primeiraData",
      (SELECT jsonb_object_agg(s, n) FROM (SELECT f2."situacaoAtual" s, count(*)::int n FROM filtrada f2 WHERE f2."chaveAgrupamento"=f."chaveAgrupamento" GROUP BY f2."situacaoAtual") c) AS situacoes
      FROM filtrada f GROUP BY "chaveAgrupamento") SELECT * FROM grupos ORDER BY "primeiraData" ASC NULLS LAST,chave LIMIT ${filtro.tamanho} OFFSET ${(filtro.pagina-1)*filtro.tamanho}`),
    prisma.$queryRaw<TotaisRow[]>(Prisma.sql`${baseConsulta(propriedadeId,filtro,agora,false)} ${totalsSql}`),
    prisma.$queryRaw<TotaisRow[]>(Prisma.sql`${base} ${totalsSql}`), coberturaAlertas(agora),
  ]);
  const itens:GrupoAlertaDTO[]=linhas.map(l=>({...l,necessidades:Number(l.necessidades),animais:Number(l.animais),primeiraData:l.primeiraData?.toISOString().slice(0,10)??null}));
  return {itens,total:Number(filtrados[0]?.cuidados??0),pagina:filtro.pagina,tamanho:filtro.tamanho,totaisGerais:totals(gerais[0]),totaisFiltrados:totals(filtrados[0]),cobertura,tiposDisponiveis};
}
export async function consultarParticipantes(propriedadeId:number|null,chave:string,filtro:ConsultaAlertas,agora=new Date()) {
  const base=baseConsulta(propriedadeId,filtro,agora);
  const [linhas,contagem]=await Promise.all([
    prisma.$queryRaw<Array<{id:string;necessidadeId:string;sujeitoId:string;brinco:string;animalNome:string|null;loteId:string|null;loteNome:string|null;titulo:string;motivo:string;situacaoAtual:string;dataReferencia:Date|null;prazo:Date|null;dataAtencaoOperacional:Date|null;revisao:number;chaveAgrupamento:string;propriedadeId:number|null}>>(Prisma.sql`${base} SELECT * FROM filtrada WHERE "chaveAgrupamento"=${chave} ORDER BY "brinco",id LIMIT ${filtro.tamanho} OFFSET ${(filtro.pagina-1)*filtro.tamanho}`),
    prisma.$queryRaw<TotaisRow[]>(Prisma.sql`${base} SELECT count(DISTINCT "chaveAgrupamento") cuidados,count(*) necessidades,count(DISTINCT "sujeitoId") FILTER(WHERE "sujeitoTipo"='ANIMAL') animais FROM filtrada WHERE "chaveAgrupamento"=${chave}`),
  ]);
  const itens:ParticipanteAlertaDTO[]=linhas.map(l=>({id:l.id,necessidadeId:l.necessidadeId,animalId:l.sujeitoId,brinco:l.brinco,nome:l.animalNome,loteId:l.loteId,loteNome:l.loteNome,titulo:l.titulo,motivo:l.motivo,situacao:l.situacaoAtual,dataReferencia:l.dataReferencia?.toISOString().slice(0,10)??null,dataAtencao:l.dataAtencaoOperacional?.toISOString().slice(0,10)??null,revisao:l.revisao,chaveAgrupamento:l.chaveAgrupamento,propriedadeId:l.propriedadeId}));
  return {itens,total:Number(contagem[0]?.necessidades??0),pagina:filtro.pagina,tamanho:filtro.tamanho,totaisFiltrados:totals(contagem[0])};
}
