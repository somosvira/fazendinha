import { Prisma } from "@prisma/client";
import { expect, it, vi } from "vitest";
import { criarFechamentoPeriodoLeiteTx } from "./operacoes.js";
import { operacaoSchema } from "./schemas.js";
vi.mock("../../db.js", () => ({ prisma: {} }));
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
it("executor financeiro fecha coletas prévias com recebível e nenhuma nova saída", async () => {
  const tx = {
    $executeRaw: vi.fn(),
    periodoFinanceiro: { findUnique: vi.fn(async () => null) },
    parceiro: {
      findFirst: vi.fn(async () => ({ tipo: "CLIENTE", papeis: [] })),
    },
    operacaoComercialLeite: {
      findFirst: vi.fn(async () => ({
        id: id(1),
        parceiroId: id(2),
        retiradas: [{ id: id(3) }, { id: id(4) }],
      })),
    },
    centroCusto: {
      findMany: vi.fn(async () => [{ id: id(5), nome: "Leite" }]),
    },
    movimentoEstoque: { groupBy: vi.fn(async () => []), create: vi.fn() },
    compromissoFinanceiro: { create: vi.fn() },
    transacaoFinanceira: { create: vi.fn() },
    auditoriaFinanceira: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(),
    },
    operacao: {
      create: vi.fn(
        async ({ data }: { data: { itens: { create: unknown[] } } }) => ({
          id: id(6),
          itens: data.itens.create,
        }),
      ),
      findUniqueOrThrow: vi.fn(async () => ({
        id: id(6),
        itens: [],
        movimentosEstoque: [],
      })),
    },
  };
  const input = {
    ...operacaoSchema.parse({
      chave: id(7),
      tipo: "VENDA",
      descricao: "Fechamento de leite",
      data: "2026-10-19",
      parceiroId: id(2),
      centroCustoId: id(5),
      itens: [
        {
          descricao: "Leite reconhecido",
          quantidade: 250,
          unidade: "L",
          valorTotal: 625,
        },
      ],
      financeiro: {
        condicao: "A_PRAZO",
        parcelas: [{ valor: 625, dataVencimento: "2026-10-30" }],
      },
    }),
    propriedadeId: 7,
  };
  await criarFechamentoPeriodoLeiteTx(
    tx as unknown as Prisma.TransactionClient,
    input,
    id(1),
  );
  expect(tx.compromissoFinanceiro.create).toHaveBeenCalledTimes(1);
  expect(tx.compromissoFinanceiro.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        operacaoId: id(6),
        tipo: "RECEBER",
        valorOriginal: new Prisma.Decimal(625),
      }),
    }),
  );
  expect(tx.movimentoEstoque.create).not.toHaveBeenCalled();
  expect(tx.transacaoFinanceira.create).not.toHaveBeenCalled();
  await expect(
    criarFechamentoPeriodoLeiteTx(
      tx as unknown as Prisma.TransactionClient,
      { ...input, itens: [{ ...input.itens[0], produtoId: id(8) }] },
      id(1),
    ),
  ).rejects.toThrow(/retiradas existentes/);
  expect(tx.operacao.create).toHaveBeenCalledTimes(1);
});
