// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { DietasNutricionais } from "./DietasNutricionais";
import * as api from "./api";
vi.mock("./api", async (original) => ({ ...await original<typeof import("./api")>(), listarDietas: vi.fn(), listarProdutosNutricionais: vi.fn(), criarDieta: vi.fn(), editarDieta: vi.fn(), criarVersaoDieta: vi.fn(), publicarDieta: vi.fn(), excluirDieta: vi.fn(), alterarEstadoDieta: vi.fn() }));
const dieta: api.Dieta = { id: "d1", nome: "Dieta leite", versao: 1, ativo: true, publicadaEm: "2026-10-01", podeExcluir: false, itens: [{ produtoId: "p1", quantidadeCabecaDia: "12", unidade: "KG", produto: { nome: "Silagem" } }] };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(api.listarDietas).mockResolvedValue([dieta]); vi.mocked(api.listarProdutosNutricionais).mockResolvedValue([{ id: "p1", nome: "Silagem", unidade: "KG", rastrearPartidas: false }]); });
afterEach(cleanup);
describe("dietas nutricionais", () => {
  it("consulta dietas sem exigir lote e esconde escritas de perfil somente leitura", async () => {
    render(<DietasNutricionais podeLancar={false} />);
    await screen.findAllByText("Dieta leite");
    expect(screen.queryByRole("button", { name: "Nova dieta" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Nova versão" })).toBeNull();
    expect(api.listarProdutosNutricionais).not.toHaveBeenCalled();
  });
  it("cria versão por ação explícita e edita o novo rascunho, preservando a original", async () => {
    vi.mocked(api.criarVersaoDieta).mockResolvedValue({ ...dieta, id: "d2", versao: 2, publicadaEm: null });
    render(<DietasNutricionais podeLancar />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Nova versão" }))[0]);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    const painel = await screen.findByRole("dialog", { name: "Editar dieta · v2" });
    expect(api.criarVersaoDieta).toHaveBeenCalledWith("d1");
    fireEvent.change(within(painel).getByLabelText("Quantidade por cabeça/dia 1"), { target: { value: "13,5" } });
    fireEvent.submit(document.getElementById("form-dieta")!);
    await waitFor(() => expect(api.editarDieta).toHaveBeenCalledWith("d2", { nome: "Dieta leite", itens: [{ produtoId: "p1", quantidadeCabecaDia: 13.5 }] }));
    expect(api.criarDieta).not.toHaveBeenCalled();
    expect(dieta.itens[0].quantidadeCabecaDia).toBe("12");
  });
  it("mantém dados e foca erro; criar dieta nunca chama criação de versão", async () => {
    render(<DietasNutricionais podeLancar />);
    fireEvent.click(await screen.findByRole("button", { name: "Nova dieta" }));
    fireEvent.submit(document.getElementById("form-dieta")!);
    expect(document.activeElement).toBe(screen.getByLabelText("Nome da dieta"));
    fireEvent.change(screen.getByLabelText("Nome da dieta"), { target: { value: "Recria" } });
    fireEvent.change(screen.getByLabelText("Ingrediente 1"), { target: { value: "p1" } });
    fireEvent.change(screen.getByLabelText("Quantidade por cabeça/dia 1"), { target: { value: "2" } });
    vi.mocked(api.criarDieta).mockRejectedValueOnce(new Error("Já existe dieta com este nome. Use Nova versão."));
    fireEvent.submit(document.getElementById("form-dieta")!);
    await screen.findAllByText(/Já existe dieta/);
    expect(screen.getByLabelText("Nome da dieta")).toHaveProperty("value", "Recria");
    expect(api.criarVersaoDieta).not.toHaveBeenCalled();
  });
});
