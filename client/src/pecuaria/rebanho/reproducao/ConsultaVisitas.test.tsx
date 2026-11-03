// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ConsultaVisitas } from "./ConsultaVisitas";
afterEach(cleanup);
it("separa abertas e encerradas sem presumir atendimento e abre o registro exato", () => {
  const abrir = vi.fn();
  render(<ConsultaVisitas visitas={[
    {id:"aberta",nome:"Retornos da manhã",propriedadeId:1,data:"2026-10-30",status:"PARCIAL",responsavel:"Ana"},
    {id:"encerrada",nome:"Conferência anterior",propriedadeId:1,data:"2026-10-10",status:"ENCERRADA"},
  ]} propriedades={[{id:1,nome:"Sítio Principal"}]} podeLancar sitioSelecionado onAbrir={abrir}/>);
  const abertas = screen.getByRole("region", {name:"Visitas em aberto"});
  const encerradas = screen.getByRole("region", {name:"Visitas encerradas"});
  expect(within(abertas).getByText("Em andamento")).toBeTruthy();
  expect(within(encerradas).getByText("Responsável não informado")).toBeTruthy();
  fireEvent.click(within(encerradas).getByRole("button", {name:/Conferência anterior/}));
  expect(abrir).toHaveBeenCalledWith("encerrada");
  expect(within(encerradas).queryByText("Abrir atendimento")).toBeNull();
});
it("permite consultar sem anunciar ação de lançamento", () => {
  render(<ConsultaVisitas visitas={[{id:"a",nome:"Visita de hoje",propriedadeId:1,data:"2026-10-30",status:"ABERTA"}]} propriedades={[]} podeLancar={false} sitioSelecionado={false} onAbrir={vi.fn()}/>);
  expect(screen.getByText("Consultar visita")).toBeTruthy();
  expect(screen.queryByText("Abrir atendimento")).toBeNull();
});
