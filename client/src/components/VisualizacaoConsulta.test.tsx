// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AlternarVisualizacaoConsulta, useVisualizacaoConsulta } from "./VisualizacaoConsulta";
function Consulta() {
  const visual = useVisualizacaoConsulta("visualTeste");
  return <><AlternarVisualizacaoConsulta {...visual} rotulo="Visualização da consulta" /><output>{visual.modo}</output></>;
}
afterEach(() => { cleanup(); localStorage.clear(); history.replaceState(null, "", "/"); });
it("permite percorrer o toggle pelo teclado e conserva exatamente uma visualização selecionada", async () => {
  history.replaceState(null, "", "/?busca=aurora&pagina=2#historico");
  render(<Consulta />);
  expect(screen.getByRole("group", { name: "Visualização da consulta" })).toBeTruthy();
  const cartoes = screen.getByRole("button", { name: "Cartões" });
  const tabela = screen.getByRole("button", { name: "Tabela" });
  cartoes.focus();
  fireEvent.keyDown(cartoes, { key: "ArrowRight" });
  await waitFor(() => expect(document.activeElement).toBe(tabela));
  fireEvent.click(tabela);
  expect(tabela.getAttribute("aria-pressed")).toBe("true");
  expect(cartoes.getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(tabela);
  expect(tabela.getAttribute("aria-pressed")).toBe("true");
  expect(new URLSearchParams(location.search).get("busca")).toBe("aurora");
  expect(new URLSearchParams(location.search).get("pagina")).toBe("2");
  expect(location.hash).toBe("#historico");
});
it("restaura a visualização na navegação sem apagar os filtros", async () => {
  history.replaceState(null, "", "/?visualTeste=tabela&sitio=2");
  render(<Consulta />);
  expect(screen.getByRole("button", { name: "Tabela" }).getAttribute("aria-pressed")).toBe("true");
  history.replaceState(null, "", "/?visualTeste=visual&sitio=2");
  fireEvent(window, new PopStateEvent("popstate"));
  await waitFor(() => expect(screen.getByRole("button", { name: "Cartões" }).getAttribute("aria-pressed")).toBe("true"));
  expect(new URLSearchParams(location.search).get("sitio")).toBe("2");
});
