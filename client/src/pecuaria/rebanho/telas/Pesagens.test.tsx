// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Pesagens } from "./Pesagens";
import { buscarFichaAnimal, listarAnimais } from "../api";
import type { AnimalFicha, ListarResultado } from "../types";

vi.mock("../api", () => ({ buscarFichaAnimal: vi.fn(), listarAnimais: vi.fn() }));
vi.mock("../components/GraficoPeso", () => ({ ROTULO_TIPO_PESAGEM: { NASCIMENTO: "Nascimento", ROTINA: "Rotina" } }));
vi.mock("../ui", () => ({ Paginacao: ({ onPaginaChange }: { onPaginaChange: (p: number) => void }) => <button onClick={() => onPaginaChange(2)}>Próxima página</button> }));
vi.mock("./ColetasCampo", () => ({ ColetasCampo: () => <h1>Pesagens em fichas</h1> }));
const ficha = { id: "a", brinco: "BAIXADO-01", nome: null, historicoPesagens: [
  { id: "p2", data: "2026-09-01", pesoKg: 320, tipo: "ROTINA", origem: "BALANCA", observacao: "Coleta de campo" },
  { id: "p1", data: "2025-01-01", pesoKg: 32, tipo: "NASCIMENTO", origem: "MANUAL", observacao: "Peso antigo V3" },
] } as AnimalFicha;
beforeEach(() => {
  vi.clearAllMocks(); window.history.replaceState(null, "", "/pecuaria/rebanho/pesagens");
  vi.mocked(listarAnimais).mockResolvedValue({ itens: [{ id: "a", brinco: "BAIXADO-01", nome: null, situacao: "BAIXADO", lote: null, propriedade: null }], total: 21 } as ListarResultado);
  vi.mocked(buscarFichaAnimal).mockResolvedValue(ficha);
});
afterEach(cleanup);
describe("pesagens", () => {
  it("permite consultar todo histórico V3 de animal baixado, sem buscar fichas de todos os animais", async () => {
    render(<Pesagens podeLancar={false} />);
    fireEvent.click((await screen.findAllByText("BAIXADO-01"))[0]);
    await screen.findAllByText("Peso antigo V3");
    expect(screen.getAllByText("32 kg").length).toBeGreaterThan(0);
    expect(screen.getAllByText("320 kg").length).toBeGreaterThan(0);
    expect(listarAnimais).toHaveBeenCalledWith({ situacao: "TODOS", busca: "", page: 1, pageSize: 20 });
    expect(buscarFichaAnimal).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "Abrir ficha e ações do animal" }).getAttribute("href")).toBe("/pecuaria/rebanho/animais/a");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
  it("mantém fichas coletivas e restaura consulta direta pelo endereço", async () => {
    window.history.replaceState(null, "", "/pecuaria/rebanho/pesagens?animalId=a");
    render(<Pesagens podeLancar />);
    await screen.findAllByText("Peso antigo V3");
    fireEvent.click(screen.getByRole("tab", { name: "Fichas de pesagem" }));
    expect(screen.getByRole("heading", { name: "Pesagens em fichas" })).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    fireEvent.click(screen.getByRole("tab", { name: "Histórico por animal" }));
    await screen.findAllByText("Peso antigo V3");
  });
  it("pagina animais e recupera erro na consulta individual", async () => {
    vi.mocked(buscarFichaAnimal).mockRejectedValueOnce(new Error("Histórico indisponível"));
    render(<Pesagens podeLancar={false} />);
    fireEvent.click((await screen.findAllByText("BAIXADO-01"))[0]);
    await screen.findByText("Histórico indisponível");
    fireEvent.click(screen.getByText("Recarregar histórico"));
    await screen.findAllByText("Peso antigo V3");
    fireEvent.click(screen.getByText("Próxima página"));
    await waitFor(() => expect(listarAnimais).toHaveBeenLastCalledWith({ situacao: "TODOS", busca: "", page: 2, pageSize: 20 }));
  });
});
