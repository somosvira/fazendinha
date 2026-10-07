import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
const { transacao } = vi.hoisted(() => ({ transacao: vi.fn() }));
vi.mock("../../db.js", () => ({ prisma: { $transaction: transacao } }));
import { transacaoEstoque } from "./transacao.js";
const conflito = () => new Prisma.PrismaClientKnownRequestError("serialização", { code: "P2034", clientVersion: "6" });
beforeEach(() => { transacao.mockReset(); });
describe("conferência serializável de lotes", () => {
  it("repete a conferência inteira no máximo três vezes", async () => {
    const conferir = vi.fn();
    transacao.mockRejectedValueOnce(conflito()).mockRejectedValueOnce(conflito()).mockResolvedValueOnce({ saldo: "40" });
    await expect(transacaoEstoque(conferir)).resolves.toEqual({ saldo: "40" });
    expect(transacao).toHaveBeenCalledTimes(3);
    expect(transacao).toHaveBeenLastCalledWith(conferir, { isolationLevel: "Serializable", timeout: 30000 });
  });
  it("não repete falha de negócio e encerra no terceiro conflito", async () => {
    transacao.mockRejectedValue(conflito());
    await expect(transacaoEstoque(vi.fn())).rejects.toMatchObject({ code: "P2034" });
    expect(transacao).toHaveBeenCalledTimes(3);
    transacao.mockReset().mockRejectedValue(new Error("Saldo insuficiente"));
    await expect(transacaoEstoque(vi.fn())).rejects.toThrow("Saldo insuficiente");
    expect(transacao).toHaveBeenCalledTimes(1);
  });
});
