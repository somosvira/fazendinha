import { Prisma } from "@prisma/client";

export function fatosTarefaNoSitio(propriedadeId: number): Prisma.TarefaProtocoloWhereInput {
  return { OR: [
    { aplicacoes: { some: { propriedadeId } } }, { exames: { some: { propriedadeId } } }, { tentativas: { some: { propriedadeId } } },
    { vinculos: { some: { OR: [{ aplicacao: { propriedadeId } }, { exame: { propriedadeId } }, { tentativa: { propriedadeId } }] } } },
  ] };
}
export function participacaoNoEscopoOperacao(propriedadeId: number | null): Prisma.ParticipacaoProtocoloWhereInput {
  return propriedadeId == null ? {} : { OR: [{ propriedadeId }, { tarefas: { some: fatosTarefaNoSitio(propriedadeId) } }] };
}
export function tarefaNoEscopoOperacao(propriedadeId: number | null): Prisma.TarefaProtocoloWhereInput {
  return propriedadeId == null ? {} : { OR: [{ execucao: { propriedadeId } }, fatosTarefaNoSitio(propriedadeId)] };
}
export function programacaoNoEscopoOperacao(propriedadeId: number | null): Prisma.ProgramacaoProtocoloWhereInput {
  return propriedadeId == null ? {} : { OR: [{ propriedadeId }, { execucoes: { some: participacaoNoEscopoOperacao(propriedadeId) } }] };
}
/** Mesma prova do predicado Prisma: origem da participação ou fato ligado à tarefa, sem localização atual. */
export function sqlTarefaNoEscopoOperacao(propriedadeId: number | null) {
  if (propriedadeId == null) return Prisma.sql`true`;
  return Prisma.sql`(p."propriedadeId"=${propriedadeId}
    OR EXISTS (SELECT 1 FROM pecuaria."AplicacaoProduto" f WHERE f."tarefaId"=t.id AND f."propriedadeId"=${propriedadeId})
    OR EXISTS (SELECT 1 FROM pecuaria."ExameAnimal" f WHERE f."tarefaId"=t.id AND f."propriedadeId"=${propriedadeId})
    OR EXISTS (SELECT 1 FROM pecuaria."TentativaReprodutiva" f WHERE f."tarefaId"=t.id AND f."propriedadeId"=${propriedadeId})
    OR EXISTS (SELECT 1 FROM pecuaria."VinculoTarefaProtocolo" v
      LEFT JOIN pecuaria."AplicacaoProduto" ap ON ap.id=v."aplicacaoId"
      LEFT JOIN pecuaria."ExameAnimal" ex ON ex.id=v."exameId"
      LEFT JOIN pecuaria."TentativaReprodutiva" tr ON tr.id=v."tentativaId"
      WHERE v."tarefaId"=t.id AND (ap."propriedadeId"=${propriedadeId} OR ex."propriedadeId"=${propriedadeId} OR tr."propriedadeId"=${propriedadeId})))`;
}
