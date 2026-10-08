// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Nutricao } from "./Nutricao";
vi.mock("../api", () => ({ listarLotes: vi.fn().mockResolvedValue([]) }));
vi.mock("./ReceitasDieta", () => ({ ReceitasDieta: () => <p>Gestão compartilhada de receitas</p> }));
vi.mock("./NutricaoLote", () => ({ NutricaoLote: () => null }));
vi.mock("./ConsultaFechamento", () => ({ ConsultaFechamento: () => <p>Fechamento consultado</p> }));
afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); });
describe("navegação da Nutrição", () => {
  it("abre receitas pelo endereço e restaura a aba após voltar no navegador", async () => {
    window.history.replaceState(null, "", "/pecuaria/nutricao?aba=receitas");
    render(<Nutricao podeLancar />);
    expect(screen.getByText("Gestão compartilhada de receitas")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Fechamentos" }));
    expect(new URLSearchParams(window.location.search).get("aba")).toBe("fechamentos");
    expect(screen.queryByText("Gestão compartilhada de receitas")).toBeNull();
    act(() => { window.history.replaceState(null, "", "/pecuaria/nutricao?aba=receitas"); window.dispatchEvent(new PopStateEvent("popstate")); });
    expect(screen.getByRole("tab", { name: "Receitas" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Gestão compartilhada de receitas")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Gerenciar receitas" }).getAttribute("href")).toBe("/configuracoes/pecuaria/nutricao/receitas");
  });
});
