// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ req: vi.fn(), confirmar: vi.fn(), salvar: vi.fn(), sugestoes: vi.fn() }));
vi.mock("./api", () => ({ reqV4: mocks.req, obterReproducao: vi.fn() }));
vi.mock("./visitas-api", async original => ({ ...await original<typeof import("./visitas-api")>(), confirmarVisita: mocks.confirmar, salvarRascunhoVisita: mocks.salvar, obterSugestoesVisita: mocks.sugestoes }));
vi.mock("./FormReproducao", () => ({ FormReproducao: () => null }));
vi.mock("./Iatf", () => ({ Iatf: () => null }));
vi.mock("./AcoesReprodutivas", () => ({ AcoesReprodutivas: () => null }));
import { Transcricao } from "./TranscricaoVisita";
import type { AtividadeVisita, Visita } from "./visitas-api";
const atividade: AtividadeVisita = { id: "at", nome: "Grupo livre", tipo: "AVALIACAO_REPRODUTIVA", extra: false, contexto: { percursoVisita: { versao: 1, origem: "LIVRE" } }, participantes: [
 { id: "pa", animalId: "a", ordem: 1, status: "PENDENTE", versaoRascunho: 1, snapshot: { brinco: "100", nome: "Aurora", lote: { id: "l", nome: "Lote preservado" } }, rascunho: { resultado: "NAO_AVALIADO", anotacaoOriginal: "Rascunho exclusivo Aurora" } },
 { id: "pb", animalId: "b", ordem: 2, status: "PENDENTE", versaoRascunho: 1, snapshot: { brinco: "200", nome: "Brisa", lote: { id: "l", nome: "Lote preservado" } }, rascunho: { resultado: "NAO_AVALIADO", anotacaoOriginal: "Rascunho exclusivo Brisa" } },
] };
const visita: Visita = { id: "v", nome: "Seleção livre", propriedadeId: 7, data: "2026-01-20", status: "ABERTA", atividades: [atividade], impressoes: [] };
beforeEach(() => {
 vi.resetAllMocks(); window.history.replaceState(null, "", "/pecuaria/visitas/v"); vi.spyOn(window, "scrollTo").mockImplementation(() => {});
 mocks.req.mockImplementation(async url => url.includes("tipos-exame") || url.includes("alertas-sanitarios") ? [] : url.startsWith("/reproducao?") ? { animais: [], tentativas: [], avaliacoes: [], partos: [], restricoes: [] } : { fingerprint: "a".repeat(64), participantes: [] });
 mocks.sugestoes.mockResolvedValue({ animais: [], tarefasSanitarias: [], tarefasIatf: [], protocolosSanitarios: [], protocolosIatf: [] });
 mocks.confirmar.mockResolvedValue({}); mocks.salvar.mockResolvedValue({ versaoRascunho: 2 });
});
afterEach(async () => { await new Promise(resolve => requestAnimationFrame(() => resolve(undefined))); cleanup(); vi.restoreAllMocks(); });
describe("seleção livre individual — contraprovas independentes", () => {
 it("abrir e confirmar Aurora não confirma o rascunho de Brisa", async () => {
  render(<Transcricao visita={visita} atividade={atividade} podeLancar onMudou={vi.fn().mockResolvedValue(undefined)}/>);
  expect(screen.getByRole("button", { name: "Conferir resultados (0)" })).toHaveProperty("disabled", true); expect(mocks.confirmar).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Abrir atendimento de 100 · Aurora" }));
  fireEvent.click(screen.getByRole("button", { name: "Conferir resultados (1)" }));
  const revisao = screen.getByRole("region", { name: "Revisão do subconjunto" }); expect(within(revisao).queryByText(/200:/)).toBeNull();
  fireEvent.click(within(revisao).getByRole("button", { name: "Confirmar 1 atendimento(s)" }));
  await waitFor(() => expect(mocks.confirmar).toHaveBeenCalledTimes(1));
  expect(mocks.confirmar.mock.calls[0][2].itens).toEqual([expect.objectContaining({ participanteId: "pa", dados: expect.objectContaining({ anotacaoOriginal: "Rascunho exclusivo Aurora" }) })]);
  expect(mocks.salvar.mock.calls.some(([, participanteId]) => participanteId === "pb")).toBe(false);
 });
 it("voltar mantém busca, contexto e rascunho sem confirmar atendimento ao navegar", async () => {
  render(<Transcricao visita={visita} atividade={atividade} podeLancar onMudou={vi.fn().mockResolvedValue(undefined)}/>);
  fireEvent.change(screen.getByLabelText("Buscar por brinco ou nome"), { target: { value: "Aurora" } });
  fireEvent.click(screen.getByRole("button", { name: "Abrir atendimento de 100 · Aurora" }));
  const anotacao = screen.getByLabelText("Anotação original · 100"); fireEvent.change(anotacao, { target: { value: "Contexto do atendimento de Aurora preservado" } }); fireEvent.blur(anotacao);
  await waitFor(() => expect(mocks.salvar).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", { name: "Voltar à lista de animais" })); await screen.findByRole("button", { name: "Abrir atendimento de 100 · Aurora" });
  expect(screen.getByLabelText("Buscar por brinco ou nome")).toHaveProperty("value", "Aurora"); expect(screen.queryByRole("button", { name: "Abrir atendimento de 200 · Brisa" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Abrir atendimento de 100 · Aurora" })); expect(screen.getByLabelText("Anotação original · 100")).toHaveProperty("value", "Contexto do atendimento de Aurora preservado");
  expect(screen.getAllByText(/Lote preservado/).length).toBeGreaterThan(0); expect(mocks.confirmar).not.toHaveBeenCalled();
 });
 it("mantém o filtro de atendimento acessível ao voltar à lista livre vazia", async () => {
  render(<Transcricao visita={visita} atividade={atividade} podeLancar onMudou={vi.fn().mockResolvedValue(undefined)}/>);
  fireEvent.click(screen.getByRole("button", { name: "Abrir atendimento de 100 · Aurora" }));
  fireEvent.click(screen.getByText("Filtrar atendimentos"));
  fireEvent.change(screen.getByRole("combobox", { name: "Atendimento" }), { target: { value: "CONFIRMADO" } });
  fireEvent.click(screen.getByRole("button", { name: "Concluir filtros" }));
  fireEvent.click(screen.getByRole("button", { name: "Voltar à lista de animais" }));
  await screen.findByText("Nenhum animal nesta seleção.");
  fireEvent.click(screen.getByRole("button", { name: /Filtrar atendimentos/ }));
  const filtro = screen.getByRole("combobox", { name: "Atendimento" });
  expect(filtro).toHaveProperty("value", "CONFIRMADO");
  expect(new URLSearchParams(window.location.search).get("atividade-at-status")).toBe("CONFIRMADO");
  fireEvent.change(filtro, { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Concluir filtros" }));
  await screen.findByRole("button", { name: "Abrir atendimento de 100 · Aurora" });
  expect(screen.getByRole("button", { name: "Abrir atendimento de 200 · Brisa" })).toBeTruthy();
  expect(new URLSearchParams(window.location.search).has("atividade-at-status")).toBe(false);
  expect(mocks.confirmar).not.toHaveBeenCalled();
  expect(mocks.salvar).not.toHaveBeenCalled();
 });
 it("permite remover na lista o motivo retomado pela URL sem apagar rascunhos", async () => {
  window.history.replaceState(null, "", "/pecuaria/visitas/v?atividade-at-motivo=Retorno+previsto");
  const atividadeComMotivo: AtividadeVisita = { ...atividade, participantes: atividade.participantes.map((p, i) => ({
   ...p, snapshot: { ...p.snapshot, motivos: i === 0 ? ["Retorno previsto"] : [] },
  })) };
  render(<Transcricao visita={visita} atividade={atividadeComMotivo} podeLancar onMudou={vi.fn().mockResolvedValue(undefined)}/>);
  expect(screen.getByRole("button", { name: "Abrir atendimento de 100 · Aurora" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Abrir atendimento de 200 · Brisa" })).toBeNull();
  fireEvent.click(screen.getByText("Filtrar atendimentos"));
  const motivo = screen.getByRole("checkbox", { name: "Retorno previsto" });
  expect(motivo).toHaveProperty("checked", true);
  fireEvent.click(motivo);
  fireEvent.click(screen.getByRole("button", { name: "Concluir filtros" }));
  expect(screen.getByRole("button", { name: "Abrir atendimento de 200 · Brisa" })).toBeTruthy();
  expect(new URLSearchParams(window.location.search).getAll("atividade-at-motivo")).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: "Abrir atendimento de 100 · Aurora" }));
  expect(screen.getByLabelText("Anotação original · 100")).toHaveProperty("value", "Rascunho exclusivo Aurora");
  expect(mocks.confirmar).not.toHaveBeenCalled();
  expect(mocks.salvar).not.toHaveBeenCalled();
 });
});
