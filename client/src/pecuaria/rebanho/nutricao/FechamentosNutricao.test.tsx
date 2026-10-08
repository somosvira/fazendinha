// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FechamentosNutricao } from "./FechamentosNutricao";
import * as api from "./api";
vi.mock("../api", () => ({ listarLotes: vi.fn().mockResolvedValue([]) }));
vi.mock("./api", () => ({ listarFechamentos: vi.fn() }));
beforeEach(() => { window.history.replaceState(null, "", "/pecuaria/nutricao?aba=fechamentos"); vi.clearAllMocks(); vi.mocked(api.listarFechamentos).mockResolvedValue({ itens: [], total: 51, pagina: 1, limite: 25 }); });
afterEach(cleanup);
describe("fechamentos gerais", () => {
  it("consulta todos os lotes, pagina e aplica situação no servidor", async () => {
    render(<FechamentosNutricao />);
    await screen.findByText(/Página 1 · 51 fechamentos/);
    expect(api.listarFechamentos).toHaveBeenCalledWith(undefined, 1, undefined);
    fireEvent.click(screen.getByRole("button", { name: "Mais fechamentos" }));
    await screen.findByText(/Página 2 · 51 fechamentos/);
    expect(api.listarFechamentos).toHaveBeenLastCalledWith(undefined, 2, undefined);
    expect(new URLSearchParams(window.location.search).get("paginaFechamentos")).toBe("2");
    fireEvent.change(screen.getByLabelText("Situação"), { target: { value: "ESTORNADO" } });
    await waitFor(() => expect(api.listarFechamentos).toHaveBeenLastCalledWith(undefined, 1, "ESTORNADO"));
  });
  it("restaura lote, situação e página por deep link", async () => {
    window.history.replaceState(null, "", "/pecuaria/nutricao?aba=fechamentos&filtroLoteId=lote&statusFechamento=CONFIRMADO&paginaFechamentos=2");
    render(<FechamentosNutricao />);
    await screen.findByText(/Página 2 · 51 fechamentos/);
    expect(api.listarFechamentos).toHaveBeenCalledWith("lote", 2, "CONFIRMADO");
  });
  it("fixa o lote no seu detalhe e oferece recuperação de falha", async () => {
    vi.mocked(api.listarFechamentos).mockRejectedValueOnce(new Error("Falha de rede"));
    render(<FechamentosNutricao loteId="lote" />);
    await screen.findByText("Falha de rede");
    expect(screen.queryByLabelText("Lote")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByText(/Página 1 · 51 fechamentos/);
    expect(api.listarFechamentos).toHaveBeenLastCalledWith("lote", 1, undefined);
  });
});
