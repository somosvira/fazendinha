import { sqlSituacaoOperacional } from "../../protocolos/situacao.js";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../../db.js";
import { dataCivil, diaCivil } from "../alertas/datas.calc.js";
export const consultaAgendaUnificadaSchema = z.object({ de: z.string().date().optional(), ate: z.string().date().optional(), animalId: z.string().uuid().optional(), loteId: z.string().uuid().optional(), busca: z.string().trim().max(160).default(""), pagina: z.coerce.number().int().min(1).default(1), tamanho: z.coerce.number().int().min(1).max(100).default(50), propriedadeId: z.coerce.number().int().positive().optional() }).strict();
export type ItemAgendaUnificada = { id: string; origem: "TAREFA" | "ALERTA"; origemId: string; alertaId: string | null; propriedadeId: number | null; participacaoId: string | null; animalId: string; brinco: string; nome: string | null; titulo: string; situacao: string; dataReferencia: Date | null; precisao: string; inicioJanela: Date | null; fimJanela: Date | null };
export async function consultarAgendaUnificada(f: z.infer<typeof consultaAgendaUnificadaSchema>, propriedadeId: number | null, agora = new Date()) {
  const hoje = dataCivil(diaCivil(agora));
  const base = Prisma.sql`WITH tarefas AS (
    SELECT 'tarefa:'||t.id AS id, 'TAREFA'::text AS origem, t.id AS "origemId", n."alertaId", p."propriedadeId", p.id AS "participacaoId", p."animalId", an.brinco, an.nome,
      COALESCE(t."nomeSnapshot", pr.nome) AS titulo,
      ${sqlSituacaoOperacional(agora)} AS situacao,
      CASE WHEN t."previsaoPendente" THEN NULL ELSE t."previstaEm" END AS "dataReferencia", t."precisaoTemporal"::text AS precisao,
      t."previstaEm" AS "inicioJanela", t."previstaEm" AS "fimJanela", l."propriedadeId" AS "propriedadeAtualId", l."loteId"
    FROM pecuaria."TarefaProtocolo" t JOIN pecuaria."ParticipacaoProtocolo" p ON p.id=t."participacaoId"
    JOIN pecuaria."Protocolo" pr ON pr.id=p."protocoloId" AND pr.tipo='SANITARIO'
    JOIN pecuaria."Animal" an ON an.id=p."animalId"
    LEFT JOIN pecuaria."LocalizacaoAnimal" l ON l."animalId"=an.id AND l.ate IS NULL
    LEFT JOIN pecuaria."NecessidadeSanitaria" n ON n."participacaoId"=p.id
  ), avisos AS (
    SELECT 'alerta:'||a.id AS id, 'ALERTA'::text AS origem, a.id AS "origemId", a.id AS "alertaId", a."propriedadeId", NULL::text AS "participacaoId", a."sujeitoId" AS "animalId", an.brinco, an.nome, a.titulo,
      CASE WHEN a.situacao='ADIADO' AND COALESCE(ns."dataAtencao",a."prazo")<=${hoje} THEN CASE WHEN a."prazo"<${hoje} THEN 'ATRASADO' ELSE 'PENDENTE' END ELSE a.situacao END AS situacao,
      CASE WHEN a.situacao IN ('CONFERENCIA_INICIAL','NECESSITA_REVISAO','DADOS_INSUFICIENTES') THEN NULL WHEN a.situacao='ADIADO' THEN COALESCE(ns."dataAtencao",a."prazo") ELSE a."dataReferencia" END AS "dataReferencia", CASE WHEN a.situacao='ADIADO' THEN 'DIA' ELSE COALESCE(a.resumo->>'precisao','DIA') END AS precisao,
      CASE WHEN a.situacao IN ('CONFERENCIA_INICIAL','NECESSITA_REVISAO','DADOS_INSUFICIENTES') THEN NULL WHEN a.situacao='ADIADO' THEN COALESCE(ns."dataAtencao",a."prazo") ELSE COALESCE(a."dataReferencia", NULLIF(a.resumo->>'inicioJanela','')::date) END AS "inicioJanela",
      CASE WHEN a.situacao IN ('CONFERENCIA_INICIAL','NECESSITA_REVISAO','DADOS_INSUFICIENTES') THEN NULL WHEN a.situacao='ADIADO' THEN COALESCE(ns."dataAtencao",a."prazo") ELSE COALESCE(a."dataReferencia", NULLIF(a.resumo->>'fimJanela','')::date) END AS "fimJanela", l."propriedadeId" AS "propriedadeAtualId", l."loteId"
    FROM public."Alerta" a JOIN pecuaria."Animal" an ON a."sujeitoTipo"='ANIMAL' AND an.id=a."sujeitoId"
    LEFT JOIN pecuaria."LocalizacaoAnimal" l ON l."animalId"=an.id AND l.ate IS NULL
    LEFT JOIN pecuaria."NecessidadeSanitaria" ns ON ns."alertaId"=a.id
    WHERE a.proprietario='fazendinha' AND a.produtor='sanidade' AND a.ciclo='ABERTO'
      AND NOT EXISTS (SELECT 1 FROM tarefas t WHERE t."alertaId"=a.id)
      AND ${propriedadeId == null ? Prisma.sql`TRUE` : Prisma.sql`a."propriedadeId"=${propriedadeId}`}
  ), unidos AS (SELECT * FROM tarefas UNION ALL SELECT * FROM avisos), filtrados AS (
    SELECT * FROM unidos WHERE ${propriedadeId == null ? Prisma.sql`TRUE` : Prisma.sql`"propriedadeAtualId"=${propriedadeId}`}
    AND ${f.animalId ? Prisma.sql`"animalId"=${f.animalId}` : Prisma.sql`TRUE`}
    AND ${f.loteId ? Prisma.sql`"loteId"=${f.loteId}` : Prisma.sql`TRUE`}
    AND ${f.de ? Prisma.sql`("fimJanela" >= ${new Date(`${f.de}T00:00:00Z`)} OR "fimJanela" IS NULL)` : Prisma.sql`TRUE`}
    AND ${f.ate ? Prisma.sql`("inicioJanela" <= ${new Date(`${f.ate}T00:00:00Z`)} OR "inicioJanela" IS NULL)` : Prisma.sql`TRUE`}
    AND ${f.busca ? Prisma.sql`(titulo ILIKE ${`%${f.busca}%`} OR brinco ILIKE ${`%${f.busca}%`} OR nome ILIKE ${`%${f.busca}%`})` : Prisma.sql`TRUE`}
  )`;
  const [itens, contagem] = await prisma.$transaction([
    prisma.$queryRaw<ItemAgendaUnificada[]>(Prisma.sql`${base} SELECT id,origem,"origemId","alertaId","propriedadeId","participacaoId","animalId",brinco,nome,titulo,situacao,"dataReferencia",precisao,"inicioJanela","fimJanela" FROM filtrados ORDER BY "inicioJanela" NULLS LAST,id LIMIT ${f.tamanho} OFFSET ${(f.pagina - 1) * f.tamanho}`),
    prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`${base} SELECT count(*) AS total FROM filtrados`),
  ], { isolationLevel: "RepeatableRead" });
  return { itens, total: Number(contagem[0]?.total ?? 0), pagina: f.pagina, tamanho: f.tamanho };
}
