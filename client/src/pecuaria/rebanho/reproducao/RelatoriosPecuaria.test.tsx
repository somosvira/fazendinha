// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RelatoriosPecuaria } from "./RelatoriosPecuaria";
import { reqV4 } from "./api";
import { setPropriedadeAtiva } from "../../../propriedadeScope";
vi.mock("./api", () => ({ reqV4: vi.fn().mockResolvedValue([]) }));
beforeEach(() => { vi.clearAllMocks(); vi.mocked(reqV4).mockImplementation(async caminho=>{
 if(caminho.startsWith('/reproducao/indicadores?'))return {versao:1,versaoMetodologia:'teste',metodologia:{rotulo:'Teste',fontes:[],regras:[],deslocamentoTeDias:7,concepcaoEstimada:null},filtros:{propriedadeId:7,inicio:'2026-01-01',fim:'2026-10-27',corte:'2026-10-27',deslocamentoTeDias:7},sobraInicial:null,periodos:[],totais:{contagens:{vaziasAptasInicio:0,negativasAnteriores:0,anterioresSemDiagnostico:0,estimativaVaziasAnteriores:null,saidasPev:0,contribuicaoPev:0,elegiveisConhecidas:0,elegiveis:null,matrizesServidas:0,tentativas:0,positivas:0,negativas:0,abertas:0,naoClassificaveis:0,denominadorConcepcao:0,animaisComPendenciaElegibilidade:0},taxas:{servico:null,concepcao:null,prenhez:null},animaisUnicos:0,participacoesAnimalPeriodo:0},pendencias:[]};
 if(caminho.startsWith('/reproducao/relatorios/partos?'))return {versao:1,emitidoEm:'2026-10-27',propriedadeId:7,periodo:{inicio:'2026-01-01',fim:'2026-10-27'},totalPartos:0,partos:[]};return [];
 });setPropriedadeAtiva(7); window.history.replaceState(null, "", "/pecuaria/relatorios"); });
afterEach(() => { cleanup(); setPropriedadeAtiva(null); });
it("mantém acesso às emissões dos dois tipos e navega pelo histórico da URL", async () => {
  render(<RelatoriosPecuaria podeLancar={false}/>);
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/relatorios/emissoes?tipo=PARTOS&propriedadeId=7", undefined, "GET", 7));
  fireEvent.click(screen.getByRole('button',{name:'Período e filtros'}));
  expect(screen.getByLabelText("Início (inclusive)")).toBeTruthy();
  fireEvent.keyDown(screen.getByRole('dialog'),{key:'Escape'});
  await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Indicadores reprodutivos" }),{button:0,ctrlKey:false});
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/relatorios/emissoes?tipo=INDICADORES&propriedadeId=7", undefined, "GET", 7));
  expect(window.location.search).toBe("?tipo=indicadores");
  fireEvent.pointerDown(screen.getByRole('button',{name:'Exportar relatório'}), {button:0,ctrlKey:false,pointerType:'mouse'});
  fireEvent.click(await screen.findByRole('menuitem',{name:'Emissões anteriores'}));
  expect(screen.getByLabelText("Emissões preservadas")).toBeTruthy();
  fireEvent.keyDown(screen.getByRole('dialog'),{key:'Escape'});
  await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
  expect(vi.mocked(reqV4).mock.calls.every(([, body]) => body === undefined)).toBe(true);
  window.history.pushState(null, "", "/pecuaria/relatorios?tipo=partos"); fireEvent(window, new PopStateEvent("popstate"));
  expect(screen.getByRole('tab',{name:'Partos e pós-parto'}).getAttribute('aria-selected')).toBe('true');
});
