// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ConferenciaSaldoLeite } from "./ConferenciaSaldoLeite";
import { consultarLeite, registrarLeite } from "./operacoes-api";
vi.mock("./operacoes-api", () => ({
  consultarLeite: vi.fn(),
  registrarLeite: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("zero observado é explícito, usa sítio resolvido e registra só conferência", async () => {
  vi.mocked(consultarLeite).mockResolvedValue({
    propriedadeId: 2,
    itens: [],
    total: 0,
    tamanho: 20,
  });
  render(
    <ConferenciaSaldoLeite
      produtoId="produto"
      data="2026-10-19"
      propriedadeId={null}
      podeLancar
    />,
  );
  fireEvent.click(
    screen.getByText("Conferência física do tanque em 2026-10-19"),
  );
  await waitFor(() => expect(consultarLeite).toHaveBeenCalled());
  fireEvent.change(screen.getByLabelText("Litros observados no tanque"), {
    target: { value: "0" },
  });
  fireEvent.change(screen.getByLabelText("Referência da medição"), {
    target: { value: "Régua conferida no tanque" },
  });
  fireEvent.change(screen.getByLabelText("Responsável pela conferência"), {
    target: { value: "Responsável da fazenda" },
  });
  fireEvent.click(
    screen.getByRole("button", {
      name: "Salvar conferência sem ajustar estoque",
    }),
  );
  await waitFor(() =>
    expect(registrarLeite).toHaveBeenCalledWith("/conferencias-saldo", 2, {
      produtoId: "produto",
      data: "2026-10-19",
      litrosObservados: 0,
      referencia: "Régua conferida no tanque",
      responsavel: "Responsável da fazenda",
      versaoEsperada: 0,
    }),
  );
  expect(vi.mocked(registrarLeite).mock.calls).toHaveLength(1);
});
