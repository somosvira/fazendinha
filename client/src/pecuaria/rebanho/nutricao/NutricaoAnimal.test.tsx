// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NutricaoAnimal } from "./NutricaoAnimal";
import { consultarConsumoAnimal, type ConsumoAnimal } from "./api";
vi.mock("./api", () => ({ consultarConsumoAnimal: vi.fn() }));
const consumo: ConsumoAnimal = { id: "fechamento", animalId: "animal", animal: { brinco: "RN1" }, inicio: "2026-09-01", fim: "2026-09-10", status: "CONFIRMADO", lote: { id: "lote", nome: "Recria" }, dieta: { nome: "Ração", versao: 1 }, propriedadeId: 1, dias: 10, custoConhecido: "20.00", custoConhecidoPorDia: "2.0000", coberturaCustoCompleta: false,
  itens: [{ produtoId: "produto", nome: "Silagem", unidade: "KG", quantidadeAtribuida: "10.000", quantidadePorDia: "1.000000", custoConhecido: "20.00" }] };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(consultarConsumoAnimal).mockResolvedValue({ itens: [consumo], total: 121, pagina: 1, limite: 25, verValores: true }); });
afterEach(cleanup);
describe("nutrição individual", () => {
  it("mostra parcela, custo incompleto, dias e origem; permite paginar o histórico", async () => {
    render(<NutricaoAnimal animalId="animal" />);
    await screen.findByRole("rowheader", { name: "Silagem" });
    expect(screen.getByRole("cell", { name: "10 KG" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Média por dia" })).toBeTruthy();
    expect(screen.getByText(/cobertura incompleta/)).toBeTruthy();
    const link = screen.getByRole("link", { name: /Abrir fechamento do lote/ });
    expect(link.getAttribute("href")).toContain("fechamentoId=fechamento");
    expect(link.closest("header")).toBeTruthy();
    const recolher = screen.getByRole("button", { name: "Ração · versão 1" });
    fireEvent.click(recolher);
    expect(recolher.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("rowheader", { name: "Silagem" })).toBeNull();
    expect(screen.getByRole("link", { name: /Abrir fechamento do lote/ })).toBeTruthy();
    fireEvent.click(recolher);
    fireEvent.click(screen.getByText("Próxima"));
    await waitFor(() => expect(consultarConsumoAnimal).toHaveBeenLastCalledWith("animal", 2));
  });
  it("preserva consumo estornado e omite valores sem autorização", async () => {
    vi.mocked(consultarConsumoAnimal).mockResolvedValue({ itens: [{ ...consumo, status: "ESTORNADO", custoConhecido: null, custoConhecidoPorDia: null }], total: 1, pagina: 1, limite: 25, verValores: false });
    render(<NutricaoAnimal animalId="animal" />);
    await screen.findByText(/Estornado — fora do consumo atual/);
    expect(screen.queryByText(/R\$/)).toBeNull();
    expect(screen.queryByText(/Custo conhecido/)).toBeNull();
  });
  it("mostra erro com recuperação e estado vazio com caminho para conferir", async () => {
    vi.mocked(consultarConsumoAnimal).mockRejectedValueOnce(new Error("Não foi possível consultar o consumo"));
    render(<NutricaoAnimal animalId="animal" />);
    await screen.findByText("Não foi possível consultar o consumo");
    vi.mocked(consultarConsumoAnimal).mockResolvedValue({ itens: [], total: 0, pagina: 1, limite: 25, verValores: false });
    fireEvent.click(screen.getByText("Tentar novamente"));
    await screen.findByText(/Ainda sem consumo conferido/);
    expect(screen.getByText("Conferir consumo do lote")).toBeTruthy();
  });
});
