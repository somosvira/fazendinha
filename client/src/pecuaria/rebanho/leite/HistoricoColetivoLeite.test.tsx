// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HistoricoColetivoLeite } from "./HistoricoColetivoLeite";
import { consultarLeite } from "./operacoes-api";
import type { ConsultaControlesColetivos } from "./historico-types";
vi.mock("./operacoes-api", () => ({ consultarLeite: vi.fn() }));
const vazio: ConsultaControlesColetivos = { propriedadeId: 2, periodo: { inicio: "2024-10-01", fim: "2024-10-31" }, itens: [], total: 0, pagina: 1, tamanho: 20 };
afterEach(cleanup);
beforeEach(() => { vi.resetAllMocks(); vi.mocked(consultarLeite).mockResolvedValue(vazio); });
it("exige sítio selecionado e consulta o mesmo intervalo sem natureza ou agrupamento operacional", async () => {
  const { rerender } = render(<HistoricoColetivoLeite propriedadeId={null} inicio="2024-10-01" fim="2024-10-31" />);
  expect(screen.getByText(/Selecione um sítio/)).toBeTruthy();
  expect(consultarLeite).not.toHaveBeenCalled();
  rerender(<HistoricoColetivoLeite propriedadeId={2} inicio="2024-10-01" fim="2024-10-31" />);
  await screen.findByText("Nenhum agregado histórico no período.");
  expect(consultarLeite).toHaveBeenCalledWith("/controles-historicos/coletivos?inicio=2024-10-01&fim=2024-10-31&pagina=1&tamanho=20", 2);
});
it("pagina no servidor e refaz a consulta ao mudar sítio/período", async () => {
  vi.mocked(consultarLeite).mockResolvedValue({ ...vazio, total: 30 });
  const { rerender } = render(<HistoricoColetivoLeite propriedadeId={2} inicio="2024-10-01" fim="2024-10-31" />);
  fireEvent.click(await screen.findByRole("button", { name: "Próximos agregados" }));
  await waitFor(() => expect(consultarLeite).toHaveBeenCalledWith(expect.stringContaining("pagina=2"), 2));
  rerender(<HistoricoColetivoLeite propriedadeId={3} inicio="2024-09-01" fim="2024-09-30" />);
  await waitFor(() => expect(consultarLeite).toHaveBeenCalledWith("/controles-historicos/coletivos?inicio=2024-09-01&fim=2024-09-30&pagina=1&tamanho=20", 3));
});
it("falha permanece erro com recuperação, sem virar período vazio", async () => {
  vi.mocked(consultarLeite).mockRejectedValueOnce(new Error("Histórico indisponível"));
  render(<HistoricoColetivoLeite propriedadeId={2} inicio="2024-10-01" fim="2024-10-31" />);
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByText("Nenhum agregado histórico no período.")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Consultar agregados novamente" }));
  await screen.findByText("Nenhum agregado histórico no período.");
});

it("ignora resposta anterior após trocar o sítio, sem repor documentos ou paginação antigos", async () => {
  let concluir!: (r: ConsultaControlesColetivos) => void;
  vi.mocked(consultarLeite).mockImplementationOnce(() => new Promise<ConsultaControlesColetivos>(resolve => { concluir = resolve; }));
  const { rerender } = render(<HistoricoColetivoLeite propriedadeId={2} inicio="2024-10-01" fim="2024-10-31" />);
  rerender(<HistoricoColetivoLeite propriedadeId={3} inicio="2024-10-01" fim="2024-10-31" />);
  await screen.findByText("Nenhum agregado histórico no período.");
  await act(async () => { concluir({ ...vazio, total: 50 }); });
  expect(screen.queryByRole("navigation", { name: "Páginas dos agregados históricos" })).toBeNull();
});
