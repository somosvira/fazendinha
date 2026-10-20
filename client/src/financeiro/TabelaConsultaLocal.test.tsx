// @vitest-environment jsdom
import "@/lib/controles.fixture";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { TabelaConsultaLocal } from "./TabelaConsultaLocal";

afterEach(cleanup);
type Item = { id: string; nome: string; valor: string | null; papeis: string[] };
const itens: Item[] = [...Array.from({length:15},(_,i)=>({id:String(i),nome:`Registro ${i}`,valor:"10.25",papeis:["CLIENTE"]})),{id:"alvo",nome:"Fora da primeira página",valor:"750.50",papeis:["CLIENTE","FORNECEDOR"]},{id:"oculto",nome:"Sem valor conhecido",valor:null,papeis:[]}];
function Consulta() {
  return <TabelaConsultaLocal rotulo="Consulta de teste" itens={itens} chaveDe={i=>i.id} buscarPor={i=>i.nome} definicoes={[
    {chave:"nome",rotulo:"Nome",tipo:"texto",obter:i=>i.nome},
    {chave:"valor",rotulo:"Valor",tipo:"valor",obter:i=>i.valor,limiteSugerido:750.50},
    {chave:"papeis",rotulo:"Papéis",tipo:"opcoes",obter:i=>i.papeis,opcoes:[{valor:"CLIENTE",texto:"Cliente"},{valor:"FORNECEDOR",texto:"Fornecedor"}]},
  ]} colunas={[{chave:"nome",titulo:"Nome",principal:true,celula:i=>i.nome},{chave:"valor",titulo:"Valor",celula:i=>i.valor??"—"}]} />;
}
it("filtra toda a coleção antes de paginar, preserva centavos e exclui valores desconhecidos", () => {
  render(<Consulta/>);
  expect(screen.queryByText("Fora da primeira página")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Filtrar por valor"}));
  fireEvent.change(screen.getByLabelText("Valor mínimo"),{target:{value:"750,50"}});
  expect(screen.queryByText("Fora da primeira página")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Aplicar"}));
  const tabela=within(screen.getByRole("table",{name:"Consulta de teste"}));
  expect(tabela.getByText("Fora da primeira página")).toBeTruthy();
  expect(tabela.queryByText("Sem valor conhecido")).toBeNull();
  expect(tabela.queryByText("Registro 0")).toBeNull();
  expect(screen.getByRole("button",{name:/Filtrar por valor, filtro ativo/})).toBeTruthy();
});
it("omite o filtro do nome já pesquisável e compartilha os demais critérios entre cabeçalho e modal", () => {
  render(<Consulta/>);
  expect(screen.queryByRole("button",{name:"Filtrar por nome"})).toBeNull();
  expect(screen.getByRole("searchbox",{name:"Buscar consulta de teste"})).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Filtrar por valor"}));
  fireEvent.change(screen.getByLabelText("Valor mínimo"),{target:{value:"750,50"}});
  fireEvent.click(screen.getByRole("button",{name:"Aplicar"}));
  fireEvent.click(screen.getByRole("button",{name:/^Filtros/}));
  const painel=screen.getByRole("dialog",{name:"Filtros"});
  const campo=within(painel).getByLabelText("Valor mínimo") as HTMLInputElement;
  expect(campo.value).toBe("750,50");
  fireEvent.change(campo,{target:{value:"10"}});
  fireEvent.click(within(painel).getByRole("button",{name:"Cancelar"}));
  expect(within(screen.getByRole("table")).queryByText("Registro 0")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:/^Filtros/}));
  expect((screen.getByLabelText("Valor mínimo") as HTMLInputElement).value).toBe("750,50");
});
it("bloqueia faixas inválidas no modal e não muda a consulta durante a correção", () => {
  render(<Consulta/>);
  fireEvent.click(screen.getByRole("button",{name:"Filtros"}));
  fireEvent.change(screen.getByLabelText("Valor mínimo"),{target:{value:"500"}});
  fireEvent.change(screen.getByLabelText("Valor máximo"),{target:{value:"100"}});
  expect(screen.getByRole("button",{name:"Aplicar filtros"}).hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("alert").textContent).toContain("mínimo");
});
