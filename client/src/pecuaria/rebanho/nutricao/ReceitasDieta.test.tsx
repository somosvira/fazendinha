// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReceitasDieta } from "./ReceitasDieta";
import * as api from "./api";
vi.mock("./api", () => ({ listarDietas: vi.fn(), listarProdutosNutricionais: vi.fn(), listarCentrosNutricionais: vi.fn(), criarDieta: vi.fn(), editarDieta: vi.fn(), publicarDieta: vi.fn() }));
const dieta = (id: string, publicadaEm: string | null): api.Dieta => ({ id, nome: "Dieta de lactação", versao: publicadaEm ? 1 : 2, publicadaEm, itens: [{ produtoId: "milho", quantidadeCabecaDia: "3.5", unidade: "KG", materiaSecaPercentualSnapshot: "85", produto: { nome: "Milho" } }] });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.listarDietas).mockResolvedValue([dieta("publicada", "2026-10-01"), dieta("rascunho", null)]);
  vi.mocked(api.listarProdutosNutricionais).mockResolvedValue([{ id: "milho", nome: "Milho", unidade: "KG" }] as api.ProdutoNutricional[]);
  vi.mocked(api.listarCentrosNutricionais).mockResolvedValue([]);
});
afterEach(cleanup);
describe("gestão compartilhada de receitas", () => {
  it("editar rascunho salva a mesma versão; nova versão não altera a publicada", async () => {
    render(<ReceitasDieta podeLancar />);
    fireEvent.click(await screen.findByRole("button", { name: "Editar rascunho" }));
    expect(screen.getByLabelText("Nome da dieta")).toHaveProperty("value", "Dieta de lactação");
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
    await waitFor(() => expect(api.editarDieta).toHaveBeenCalledWith("rascunho", { nome: "Dieta de lactação", itens: [{ produtoId: "milho", quantidadeCabecaDia: 3.5 }] }));
    fireEvent.click(screen.getByRole("button", { name: "Criar nova versão a partir desta" }));
    fireEvent.click(screen.getByRole("button", { name: "Criar rascunho" }));
    await waitFor(() => expect(api.criarDieta).toHaveBeenCalledWith({ nome: "Dieta de lactação", itens: [{ produtoId: "milho", quantidadeCabecaDia: 3.5 }] }));
    expect(api.editarDieta).toHaveBeenCalledTimes(1);
  });
  it("cancelar preserva a lista e publicar só atua no rascunho", async () => {
    render(<ReceitasDieta podeLancar />);
    fireEvent.click(await screen.findByRole("button", { name: "Criar nova versão a partir desta" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByLabelText("Nome da dieta")).toBeNull();
    expect(screen.getByText("Publicada")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Publicar" }));
    await waitFor(() => expect(api.publicarDieta).toHaveBeenCalledWith("rascunho"));
    expect(api.criarDieta).not.toHaveBeenCalled();
    expect(api.editarDieta).not.toHaveBeenCalled();
  });
  it("leitura mantém versões e ingredientes sem ações de escrita", async () => {
    render(<ReceitasDieta podeLancar={false} />);
    await screen.findByText("Publicada");
    expect(screen.getAllByText(/Milho · 3.5 KG\/cabeça\/dia · MS 85%/)).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Nova receita" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Publicar" })).toBeNull();
    expect(screen.queryByLabelText("Nome da dieta")).toBeNull();
  });
});
