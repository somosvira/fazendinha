// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CalendarioFechamentos, intervaloMesFechamento, semanasMesFechamento, diferencaConsumo } from "./CalendarioFechamentos";
import type { Fechamento } from "./api";
afterEach(cleanup);
const f={id:"f",inicio:"2026-10-01",fim:"2026-10-07",status:"CONFIRMADO",lote:{id:"l",nome:"Matrizes"},propriedade:{id:1,nome:"Principal"},vigencia:{dieta:{nome:"Dieta",versao:2}},animalDias:42,verValores:false,custoConhecido:null,coberturaCustoCompleta:false,itens:[{produtoId:"p",produto:{nome:"Ração"},quantidadePrevista:"0.3",quantidadeConfirmada:"0.1",unidade:"KG"}]} as Fechamento;
describe("calendário nutricional",()=>{
 it("calcula meses civis e diferenças de quantidades sem somar ingredientes",()=>{
  expect(intervaloMesFechamento("2024-02")).toEqual({de:"2024-02-01",ate:"2024-02-29"});expect(semanasMesFechamento("2026-10")[0][0]).toBe("2026-09-28");expect(diferencaConsumo("0.3","0.1")).toBe(-0.2);
 });
 it("consulta outro mês por intervalo e não afirma que dias vazios são pendências",()=>{
  const mes=vi.fn();const abrir=vi.fn();render(<CalendarioFechamentos itens={[f]} total={51} de="" onMes={mes} onAbrir={abrir}/>);
  expect(screen.getByText(/1 de 51 fechamentos no recorte/)).toBeTruthy();expect(screen.getByText("Previsto × conferido")).toBeTruthy();expect(screen.queryByText("Custo conhecido")).toBeNull();fireEvent.click(screen.getByRole("button",{name:"Mês anterior"}));expect(mes).toHaveBeenCalledWith({de:"2026-09-01",ate:"2026-09-30"});fireEvent.click(screen.getByRole("button",{name:"Ver fechamento"}));expect(abrir).toHaveBeenCalledWith(f);expect(screen.queryByText(/Consumo pendente/)).toBeNull();
 });
});
