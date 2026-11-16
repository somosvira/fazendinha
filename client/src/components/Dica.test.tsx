// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AjudaCampo, Dica } from "./Dica";

beforeEach(() => { vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Dica", () => {
  it("abre ao passar o mouse e fecha ao sair", async () => {
    render(<AjudaCampo texto="Explicação do campo" rotulo="Ajuda do campo" />);
    expect(screen.queryByText("Explicação do campo")).toBeNull();
    const gatilho = screen.getByRole("button", { name: "Ajuda do campo" });
    fireEvent.mouseEnter(gatilho);
    expect(await screen.findByText("Explicação do campo")).toBeTruthy();
    fireEvent.mouseLeave(gatilho);
    expect(screen.queryByText("Explicação do campo")).toBeNull();
  });

  it("abre ao clicar e não fecha se já estava aberta pelo hover", async () => {
    render(<AjudaCampo texto="Explicação do campo" rotulo="Ajuda do campo" />);
    const gatilho = screen.getByRole("button", { name: "Ajuda do campo" });
    fireEvent.mouseEnter(gatilho);
    fireEvent.click(gatilho);
    expect(await screen.findByText("Explicação do campo")).toBeTruthy();
  });

  it("fecha com Esc", async () => {
    render(<AjudaCampo texto="Explicação do campo" rotulo="Ajuda do campo" />);
    fireEvent.click(screen.getByRole("button", { name: "Ajuda do campo" }));
    const texto = await screen.findByText("Explicação do campo");
    fireEvent.keyDown(texto, { key: "Escape" });
    expect(screen.queryByText("Explicação do campo")).toBeNull();
  });
});

it("preserva o diálogo acessível e a abertura por clique nas ajudas existentes", () => {
  render(<AjudaCampo rotulo="Sobre os filtros" texto="Filtros ainda não aplicados" />);
  fireEvent.click(screen.getByRole("button", { name: "Sobre os filtros" }));
  expect(screen.getByRole("dialog").textContent).toBe("Filtros ainda não aplicados");
});

it("mostra tooltip no hover de uma ação sem impedir seu clique", () => {
  const executar = vi.fn();
  render(<Dica asChild rotulo="Editar produto" conteudo="Editar"><button type="button" onClick={executar}>Ícone</button></Dica>);
  const acao = screen.getByRole("button", { name: "Editar produto" });
  fireEvent.mouseEnter(acao);
  expect(screen.getByRole("tooltip").textContent).toBe("Editar");
  fireEvent.click(acao);
  expect(executar).toHaveBeenCalledOnce();
});
