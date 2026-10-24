import { Prisma, type TipoProtocolo } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../db.js";
import { contextoRegularizacaoTx } from "./regularizacao.js";

export const paginaSubstitutosSchema = z.object({
  pagina: z.coerce.number().int().min(1).max(10000).default(1),
  porPagina: z.coerce.number().int().min(1).max(10).default(10),
  busca: z.string().trim().max(100).optional(),
}).strict();

/** A seleção usa somente tabelas predefinidas; filtros e ocupação precedem a paginação. */
export async function paginaSubstitutosFatoTx(tx: Prisma.TransactionClient, fatoTipo: string, fatoId: string | null,
  animalId: string, propriedadeId: number, consulta: unknown, tarefaId: string | null = null) {
  const f = paginaSubstitutosSchema.parse(consulta);
  const vazio = { itens: [] as Array<{ id: string; descricao: string }>, total: 0, pagina: 1, porPagina: f.porPagina };
  if (!fatoId) return vazio;
  let tabela: Prisma.Sql, descricao: Prisma.Sql, identidade = Prisma.empty;
  let tarefa = Prisma.sql`(c."tarefaId" IS NULL OR c."tarefaId"=${tarefaId})`;
  let natureza = Prisma.empty;
  switch (fatoTipo) {
    case "AplicacaoProduto":
      tabela = Prisma.sql`pecuaria."AplicacaoProduto"`;
      descricao = Prisma.sql`c."nomeProdutoAplicado" || ' · ' || c.data::text`;
      break;
    case "TentativaReprodutiva":
      tabela = Prisma.sql`pecuaria."TentativaReprodutiva"`;
      descricao = Prisma.sql`c.tipo || ' · ' || c.data::text || coalesce(' · ' || c.responsavel,'')`;
      identidade = Prisma.sql`AND c.tipo=o.tipo`;
      break;
    case "ManejoAnimal":
      tabela = Prisma.sql`pecuaria."ManejoAnimal"`;
      descricao = Prisma.sql`c.tipo || ' · ' || c.data::text || coalesce(' · ' || c.responsavel,'')`;
      identidade = Prisma.sql`AND c.tipo=o.tipo AND c."insercaoAplicacaoId" IS NOT DISTINCT FROM o."insercaoAplicacaoId"`;
      break;
    case "ExameAnimal":
      tabela = Prisma.sql`pecuaria."ExameAnimal"`;
      descricao = Prisma.sql`(SELECT te.nome FROM pecuaria."TipoExame" te WHERE te.id=c."tipoExameId") || ' · ' || c.data::text`;
      natureza = Prisma.sql`AND c.realizacao<>'NAO_REALIZADO' AND NOT EXISTS(SELECT 1 FROM pecuaria."InterpretacaoReprodutiva" i WHERE i."exameId"=c.id)`;
      break;
    case "AvaliacaoReprodutiva":
      tabela = Prisma.sql`pecuaria."AvaliacaoReprodutiva"`;
      descricao = Prisma.sql`coalesce(nullif(c."anotacaoOriginal",''),c.resultado) || ' · ' || c.data::text`;
      tarefa = Prisma.sql`EXISTS(SELECT 1 FROM pecuaria."ExameAnimal" e JOIN pecuaria."InterpretacaoReprodutiva" i ON i."exameId"=e.id
        WHERE i.id=c.id AND e.realizacao='REALIZADO' AND (e."tarefaId" IS NULL OR e."tarefaId"=${tarefaId}))`;
      natureza = Prisma.sql`AND c.resultado<>'NAO_AVALIADO'`;
      break;
    default: return vazio;
  }
  const candidatos = Prisma.sql`WITH candidatos AS (
    SELECT c.id,${descricao} AS descricao,c."criadoEm" FROM ${tabela} c JOIN ${tabela} o ON o.id=${fatoId}
    WHERE o."animalId"=${animalId} AND o."propriedadeId"=${propriedadeId}
      AND c.id<>o.id AND c."animalId"=o."animalId" AND c."propriedadeId"=o."propriedadeId"
      AND c.data=o.data AND c.status='VALIDO' ${identidade} ${natureza} AND ${tarefa}
      AND NOT EXISTS(SELECT 1 FROM pecuaria."ParticipanteVisita" p WHERE p.status='CONFIRMADO'
        AND p."fatoTipo"=${fatoTipo} AND p."fatoId"=c.id AND (p."tarefaId" IS NULL OR p."tarefaId" IS DISTINCT FROM ${tarefaId}))
      AND NOT EXISTS(SELECT 1 FROM pecuaria."VinculoTarefaProtocolo" v
        LEFT JOIN pecuaria."InterpretacaoReprodutiva" i ON i."exameId"=v."exameId"
        WHERE v."tarefaId" IS DISTINCT FROM ${tarefaId}
          AND (v."aplicacaoId"=c.id OR v."tentativaId"=c.id OR v."manejoId"=c.id OR v."exameId"=c.id OR i.id=c.id))
  ), filtrados AS (SELECT * FROM candidatos WHERE ${f.busca ? Prisma.sql`strpos(lower(descricao),lower(${f.busca}))>0` : Prisma.sql`true`})`;
  const [contagem] = await tx.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`${candidatos} SELECT count(*) AS total FROM filtrados`);
  const total = Number(contagem.total);
  const pagina = Math.min(f.pagina, Math.max(1, Math.ceil(total / f.porPagina)));
  const itens = await tx.$queryRaw<Array<{ id: string; descricao: string }>>(Prisma.sql`${candidatos}
    SELECT id,descricao FROM filtrados ORDER BY "criadoEm" DESC,id OFFSET ${(pagina - 1) * f.porPagina} LIMIT ${f.porPagina}`);
  return { itens, total, pagina, porPagina: f.porPagina };
}

export async function paginaSubstitutosTarefa(id: string, propriedadeId: number, consulta: unknown, tipo?: TipoProtocolo) {
  const f = paginaSubstitutosSchema.parse(consulta);
  return prisma.$transaction(async tx => {
    const identidade = await tx.tarefaProtocolo.findFirst({where:{OR:[{id},{legadoIatfId:id}]},select:{id:true}});
    const { tarefa, fatoTipo, fatoId } = await contextoRegularizacaoTx(tx,identidade?.id??id,propriedadeId,tipo);
    if (!tarefa.regularizacaoPendente) return { itens: [], total: 0, pagina: 1, porPagina: f.porPagina };
    return paginaSubstitutosFatoTx(tx,fatoTipo,fatoId,tarefa.execucao.animalId,propriedadeId,f,tarefa.id);
  }, { isolationLevel: "RepeatableRead" });
}
