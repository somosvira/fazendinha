// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { OrdenarConsulta, ordenarColecao, type DefinicaoOrdenacao } from "./OrdenarConsulta";
const campos: DefinicaoOrdenacao<{id:string;valor:string|null}>[]=[{chave:"valor",rotulo:"Valor",tipo:"numero",obter:i=>i.valor}];
describe("Ordenação das consultas",()=>{
 it("compara decimais sem perder precisão e mantém ausentes no final nos dois sentidos",()=>{
 const itens=[{id:"ausente",valor:null},{id:"maior",valor:"9007199254740993.01"},{id:"menor",valor:"9007199254740993.00"},{id:"zero",valor:"0"},{id:"negativo",valor:"-2.5"}];
 expect(ordenarColecao(itens,campos,{campo:"valor",direcao:"asc"}).map(i=>i.id)).toEqual(["negativo","zero","menor","maior","ausente"]);
 expect(ordenarColecao(itens,campos,{campo:"valor",direcao:"desc"}).map(i=>i.id)).toEqual(["maior","menor","zero","negativo","ausente"]);
 expect(itens[0].id).toBe("ausente");
 });
 it("preserva empates e restaura a ordem original sem campo selecionado",()=>{
 const itens=[{id:"a",valor:"1.00"},{id:"b",valor:"1"}];
 expect(ordenarColecao(itens,campos,{campo:"valor",direcao:"desc"})).toEqual(itens);
 expect(ordenarColecao(itens,campos,{campo:"",direcao:"asc"})).toEqual(itens);
 });
 it("abre a lista diretamente e mantém o popover aberto ao escolher o campo",()=>{
 const mudar=vi.fn();render(<OrdenarConsulta controle={{campo:"",direcao:"asc",campos,mudar,restaurar:vi.fn()}}/>);
 fireEvent.click(screen.getByRole("button",{name:"Ordenar: Ordenar"}));
 fireEvent.click(screen.getByRole("radio",{name:"Valor"}));
 expect(mudar).toHaveBeenCalledWith({campo:"valor",direcao:"asc"});
 expect(screen.getByText("Ordenar por")).toBeTruthy();
 });
});
