// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NutricaoLote } from "./NutricaoLote";
import * as api from "./api";
vi.mock("./api", () => ({ listarDietas: vi.fn(), listarVigencias: vi.fn(), listarFechamentos: vi.fn(), listarProdutosNutricionais: vi.fn(), listarCentrosNutricionais: vi.fn() }));
vi.mock("./ConferenciaPeriodos", () => ({ ConferenciaPeriodos: () => <p>Conferência do consumo</p> }));
const vigente: api.Vigencia = { id: "atual", desde: "2026-09-01", ate: "2026-11-01", dieta: { id: "d1", nome: "Dieta atual", versao: 1 } };
const programada: api.Vigencia = { id: "futura", desde: "2026-11-01", ate: null, dieta: { id: "d2", nome: "Dieta futura", versao: 2 } };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.listarDietas).mockResolvedValue([]);
  vi.mocked(api.listarVigencias).mockResolvedValue({ itens: [programada, vigente], total: 121, pagina: 1, limite: 25, vigente, programada });
  vi.mocked(api.listarFechamentos).mockResolvedValue({ itens: [], total: 0, pagina: 1, limite: 25 });
  vi.mocked(api.listarProdutosNutricionais).mockResolvedValue([]);
  vi.mocked(api.listarCentrosNutricionais).mockResolvedValue([]);
});
afterEach(cleanup);
describe("nutrição do lote", () => {
  it("separa dieta vigente da futura e mantém vigências acessíveis sem permissão de escrita", async () => {
    render(<NutricaoLote loteId="lote" propriedadeId={1} podeLancar={false} vista="lotes" />);
    await screen.findByText(/Dieta vigente: Dieta atual/);
    expect(screen.getByText(/Programada: Dieta futura/)).toBeTruthy();
    expect(screen.queryByText("Aplicar ao lote")).toBeNull();
    fireEvent.click(screen.getByText("Mais dietas"));
    await waitFor(() => expect(api.listarVigencias).toHaveBeenLastCalledWith("lote", 2));
    expect(screen.getByText(/Página 2 · 121 vigências/)).toBeTruthy();
  });
  it("informa carregamento e permite recuperar uma consulta que falhou", async () => {
    vi.mocked(api.listarDietas).mockRejectedValueOnce(new Error("Não foi possível carregar as receitas"));
    render(<NutricaoLote loteId="lote" propriedadeId={1} podeLancar={false} />);
    expect(screen.getByRole("status").textContent).toContain("Carregando");
    await screen.findByText("Não foi possível carregar as receitas");
    fireEvent.click(screen.getByText("Tentar novamente"));
    await screen.findByText(/Dieta vigente: Dieta atual/);
    expect(screen.queryByText("Não foi possível carregar as receitas")).toBeNull();
  });
});
