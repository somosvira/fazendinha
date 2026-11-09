// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AjudaCampo, Dica } from "./Dica";

beforeEach(() => { vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

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
