import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../db.js";
import { sqlTarefaNoEscopoOperacao } from "./operacao.escopo.js";
import { sqlSituacaoOperacional } from "./situacao.js";

export const etapasDoDiaSchema = z
  .object({
    data: z.string().date(),
    pagina: z.coerce.number().int().positive().default(1),
    porPagina: z.coerce.number().int().min(1).max(10).default(10),
  })
  .strict();

type Linha = {
  contextoId: string;
  modo: "COLETIVO" | "INDIVIDUAL";
  nome: string;
  modelo: string;
  etapaId: string;
  etapa: string;
  totalAnimais: bigint;
  atendidos: bigint;
  pendentes: bigint;
  encerrados: bigint;
};

/** Universo do planejamento na data, incluindo atendimentos e encerramentos.
 * A agenda de visitas continua sendo a fila de cuidados pendentes. */
export async function listarEtapasDoDia(
  propriedadeId: number | null,
  entrada: z.input<typeof etapasDoDiaSchema>,
) {
  const f = etapasDoDiaSchema.parse(entrada);
  const agora = new Date();
  const base = Prisma.sql`WITH universo AS (
    SELECT coalesce(p."programacaoId",p.id) AS "contextoId",
      CASE WHEN p."programacaoId" IS NULL THEN 'INDIVIDUAL' ELSE 'COLETIVO' END AS modo,
      coalesce(pg.nome,a.nome,a.brinco) AS nome, pr.nome AS modelo,
      e.id AS "etapaId", e.nome AS etapa, e.ordem, p."animalId",
      ${sqlSituacaoOperacional(agora)} AS situacao
    FROM pecuaria."TarefaProtocolo" t
    JOIN pecuaria."ParticipacaoProtocolo" p ON p.id=t."participacaoId"
    JOIN pecuaria."Protocolo" pr ON pr.id=p."protocoloId"
    JOIN pecuaria."EtapaProtocolo" e ON e.id=t."etapaId"
    JOIN pecuaria."Animal" a ON a.id=p."animalId"
    LEFT JOIN pecuaria."ProgramacaoProtocolo" pg ON pg.id=p."programacaoId"
    WHERE pr.tipo='REPRODUTIVO' AND NOT t."previsaoPendente"
      AND ${sqlTarefaNoEscopoOperacao(propriedadeId)}
      AND (CASE WHEN t."precisaoTemporal"::text='HORA'
        THEN (t."previstaEm" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date
        ELSE t."previstaEm"::date END)=${f.data}::date
  ), grupos AS (
    SELECT "contextoId",modo,nome,modelo,"etapaId",etapa,ordem,
      count(DISTINCT "animalId") AS "totalAnimais",
      count(DISTINCT "animalId") FILTER(WHERE situacao='ATENDIDO') AS atendidos,
      count(DISTINCT "animalId") FILTER(WHERE situacao IN
        ('SEM_REGISTRO','NAO_ATENDIDO','ADIADO','REGULARIZACAO_PENDENTE','PREVISTO')) AS pendentes,
      count(DISTINCT "animalId") FILTER(WHERE situacao IN
        ('ENCERRADO','DISPENSADO','RETIRADO')) AS encerrados
    FROM universo GROUP BY "contextoId",modo,nome,modelo,"etapaId",etapa,ordem
  )`;
  return prisma.$transaction(
    async (tx) => {
      const [contagem] = await tx.$queryRaw<Array<{ total: bigint }>>(
        Prisma.sql`${base} SELECT count(*) AS total FROM grupos`,
      );
      const total = Number(contagem?.total ?? 0);
      const pagina = Math.min(
        f.pagina,
        Math.max(1, Math.ceil(total / f.porPagina)),
      );
      const linhas = await tx.$queryRaw<Linha[]>(Prisma.sql`${base}
      SELECT * FROM grupos ORDER BY nome,"contextoId",ordem,"etapaId"
      LIMIT ${f.porPagina} OFFSET ${(pagina - 1) * f.porPagina}`);
      return {
        itens: linhas.map((l) => ({
          ...l,
          totalAnimais: Number(l.totalAnimais),
          atendidos: Number(l.atendidos),
          pendentes: Number(l.pendentes),
          encerrados: Number(l.encerrados),
        })),
        total,
        pagina,
        porPagina: f.porPagina,
        data: f.data,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
