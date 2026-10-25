// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { ConsultasComerciaisLeite } from "./ConsultasComerciaisLeite";
import { consultarLeite } from "./operacoes-api";
vi.mock("./operacoes-api", () => ({ consultarLeite: vi.fn() }));
vi.mock("../../../propriedadeScope", () => ({ getPropriedadeAtiva: () => 2 }));
afterEach(() => { cleanup(); vi.resetAllMocks(); history.replaceState(null, "", "/"); });
it("coleta usa data própria e deixa operação/qualidade acessíveis sem preço", async () => {
  history.replaceState(null, "", "/?leiteSecao=coletas&coletasDe=2026-10-31&coletasAte=2026-10-31");
  vi.mocked(consultarLeite).mockImplementation(async caminho => caminho.includes("cadastros") ? { parceiros: [] } : { itens: [{ id: "r", comercialId: "o", data: "2026-10-31", inicio: "2026-10-01", fim: "2026-11-01", parceiroNome: "Laticínio", quantidadeLitros: "10", situacao: "PRECO_PENDENTE", referencia: "Coleta" }], total: 1, porPagina: 20 });
  render(<ConsultasComerciaisLeite tipo="coletas" />);
  await screen.findByRole("table", { name: "Coletas pela data real" });
  expect(consultarLeite).toHaveBeenCalledWith("/comercial/consultas/coletas?de=2026-10-31&ate=2026-10-31&pagina=1", 2);
  expect(within(screen.getByRole("table")).getByRole("link", { name: "Abrir operação e coletas" }).getAttribute("href")).toContain("operacaoLeiteId=o");
  expect(location.search).toContain("leiteSecao=coletas");
});
it("venda mostra volume sem valores e consulta diretamente sem abrir coleta", async () => {
  vi.mocked(consultarLeite).mockImplementation(async caminho => caminho.includes("cadastros") ? { parceiros: [] } : { itens: [{ id: "o", comercialId: "o", inicio: "2026-10-01", fim: "2026-10-31", parceiroNome: "Laticínio", fechamento: { volumeReconhecido: "10", valorTotal: null, precoUnitario: null, amostras: [] } }], total: 1, porPagina: 20 });
  render(<ConsultasComerciaisLeite tipo="vendas" />);
  await screen.findByRole("table", { name: "Vendas pelo período comercial" });
  expect(screen.getByText("Vendas pelo período comercial")).toBeTruthy();
  expect(consultarLeite).toHaveBeenCalledWith(expect.stringContaining("/comercial/consultas/vendas?"), 2);
});

it("aplica busca no servidor antes de paginar as coletas", async () => {
  vi.mocked(consultarLeite).mockImplementation(async caminho => caminho.includes("cadastros") ? { parceiros: [] } : { itens: [], total: 21, porPagina: 20 });
  render(<ConsultasComerciaisLeite tipo="coletas" />);
  await screen.findByRole("table", { name: "Coletas pela data real" });
  fireEvent.change(screen.getByRole("searchbox", { name: "Buscar comprador, coleta ou romaneio" }), { target: { value: "Romaneio 9" } });
  await waitFor(() => expect(consultarLeite).toHaveBeenCalledWith(expect.stringContaining("busca=Romaneio+9"), 2));
  fireEvent.click(await screen.findByRole("button", { name: "Próxima" }));
  await waitFor(() => expect(consultarLeite).toHaveBeenCalledWith(expect.stringContaining("pagina=2&busca=Romaneio+9"), 2));
});
