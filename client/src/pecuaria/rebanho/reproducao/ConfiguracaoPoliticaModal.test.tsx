// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { executarComGuardaNavegacao } from "../../../navegacaoGuardada";
import { ConfiguracaoReprodutiva } from "./ConfiguracaoReprodutiva";
import { ConfiguracaoAcompanhamento } from "./ConfiguracaoAcompanhamento";
import { criarPolitica, listarPoliticas, type PoliticaElegibilidade } from "./elegibilidade-api";
vi.mock("./elegibilidade-api", () => ({ criarPolitica: vi.fn(), listarPoliticas: vi.fn() }));
vi.mock("./api", () => ({ reqV4: vi.fn(async () => []) }));
const politica: PoliticaElegibilidade = { id: "vigente", versao: 1, vigenteDesde: "2020-01-01", parametros: { versao: 1, metodologia: "IDEAGRI_IILB_BASE_V1", pevPrimiparasDias: 0, pevMultiparasDias: 60, aborto: "LIBERACAO_EXPLICITA", pevAposAbortoDias: null, descarte: "EXCLUIR", restricoes: "EXCLUIR", perdaGestacional: "EXIGE_LIBERACAO", papeisIncluidos: ["NENHUM"] } };
beforeEach(() => { vi.mocked(listarPoliticas).mockResolvedValue([politica]); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("edita os valores vigentes na página e protege o rascunho ao cancelar", async () => {
  render(<ConfiguracaoReprodutiva propriedadeId={7} podeLancar/>);
  await screen.findByText(/Política vigente/);
  expect(screen.getByText("0 dias")).toBeTruthy();
  expect(screen.getByLabelText("PEV após primeiro parto (dias)")).toHaveProperty("value", "0");
  const modal = screen.getByRole("region", { name: "Regras de aptidão e indicadores" });
  fireEvent.change(within(modal).getByLabelText("PEV após primeiro parto (dias)"), { target: { value: "42" } });
  fireEvent.click(within(modal).getByRole("button", { name: "Cancelar" }));
  expect(screen.getByRole("dialog", { name: "Descartar alterações?" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
  expect(screen.getByLabelText("PEV após primeiro parto (dias)")).toHaveProperty("value", "42");
  fireEvent.click(within(modal).getByRole("button", { name: "Cancelar" }));
  fireEvent.click(screen.getByRole("button", { name: "Descartar alterações" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByLabelText("PEV após primeiro parto (dias)")).toHaveProperty("value", "0");
  expect(criarPolitica).not.toHaveBeenCalled();
});
it("protege alteração feita por botão no acompanhamento e não descarta ao recusar saída", async () => {
  render(<ConfiguracaoAcompanhamento propriedadeId={7} podeLancar/>);
  await screen.findByRole("region", { name: "Prazos de acompanhamento" });
  const modal = screen.getByRole("region", { name: "Prazos de acompanhamento" });
  fireEvent.click(within(modal).getByRole("button", { name: "Adicionar reconfirmação" }));
  fireEvent.click(within(modal).getByRole("button", { name: "Cancelar" }));
  fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
  expect(screen.getByText("Reconfirmação 1")).toBeTruthy();
});

it("recusar troca de sítio ou rota mantém a página e seus valores", async () => {
  render(<ConfiguracaoReprodutiva propriedadeId={7} podeLancar/>);
  await screen.findByText(/Política vigente/);
  fireEvent.change(screen.getByLabelText("PEV após primeiro parto (dias)"), { target: { value: "42" } });
  const navegar = vi.fn();
  let saida: void | Promise<boolean> = undefined;
  act(() => { saida = executarComGuardaNavegacao(navegar); });
  expect(screen.getByRole("dialog", { name: "Descartar alterações?" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
  await act(async () => { await saida; });
  expect(navegar).not.toHaveBeenCalled();
  expect(screen.getByLabelText("PEV após primeiro parto (dias)")).toHaveProperty("value", "42");
  act(() => { saida = executarComGuardaNavegacao(navegar); });
  fireEvent.click(screen.getByRole("button", { name: "Descartar alterações" }));
  await act(async () => { await saida; });
  expect(navegar).toHaveBeenCalledTimes(1);
});

it("falha ao salvar conserva os campos e a chave idempotente na nova tentativa", async () => {
  vi.mocked(criarPolitica).mockRejectedValueOnce(new Error("Falha temporária")).mockResolvedValueOnce(politica);
  render(<ConfiguracaoReprodutiva propriedadeId={7} podeLancar/>);
  await screen.findByText(/Política vigente/);
  const formulario = screen.getByRole("region", { name: "Regras de aptidão e indicadores" });
  for (const [rotulo, value] of [["Vigente desde", "2026-10-30"], ["PEV após primeiro parto (dias)", "0"], ["PEV após demais partos (dias)", "60"], ["Após aborto", "LIBERACAO_EXPLICITA"], ["Matrizes em descarte", "EXCLUIR"], ["Restrições reprodutivas", "EXCLUIR"], ["Após perda gestacional", "EXIGE_LIBERACAO"], ["Motivo da alteração", "Revisão com o responsável"]]) fireEvent.change(within(formulario).getByLabelText(rotulo), { target: { value } });
  fireEvent.submit((screen.getByRole("button", { name: "Salvar alterações" }) as HTMLButtonElement).form!);
  await screen.findByText("Falha temporária");
  expect(screen.getByLabelText("PEV após primeiro parto (dias)")).toHaveProperty("value", "0");
  const primeira = vi.mocked(criarPolitica).mock.calls[0][0];
  expect(primeira).toMatchObject({ propriedadeId: 7, parametros: { pevPrimiparasDias: 0, pevMultiparasDias: 60 } });
  fireEvent.submit((screen.getByRole("button", { name: "Salvar alterações" }) as HTMLButtonElement).form!);
  await screen.findByText(/Alterações salvas/);
  expect(criarPolitica).toHaveBeenNthCalledWith(2, primeira);
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("duas configurações alteradas exigem a confirmação de ambas antes de sair", async () => {
  render(<ConfiguracaoReprodutiva propriedadeId={7} podeLancar/>);
  const aptidao = await screen.findByRole("region", {name:"Regras de aptidão e indicadores"});
  const acompanhamento = await screen.findByRole("region", {name:"Prazos de acompanhamento"});
  fireEvent.change(within(aptidao).getByLabelText("PEV após primeiro parto (dias)"), {target:{value:"42"}});
  fireEvent.click(within(acompanhamento).getByRole("button", {name:"Adicionar reconfirmação"}));
  const navegar = vi.fn();
  let saida: void | Promise<boolean> = undefined;
  act(() => { saida = executarComGuardaNavegacao(navegar); });
  fireEvent.click(await screen.findByRole("button", {name:"Descartar alterações"}));
  fireEvent.click(await screen.findByRole("button", {name:"Continuar editando"}));
  await act(async () => { await saida; });
  expect(navegar).not.toHaveBeenCalled();
  expect(within(aptidao).getByLabelText("PEV após primeiro parto (dias)")).toHaveProperty("value","42");
  expect(within(acompanhamento).getByText("Reconfirmação 1")).toBeTruthy();
});
