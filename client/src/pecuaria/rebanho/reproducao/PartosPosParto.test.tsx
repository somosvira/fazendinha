// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PartosPosParto } from "./PartosPosParto";
import { reqV4 } from "./api";
import type { PartoRelatorio, SnapshotRelatorioPartos } from "./RelatorioPartos";
vi.mock("./api", () => ({ reqV4: vi.fn() }));
vi.mock("../../../lib/hoje", async original => ({ ...await original<typeof import("../../../lib/hoje")>(), getHoje: () => new Date(2026, 9, 17) }));
function parto(id: string, data: string): PartoRelatorio {
  return { id, data, versao: 1, matriz: { id, brinco: id, nome: null }, ocorridoEm: null, horarioEstimado: false,
    desfecho: "NASCIMENTO", tipo: "NORMAL", induzido: null, dificuldade: null, assistenciaDescricao: null,
    retencaoPlacenta: null, responsavel: null, observacao: null, lancador: null, criadoEm: data,
    ocorrenciasRetencaoPlacenta: [], pesosMatriz: [], escoresMatriz: [], crias: [] };
}
const snapshot: SnapshotRelatorioPartos = { versao: 1, emitidoEm: "2026-10-17", propriedadeId: 7,
  periodo: { inicio: "2026-07-20", fim: "2026-10-17" }, totalPartos: 2,
  partos: [parto("Antiga", "2026-08-01"), parto("Recente", "2026-10-16")] };
beforeEach(() => { vi.resetAllMocks(); window.history.replaceState(null, "", "/pecuaria/reproducao?rotina=partos&visualPartos=tabela"); vi.mocked(reqV4).mockResolvedValue(snapshot); });
afterEach(cleanup);
it("abre os últimos 90 dias por leitura, com partos recentes primeiro e sem emissões", async () => {
  render(<PartosPosParto propriedadeId={7}/>);
  await screen.findAllByText("Recente");
  expect(reqV4).toHaveBeenCalledWith("/reproducao/relatorios/partos?propriedadeId=7&inicio=2026-07-20&fim=2026-10-17", undefined, "GET", 7);
  const linhas = screen.getAllByRole("row");
  expect(linhas[1].textContent).toContain("Recente");
  expect(linhas[2].textContent).toContain("Antiga");
  expect(screen.queryByText(/Emissões|Salvar emissão|Imprimir ficha/)).toBeNull();
  expect(vi.mocked(reqV4).mock.calls.every(([,body]) => body === undefined)).toBe(true);
});
it("permite consultar outro período e preserva filtros na URL", async () => {
  render(<PartosPosParto propriedadeId={7}/>); await screen.findAllByText("Recente");
  fireEvent.click(screen.getByRole("button", { name: /^Período/ }));
  fireEvent.click(screen.getByRole("button", { name: "Período personalizado" }));
  fireEvent.change(screen.getByLabelText("Data inicial"), { target: { value: "2025-01-01" } });
  fireEvent.change(screen.getByLabelText("Data final"), { target: { value: "2025-12-31" } });
  fireEvent.click(screen.getByRole("button", { name: "Aplicar período" }));
  await waitFor(() => expect(reqV4).toHaveBeenLastCalledWith(expect.stringContaining("inicio=2025-01-01&fim=2025-12-31"), undefined, "GET", 7));
  expect(window.location.search).toContain("inicio=2025-01-01");
});
it("não exibe dados antigos após trocar sítio e ignora respostas atrasadas", async () => {
  let resolver!: (s: SnapshotRelatorioPartos) => void;
  vi.mocked(reqV4).mockImplementation(async path => path.includes("propriedadeId=7") ? new Promise(resolve => { resolver = resolve; }) : { ...snapshot, propriedadeId: 8, partos: [], totalPartos: 0 });
  const { rerender } = render(<PartosPosParto propriedadeId={7}/>);
  await waitFor(() => expect(resolver).toBeTypeOf("function"));
  rerender(<PartosPosParto propriedadeId={8}/>);
  await screen.findByText("Nenhum parto neste período.");
  resolver(snapshot);
  await waitFor(() => expect(screen.queryAllByText("Recente")).toHaveLength(0));
});
it("abre detalhes do pós-parto com acesso à ficha da cria sem salvar relatório", async () => {
  vi.mocked(reqV4).mockResolvedValue({ ...snapshot, partos: [{ ...snapshot.partos[1], crias: [{ id: "cria", animalId: "animal-cria", ordem: 1, sexo: "FEMEA", viva: true, filiacaoSnapshot: { brincoInformado: "C-01" }, pesos: [], colostro: [] }] }] });
  render(<PartosPosParto propriedadeId={7}/>);
  const botoes = await screen.findAllByRole("link", { name: "Ver parto" });
  fireEvent.click(botoes[0]);
  expect(window.location.pathname).toBe("/pecuaria/reproducao/partos/Recente");
  expect(new URLSearchParams(window.location.search).get("sitio")).toBe("7");
  expect(new URLSearchParams(window.location.search).get("retorno")).toContain("rotina=partos");
  expect(vi.mocked(reqV4).mock.calls.every(([,body]) => body === undefined)).toBe(true);
});

it("distingue busca vazia de período sem partos e conserva datas ao limpar", async () => {
  render(<PartosPosParto propriedadeId={7}/>); await screen.findAllByText("Recente");
  fireEvent.change(screen.getByRole("searchbox", { name: "Buscar matriz" }), {target:{value:"inexistente"}});
  expect(screen.getByText("Nenhum parto corresponde à busca ou aos filtros.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", {name:"Limpar busca e filtros"}));
  expect(screen.getAllByText("Recente")[0]).toBeTruthy();
  expect(window.location.search).not.toContain("partosBusca");
  expect(vi.mocked(reqV4).mock.calls.every(([,body])=>body===undefined)).toBe(true);
});
