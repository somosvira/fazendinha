// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { CartaoConsulta, LinhaTempoConsulta } from "./ConsultaVisual";
import { AlternarVisualizacaoConsulta, useVisualizacaoConsulta } from "./VisualizacaoConsulta";
afterEach(cleanup);
beforeEach(() => { localStorage.clear(); window.history.replaceState(null, "", "/financeiro/operacoes?status=CONFIRMADA#lista"); });
it("separa ação de navegação e seleção do cartão", () => {
  const abrir = vi.fn(), editar = vi.fn(), selecionar = vi.fn();
  render(<CartaoConsulta titulo="Aurora" onAbrir={abrir} selecao={<input type="checkbox" aria-label="Selecionar Aurora" onChange={selecionar} />} acoes={<button onClick={editar}>Editar Aurora</button>}>Último peso 489 kg</CartaoConsulta>);
  fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByRole("button", { name: "Editar Aurora" }));
  expect(abrir).not.toHaveBeenCalled(); expect(editar).toHaveBeenCalledOnce(); expect(selecionar).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Aurora" })); expect(abrir).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", { name: "Aurora" }).querySelector("button,input,a")).toBeNull();
});
it("preserva filtros e fragmento ao alternar e restaura a preferência individual", () => {
  function Consulta() { const visual = useVisualizacaoConsulta("visualTeste"); return <AlternarVisualizacaoConsulta {...visual} rotulo="Visualização" />; }
  const tela = render(<Consulta />); fireEvent.click(screen.getByRole("button", { name: "Tabela" }));
  expect(window.location.search).toContain("status=CONFIRMADA"); expect(window.location.hash).toBe("#lista");
  tela.unmount(); window.history.replaceState(null, "", "/financeiro/operacoes"); render(<Consulta />);
  expect(screen.getByRole("button", { name: "Tabela" }).getAttribute("aria-pressed")).toBe("true");
});
it("conserva a ordem recebida e não reúne movimentos separados pela ordenação", () => {
  const itens = [{ id: "a", data: "2026-10-01", nome: "Saída original" }, { id: "b", data: "2026-10-14", nome: "Estorno" }, { id: "c", data: "2026-10-01", nome: "Outra saída" }];
  render(<LinhaTempoConsulta rotulo="Extrato" itens={itens} dataDe={i => i.data} chaveDe={i => i.id} render={i => <span>{i.nome}</span>} />);
  expect(within(screen.getByRole("list", { name: "Extrato" })).getAllByRole("listitem").map(i => i.textContent)).toEqual(["01/10/2026Saída original", "14/10/2026Estorno", "01/10/2026Outra saída"]);
});
