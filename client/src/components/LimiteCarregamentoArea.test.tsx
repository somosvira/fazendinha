// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LimiteCarregamentoArea } from "./LimiteCarregamentoArea";
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("contém falha da área e permite navegar para outra sem recarregar o shell", () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  function Falha(): never { throw new Error("Falha no download da área"); }
  const r = render(<><nav>Menu preservado</nav><LimiteCarregamentoArea contexto="financeiro"><Falha /></LimiteCarregamentoArea></>);
  expect(screen.getByRole("alert").textContent).toContain("Não foi possível abrir");
  expect(screen.getByText("Menu preservado")).toBeTruthy();
  r.rerender(<><nav>Menu preservado</nav><LimiteCarregamentoArea contexto="estoque"><h1>Estoque</h1></LimiteCarregamentoArea></>);
  expect(screen.getByRole("heading", { name: "Estoque" })).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
});
