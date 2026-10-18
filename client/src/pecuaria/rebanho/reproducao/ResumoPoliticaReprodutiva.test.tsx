// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setPropriedadeAtiva } from "../../../propriedadeScope";
import { ResumoPoliticaReprodutiva } from "./ResumoPoliticaReprodutiva";
import { listarPoliticas, type PoliticaElegibilidade } from "./elegibilidade-api";
vi.mock("./elegibilidade-api", () => ({ listarPoliticas: vi.fn() }));
vi.mock("../../../lib/hoje", async original => ({ ...await original<typeof import("../../../lib/hoje")>(), getHojeISO: () => "2026-10-17" }));
beforeEach(() => { setPropriedadeAtiva(null); window.history.replaceState(null, "", "/pecuaria/reproducao?sitio=7"); });
afterEach(() => { cleanup(); vi.clearAllMocks(); setPropriedadeAtiva(null); });
const politica: PoliticaElegibilidade = { id: "p", versao: 1, vigenteDesde: "2026-01-01", parametros: { versao: 1, metodologia: "IDEAGRI_IILB_BASE_V1", pevPrimiparasDias: 0, pevMultiparasDias: 60, aborto: "LIBERACAO_EXPLICITA", pevAposAbortoDias: null, descarte: "EXCLUIR", restricoes: "EXCLUIR", perdaGestacional: "EXIGE_LIBERACAO", papeisIncluidos: ["NENHUM"] } };
it("mostra versão vigente, conserva zero e encaminha ao cadastro do mesmo sítio", async () => {
  vi.mocked(listarPoliticas).mockResolvedValue([{ ...politica, versao: 2, vigenteDesde: "2027-01-01" }, politica]);
  render(<ResumoPoliticaReprodutiva propriedadeId={7}/>);
  await screen.findByText(/Versão 1 · desde 01\/01\/2026 · PEV: 0 dias/);
  expect(screen.queryByText(/Versão 2/)).toBeNull();
  expect(screen.queryByRole("button", { name: /Registrar/ })).toBeNull();
  expect(screen.getByRole("link", { name: "Gerenciar política" }).getAttribute("href")).toBe("/configuracoes/pecuaria/reproducao/politica?sitio=7");
});
it("distingue falha de leitura de política não configurada", async () => {
  vi.mocked(listarPoliticas).mockRejectedValue(new Error("Falha na consulta"));
  render(<ResumoPoliticaReprodutiva propriedadeId={7}/>);
  await screen.findByRole("alert"); expect(screen.queryByText(/Nenhuma política vigente/)).toBeNull();
});

it("navega para gerenciar política via History API mantendo o sítio efetivo", async () => {
  vi.mocked(listarPoliticas).mockResolvedValue([politica]);
  render(<ResumoPoliticaReprodutiva propriedadeId={8}/>);
  await screen.findByText(/Versão 1/);
  const mudou = vi.fn(); window.addEventListener("popstate", mudou);
  fireEvent.click(screen.getByRole("link", { name: "Gerenciar política" }));
  expect(window.location.pathname + window.location.search).toBe("/configuracoes/pecuaria/reproducao/politica?sitio=8");
  expect(mudou).toHaveBeenCalledTimes(1);
  window.removeEventListener("popstate", mudou);
});
it("distingue ausência de política e permite repetir somente a leitura que falhou", async () => {
  vi.mocked(listarPoliticas).mockRejectedValueOnce(new Error("Falha temporária")).mockResolvedValueOnce([]);
  render(<ResumoPoliticaReprodutiva propriedadeId={7}/>);
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  await screen.findByText(/Nenhuma política vigente neste sítio/);
  expect(listarPoliticas).toHaveBeenNthCalledWith(2, 7);
});
it("não apresenta uma política de sítio anterior após troca rápida com resposta fora de ordem", async () => {
  let resolver!: (politicas: PoliticaElegibilidade[]) => void;
  vi.mocked(listarPoliticas).mockImplementationOnce(() => new Promise(resolve => { resolver = resolve; })).mockResolvedValueOnce([]);
  const { rerender } = render(<ResumoPoliticaReprodutiva propriedadeId={7}/>);
  await waitFor(() => expect(resolver).toBeTypeOf("function"));
  rerender(<ResumoPoliticaReprodutiva propriedadeId={8}/>);
  await screen.findByText(/Nenhuma política vigente neste sítio/);
  await act(async () => resolver([politica]));
  expect(screen.queryByText(/Versão 1/)).toBeNull();
  expect(screen.getByRole("link", { name: "Gerenciar política" }).getAttribute("href")).toContain("sitio=8");
});
