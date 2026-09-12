import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  periodo: vi.fn(),
  parceiro: vi.fn(),
  conta: vi.fn(),
  transacaoCreate: vi.fn(),
}));

vi.mock("../../db.js", () => {
  const tx = {
    periodoFinanceiro: { findUnique: mocks.periodo },
    parceiro: { findFirst: mocks.parceiro },
    contaFinanceira: { findFirst: mocks.conta },
    transacaoFinanceira: { create: mocks.transacaoCreate },
  };
  mocks.transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx));
  return { prisma: { $transaction: mocks.transaction } };
});

import { criarOperacao, criarTransacaoAvulsa, transferir } from "./operacoes.js";

describe("operações financeiras — cadastros ativos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.periodo.mockResolvedValue(null);
    mocks.parceiro.mockResolvedValue(null);
    mocks.conta.mockResolvedValue(null);
  });

  it("recusa criar operação com parceiro inativo", async () => {
    await expect(criarOperacao({
      tipo: "SERVICO",
      data: new Date("2026-09-10T00:00:00Z"),
      descricao: "Serviço veterinário",
      valorTotal: 100,
      parceiroId: 7,
      propriedadeId: 1,
      itens: [],
      financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" },
    })).rejects.toMatchObject({ code: "NAO_ENCONTRADO", campo: "parceiroId" });
    expect(mocks.transacaoCreate).not.toHaveBeenCalled();
  });

  it("recusa criar transação avulsa com parceiro inativo", async () => {
    await expect(criarTransacaoAvulsa({
      tipo: "PAGAMENTO",
      contaId: 1,
      valor: 100,
      data: new Date("2026-09-10T00:00:00Z"),
      descricao: "Pagamento avulso",
      parceiroId: 7,
      propriedadeId: 1,
    })).rejects.toMatchObject({ code: "NAO_ENCONTRADO", campo: "parceiroId" });
    expect(mocks.transacaoCreate).not.toHaveBeenCalled();
  });

  it("recusa transferência com conta inativa", async () => {
    await expect(transferir({
      contaOrigemId: 1,
      contaDestinoId: 2,
      valor: 100,
      data: new Date("2026-09-10T00:00:00Z"),
      propriedadeId: 1,
    })).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    expect(mocks.transacaoCreate).not.toHaveBeenCalled();
  });
});
