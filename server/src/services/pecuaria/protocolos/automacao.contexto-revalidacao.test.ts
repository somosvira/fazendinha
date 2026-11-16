import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  transacao: vi.fn(),
  trava: vi.fn(),
  participacao: vi.fn(),
  usuario: vi.fn(),
  tarefas: vi.fn(),
  criar: vi.fn(),
}));
vi.mock("../transacao.js", () => ({ transacaoPecuaria: m.transacao }));
vi.mock("../rebanho/regras.js", async (original) => ({
  ...(await original<object>()),
  travarAnimais: m.trava,
}));
import { ativarAutomacao } from "./automacao.js";
const id = "9192047d-ab87-4ff6-bbc7-f7c6702eb83a";
const entrada = {
  propriedadeId: 1,
  participacaoId: id,
  momentoId: id,
  itens: [
    {
      tipo: "APLICACAO",
      tarefaId: id,
      animalId: id,
      propriedadeId: 1,
      data: "2026-11-01",
      origemInsumo: "SEM_ORIGEM_JUSTIFICADA",
      justificativaSemOrigem: "Registro documentado para revisão",
      nomeProdutoAplicado: "Medicamento",
      dose: "1",
      unidadeDose: "ML",
    },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  m.usuario.mockResolvedValue({
    id: 9,
    status: "ATIVO",
    dono: true,
    abas: [],
    flags: [],
  });
  const tx = {
    usuario: { findUnique: m.usuario },
    participacaoProtocolo: { findFirst: m.participacao },
    tarefaProtocolo: { findMany: m.tarefas },
    automacaoProtocolo: { create: m.criar },
  };
  m.transacao.mockImplementation(
    (executar: (t: typeof tx) => Promise<unknown>) => executar(tx),
  );
});
describe("revalidação de automação após trava do animal", () => {
  it.each([
    { bloqueadaEm: new Date(), canceladaEm: null },
    { bloqueadaEm: null, canceladaEm: new Date() },
  ])("recusa estado alterado enquanto aguardava a trava %j", async (estado) => {
    m.participacao
      .mockResolvedValueOnce({ animalId: id })
      .mockResolvedValueOnce({
        id,
        animalId: id,
        protocolo: { tipo: "REPRODUTIVO" },
        rodada: null,
        ...estado,
      });
    await expect(ativarAutomacao(entrada, 9)).rejects.toThrow(
      /bloqueada|encerrada/,
    );
    expect(m.participacao).toHaveBeenCalledTimes(2);
    expect(m.participacao.mock.invocationCallOrder[1]).toBeGreaterThan(
      m.trava.mock.invocationCallOrder[0],
    );
    expect(m.tarefas).not.toHaveBeenCalled();
    expect(m.criar).not.toHaveBeenCalled();
  });
});
