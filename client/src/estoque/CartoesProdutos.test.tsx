// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
const listar=vi.hoisted(()=>vi.fn());
vi.mock("./api",()=>({listarPartidasProduto:listar}));
vi.mock("@/components/LinkInterno",()=>({LinkInterno:({href,children}:{href:string;children:import("react").ReactNode})=><a href={href}>{children}</a>}));
import { CartoesProdutos, resumirValidades } from "./CartoesProdutos";
import type { LoteProdutoDTO, SaldoDTO } from "./api";
afterEach(()=>{cleanup();vi.clearAllMocks();});
const partida=(id:string,saldo:string,validade:string|null):LoteProdutoDTO=>({id,codigo:id,nome:id,saldo,validade,origemRastreio:"ENTRADA"});
const produto:SaldoDTO={produtoId:"p",nome:"Ração",materialGeneticoId:null,categoria:null,centrosCusto:[],unidade:"KG",saldo:-2,custoMedio:null,valor:null,minimoEstoque:10,abaixoMinimo:true};
describe("produtos em visão visual",()=>{
 it("considera só lotes com saldo positivo e mantém validades desconhecidas separadas",()=>{
  expect(resumirValidades([partida("v","1","2026-10-20"),partida("h","2","2026-10-21"),partida("f","3","2026-11-15"),partida("u","4",null),partida("z","0","2026-10-01"),partida("n","-1","2026-10-01")],"2026-10-21")).toEqual({total:4,vencidas:1,desconhecidas:1,proxima:"2026-10-21",em30Dias:2});
 });
 it("não desenha saldo negativo como reserva positiva e respeita a ocultação de custos",async()=>{
  listar.mockResolvedValue([]);render(<CartoesProdutos itens={[produto]} todos={[produto]} propriedadeId={7} verValores={false} acoes={()=>null} filtrarReposicao={vi.fn()}/>);
  await screen.findByText("Sem lotes com saldo positivo");expect(listar).toHaveBeenCalledWith("p",7);expect(screen.getByText("Saldo negativo")).toBeTruthy();expect(document.querySelector(".produto-minimo")).toBeNull();expect(screen.queryByText("Valor em estoque")).toBeNull();expect(screen.getByText("Faltam 12 kg para o mínimo")).toBeTruthy();
 });
});
