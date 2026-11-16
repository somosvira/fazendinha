import { beforeEach, describe, expect, it, vi } from "vitest";
import { uid } from "../../lib/uid.fixture.js";

const mocks = vi.hoisted(() => ({ transaction: vi.fn(), periodo: vi.fn(), operacaoCreate: vi.fn() }));

vi.mock("../../db.js", () => {
  const tx = { periodoFinanceiro: { findUnique: mocks.periodo }, operacao: { create: mocks.operacaoCreate, findFirst: vi.fn().mockResolvedValue(null) } };
  mocks.transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx));
  return { prisma: { $transaction: mocks.transaction } };
});

import { criarOperacao } from "./operacoes.js";

const base = {
  data: new Date("2026-09-10T00:00:00Z"),
  descricao: "Teste",
  valorTotal: 100,
  propriedadeId: 1,
  financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" },
  itens: [{ descricao: "Item", quantidade: 1, unidade: "UN", valorTotal: 100, estocavel: true, produtoCatalogoId: uid(2) }],
};

describe("operações financeiras — catálogo só em entradas de estoque", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.periodo.mockResolvedValue(null); });

  it.each(["VENDA", "CONSUMO", "SERVICO", "DESPESA", "PERDA"])("recusa produtoCatalogoId em %s", async (tipo) => {
    await expect(criarOperacao({ ...base, tipo, itens: base.itens } as never)).rejects.toMatchObject({ code: "VALIDACAO", campo: "itens.0.produtoCatalogoId" });
    expect(mocks.operacaoCreate).not.toHaveBeenCalled();
    expect(mocks.periodo).not.toHaveBeenCalled();
  });
});
