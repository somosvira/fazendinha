// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { GestaoMensal } from "./GestaoMensal";
import * as api from "./mensal-api";
vi.mock("./mensal-api", () => ({
  statusMensal: vi.fn(),
  configuracoesMensais: vi.fn(),
  mesesNutricionais: vi.fn(),
  mesNutricional: vi.fn(),
  salvarConfiguracaoMensal: vi.fn(),
  confirmarMensal: vi.fn(),
  reprocessarMensal: vi.fn(),
}));
vi.mock("../api", () => ({ listarLotes: vi.fn(async () => []) }));
vi.mock("../../../api/propriedades", () => ({
  listarPropriedades: vi.fn(async () => [{ id: 1, nome: "Escola" }]),
}));
vi.mock("../../../propriedadeScope", () => ({ getPropriedadeAtiva: () => 1 }));
vi.mock("../../../estoque/SelecaoPartidas", () => ({
  SelecaoPartidas: () => null,
}));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/pecuaria/nutricao?aba=configuracao");
  vi.mocked(api.statusMensal).mockResolvedValue({
    habilitada: true,
    automacao: false,
  });
  vi.mocked(api.configuracoesMensais).mockResolvedValue([]);
  vi.mocked(api.mesesNutricionais).mockResolvedValue({ itens: [], total: 0 });
});
describe("configuração nutricional", () => {
  it("explica os três modelos e envia o dia exato e o escopo", async () => {
    render(<GestaoMensal vista="configuracao" podeLancar />);
    await screen.findByText("Como dar baixa no estoque");
    expect(screen.getByText("Vale a partir de")).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(
      (
        screen.getByRole("radio", {
          name: /Baixa automática diária/,
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    fireEvent.change(screen.getByLabelText(/Dia da conferência/), { target: { value: "31" } });
    fireEvent.click(screen.getByRole("button", { name: "Revisar configuração" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar configuração" }),
    );
    await waitFor(() =>
      expect(api.salvarConfiguracaoMensal).toHaveBeenCalledWith(
        expect.objectContaining({
          propriedadeId: 1,
          loteId: null,
          modelo: "AUTOMATICO",
          diaConferencia: 31,
          autorizaValidade: false,
        }),
      ),
    );
  });
  it("não oferece escrita ao perfil de consulta", async () => {
    render(<GestaoMensal vista="configuracao" podeLancar={false} />);
    await screen.findByText("Seu perfil pode consultar as configurações.");
    expect(
      screen.queryByRole("button", { name: "Confirmar configuração" }),
    ).toBeNull();
  });
  it("pede filtro de alertas ao servidor antes da paginação", async () => {
    render(<GestaoMensal vista="alertas" podeLancar={false} />);
    // Sem meses pendentes a seção some; a consulta continua filtrada no servidor.
    await waitFor(() => expect(api.mesesNutricionais).toHaveBeenCalledWith(1, undefined, true));
    expect(screen.queryByText("Meses para conferir")).toBeNull();
  });
  it("preserva os campos após falha e não duplica submissão concorrente", async () => {
    let rejeitar!: (e: Error) => void;
    vi.mocked(api.salvarConfiguracaoMensal).mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejeitar = reject;
        }),
    );
    render(<GestaoMensal vista="configuracao" podeLancar />);
    await screen.findByRole("button", { name: "Revisar configuração" });
    fireEvent.change(screen.getByLabelText(/Dia da conferência/), { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: "Revisar configuração" }));
    const botao = screen.getByRole("button", { name: "Confirmar configuração" });
    fireEvent.click(botao);
    fireEvent.click(botao);
    expect(api.salvarConfiguracaoMensal).toHaveBeenCalledTimes(1);
    rejeitar(new Error("Falha de rede"));
    await screen.findByText("Falha de rede");
    expect((screen.getByLabelText(/Dia da conferência/) as HTMLInputElement).value).toBe("9");
  });
});
