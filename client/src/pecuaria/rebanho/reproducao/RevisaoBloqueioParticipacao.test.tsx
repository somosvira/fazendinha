// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RevisaoBloqueioParticipacao } from "./RevisaoBloqueioParticipacao";
import { revisarBloqueioParticipacao } from "./revisao-impacto-api";
import { SanidadeApiError } from "../sanidade/api";
import { mudarCampo } from "@/lib/controles.fixture";
vi.mock("./revisao-impacto-api", () => ({
  revisarBloqueioParticipacao: vi.fn(),
}));
const bloqueadaEm = "2026-11-08T12:34:56.000Z";
const props = {
  participacaoId: "p",
  animal: "123 · Estrela",
  propriedadeId: 7,
  bloqueadaEm,
  motivoBloqueio: "Ocorrência exige revisão",
  aoFechar: vi.fn(),
  aoConfirmar: vi.fn(),
  aoReconsultar: vi.fn(),
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(revisarBloqueioParticipacao).mockResolvedValue({
    id: "p",
    bloqueadaEm: null,
    canceladaEm: null,
  });
});
afterEach(cleanup);
function preencher(destino = "RETOMAR") {
  mudarCampo(screen.getByLabelText("Decisão sobre a participação"), {
    target: { value: destino },
  });
  fireEvent.change(screen.getByLabelText("Motivo da revisão"), {
    target: { value: "Revisão explícita pelo responsável" },
  });
  fireEvent.click(
    screen.getByLabelText(
      "Conferi o bloqueio e confirmo a decisão sobre esta participação.",
    ),
  );
}
it("manter bloqueio fecha sem chamada e não presume decisão", () => {
  render(<RevisaoBloqueioParticipacao {...props} />);
  expect(
    screen.getByRole("button", { name: "Confirmar revisão" }),
  ).toHaveProperty("disabled", true);
  fireEvent.click(screen.getByRole("button", { name: "Manter bloqueio" }));
  expect(props.aoFechar).toHaveBeenCalledOnce();
  expect(revisarBloqueioParticipacao).not.toHaveBeenCalled();
});
it("exige motivo, ciência e timestamp esperado antes de retomar", async () => {
  render(<RevisaoBloqueioParticipacao {...props} />);
  mudarCampo(screen.getByLabelText("Decisão sobre a participação"), {
    target: { value: "RETOMAR" },
  });
  expect(
    screen.getByText(
      /Aptidão e impedimentos clínicos continuam sendo validados/,
    ),
  ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Confirmar revisão" }),
  ).toHaveProperty("disabled", true);
  fireEvent.change(screen.getByLabelText("Motivo da revisão"), {
    target: { value: "Revisão explícita pelo responsável" },
  });
  fireEvent.click(
    screen.getByLabelText(
      "Conferi o bloqueio e confirmo a decisão sobre esta participação.",
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Confirmar revisão" }));
  await vi.waitFor(() =>
    expect(props.aoConfirmar).toHaveBeenCalledWith("RETOMAR"),
  );
  expect(revisarBloqueioParticipacao).toHaveBeenCalledWith("p", {
    propriedadeId: 7,
    bloqueadaEm,
    destino: "RETOMAR",
    motivo: "Revisão explícita pelo responsável",
    chave: expect.any(String),
  });
});
it("retirada tem decisão própria e conserva cuidado físico do dispositivo", async () => {
  render(<RevisaoBloqueioParticipacao {...props} />);
  preencher("RETIRAR");
  expect(
    screen.getByText(
      /Dispositivos instalados continuam exigindo retirada física/,
    ),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar revisão" }));
  await vi.waitFor(() =>
    expect(props.aoConfirmar).toHaveBeenCalledWith("RETIRAR"),
  );
});
it("erro transitório conserva rascunho e chave para repetir a confirmação", async () => {
  vi.mocked(revisarBloqueioParticipacao).mockRejectedValueOnce(
    Error("Falha temporária"),
  );
  render(<RevisaoBloqueioParticipacao {...props} />);
  preencher();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar revisão" }));
  await screen.findByText("Falha temporária");
  expect(screen.getByLabelText("Motivo da revisão")).toHaveProperty(
    "value",
    "Revisão explícita pelo responsável",
  );
  fireEvent.click(screen.getByRole("button", { name: "Confirmar revisão" }));
  await vi.waitFor(() => expect(props.aoConfirmar).toHaveBeenCalledOnce());
  expect(vi.mocked(revisarBloqueioParticipacao).mock.calls[1]).toEqual(
    vi.mocked(revisarBloqueioParticipacao).mock.calls[0],
  );
});
it("conflito exige nova leitura e não reenvia decisão com bloqueio obsoleto", async () => {
  vi.mocked(revisarBloqueioParticipacao).mockRejectedValue(
    new SanidadeApiError("O bloqueio mudou; confira novamente", "CONFLITO"),
  );
  render(<RevisaoBloqueioParticipacao {...props} />);
  preencher();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar revisão" }));
  await screen.findByText("O bloqueio mudou; confira novamente");
  expect(
    screen.queryByRole("button", { name: "Confirmar revisão" }),
  ).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Fechar e atualizar participações" }),
  );
  expect(props.aoReconsultar).toHaveBeenCalledOnce();
  expect(revisarBloqueioParticipacao).toHaveBeenCalledOnce();
  expect(props.aoConfirmar).not.toHaveBeenCalled();
});
