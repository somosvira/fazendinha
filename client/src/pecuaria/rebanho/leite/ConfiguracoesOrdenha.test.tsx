// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ConfiguracoesOrdenha } from "./ConfiguracoesOrdenha";
import { salvarConfiguracao } from "./api";
import type { ConfiguracaoOrdenha } from "./types";
vi.mock("./api", () => ({ salvarConfiguracao: vi.fn() }));
const configuracao: ConfiguracaoOrdenha = {
  id: null,
  propriedadeId: 1,
  vigenteDesde: "1900-01-01",
  inicial: true,
  ordenhas: [
    { posicaoId: "p1", nome: "Manhã", ordem: 1, horario: null },
    { posicaoId: "p2", nome: "Tarde", ordem: 2, horario: "14:00" },
  ],
};
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(salvarConfiguracao).mockResolvedValue(configuracao);
});
describe("Configuração de ordenhas", () => {
  it("preserva identidade ao reordenar e mantém horário desconhecido nulo", async () => {
    const aoSalvar = vi.fn();
    render(
      <ConfiguracoesOrdenha
        configuracao={configuracao}
        data="2026-10-20"
        aoFechar={vi.fn()}
        aoSalvar={aoSalvar}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Mover Tarde para cima" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar configuração" }),
    );
    await waitFor(() => expect(aoSalvar).toHaveBeenCalled());
    expect(vi.mocked(salvarConfiguracao).mock.calls[0][0]).toMatchObject({
      propriedadeId: 1,
      vigenteDesde: "2026-10-20",
      ordenhas: [
        { posicaoId: "p2", nome: "Tarde", ordem: 1, horario: "14:00" },
        { posicaoId: "p1", nome: "Manhã", ordem: 2, horario: null },
      ],
    });
  });
  it("não envia nomes em branco e mantém dados após falha", async () => {
    vi.mocked(salvarConfiguracao).mockRejectedValue(
      new Error("Rotina conflitante"),
    );
    render(
      <ConfiguracoesOrdenha
        configuracao={configuracao}
        data="2026-10-20"
        aoFechar={vi.fn()}
        aoSalvar={vi.fn()}
      />,
    );
    fireEvent.change(screen.getAllByLabelText("Nome")[0], {
      target: { value: "" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar configuração" }),
    );
    await screen.findByText("Dê um nome a cada ordenha.");
    expect(salvarConfiguracao).not.toHaveBeenCalled();
    fireEvent.change(screen.getAllByLabelText("Nome")[0], {
      target: { value: "Primeira" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar configuração" }),
    );
    await screen.findByText("Rotina conflitante");
    expect(
      (screen.getAllByLabelText("Nome")[0] as HTMLInputElement).value,
    ).toBe("Primeira");
  });
});
