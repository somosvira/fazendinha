// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormComposicao } from "./FormComposicao";
import { buscarComposicaoSugerida, substituirComposicaoAnimal } from "../api";
import type { AnimalFicha, CatalogoRaca } from "../types";

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  substituirComposicaoAnimal: vi.fn(),
  buscarComposicaoSugerida: vi.fn(),
}));

afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); vi.mocked(buscarComposicaoSugerida).mockResolvedValue(null); });

const racasAtivas: CatalogoRaca[] = [{ id: "r-ho", nome: "Holandês", sigla: "HO", base: true }];

const animal = {
  id: "animal-1", brinco: "1", composicao: [
    { racaId: "r-ho", sigla: "HO", nome: "Holandês", racaAtiva: true, fracao64: 32 },
    { racaId: "r-gl", sigla: "GL", nome: "Girolando", racaAtiva: false, fracao64: 32 },
  ],
} as unknown as AnimalFicha;

describe("FormComposicao", () => {
  it("raça desativada já presente continua na composição e é enviada pelo id", async () => {
    vi.mocked(substituirComposicaoAnimal).mockResolvedValue([]);
    const onSalvo = vi.fn();
    render(<FormComposicao animal={animal} racas={racasAtivas} onSalvo={onSalvo} onFechar={vi.fn()} />);
    expect((await screen.findAllByRole("option", { name: "Girolando (inativa) (GL)" })).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Salvar/ }));
    await waitFor(() => expect(onSalvo).toHaveBeenCalled());
    expect(substituirComposicaoAnimal).toHaveBeenCalledWith("animal-1", { itens: [{ racaId: "r-ho", fracao64: 32 }, { racaId: "r-gl", fracao64: 32 }] });
  });

  it("com dois genitores completos só oferece exceção justificada", async () => {
    vi.mocked(buscarComposicaoSugerida).mockResolvedValue({ itens: [{ racaId: "r-ho", sigla: "HO", fracao64: 32 }, { racaId: "r-gl", sigla: "GL", fracao64: 32 }], rotulo: "1/2 HO 1/2 GL" });
    render(<FormComposicao animal={animal} racas={racasAtivas} onSalvo={vi.fn()} onFechar={vi.fn()} />);
    expect(await screen.findByText(/Composição completa/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "+ Adicionar raça" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Registrar exceção à composição calculada" }));
    expect(screen.getByLabelText("Justificativa da exceção")).toBeTruthy();
  });

  it("com um genitor fixa 32/64 e só envia a soma com a metade editável", async () => {
    vi.mocked(buscarComposicaoSugerida).mockResolvedValue({ itens: [{ racaId: "r-ho", sigla: "HO", fracao64: 32 }], rotulo: "1/2 HO" });
    vi.mocked(substituirComposicaoAnimal).mockResolvedValue([]);
    render(<FormComposicao animal={animal} racas={racasAtivas} onSalvo={vi.fn()} onFechar={vi.fn()} />);
    expect(await screen.findByText(/Pode informar até 32\/64/)).toBeTruthy();
    expect(screen.getAllByLabelText("Fração (/64)")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /Salvar composição/ }));
    await waitFor(() => expect(substituirComposicaoAnimal).toHaveBeenCalledWith("animal-1", { itens: [{ racaId: "r-ho", fracao64: 32 }, { racaId: "r-gl", fracao64: 32 }] }));
  });
});
