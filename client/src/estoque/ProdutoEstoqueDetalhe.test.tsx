// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProdutoEstoqueDetalhe } from "./ProdutoEstoqueDetalhe";
import { obterProdutoEstoque, listarLotesProduto, listarMovimentosProduto, listarOrigensProduto, renomearLoteProduto } from "./api";
import { getUsuario } from "../lib/auth";
import { setPropriedadeAtiva } from "../propriedadeScope";
vi.mock("./api", async (original) => ({ ...(await original<typeof import("./api")>()), obterProdutoEstoque: vi.fn(), listarLotesProduto: vi.fn(), listarMovimentosProduto: vi.fn(), listarOrigensProduto: vi.fn(), renomearLoteProduto: vi.fn() }));
vi.mock("../api/propriedades", () => ({ listarPropriedades: vi.fn().mockResolvedValue([{ id: 1, nome: "Fazenda Rio Novo", ativo: true }, { id: 2, nome: "Sítio Novo", ativo: true }]) }));
vi.mock("../lib/auth", async (original) => ({ ...(await original<typeof import("../lib/auth")>()), getUsuario: vi.fn() }));
vi.mock("./PartidasProduto", () => ({ PartidasProduto: () => <p>Controle avançado</p> }));
const produto = { id: "p", nome: "Ração", unidade: "KG" as const, rastrearPartidas: true, saldo: "25", custoMedio: null, valor: null, propriedadeId: null, totalLotes: 1, lotesComSaldo: 1 };
const lote = { id: "l", nome: "Vence dezembro", codigo: "AUTO", validade: "2026-12-31", saldo: "25", origemRastreio: "INFORMADA" };
beforeEach(() => {
  vi.clearAllMocks(); setPropriedadeAtiva(null); vi.mocked(getUsuario).mockReturnValue(null);
  vi.mocked(obterProdutoEstoque).mockResolvedValue(produto);
  vi.mocked(listarLotesProduto).mockResolvedValue({ itens: [lote], total: 16, pagina: 1, porPagina: 15 });
  vi.mocked(listarMovimentosProduto).mockResolvedValue({ itens: [], total: 0 });
  vi.mocked(listarOrigensProduto).mockResolvedValue({ itens: [], total: 0, pagina: 1, porPagina: 15 });
  vi.mocked(renomearLoteProduto).mockResolvedValue(lote);
});
afterEach(cleanup);
describe("ficha do produto", () => {
  it("monta o resumo consolidado e troca o sítio sem criar estoque", async () => {
    render(<ProdutoEstoqueDetalhe produtoId="p" />);
    await screen.findByText("Saldo consolidado");
    expect(screen.getByText("25 KG")).toBeTruthy();
    expect(screen.queryByText(/Custo médio:/)).toBeNull();
    fireEvent.change(screen.getByLabelText("Sítio da ficha"), { target: { value: "2" } });
    await waitFor(() => expect(obterProdutoEstoque).toHaveBeenLastCalledWith("p", 2));
    await screen.findByText("Saldo em Sítio Novo");
  });
  it("pagina lotes e abre origens filtradas por lote", async () => {
    render(<ProdutoEstoqueDetalhe produtoId="p" />); await screen.findByText("Saldo consolidado");
    fireEvent.click(screen.getByRole("tab", { name: "Lotes" }));
    await screen.findByRole("heading", { name: "Vence dezembro" });
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await waitFor(() => expect(listarLotesProduto).toHaveBeenLastCalledWith("p", expect.objectContaining({ pagina: 2 })));
    await screen.findByRole("button", { name: "Ver origens" });
    fireEvent.click(screen.getByRole("button", { name: "Ver origens" }));
    await waitFor(() => expect(listarOrigensProduto).toHaveBeenLastCalledWith("p", expect.objectContaining({ partidaId: "l", pagina: 1 })));
    await screen.findByText("Nenhum recebimento neste escopo.");
  });
  it("renomeia por ação explícita auditada", async () => {
    render(<ProdutoEstoqueDetalhe produtoId="p" />); await screen.findByText("Saldo consolidado");
    fireEvent.click(screen.getByRole("tab", { name: "Lotes" })); await screen.findByRole("heading", { name: "Vence dezembro" });
    fireEvent.click(screen.getByRole("button", { name: "Renomear lote" }));
    fireEvent.change(screen.getByLabelText("Novo nome"), { target: { value: "Lote dezembro" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));
    await waitFor(() => expect(renomearLoteProduto).toHaveBeenCalledWith("l", "Lote dezembro"));
  });
  it("oferece nova tentativa quando a ficha falha", async () => {
    vi.mocked(obterProdutoEstoque).mockRejectedValueOnce(new Error("Não conseguimos carregar."));
    render(<ProdutoEstoqueDetalhe produtoId="p" />);
    fireEvent.click(await screen.findByRole("button", { name: "Tentar novamente" }));
    await screen.findByText("Saldo consolidado");
  });
  it("consulta sem ações e sem custos para acesso de pecuária", async () => {
    vi.mocked(getUsuario).mockReturnValue({ id: 1, nome: "Leitor", email: "leitor@fazenda.test", papel: "OPERADOR", abas: [], areas: ["pecuaria"], flags: [], status: "ATIVO", dono: false });
    render(<ProdutoEstoqueDetalhe produtoId="p" />); await screen.findByText("Saldo consolidado");
    expect(screen.queryByRole("button", { name: "Editar produto" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ajustar quantidade" })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Lotes" })); await screen.findByRole("heading", { name: "Vence dezembro" });
    expect(screen.queryByRole("button", { name: "Renomear lote" })).toBeNull();
  });
  it("liga origens à compra e ao fornecedor quando o Financeiro está permitido", async () => {
    vi.mocked(listarOrigensProduto).mockResolvedValue({ total: 1, pagina: 1, porPagina: 15, itens: [{ id: "e", movimentoId: "e", seq: 1, data: "2026-10-02", propriedadeId: 1, origem: "COMPRA", status: "CONFIRMADO", quantidade: "25", custoUnitario: null, valorTotal: null, fornecedor: "Cooperativa", fornecedorId: "f", operacaoId: "op", operacaoNumero: 5, partidas: [] }] });
    render(<ProdutoEstoqueDetalhe produtoId="p" />); await screen.findByText("Saldo consolidado");
    fireEvent.click(screen.getByRole("tab", { name: "Origens das entradas" }));
    expect((await screen.findByRole("link", { name: "Compra OP-0005" })).getAttribute("href")).toBe("/financeiro/operacoes/op");
    expect(screen.getByRole("link", { name: "Consultar fornecedor" }).getAttribute("href")).toBe("/financeiro/configuracoes?aba=parceiros&parceiroId=f");
  });
});
