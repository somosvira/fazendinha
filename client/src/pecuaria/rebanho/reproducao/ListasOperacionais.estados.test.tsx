// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Visitas } from "./Visitas";
import { AcompanhamentoReprodutivo } from "./AcompanhamentoReprodutivo";
import { listarVisitas, obterSugestoesVisita, type SugestoesVisita } from "./visitas-api";
const escopo = vi.hoisted(() => ({ propriedadeId: null as number | null }));
vi.mock("../../../api/propriedades", () => ({ usePropriedades: () => ({ data: [{ id: 7, nome: "Escola", ativo: true }] }) }));
vi.mock("../../../propriedadeScope", async original => ({ ...await original<typeof import("../../../propriedadeScope")>(), getPropriedadeAtiva: () => escopo.propriedadeId }));
vi.mock("./visitas-api", async original => ({ ...await original<typeof import("./visitas-api")>(), listarVisitas: vi.fn(), obterSugestoesVisita: vi.fn() }));
const vazio: SugestoesVisita = { animais: [], tarefasSanitarias: [], tarefasIatf: [], protocolosSanitarios: [], protocolosIatf: [], retornos: [] };
beforeEach(() => { vi.resetAllMocks(); escopo.propriedadeId = null; window.history.replaceState({}, "", "/pecuaria/visitas"); });
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
  await screen.findByText("VACA-7"); expect(screen.getByText("02/11/2026")).toBeTruthy();
  tela.rerender(<AcompanhamentoReprodutivo atualizacao={0} propriedadeId={8}/>);
  expect(screen.queryByText("VACA-7")).toBeNull();
  expect(screen.queryByText(/Nenhum retorno/)).toBeNull();
  tela.rerender(<AcompanhamentoReprodutivo atualizacao={0} propriedadeId={9}/>);
  await act(async () => resolverTerceiro(vazio));
  await screen.findByText("Nenhum retorno ou previsão com os critérios atuais.");
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
