import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const m = vi.hoisted(() => ({ produto: vi.fn(), saldos: vi.fn() }));
vi.mock("../../../db.js", () => ({
  prisma: {
    $transaction: async (f: (tx: unknown) => unknown) =>
      f({ produto: { findUnique: m.produto } }),
  },
}));
vi.mock("../../estoque/valorizacao.js", () => ({ saldosBasesTx: m.saldos }));
import { estimarModelo, estimativaModeloSchema } from "./estimativa-modelo.js";
const ref = (valorUnitario: string) => ({
  valorUnitario,
  unidade: "ML",
  origem: "Tabela documentada",
  data: "2026-01-01",
});
beforeEach(() => {
  vi.resetAllMocks();
});
it("estima por referências explícitas com Decimal, distingue zero e parcial sem consulta de saldo", async () => {
  const i = estimativaModeloSchema.parse({
    propriedadeId: 1,
    etapas: [
      {
        nome: "Aplicação",
        tipo: "APLICACAO",
        quantidade: "3",
        unidade: "ML",
        referenciasCusto: { material: ref("0.10") },
      },
      {
        nome: "Retirada",
        tipo: "RETIRADA",
        referenciasCusto: {
          servico: { ...ref("0"), unidade: "POR_ATENDIMENTO" },
        },
      },
    ],
  });
  const r = await estimarModelo(i);
  expect(r).toMatchObject({
    situacao: "PARCIAL",
    total: null,
    totalConhecido: "0.30",
    componentesPendentes: 1,
    componentesConhecidos: 2,
  });
  expect(m.saldos).not.toHaveBeenCalled();
  expect(r.referencias.itens[0]).not.toHaveProperty("tarefaId");
});
it("consulta base valorizada do sítio, converte unidade e conserva origem/data", async () => {
  m.produto.mockResolvedValue({ unidade: "L" });
  m.saldos.mockResolvedValue([
    { quantidade: new Prisma.Decimal("2"), valor: new Prisma.Decimal("20") },
  ]);
  const i = estimativaModeloSchema.parse({
    propriedadeId: 7,
    etapas: [
      {
        nome: "Produto",
        tipo: "APLICACAO",
        produtoId: "00000000-0000-4000-8000-000000000001",
        quantidade: "50",
        unidade: "ML",
      },
    ],
  });
  const r = await estimarModelo(i);
  expect(m.saldos).toHaveBeenCalledWith(
    expect.any(Object),
    i.etapas[0].produtoId,
    7,
    expect.any(Date),
  );
  expect(r).toMatchObject({ totalConhecido: "0.50", situacao: "PARCIAL" });
  expect(r.referencias.itens[0]).toMatchObject({
    origem: "Saldo valorizado atual do sítio",
    quantidade: "0.05",
    unidade: "L",
    valor: "0.50",
  });
});
it("não trata material genético não escolhido como zero e pagina sem alterar totais", async () => {
  const i = estimativaModeloSchema.parse({
    propriedadeId: 1,
    referenciasPagina: 2,
    etapas: Array.from({ length: 11 }, () => ({
      nome: "IA",
      tipo: "TENTATIVA",
    })),
  });
  const r = await estimarModelo(i);
  expect(r).toMatchObject({
    situacao: "NAO_APURADO",
    totalConhecido: null,
    componentesPendentes: 22,
    referencias: { total: 22, pagina: 2 },
  });
  expect(r.referencias.itens).toHaveLength(10);
});
