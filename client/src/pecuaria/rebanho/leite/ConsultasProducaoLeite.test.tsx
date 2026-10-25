// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConsultasProducaoLeite } from "./ConsultasProducaoLeite";
import { consultarLeite } from "./operacoes-api";
vi.mock("./operacoes-api", () => ({ consultarLeite: vi.fn() }));
vi.mock("../../../propriedadeScope", () => ({ getPropriedadeAtiva: () => 2 }));
const producao = { grupos: [{ periodo: "2026-10", litros: 10, completa: false, turnos: [{ posicaoId: "t", litros: 10 }, { posicaoId: "n", litros: null }] }], ordenhas: [{ posicaoId: "t", nome: "Tarde" }, { posicaoId: "n", nome: "Noturna" }], coberturaCompleta: false, mesEmAndamento: true };
beforeEach(() => { HTMLElement.prototype.scrollIntoView = vi.fn(); HTMLElement.prototype.hasPointerCapture = vi.fn(() => false); HTMLElement.prototype.releasePointerCapture = vi.fn(); vi.mocked(consultarLeite).mockImplementation(async caminho => caminho.startsWith("/custos") ? { consolidado: { situacao: "OCULTO", motivos: [] }, porClassificacao: [] } : producao); });
afterEach(() => { cleanup(); vi.resetAllMocks(); history.replaceState(null, "", "/"); });
it("consulta produção e custos no mesmo recorte com turnos históricos e ausência distinta de zero", async () => {
  history.replaceState(null, "", "/?leiteSecao=producao&producaoData=2026-10-31&producaoVisao=mes");
  render(<ConsultasProducaoLeite podeExportar />);
  await screen.findByRole("table", { name: "Volumes de produção" });
  expect(consultarLeite).toHaveBeenCalledWith(expect.stringContaining("agrupamento=MES"), 2);
  expect(consultarLeite).toHaveBeenCalledWith("/custos?inicio=2026-10-01&fim=2026-10-31", 2);
  expect(screen.getAllByText("Noturna")[0]).toBeTruthy();
  expect(screen.getAllByText("Não informado")[0]).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Exportar/ })).toBeNull();
});
it("cancelar edição de filtros não consulta; aplicar muda os dois recortes e preserva URL externa", async () => {
  history.replaceState(null, "", "/?leiteSecao=producao&producaoData=2026-10-31&producaoVisao=mes");
  render(<ConsultasProducaoLeite />); await screen.findByRole("table");
  const chamadas = vi.mocked(consultarLeite).mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
  fireEvent.change(screen.getByLabelText("Data de produção"), { target: { value: "2026-09-15" } });
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(consultarLeite).toHaveBeenCalledTimes(chamadas);
  fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
  expect((screen.getByLabelText("Data de produção") as HTMLInputElement).value).toBe("2026-10-31");
  fireEvent.change(screen.getByLabelText("Data de produção"), { target: { value: "2026-09-15" } });
  fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
  await waitFor(() => expect(consultarLeite).toHaveBeenCalledWith("/custos?inicio=2026-09-01&fim=2026-09-30", 2));
  expect(location.search).toContain("leiteSecao=producao");
});
it("separa classificação pendente das três naturezas e envia o contrato legado", async () => {
  render(<ConsultasProducaoLeite />); await screen.findByRole("table");
  fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
  fireEvent.click(screen.getByRole("checkbox", { name: /Classificação/ }));
  fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
  await waitFor(() => expect(consultarLeite).toHaveBeenCalledWith(expect.stringContaining("natureza=A_CLASSIFICAR"), 2));
  fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
  fireEvent.click(screen.getByRole("combobox", { name: "Natureza" }));
  expect(screen.queryByRole("option", { name: "A classificar" })).toBeNull();
  fireEvent.click(await screen.findByRole("option", { name: "Descarte" }));
  expect((screen.getByRole("checkbox", { name: /Classificação/ }) as HTMLInputElement).checked).toBe(false);
});
it("pagina os grupos completos sem refazer consulta do servidor", async () => {
  vi.mocked(consultarLeite).mockImplementation(async caminho => caminho.startsWith("/custos") ? { consolidado: { situacao: "OCULTO", motivos: [] } } : { ...producao, grupos: Array.from({ length: 31 }, (_, i) => ({ ...producao.grupos[0], periodo: `2026-10-${String(i + 1).padStart(2, "0")}` })) });
  render(<ConsultasProducaoLeite />); await screen.findByRole("navigation", { name: "Paginação da produção" });
  const chamadas = vi.mocked(consultarLeite).mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
  expect(screen.getByText("16–30 de 31 períodos")).toBeTruthy();
  expect(consultarLeite).toHaveBeenCalledTimes(chamadas);
});
