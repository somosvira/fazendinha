import { beforeEach, describe, expect, it, vi } from "vitest";

const { tx, criar, buscar } = vi.hoisted(() => ({
  tx: { $executeRaw: vi.fn(), requisicaoPecuaria: { findUnique: vi.fn(), create: vi.fn() } },
  criar: vi.fn(), buscar: vi.fn(),
}));
vi.mock("./transacao.js", () => ({ transacaoPecuaria: (executar: (db: unknown) => unknown) => executar(tx) }));
vi.mock("./rebanho/regras.js", async (original) => ({ ...await original<typeof import("./rebanho/regras.js")>(), travarAnimais: vi.fn() }));
import { confirmarFato } from "./idempotencia.js";

const input = { chave: "chave", animalId: "animal", propriedadeId: 2, dose: "2" };
beforeEach(() => {
  vi.clearAllMocks();
  tx.requisicaoPecuaria.findUnique.mockResolvedValue(null);
  criar.mockResolvedValue({ id: "fato", status: "VALIDO" });
  buscar.mockResolvedValue({ id: "fato", status: "ANULADO" });
});

describe("reenvio de um fato individual", () => {
  it("reserva a chave com o fato e recupera o mesmo ID mesmo após anulação", async () => {
    await expect(confirmarFato(input, 7, "APLICACAO", criar, buscar)).resolves.toMatchObject({ id: "fato" });
    const data = tx.requisicaoPecuaria.create.mock.lastCall?.[0].data;
    expect(data).toMatchObject({ chave: input.chave, propriedadeId: 2, usuarioId: 7, operacao: "APLICACAO", resultadoIds: { id: "fato" } });
    tx.requisicaoPecuaria.findUnique.mockResolvedValue(data);
    await expect(confirmarFato({ dose: "2", propriedadeId: 2, animalId: "animal", chave: "chave" }, 7, "APLICACAO", criar, buscar)).resolves.toEqual({ id: "fato", status: "ANULADO" });
    expect(criar).toHaveBeenCalledTimes(1);
    expect(buscar).toHaveBeenCalledWith(tx, "fato");
  });
  it("não reutiliza chave entre usuário, sítio, operação ou conteúdo diferentes", async () => {
    await confirmarFato(input, 7, "APLICACAO", criar, buscar);
    tx.requisicaoPecuaria.findUnique.mockResolvedValue(tx.requisicaoPecuaria.create.mock.lastCall?.[0].data);
    for (const [dados, usuario, operacao] of [[input, 8, "APLICACAO"], [{ ...input, propriedadeId: 3 }, 7, "APLICACAO"], [input, 7, "EXAME"], [{ ...input, dose: "3" }, 7, "APLICACAO"]] as const) {
      await expect(confirmarFato(dados, usuario, operacao, criar, buscar)).rejects.toThrow(/outros dados/);
    }
    expect(criar).toHaveBeenCalledTimes(1);
  });
  it("preserva criação sem chave e rejeita chave sem resultado recuperável", async () => {
    await confirmarFato({ animalId: "animal", propriedadeId: 2 }, null, "MANEJO", criar, buscar);
    expect(tx.requisicaoPecuaria.create).not.toHaveBeenCalled();
    await confirmarFato(input, null, "MANEJO", criar, buscar);
    tx.requisicaoPecuaria.findUnique.mockResolvedValue({ ...tx.requisicaoPecuaria.create.mock.lastCall?.[0].data, resultadoIds: [] });
    await expect(confirmarFato(input, null, "MANEJO", criar, buscar)).rejects.toThrow(/recuperar/);
  });
});
