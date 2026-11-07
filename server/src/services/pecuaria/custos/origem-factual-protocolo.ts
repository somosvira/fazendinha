import type { Prisma } from "@prisma/client";

/** Vínculo factual não usa a atribuição financeira de preparatórios como prova clínica. */
export function tentativaDoProtocolo(
  participacoes: string[],
): Prisma.TentativaReprodutivaWhereInput {
  return {
    OR: [
      { tarefa: { execucaoId: { in: participacoes } } },
      {
        vinculosProtocolo: {
          some: {
            estado: "ATUAL",
            tarefa: { execucaoId: { in: participacoes } },
          },
        },
      },
      {
        participacoesExplicitas: {
          some: { revogadoEm: null, participacaoId: { in: participacoes } },
        },
      },
    ],
  };
}

export function exameDoProtocolo(
  participacoes: string[],
): Prisma.ExameAnimalWhereInput {
  return {
    OR: [
      { tarefa: { execucaoId: { in: participacoes } } },
      {
        vinculosProtocolo: {
          some: {
            estado: "ATUAL",
            tarefa: { execucaoId: { in: participacoes } },
          },
        },
      },
      {
        demandaAcompanhamento: {
          tarefa: { execucaoId: { in: participacoes } },
        },
      },
      {
        interpretacao: {
          OR: [
            { TentativaReprodutiva: tentativaDoProtocolo(participacoes) },
            {
              GestacaoAnimal: {
                TentativaReprodutiva: tentativaDoProtocolo(participacoes),
              },
            },
          ],
        },
      },
    ],
  };
}
