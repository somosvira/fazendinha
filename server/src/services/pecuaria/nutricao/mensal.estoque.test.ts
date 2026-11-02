import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const mock = vi.hoisted(() => ({
  planejar: vi.fn(),
  registrar: vi.fn(),
  saldos: vi.fn(),
  travar: vi.fn(),
  cronologia: vi.fn(),
  partidas: vi.fn(),
  periodo: vi.fn(),
}));
vi.mock("../../estoque/valorizacao.js", () => ({
  planejarSaidaTx: mock.planejar,
  registrarSaidaValorizadaTx: mock.registrar,
  saldosBasesTx: mock.saldos,
  travarValorizacaoTx: mock.travar,
  previaRetroatividadeTx: mock.cronologia,
}));
vi.mock("../../estoque/partidas.js", () => ({
  prepararPartidasTx: mock.partidas,
}));
vi.mock("../../financeiro/regras.js", () => ({
  exigirPeriodoAberto: mock.periodo,
}));
import { ajustarItemTx } from "./mensal.estoque.js";
const D = (v: string | number) => new Prisma.Decimal(v);
function contexto(confirmada = 10) {
  const item = {
    id: "item",
    produtoId: "produto",
    unidade: "KG",
    confirmada: D(confirmada),
    produto: { rastrearPartidas: false, unidade: "KG" },
    dia: {
      data: new Date("2026-10-31"),
      centroCustoId: "centro",
      mes: { propriedadeId: 1, configuracao: { autorizaValidade: false } },
    },
  };
  const tx = {
    itemConsumoDiario: {
      findUniqueOrThrow: vi.fn(async () => item),
      update: vi.fn(),
    },
    centroCusto: { findFirst: vi.fn(async () => ({ id: "centro" })) },
    movimentoEstoque: {
      create: vi.fn(async (_args: unknown) => ({ id: "movimento" })),
    },
    movimentoConsumoDiario: {
      create: vi.fn(),
      findMany: vi.fn(async () => [
        {
          movimento: {
            parcelasValorizacao: [
              {
                baseId: "base",
                quantidade: D(-10),
                valorTotal: D(-20),
                base: { partidaId: null, metodo: "FIFO_AQUISICAO_V1" },
              },
            ],
          },
        },
      ]),
    },
    parcelaValorizacaoEstoque: { createMany: vi.fn() },
    partidaProduto: { findMany: vi.fn(async () => []) },
  };
  return { item, tx, db: tx as unknown as Prisma.TransactionClient };
}
beforeEach(() => {
  vi.resetAllMocks();
  mock.cronologia.mockResolvedValue({ permitido: true });
  mock.partidas.mockResolvedValue([]);
  mock.planejar.mockResolvedValue({ valorTotal: D(4), custoUnitario: D(2) });
  mock.saldos.mockResolvedValue([]);
});
describe("efeitos físicos do consumo diário", () => {
  it("não cria outro movimento para o mesmo alvo", async () => {
    const { db, tx } = contexto();
    await ajustarItemTx(db, "item", D(10), 1, "Conferência");
    expect(tx.movimentoEstoque.create).not.toHaveBeenCalled();
    expect(mock.planejar).not.toHaveBeenCalled();
  });
  it("só baixa o complemento e mantém a origem nutricional", async () => {
    const { db, tx } = contexto();
    await ajustarItemTx(db, "item", D(12), 1, "Ajuste conferido");
    expect(mock.planejar).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ quantidade: D(2), propriedadeId: 1 }),
    );
    expect(tx.movimentoEstoque.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          origem: "NUTRICAO",
          tipo: "SAIDA",
          quantidade: D(2),
          valorTotal: D(4),
        }),
      }),
    );
    expect(tx.movimentoConsumoDiario.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ quantidade: D(2), valor: D(4) }),
    });
  });
  it("recompõe quantidade e valor nas mesmas bases, sem inventar compra", async () => {
    const { db, tx } = contexto();
    await ajustarItemTx(db, "item", D(8), 1, "Correção para oito");
    expect(mock.planejar).not.toHaveBeenCalled();
    expect(tx.parcelaValorizacaoEstoque.createMany).toHaveBeenCalledWith({
      data: [
        {
          movimentoEstoqueId: "movimento",
          baseId: "base",
          ordem: 0,
          quantidade: D(2),
          valorTotal: D(4),
        },
      ],
    });
    expect(tx.movimentoConsumoDiario.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ quantidade: D(-2), valor: D(-4) }),
    });
    expect(tx.itemConsumoDiario.update).toHaveBeenCalledWith({
      where: { id: "item" },
      data: { confirmada: D(8), custoLiquido: { increment: D(-4) } },
    });
  });
  it("não escolhe partidas sem autorização", async () => {
    const { item, db, tx } = contexto(0);
    item.produto.rastrearPartidas = true;
    await expect(
      ajustarItemTx(db, "item", D(2), null, "Automático"),
    ).rejects.toThrow("Selecione");
    expect(tx.movimentoEstoque.create).not.toHaveBeenCalled();
  });
  it("mantém falta de lastro sem movimento parcial", async () => {
    const { db, tx } = contexto(0);
    mock.planejar.mockRejectedValue(new Error("Sem lastro"));
    await expect(
      ajustarItemTx(db, "item", D(2), 1, "Confirmação"),
    ).rejects.toThrow("Sem lastro");
    expect(tx.movimentoEstoque.create).not.toHaveBeenCalled();
  });
  it("impede correção em período fechado antes de gravar estoque", async () => {
    const { db, tx } = contexto();
    mock.periodo.mockRejectedValue(new Error("Período fechado"));
    await expect(
      ajustarItemTx(db, "item", D(8), 1, "Correção"),
    ).rejects.toThrow("Período fechado");
    expect(tx.movimentoEstoque.create).not.toHaveBeenCalled();
  });
});
it("valida a partida na data do consumo e valoriza na data da confirmação", async () => {
  const { db, tx, item } = contexto(0);
  item.produto.rastrearPartidas = true;
  await ajustarItemTx(db, "item", D(2), 1, "Conferência de mês anterior", [
    { partidaId: "partida", quantidade: "2" },
  ]);
  expect(mock.partidas).toHaveBeenCalledWith(
    db,
    expect.objectContaining({ data: item.dia.data }),
  );
  const criado = tx.movimentoEstoque.create.mock.calls[0][0] as unknown as {
    data: { data: Date };
  };
  expect(mock.planejar).toHaveBeenCalledWith(
    db,
    expect.objectContaining({ data: criado.data.data }),
  );
});
