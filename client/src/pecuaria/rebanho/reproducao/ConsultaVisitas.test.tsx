// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ConsultaVisitas } from "./ConsultaVisitas";
afterEach(cleanup);
it("lista abertas e encerradas sem presumir atendimento e abre o registro exato", () => {
  const abrir = vi.fn();
  render(<ConsultaVisitas visitas={[
    {id:"aberta",nome:"Retornos da manhã",propriedadeId:1,data:"2026-10-30",status:"PARCIAL",responsavel:"Ana"},
    {id:"encerrada",nome:"Conferência anterior",propriedadeId:1,data:"2026-10-10",status:"ENCERRADA"},
  ]} propriedades={[{id:1,nome:"Sítio Principal"}]} podeLancar sitioSelecionado onAbrir={abrir}/>);
  const tabela = screen.getByRole("table", {name:"Visitas veterinárias"});
  expect(within(tabela).getByText("Em andamento")).toBeTruthy();
  expect(within(tabela).getByText("Responsável não informado")).toBeTruthy();
  expect(within(tabela).getByText("Encerrada")).toBeTruthy();
  fireEvent.click(within(tabela).getByText("Conferência anterior"));
  expect(abrir).toHaveBeenCalledWith("encerrada");
  expect(within(tabela).queryByText("Abrir atendimento")).toBeNull();
});
it("permite consultar sem anunciar ação de lançamento", () => {
  render(<ConsultaVisitas visitas={[{id:"a",nome:"Visita de hoje",propriedadeId:1,data:"2026-10-30",status:"ABERTA"}]} propriedades={[]} podeLancar={false} sitioSelecionado={false} onAbrir={vi.fn()}/>);
  expect(screen.getByText("Visita de hoje")).toBeTruthy();
  expect(screen.queryByText("Abrir atendimento")).toBeNull();
});
