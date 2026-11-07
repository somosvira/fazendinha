import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  transacao: vi.fn(),
  trava: vi.fn(),
  reconciliar: vi.fn(),
  referencia: vi.fn(),
  insercao: vi.fn(),
  criar: vi.fn(),
  auditar: vi.fn(),
}));
vi.mock("../transacao.js", () => ({ transacaoPecuaria: m.transacao }));
vi.mock("../fatos.js", () => ({ conferirAnimalNoFato: vi.fn() }));
vi.mock("../rebanho/regras.js", async (original) => ({
  ...(await original<object>()),
  travarAnimais: m.trava,
  auditar: m.auditar,
}));
vi.mock("./alertas/produtor.js", () => ({
  reconciliarAlertasReprodutivosAnimalTx: m.reconciliar,
}));
vi.mock("./operacoes.js", () => ({
  operacaoIdempotenteTx: (
    _tx: unknown,
    _input: unknown,
    _usuario: unknown,
    _tipo: unknown,
    executar: () => Promise<unknown>,
  ) => executar(),
}));
import {
  registrarRetiradaDispositivo,
  retiradaDispositivoAvulsaSchema,
} from "./retirada-dispositivo.js";
const id = "9192047d-ab87-4ff6-bbc7-f7c6702eb83a";
const input = {
  chave: id,
  propriedadeId: 1,
  realizadaEm: "2026-11-02",
  confirmarRetiradaFisica: true,
  observacao: "Dispositivo efetivamente retirado do animal",
};
beforeEach(() => {
  vi.clearAllMocks();
  m.referencia.mockResolvedValue({ animalId: "animal" });
  m.insercao.mockResolvedValue({
    id,
    data: new Date("2026-11-01"),
    aplicadaEm: null,
    precisaoTemporal: "DIA",
  });
  m.criar.mockResolvedValue({ id: "retirada" });
  const tx = {
    aplicacaoProduto: { findUnique: m.referencia, findFirst: m.insercao },
    manejoAnimal: { create: m.criar },
  };
  m.transacao.mockImplementation(
    (executar: (t: typeof tx) => Promise<unknown>) => executar(tx),
  );
});
describe("retirada física independente de programação", () => {
  it("registra fato manual sem exigir nova participação nem alterar inserção/consumo", async () => {
    expect(await registrarRetiradaDispositivo(id, input, 9)).toMatchObject({
      id: "retirada",
      insercaoAplicacaoId: id,
    });
    expect(m.criar).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tipo: "RETIRADA_DISPOSITIVO",
        insercaoAplicacaoId: id,
        animalId: "animal",
        propriedadeId: 1,
        criadoPorId: 9,
        precisaoTemporal: "DIA",
        realizadaEm: null,
      }),
    });
    expect(m.criar.mock.calls[0][0].data).not.toHaveProperty("tarefaId");
    expect(m.reconciliar).toHaveBeenCalledWith(expect.anything(), "animal", 9);
  });
  it("revalida retirada concorrente sob trava e recusa duplicação", async () => {
    m.insercao.mockResolvedValue(null);
    await expect(registrarRetiradaDispositivo(id, input, 9)).rejects.toThrow(
      "já tem retirada",
    );
    expect(m.insercao.mock.invocationCallOrder[0]).toBeGreaterThan(
      m.trava.mock.invocationCallOrder[0],
    );
    expect(m.criar).not.toHaveBeenCalled();
  });
  it("decisão administrativa não basta: exige confirmação factual, data até agora e cronologia", async () => {
    expect(
      retiradaDispositivoAvulsaSchema.safeParse({
        ...input,
        confirmarRetiradaFisica: false,
      }).success,
    ).toBe(false);
    await expect(
      registrarRetiradaDispositivo(
        id,
        { ...input, realizadaEm: "2099-01-01" },
        9,
      ),
    ).rejects.toThrow("até agora");
    await expect(
      registrarRetiradaDispositivo(
        id,
        { ...input, realizadaEm: "2026-10-01" },
        9,
      ),
    ).rejects.toThrow("anteceder");
    expect(m.criar).not.toHaveBeenCalled();
  });
});
