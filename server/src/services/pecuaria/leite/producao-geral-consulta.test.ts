import { Prisma } from "@prisma/client";
import { expect, it, vi } from "vitest";
import { linhasProducaoGeralTx } from "./producao-geral-consulta.js";
it("usa a classificação vigente e deixa apenas a ordenha sem aferição como pendente", async () => {
  const tanque = {
    id: "tanque",
    identidadeId: "tanque",
    ativo: true,
    versao: 1,
    nome: "Tanque 3000",
    vigenteDesde: new Date("2026-10-01"),
  };
  const tx = {
    tanqueLeite: { findMany: vi.fn(async () => [tanque, { ...tanque, id: "outro", identidadeId: "outro", nome: "Tanque opcional" }]) },
    diaProducaoLeite: {
      findUniqueOrThrow: vi.fn(async () => ({ propriedadeId: 1 })),
    },
    medicaoGeralLeite: {
      findMany: vi.fn(async () => [
        {
          tanqueId: "tanque",
          sessaoId: "manha",
          animaisOrigem: ["animal"],
          natureza: "COMERCIAL",
          litros: new Prisma.Decimal(200),
          entradasEstoque: [
            { id: "entrada", classificacoes: [{ natureza: "NAO_COMERCIAL" }] },
          ],
        },
      ]),
    },
  };
  const linhas = await linhasProducaoGeralTx(
    tx as unknown as Prisma.TransactionClient,
    [
      {
        id: "dia",
        dataOperacional: new Date("2026-10-01"),
        configuracao: { fonteProducao: "GERAL" },
        sessoes: [
          { id: "manha", posicaoId: "manha", nome: "Manhã" },
          { id: "tarde", posicaoId: "tarde", nome: "Tarde" },
        ],
      },
    ],
  );
  expect(linhas).toMatchObject([
    {
      natureza: "NAO_COMERCIAL",
      litros: 200,
      confirmada: true,
      animalId: null,
    },
    { litros: null, estado: "PENDENTE", confirmada: false },
  ]);
  expect(linhas).toHaveLength(2);
  expect(linhas[0].tanqueId).toBe("tanque");
  expect(linhas[1].tanqueId).toBeNull();
  expect(tx.medicaoGeralLeite.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      include: {
        entradasEstoque: {
          where: { status: "CONFIRMADA" },
          select: {
            id: true,
            classificacoes: {
              orderBy: { versao: "desc" },
              take: 1,
              select: { natureza: true },
            },
          },
        },
      },
    }),
  );
});
