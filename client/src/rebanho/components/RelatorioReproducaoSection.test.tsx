// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RelatorioReproducaoSection } from "./RelatorioReproducaoSection";

const api = vi.hoisted(() => ({ obterRelatorioReproducao: vi.fn() }));
vi.mock("../api", () => api);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("RelatorioReproducaoSection", () => {
  it("mostra somente métodos reprodutivos que possuem coberturas", async () => {
    api.obterRelatorioReproducao.mockResolvedValue({
      coberturas: 10,
      prenhes: 5,
      partos: 2,
      taxaConcepcao: 0.5,
      porMetodo: [
        { metodo: "IA", coberturas: 10, prenhes: 5, taxa: 0.5 },
        { metodo: "MN", coberturas: 0, prenhes: 0, taxa: null },
        { metodo: "TE", coberturas: 0, prenhes: 0, taxa: null },
      ],
    });

    render(<RelatorioReproducaoSection />);

    expect(await screen.findByRole("cell", { name: "Inseminação" })).toBeTruthy();
    expect(screen.queryByRole("cell", { name: "Monta natural" })).toBeNull();
    expect(screen.queryByRole("cell", { name: "Transferência de embrião" })).toBeNull();
  });
});
