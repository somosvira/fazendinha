// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormFiliacao } from "./FormFiliacao";
import { definirFiliacaoAnimal, listarGenitores, substituirComposicaoAnimal } from "../api";
import type { AnimalFicha, GenitorDTO } from "../types";

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  definirFiliacaoAnimal: vi.fn(),
  substituirComposicaoAnimal: vi.fn(),
  listarGenitores: vi.fn(),
}));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listarGenitores).mockResolvedValue([]);
});

const animal = {
  id: "animal-1", brinco: "1234",
  filiacao: { mae: null, pai: null },
} as unknown as AnimalFicha;

describe("FormFiliacao", () => {
  it("sem escolher genitores, envia todos os quatro campos como null", async () => {
    vi.mocked(definirFiliacaoAnimal).mockResolvedValue({ ...animal, avisos: [], composicaoSugerida: null } as never);
    const onSalvo = vi.fn();
    render(<FormFiliacao animal={animal} onSalvo={onSalvo} onFechar={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Salvar filiação/ }));
    await waitFor(() => expect(onSalvo).toHaveBeenCalled());
    expect(definirFiliacaoAnimal).toHaveBeenCalledWith("animal-1", { maeId: null, maeExternaId: null, paiId: null, paiExternoId: null });
  });

  it("escolhendo um genitor externo como pai, envia paiExternoId", async () => {
    const genitores: GenitorDTO[] = [{ id: "ext-1", sexo: "M", nome: "Touro X", codigo: null, fornecedor: null, observacao: null, ativo: true, composicao: [], composicaoRotulo: "", filhos: 0 }];
    vi.mocked(listarGenitores).mockImplementation((filtros) => Promise.resolve(filtros?.sexo === "M" ? genitores : []));
    vi.mocked(definirFiliacaoAnimal).mockResolvedValue({ ...animal, avisos: [], composicaoSugerida: null } as never);
    const onSalvo = vi.fn();
    render(<FormFiliacao animal={animal} onSalvo={onSalvo} onFechar={vi.fn()} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Genitor externo" })[1]);
    await screen.findByText("Touro X");
    fireEvent.change(screen.getByLabelText(/Selecionar pai entre os genitores externos/), { target: { value: "ext-1" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar filiação/ }));

    await waitFor(() => expect(onSalvo).toHaveBeenCalled());
    expect(definirFiliacaoAnimal).toHaveBeenCalledWith("animal-1", { maeId: null, maeExternaId: null, paiId: null, paiExternoId: "ext-1" });
  });

  it("quando o servidor devolve composicaoSugerida, pergunta antes de aplicar", async () => {
    vi.mocked(definirFiliacaoAnimal).mockResolvedValue({
      ...animal, avisos: [], composicaoSugerida: { itens: [{ racaId: "r-ho", sigla: "HO", fracao64: 32 }], rotulo: "1/2 HO" },
    } as never);
    vi.mocked(substituirComposicaoAnimal).mockResolvedValue([]);
    const onSalvo = vi.fn();
    render(<FormFiliacao animal={animal} onSalvo={onSalvo} onFechar={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Salvar filiação/ }));
    expect(await screen.findByText("Substituir pela composição calculada?")).toBeTruthy();
    expect(onSalvo).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Substituir pela calculada" }));
    await waitFor(() => expect(substituirComposicaoAnimal).toHaveBeenCalledWith("animal-1", { itens: [{ racaId: "r-ho", fracao64: 32 }], origem: "CALCULADA" }));
    await waitFor(() => expect(onSalvo).toHaveBeenCalled());
  });
});
