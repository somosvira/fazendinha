// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AlternarVisualizacaoConsulta, useVisualizacaoConsulta } from "./VisualizacaoConsulta";
function Consulta({ visual }: { visual?: "Gráfico" | "Linha do tempo" }) {
  const consulta = useVisualizacaoConsulta("visualTeste", "consultas", visual ? "tabela" : "visual");
  return <><AlternarVisualizacaoConsulta {...consulta} visual={visual} rotulo="Visualização da consulta" /><output>{consulta.modo}</output></>;
}
afterEach(() => { cleanup(); localStorage.clear(); history.replaceState(null, "", "/"); });
it("não oferece cartões: a lista fica em tabela mesmo com preferência antiga e sem gravar nada", async () => {
  history.replaceState(null, "", "/?busca=aurora&visualTeste=visual#historico");
  localStorage.setItem("terrano:consultas:sessao:visualTeste", "visual");
  render(<Consulta />);
  expect(screen.queryByRole("group", { name: "Visualização da consulta" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Cartões" })).toBeNull();
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("tabela"));
  expect(new URLSearchParams(location.search).get("busca")).toBe("aurora");
  expect(location.hash).toBe("#historico");
});
it("mantém o alternador de visualizações que a tabela não substitui, com teclado e filtros preservados", async () => {
  history.replaceState(null, "", "/?busca=aurora&pagina=2#historico");
  render(<Consulta visual="Gráfico" />);
  expect(screen.getByRole("group", { name: "Visualização da consulta" })).toBeTruthy();
  const grafico = screen.getByRole("button", { name: "Gráfico" });
  const tabela = screen.getByRole("button", { name: "Tabela" });
  expect(tabela.getAttribute("aria-pressed")).toBe("true");
  tabela.focus();
  fireEvent.keyDown(tabela, { key: "ArrowLeft" });
  await waitFor(() => expect(document.activeElement).toBe(grafico));
  fireEvent.click(grafico);
  expect(grafico.getAttribute("aria-pressed")).toBe("true");
  expect(tabela.getAttribute("aria-pressed")).toBe("false");
  expect(new URLSearchParams(location.search).get("busca")).toBe("aurora");
  expect(new URLSearchParams(location.search).get("pagina")).toBe("2");
  expect(location.hash).toBe("#historico");
});
