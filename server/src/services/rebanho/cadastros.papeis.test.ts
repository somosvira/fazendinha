import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), update: vi.fn() }));
vi.mock("../../db.js", () => ({ prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn({ parceiro: mocks }) } }));
import { editarFornecedor } from "./cadastros.js";

describe("compatibilidade dos papéis no cadastro legado de fornecedores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue({ id: 1, nome: "Oficina", tipo: "FORNECEDOR", papeis: [{ papel: "PRESTADOR_SERVICO" }] });
    mocks.update.mockResolvedValue({ id: 1, nome: "Oficina", tipo: "FORNECEDOR", ativo: true });
  });
  it("salvar nome com o mesmo tipo legado não promove prestador a fornecedor", async () => {
    await editarFornecedor(1, { nome: "Oficina nova", tipo: "FORNECEDOR" });
    expect(mocks.update.mock.calls[0][0].data.papeis).toBeUndefined();
  });
  it("alterar o papel comercial mantém o papel de prestador", async () => {
    await editarFornecedor(1, { tipo: "AMBOS" });
    expect(mocks.update.mock.calls[0][0].data.papeis).toEqual({ deleteMany: {}, create: [{ papel: "PRESTADOR_SERVICO" }, { papel: "CLIENTE" }, { papel: "FORNECEDOR" }] });
  });
});
