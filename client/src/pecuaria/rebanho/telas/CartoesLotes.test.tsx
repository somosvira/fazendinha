// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
const resumo=vi.hoisted(()=>vi.fn());
vi.mock("../api",()=>({buscarResumoLote:resumo}));
import { CartoesLotes } from "./CartoesLotes";
import type { Lote, ResumoLote } from "../types";
afterEach(()=>{cleanup();vi.clearAllMocks();});
const lote:Lote={id:"l",nome:"Matrizes",propriedadeId:1,propriedade:{id:1,nome:"Principal"},ativo:true,observacao:null,animaisAtivos:2};
const dados:ResumoLote={ativos:2,porSexo:{F:2,M:0},porCategoria:[{categoriaId:"c",categoria:"Vaca",qtd:2}],idadeMediaMeses:30,peso:{medioKg:400,minKg:400,maxKg:400,semPeso:1},gmd:{medio:0,comGmd:1,periodoDias:30}};
describe("cartões dos lotes",()=>{
 it("usa resumo autorizado com janela explícita e distingue zero de GMD ausente",async()=>{
  resumo.mockResolvedValue(dados);const abrir=vi.fn();render(<CartoesLotes lotes={[lote]} todos={[lote]} acoes={()=>null} onAbrir={abrir}/>);
  expect(await screen.findByRole("img",{name:"Composição: Vaca: 2"})).toBeTruthy();expect(resumo).toHaveBeenCalledWith("l",{periodoDias:30});
  expect(screen.getByText("0,000 kg/dia")).toBeTruthy();expect(screen.getByText("1 de 2 com GMD")).toBeTruthy();expect(screen.getByText("1 de 2 com pesagem")).toBeTruthy();fireEvent.click(screen.getByRole("button",{name:"Ver lote"}));expect(abrir).toHaveBeenCalledWith("l");
 });
 it("mantém abertura do lote e não inventa desempenho quando a consulta falha",async()=>{
  resumo.mockRejectedValue(new Error("Falha"));render(<CartoesLotes lotes={[lote]} todos={[lote]} acoes={()=>null} onAbrir={vi.fn()}/>);
  await screen.findByText("Resumo indisponível.");expect(screen.queryByRole("img")).toBeNull();expect(screen.queryByText("0,000 kg/dia")).toBeNull();expect(screen.getByRole("button",{name:"Ver lote"})).toBeTruthy();
 });
});
