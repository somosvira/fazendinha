// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Transcricao } from "./TranscricaoVisita";
import {
  confirmarVisita,
  salvarRascunhoVisita,
  type AtividadeVisita,
  type Visita,
} from "./visitas-api";
import { reqV4 } from "./api";
vi.mock("./api", () => ({
  obterReproducao: vi
    .fn()
    .mockResolvedValue({
      animais: [],
      tentativas: [],
      avaliacoes: [],
      partos: [],
      restricoes: [],
    }),
  reqV4: vi.fn(),
}));
vi.mock("./visitas-api", async (original) => ({
  ...(await original<typeof import("./visitas-api")>()),
  confirmarVisita: vi.fn(),
  salvarRascunhoVisita: vi.fn(),
  obterSugestoesVisita: vi
    .fn()
    .mockResolvedValue({
      animais: [],
      tarefasSanitarias: [],
      tarefasIatf: [],
      protocolosSanitarios: [],
      protocolosIatf: [],
    }),
}));
const atividade: AtividadeVisita = {
  id: "at",
  nome: "Diagnóstico",
  tipo: "AVALIACAO_REPRODUTIVA",
  extra: false,
  participantes: [
    {
      id: "p",
      animalId: "a",
      ordem: 1,
      status: "PENDENTE",
      rascunho: {
        resultado: "NAO_AVALIADO",
        anotacaoOriginal: "Não estava no curral",
      },
      snapshot: { brinco: "100" },
    },
  ],
};
const visita: Visita = {
  id: "v",
  nome: "Visita",
  data: "2026-10-13",
  propriedadeId: 1,
  status: "ABERTA",
  atividades: [atividade],
  impressoes: [],
};
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/pecuaria/visitas/v");
  vi.mocked(reqV4).mockResolvedValue({
    fingerprint: "a".repeat(64),
    participantes: [],
  });
  vi.mocked(salvarRascunhoVisita).mockResolvedValue({});
});
describe("confirmação da transcrição", () => {
  it("resposta perdida repete o mesmo envelope sem regravar rascunho já confirmado", async () => {
    vi.mocked(confirmarVisita)
      .mockRejectedValueOnce(new Error("Resposta perdida"))
      .mockResolvedValueOnce({});
    const mudou = vi.fn().mockResolvedValue(undefined);
    render(
      <Transcricao
        visita={visita}
        atividade={atividade}
        podeLancar
        onMudou={mudou}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar animal" }));
    await screen.findByText("Resposta perdida");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar animal" }));
    await waitFor(() => expect(mudou).toHaveBeenCalled());
    expect(confirmarVisita).toHaveBeenCalledTimes(2);
    expect(vi.mocked(confirmarVisita).mock.calls[1][2]).toEqual(
      vi.mocked(confirmarVisita).mock.calls[0][2],
    );
    expect(salvarRascunhoVisita).toHaveBeenCalledTimes(1);
    expect(vi.mocked(confirmarVisita).mock.calls[0][2].itens).toEqual([
      {
        participanteId: "p",
        status: "CONFIRMADO",
        motivo: undefined,
        dados: {
          resultado: "NAO_AVALIADO",
          anotacaoOriginal: "Não estava no curral",
        },
      },
    ]);
  });
  it("mudança de contexto exige revisão explícita e leva fingerprint na confirmação", async () => {
    vi.mocked(reqV4).mockResolvedValue({
      fingerprint: "b".repeat(64),
      participantes: [
        { participanteId: "p", animalId: "a", alteracoes: ["Gestação mudou"] },
      ],
    });
    vi.mocked(confirmarVisita).mockResolvedValue({});
    render(
      <Transcricao
        visita={visita}
        atividade={atividade}
        podeLancar
        onMudou={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar animal" }));
    await screen.findByText(/100: Gestação mudou/);
    expect(confirmarVisita).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("switch", { name: /Revisei as mudanças/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar animal" }));
    await waitFor(() => expect(confirmarVisita).toHaveBeenCalled());
    expect(vi.mocked(confirmarVisita).mock.calls[0][2]).toMatchObject({
      cienciaAlteracoes: true,
      fingerprintPrevia: "b".repeat(64),
    });
  });
});
