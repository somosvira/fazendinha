// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Visitas } from "./Visitas";
import { AcompanhamentoReprodutivo } from "./AcompanhamentoReprodutivo";
import { listarVisitas, obterSugestoesVisita, type SugestoesVisita } from "./visitas-api";
const escopo = vi.hoisted(() => ({ propriedadeId: null as number | null }));
vi.mock("../../../api/propriedades", () => ({ usePropriedades: () => ({ data: [{ id: 7, nome: "Escola", ativo: true }] }) }));
vi.mock("../../../propriedadeScope", async original => ({ ...await original<typeof import("../../../propriedadeScope")>(), getPropriedadeAtiva: () => escopo.propriedadeId }));
vi.mock("./visitas-api", async original => ({ ...await original<typeof import("./visitas-api")>(), listarVisitas: vi.fn(), obterSugestoesVisita: vi.fn() }));
const vazio: SugestoesVisita = { animais: [], tarefasSanitarias: [], tarefasIatf: [], protocolosSanitarios: [], protocolosIatf: [], retornos: [] };
beforeEach(() => { vi.resetAllMocks(); localStorage.clear(); escopo.propriedadeId = null; window.history.replaceState({}, "", "/pecuaria/visitas"); });
afterEach(cleanup);
it("lista distingue carregamento, ausência consolidada e ausência no sítio", async () => {
  let resolver!: (v: []) => void;
  vi.mocked(listarVisitas).mockReturnValue(new Promise(resolve => { resolver = resolve; }));
  const tela = render(<Visitas podeLancar={false}/>);
  expect(screen.getByRole("status").textContent).toContain("Carregando visitas");
  expect(screen.queryByText(/Nenhuma visita/)).toBeNull();
  await act(async () => resolver([]));
  expect(screen.getByText("Nenhuma visita nos sítios disponíveis.")).toBeTruthy();
  expect(screen.queryByText(/Use Nova visita/)).toBeNull();
  tela.unmount(); escopo.propriedadeId = 7;
  vi.mocked(listarVisitas).mockResolvedValue([]);
  render(<Visitas podeLancar/>);
  await screen.findByText("Nenhuma visita neste sítio.");
  expect(screen.getByText(/Use Nova visita/)).toBeTruthy();
});
it("falha de leitura não afirma ausência de visitas", async () => {
  vi.mocked(listarVisitas).mockRejectedValue(new Error("Visitas indisponíveis"));
  render(<Visitas podeLancar/>);
  await screen.findByRole("alert");
  expect(screen.queryByText(/Nenhuma visita/)).toBeNull();
});
it("lista apresenta datas brasileiras e situação legível", async () => {
  vi.mocked(listarVisitas).mockResolvedValue([{ id: "v1", propriedadeId: 7, nome: "Manejo das matrizes", data: "2026-10-17", status: "ABERTA", responsavel: "Veterinária" }]);
  render(<Visitas podeLancar={false}/>);
  await screen.findByText("Manejo das matrizes");
  expect(screen.getByText("17/10/2026")).toBeTruthy();
  expect(screen.getByText("Aberta")).toBeTruthy();
  expect(screen.getByText("Veterinária")).toBeTruthy();
  expect(screen.queryByText("ABERTA")).toBeNull();
});
it("agenda oculta o sítio anterior enquanto consulta outro e ignora resposta obsoleta", async () => {
  let resolverSegundo!: (v: SugestoesVisita) => void;
  let resolverTerceiro!: (v: SugestoesVisita) => void;
  vi.mocked(obterSugestoesVisita).mockResolvedValueOnce({ ...vazio, retornos: [{ origem: "PREVISAO_PARTO", origemId: "p1", animalId: "VACA-7", data: "2026-11-02", status: "PREVISTO", propriedadeId: 7 }] })
    .mockReturnValueOnce(new Promise(resolve => { resolverSegundo = resolve; }))
    .mockReturnValueOnce(new Promise(resolve => { resolverTerceiro = resolve; }));
  const tela = render(<AcompanhamentoReprodutivo atualizacao={0} propriedadeId={7}/>);
  await screen.findAllByText("02/11/2026");
  tela.rerender(<AcompanhamentoReprodutivo atualizacao={0} propriedadeId={8}/>);
  expect(screen.queryByText("VACA-7")).toBeNull();
  expect(screen.queryByText(/Nenhum retorno/)).toBeNull();
  tela.rerender(<AcompanhamentoReprodutivo atualizacao={0} propriedadeId={9}/>);
  await act(async () => resolverTerceiro(vazio));
  await screen.findByText(/Nenhum retorno ou previsão com os critérios atuais/);
  await act(async () => resolverSegundo({ ...vazio, retornos: [{ origem: "PREVISAO_PARTO", origemId: "p2", animalId: "VACA-8", data: "2026-11-02", status: "PREVISTO", propriedadeId: 8 }] }));
  expect(screen.queryByText("VACA-8")).toBeNull();
});
it("falha na agenda não é apresentada como agenda vazia", async () => {
  vi.mocked(obterSugestoesVisita).mockRejectedValue(new Error("Agenda indisponível"));
  render(<AcompanhamentoReprodutivo atualizacao={0} propriedadeId={7}/>);
  await screen.findByRole("alert");
  expect(screen.queryByText(/Nenhum retorno/)).toBeNull();
  expect(screen.queryByRole("status")).toBeNull();
});

it("agenda mantém sem previsão ao final nas duas ordens e retorna com contexto", async () => {
  window.history.replaceState({}, "", "/pecuaria/reproducao?rotina=agenda&sitio=7&agendaInicio=2026-10-01&agendaFim=2026-10-31");
  vi.mocked(obterSugestoesVisita).mockResolvedValue({ ...vazio, retornos: [
    { origem: "TAREFA_IATF", origemId: "t1", animalId: "a", data: "2020-01-01", status: "PREVISAO_PENDENTE", propriedadeId: 7, programacaoId: "p" },
    { origem: "PREVISAO_PARTO", origemId: "g", animalId: "b", data: "2026-10-20", status: "PREVISTO", propriedadeId: 7 },
  ] });
  render(<AcompanhamentoReprodutivo atualizacao={0} propriedadeId={7}/>);
  await screen.findAllByText("20/10/2026");
  fireEvent.click(screen.getByRole("button", { name: "Tabela" }));
  expect(screen.getAllByRole("row")[1].textContent).toContain("20/10/2026");
  expect(screen.getAllByRole("row")[2].textContent).toContain("Previsão a definir");
  fireEvent.click(screen.getByRole("button", { name: "Data crescente" }));
  expect(screen.getAllByRole("row")[2].textContent).toContain("Previsão a definir");
  expect(new URLSearchParams(window.location.search).get("agendaOrdem")).toBe("desc");
  fireEvent.click(screen.getAllByRole("link", { name: "Ver ação" })[1]);
  expect(window.location.pathname).toBe("/pecuaria/reproducao/programacoes/p");
  const retorno=new URLSearchParams(window.location.search).get("retorno");
  expect(retorno).toContain("rotina=agenda"); expect(retorno).toContain("agendaOrdem=desc");
});

it("agenda filtra o dia exibido em São Paulo para HORA e preserva o dia civil para DIA",async()=>{
 window.history.replaceState({},"","/pecuaria/reproducao?rotina=agenda&agendaInicio=2026-10-18&agendaFim=2026-10-18");
 vi.mocked(obterSugestoesVisita).mockResolvedValue({...vazio,animais:[],retornos:[
  {origem:"TAREFA_IATF",origemId:"hora",animalId:"a",data:"2026-10-19T00:30:00Z",precisaoTemporal:"HORA",status:"PENDENTE",propriedadeId:7,programacaoId:"p"},
  {origem:"TAREFA_IATF",origemId:"dia",animalId:"b",data:"2026-10-18T00:00:00Z",precisaoTemporal:"DIA",status:"PENDENTE",propriedadeId:7,programacaoId:"p"},
  {origem:"TAREFA_IATF",origemId:"fora",animalId:"c",data:"2026-10-19T00:00:00Z",precisaoTemporal:"DIA",status:"PENDENTE",propriedadeId:7,programacaoId:"p"},
 ]});
 render(<AcompanhamentoReprodutivo atualizacao={0} propriedadeId={7}/>);
 await screen.findAllByText("18/10/2026, 21:30");
 fireEvent.click(screen.getByRole("button", {name:"Tabela"}));
 expect(screen.getAllByRole("row")).toHaveLength(3);
 expect(screen.getAllByText("18/10/2026 · horário não informado").length).toBeGreaterThan(0);
});
