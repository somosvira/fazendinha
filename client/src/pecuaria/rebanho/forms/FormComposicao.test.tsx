// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormComposicao } from "./FormComposicao";
import { substituirComposicaoAnimal } from "../api";
import type { AnimalFicha, CatalogoRaca } from "../types";

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  substituirComposicaoAnimal: vi.fn(),
}));

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

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
    expect(screen.getAllByRole("option", { name: "Girolando (inativa) (GL)" }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Salvar/ }));
    await waitFor(() => expect(onSalvo).toHaveBeenCalled());
    expect(substituirComposicaoAnimal).toHaveBeenCalledWith("animal-1", { itens: [{ racaId: "r-ho", fracao64: 32 }, { racaId: "r-gl", fracao64: 32 }] });
  });
});
