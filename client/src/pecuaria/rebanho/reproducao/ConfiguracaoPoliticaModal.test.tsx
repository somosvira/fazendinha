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
it("mostra a política vigente antes de oferecer criação e protege o rascunho ao cancelar", async () => {
  render(<ConfiguracaoReprodutiva propriedadeId={7} podeLancar/>);
  await screen.findByText(/Política vigente/);
  expect(screen.getByText("0 dias")).toBeTruthy();
  expect(screen.queryByLabelText("PEV após primeiro parto (dias)")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Nova versão da política" }));
  const modal = screen.getByRole("dialog", { name: "Nova versão da política" });
  fireEvent.change(within(modal).getByLabelText("PEV após primeiro parto (dias)"), { target: { value: "42" } });
  fireEvent.click(within(modal).getByRole("button", { name: "Cancelar" }));
  expect(screen.getByRole("dialog", { name: "Descartar alterações?" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
  expect(screen.getByLabelText("PEV após primeiro parto (dias)")).toHaveProperty("value", "42");
  fireEvent.click(within(modal).getByRole("button", { name: "Cancelar" }));
  fireEvent.click(screen.getByRole("button", { name: "Descartar alterações" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Nova versão da política" }));
  expect(screen.getByLabelText("PEV após primeiro parto (dias)")).toHaveProperty("value", "");
  expect(criarPolitica).not.toHaveBeenCalled();
});
it("protege alteração feita por botão no acompanhamento e não descarta ao recusar saída", async () => {
  render(<ConfiguracaoAcompanhamento propriedadeId={7} podeLancar/>);
  expect(screen.queryByLabelText("Vigente desde")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Nova versão de acompanhamento" }));
  const modal = screen.getByRole("dialog", { name: "Nova versão de acompanhamento" });
  fireEvent.click(within(modal).getByRole("button", { name: "Adicionar reconfirmação" }));
  fireEvent.click(within(modal).getByRole("button", { name: "Cancelar" }));
  fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
  expect(screen.getByText("Reconfirmação 1")).toBeTruthy();
});

it("recusar troca de sítio ou rota mantém o modal e seus valores", async () => {
  render(<ConfiguracaoReprodutiva propriedadeId={7} podeLancar/>);
  await screen.findByText(/Política vigente/);
  fireEvent.click(screen.getByRole("button", { name: "Nova versão da política" }));
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
  fireEvent.click(screen.getByRole("button", { name: "Nova versão da política" }));
  for (const [rotulo, value] of [["Vigente desde", "2026-10-30"], ["PEV após primeiro parto (dias)", "0"], ["PEV após demais partos (dias)", "60"], ["Após aborto", "LIBERACAO_EXPLICITA"], ["Matrizes em descarte", "EXCLUIR"], ["Restrições reprodutivas", "EXCLUIR"], ["Após perda gestacional", "EXIGE_LIBERACAO"], ["Motivo da nova versão", "Revisão com o responsável"]]) fireEvent.change(screen.getByLabelText(rotulo), { target: { value } });
  fireEvent.click(screen.getByLabelText("Nenhum"));
  fireEvent.submit((screen.getByRole("button", { name: "Registrar versão da política" }) as HTMLButtonElement).form!);
  await screen.findByText("Falha temporária");
  expect(screen.getByLabelText("PEV após primeiro parto (dias)")).toHaveProperty("value", "0");
  const primeira = vi.mocked(criarPolitica).mock.calls[0][0];
  expect(primeira).toMatchObject({ propriedadeId: 7, parametros: { pevPrimiparasDias: 0, pevMultiparasDias: 60 } });
  fireEvent.submit((screen.getByRole("button", { name: "Registrar versão da política" }) as HTMLButtonElement).form!);
  await screen.findByText(/Nova versão registrada/);
  expect(criarPolitica).toHaveBeenNthCalledWith(2, primeira);
  expect(screen.queryByRole("dialog")).toBeNull();
});
