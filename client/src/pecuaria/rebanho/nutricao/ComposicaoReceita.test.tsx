// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ComposicaoReceita } from "./ComposicaoReceita";
import type { Dieta } from "./api";
afterEach(cleanup);
it("separa unidades, conserva matéria seca desconhecida e oferece tabela", () => {
  const dieta: Dieta = {id:"a",nome:"Teste",versao:1,publicadaEm:null,itens:[{produtoId:"a",produto:{nome:"Ração"},unidade:"KG",quantidadeCabecaDia:"2",materiaSecaPercentualSnapshot:"90"},{produtoId:"b",produto:{nome:"Mineral"},unidade:"KG",quantidadeCabecaDia:"0.1",materiaSecaPercentualSnapshot:null},{produtoId:"c",produto:{nome:"Líquido"},unidade:"L",quantidadeCabecaDia:"1",materiaSecaPercentualSnapshot:null}]};
  render(<ComposicaoReceita dieta={dieta} />);
  expect(screen.getByText("2,1 KG")).toBeTruthy();
  expect(screen.getAllByText("Não informada")).toHaveLength(2);
  expect(screen.queryByText("3,1 KG")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Tabela"}));
  expect(screen.getByRole("table")).toBeTruthy();
  expect(screen.getByText("90%")).toBeTruthy();
  expect(screen.getAllByText("Não informada")).toHaveLength(2);
});
