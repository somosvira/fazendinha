import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const { transacao } = vi.hoisted(() => ({ transacao: vi.fn() }));
vi.mock("../../db.js", () => ({ prisma: { $transaction: transacao } }));
import { transacaoPecuaria } from "./transacao.js";

const conflito = () => new Prisma.PrismaClientKnownRequestError("serialização", { code: "P2034", clientVersion: "6" });
beforeEach(() => { transacao.mockReset(); });

describe("confirmação pecuária serializável", () => {
  it("repete a transação inteira até a terceira tentativa", async () => {
    const confirmar = vi.fn();
    transacao.mockRejectedValueOnce(conflito()).mockRejectedValueOnce(conflito()).mockResolvedValueOnce({ id: "mesmo-fato" });
    await expect(transacaoPecuaria(confirmar)).resolves.toEqual({ id: "mesmo-fato" });
    expect(transacao).toHaveBeenCalledTimes(3);
    expect(transacao).toHaveBeenLastCalledWith(confirmar, { isolationLevel: "Serializable", timeout: 30000 });
  });
  it("encerra após três conflitos e não repete erro de validação", async () => {
    transacao.mockRejectedValue(conflito());
    await expect(transacaoPecuaria(vi.fn())).rejects.toMatchObject({ code: "P2034" });
    expect(transacao).toHaveBeenCalledTimes(3);
    transacao.mockReset().mockRejectedValue(new Error("dose inválida"));
    await expect(transacaoPecuaria(vi.fn())).rejects.toThrow("dose inválida");
    expect(transacao).toHaveBeenCalledTimes(1);
  });
});
