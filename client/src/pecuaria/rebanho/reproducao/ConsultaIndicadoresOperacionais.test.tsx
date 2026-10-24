// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { abrirFiltrosConsulta, aplicarFiltrosConsulta, alterarControle } from "@/lib/controles.fixture";
import { ConsultaIndicadoresOperacionais } from "./ConsultaIndicadoresOperacionais";
import { consultarIndicadores, type FiltrosIndicadores, type SnapshotIndicadoresReprodutivos } from "./indicadores-api";
vi.mock("./api",()=>({reqV4:vi.fn().mockResolvedValue([{id:"l1",nome:"Novilhas"}])}));
vi.mock("./indicadores-api",()=>({consultarIndicadores:vi.fn()}));
function snapshot(f:FiltrosIndicadores):SnapshotIndicadoresReprodutivos {
  const contagens={vaziasAptasInicio:2,negativasAnteriores:0,anterioresSemDiagnostico:0,estimativaVaziasAnteriores:0,saidasPev:0,contribuicaoPev:0,elegiveisConhecidas:2,elegiveis:2,matrizesServidas:1,tentativas:1,positivas:1,negativas:0,abertas:0,naoClassificaveis:0,denominadorConcepcao:1,animaisComPendenciaElegibilidade:1};
  const taxas={servico:50,concepcao:100,prenhez:50};
  const baseCalculo={animaisValidos:2,animaisPendentes:1,participacoesValidas:2,participacoesPendentes:1,parcial:true};
  return {versao:2,versaoMetodologia:"FAZENDINHA_IDEAGRI_IILB_V2_BASE_VALIDA",filtros:f,metodologia:{rotulo:"Base válida",fontes:[],regras:[],deslocamentoTeDias:7,concepcaoEstimada:null},sobraInicial:null,periodos:[{id:"p",inicio:f.inicio,fim:f.fim,contagens,taxas,baseCalculo,pendencias:["ELEGIBILIDADE_PENDENTE"],maturidade:{corte:f.corte,diasAposFim:0,tentativasAbertas:0},detalhamento:[]}],totais:{contagens,taxas,baseCalculo,animaisUnicos:2,participacoesAnimalPeriodo:2},pendencias:["ELEGIBILIDADE_PENDENTE"]};
}
beforeEach(()=>{vi.clearAllMocks();window.history.replaceState(null,"","/pecuaria/reproducao?rotina=indicadores");vi.mocked(consultarIndicadores).mockImplementation(async f=>snapshot(f));});
afterEach(cleanup);
it("apresenta taxas parciais sem bloquear a base válida e aplica apenas o rascunho confirmado",async()=>{
  render(<ConsultaIndicadoresOperacionais propriedadeId={7}/>);
  await screen.findByText("Resultado parcial · 1 animal com pendência");
  expect(screen.getAllByText("50%").length).toBeGreaterThan(0);
  expect(screen.queryByText("Memória de cálculo")).toBeNull();
  await abrirFiltrosConsulta();
  await alterarControle(screen.getByLabelText("Lote"),{target:{value:"l1"}});
  expect(screen.getByText(/Alterações ainda não aplicadas/)).toBeTruthy();
  const chamadas=vi.mocked(consultarIndicadores).mock.calls.length;
  fireEvent.click(screen.getByRole("button",{name:"Cancelar"}));
  expect(consultarIndicadores).toHaveBeenCalledTimes(chamadas);
  await abrirFiltrosConsulta();
  await alterarControle(screen.getByLabelText("Lote"),{target:{value:"l1"}});
  await aplicarFiltrosConsulta();
  await waitFor(()=>expect(consultarIndicadores).toHaveBeenLastCalledWith(expect.objectContaining({propriedadeId:7,loteId:"l1"})));
  expect(window.location.search).toContain("indicadoresLote=l1");
  expect(screen.getByRole("button",{name:"Remover filtro: Lote: Novilhas"})).toBeTruthy();
});
it("ignora uma resposta de outro sítio",async()=>{
  let resolver!:(s:SnapshotIndicadoresReprodutivos)=>void;let anterior!:FiltrosIndicadores;
  vi.mocked(consultarIndicadores).mockImplementationOnce(f=>{anterior=f;return new Promise(r=>{resolver=r;});});
  const {rerender}=render(<ConsultaIndicadoresOperacionais propriedadeId={7}/>);
  await waitFor(()=>expect(resolver).toBeTypeOf("function"));
  rerender(<ConsultaIndicadoresOperacionais propriedadeId={8}/>);
  await screen.findByText(/Resultado parcial/);
  resolver({...snapshot(anterior),totais:{...snapshot(anterior).totais,taxas:{servico:99,concepcao:99,prenhez:99}}});
  await waitFor(()=>expect(screen.queryByText("99%")).toBeNull());
});
