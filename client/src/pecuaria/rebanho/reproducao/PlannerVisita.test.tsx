// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlannerVisita } from "./PlannerVisita";
import { carregarPreviaCompleta, consultarPlanner, incluirGrupo, listarSelecoes, type GrupoPlanner, type PreviaPlanner } from "./planner-api";
import { RebanhoApiError } from "../api";
import type { Visita } from "./visitas-api";
vi.mock("../../../api/propriedades",()=>({usePropriedades:()=>({data:[{id:1,nome:"Sítio de teste"}]})}));
vi.mock("../../../financeiro/PainelCadastro",()=>({classeInput:"",PainelCadastro:({titulo,children,rodape}:{titulo:string;children:React.ReactNode;rodape:React.ReactNode})=><div role="dialog" aria-label={titulo}><h2>{titulo}</h2>{children}{rodape}</div>}));
vi.mock("./planner-api",async importar=>({...await importar<typeof import("./planner-api")>(),consultarPlanner:vi.fn(),listarSelecoes:vi.fn(),carregarPreviaCompleta:vi.fn(),incluirGrupo:vi.fn()}));
const grupo=(n:number):GrupoPlanner=>({grupo:{origem:"PROTOCOLO",identidade:String(n)},nome:`Protocolo ${n}`,secao:"REPRODUCAO",janela:"DIA",tipo:"TAREFA_IATF",protocolo:{id:String(n),nome:`Protocolo ${n}`,versao:1},turma:{id:String(n),nome:`Turma ${n}`},etapa:{id:String(n),nome:"Avaliação",ordem:1},previstaPara:"2026-10-14",precisaoTemporal:"DIA",criterios:null,totalAnimais:1,totalProcedimentos:1,emVisitaAberta:0});
const previa=(g:GrupoPlanner):PreviaPlanner=>({grupo:g,animais:[{animalId:"vaca",brinco:"100",tarefaId:null,motivos:["Motivo do teste"],visitasAbertas:[]}],total:1,pagina:1,tamanhoPagina:200,fingerprint:`fingerprint-${g.nome}`});
const visita:Visita={id:"visita",propriedadeId:1,data:"2026-10-14",nome:"Visita",status:"ABERTA",atividades:[],impressoes:[]};
beforeEach(()=>{vi.clearAllMocks();vi.mocked(consultarPlanner).mockResolvedValue({grupos:[grupo(1),grupo(2)],totalGrupos:2,totais:{animaisUnicos:1,procedimentos:2},pagina:1,tamanhoPagina:200});vi.mocked(listarSelecoes).mockResolvedValue({selecoes:[]});vi.mocked(carregarPreviaCompleta).mockImplementation(async(_p,_d,g)=>previa(grupo(g.origem==="PROTOCOLO"?Number(g.identidade):1)));});
afterEach(cleanup);
async function selecionar(n:number){fireEvent.click(await screen.findByRole("checkbox",{name:`Selecionar Protocolo ${n}`}));await screen.findByRole("dialog");fireEvent.click(screen.getByRole("button",{name:"Usar grupo revisado"}));}
describe("planner da visita",()=>{
 it("exige revisão antes da inclusão e mantém apenas pendentes após falha parcial, com a mesma chave no reenvio",async()=>{
  const mudou=vi.fn().mockResolvedValue(undefined);vi.mocked(incluirGrupo).mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("Rede indisponível")).mockResolvedValueOnce({});
  render(<PlannerVisita visita={visita} podeLancar onMudou={mudou} onExtra={vi.fn()}/>);
  await selecionar(1);await selecionar(2);expect(incluirGrupo).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"Preparar visita"}));
  await screen.findByText(/Rede indisponível/);await waitFor(()=>expect(mudou).toHaveBeenCalledTimes(1));
  expect((screen.getByRole("checkbox",{name:"Selecionar Protocolo 1"}) as HTMLInputElement).checked).toBe(false);
  expect((screen.getByRole("checkbox",{name:"Selecionar Protocolo 2"}) as HTMLInputElement).checked).toBe(true);
  const chave=vi.mocked(incluirGrupo).mock.calls[1]?.[1].chave;
  fireEvent.click(screen.getByRole("button",{name:"Preparar visita"}));
  await waitFor(()=>expect(incluirGrupo).toHaveBeenCalledTimes(3));expect(vi.mocked(incluirGrupo).mock.calls[2]?.[1].chave).toBe(chave);
 });
 it("bloqueia reenvio de uma revisão que recebeu conflito",async()=>{
  vi.mocked(incluirGrupo).mockRejectedValue(new RebanhoApiError("Contexto alterado",409));
  render(<PlannerVisita visita={visita} podeLancar onMudou={vi.fn()} onExtra={vi.fn()}/>);
  await selecionar(1);fireEvent.click(screen.getByRole("button",{name:"Preparar visita"}));
  await screen.findByText(/Contexto alterado/);expect((screen.getByRole("button",{name:"Preparar visita"}) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("checkbox",{name:"Selecionar Protocolo 1"}) as HTMLInputElement).checked).toBe(true);
 });
 it("mantém a consulta disponível sem ações de escrita",async()=>{
  render(<PlannerVisita visita={visita} podeLancar={false} onMudou={vi.fn()} onExtra={vi.fn()}/>);
  await screen.findByText("Protocolo 1");expect(screen.queryByRole("button",{name:"Preparar visita"})).toBeNull();expect(screen.queryByRole("button",{name:"Gerenciar seleções"})).toBeNull();
  expect((screen.getByRole("checkbox",{name:"Selecionar Protocolo 1"}) as HTMLInputElement).disabled).toBe(true);
 });
});
