// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  listarCategorias: vi.fn(async () => []),
  listarCentrosCusto: vi.fn(async () => []),
  criarProduto: vi.fn(),
  editarProduto: vi.fn(),
}));
import { ProdutoForm } from "./ProdutoForm";

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("ProdutoForm", () => {
  it("explica os setores na lista aberta e aplica o escolhido", async () => {
    render(<ProdutoForm onFechar={vi.fn()} onSalvo={vi.fn()} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Setor" }));
    const leite = await screen.findByRole("option", { name: "Leite" });
    expect(leite.textContent).toContain("Produto usado no rebanho de leite.");
    expect((await screen.findByRole("option", { name: "— (Geral)" })).textContent).toContain("Insumo compartilhado entre as atividades.");
    fireEvent.click(leite);
    expect(screen.getByRole("combobox", { name: "Setor" }).textContent).toBe("Leite");
  });
});
