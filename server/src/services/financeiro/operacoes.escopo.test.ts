import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ compromisso: vi.fn(), criarTransacao: vi.fn() }));
vi.mock("../../db.js", () => ({ prisma: { $transaction: async (fn: (tx: unknown) => unknown) => fn({ compromissoFinanceiro: { findUnique: mocks.compromisso }, transacaoFinanceira: { create: mocks.criarTransacao } }) } }));
import { liquidarCompromisso } from "./operacoes.js";
beforeEach(() => vi.clearAllMocks());
it("liquidação rejeita compromisso de outro sítio antes de calcular saldo ou gravar", async () => {
  mocks.compromisso.mockResolvedValue({ id: "compromisso", operacao: { propriedadeId: 2 } });
  await expect(liquidarCompromisso("compromisso", { propriedadeId: 1, contaId: "conta", data: new Date(), valor: 1 })).rejects.toMatchObject({ code: "NAO_ENCONTRADO", message: "Compromisso não encontrado neste sítio" });
  expect(mocks.criarTransacao).not.toHaveBeenCalled();
});
