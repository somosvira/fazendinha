// @vitest-environment jsdom
import { alterarControle } from "../lib/controles.fixture";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ProdutoEstoqueDetalhe } from "./ProdutoEstoqueDetalhe";
import { obterProdutoEstoque, editarProduto, listarLotesProduto, listarMovimentosProduto, listarOrigensProduto, listarProdutos, renomearLoteProduto } from "./api";
import { getUsuario } from "../lib/auth";
import { setPropriedadeAtiva } from "../propriedadeScope";
vi.mock("./api", async (original) => ({ ...(await original<typeof import("./api")>()), obterProdutoEstoque: vi.fn(), editarProduto: vi.fn(), listarProdutos: vi.fn(), listarLotesProduto: vi.fn(), listarMovimentosProduto: vi.fn(), listarOrigensProduto: vi.fn(), renomearLoteProduto: vi.fn() }));
vi.mock("../api/propriedades", () => ({ listarPropriedades: vi.fn().mockResolvedValue([{ id: 1, nome: "Fazenda Rio Novo", ativo: true }, { id: 2, nome: "Sítio Novo", ativo: true }]) }));
vi.mock("../lib/auth", async (original) => ({ ...(await original<typeof import("../lib/auth")>()), getUsuario: vi.fn() }));
vi.mock("../financeiro/FormProduto", async (original) => ({ ...(await original<typeof import("../financeiro/FormProduto")>()), FormProduto: ({ somenteLeitura }: { somenteLeitura?: boolean }) => <div role="dialog" aria-label="Cadastro do produto">{somenteLeitura ? "Cadastro somente leitura" : "Cadastro editável"}</div> }));
vi.mock("./PartidasProduto", () => ({ PartidasProduto: () => <p>Controle avançado</p> }));
const produto = { id: "p", nome: "Ração", unidade: "KG" as const, rastrearPartidas: true, saldo: "25", custoMedio: null, valor: null, propriedadeId: null, totalLotes: 1, lotesComSaldo: 1 };
const lote = { id: "l", nome: "Vence dezembro", codigo: "AUTO", validade: "2026-12-31", saldo: "25", origemRastreio: "INFORMADA" };
beforeEach(() => {
  history.replaceState(null, "", "/estoque/produtos/p");
  vi.clearAllMocks(); setPropriedadeAtiva(null); vi.mocked(getUsuario).mockReturnValue(null);
  vi.mocked(obterProdutoEstoque).mockResolvedValue(produto);
  vi.mocked(listarProdutos).mockResolvedValue([produto]);
  vi.mocked(listarLotesProduto).mockResolvedValue({ itens: [lote], total: 16, pagina: 1, porPagina: 15 });
  vi.mocked(listarMovimentosProduto).mockResolvedValue({ itens: [], total: 0 });
  vi.mocked(listarOrigensProduto).mockResolvedValue({ itens: [], total: 0, pagina: 1, porPagina: 15 });
  vi.mocked(renomearLoteProduto).mockResolvedValue(lote);
});
afterEach(cleanup);
describe("ficha do produto", () => {
  it("produto adotado mostra a origem de cada campo e os princípios ativos; Restaurar envia null e recarrega", async () => {
    const adotado = { ...produto, nome: "Biomox da fazenda", apresentacao: "sachê 100 g", fabricante: { id: "f", nome: "Vetbrands", ativo: true }, classificacaoTecnica: null, produtoCatalogoId: "c1", nomeAlterado: true,
      origemCampos: { nome: "fazenda", apresentacao: "catalogo", fabricante: "fazenda", classificacaoTecnica: "catalogo" } as const,
      principiosAtivos: [{ id: "pa1", nome: "Amoxicilina", ordem: 1 }, { id: "pa2", nome: "Colistina", ordem: 2 }] };
    vi.mocked(obterProdutoEstoque).mockResolvedValueOnce(adotado as never);
    vi.mocked(editarProduto).mockResolvedValue(adotado as never);
    render(<ProdutoEstoqueDetalhe produtoId="p" />);
    const secao = await screen.findByRole("region", { name: "Cadastro do catálogo" });
    expect(within(secao).getByText("Amoxicilina, Colistina")).toBeTruthy();
    expect(Array.from(secao.querySelectorAll("[data-origem]")).map((e) => e.getAttribute("data-origem"))).toEqual(["fazenda", "catalogo", "fazenda", "catalogo"]);
    fireEvent.click(within(secao).getByRole("button", { name: "Restaurar fabricante do catálogo" }));
    await waitFor(() => expect(editarProduto).toHaveBeenCalledWith("p", { fabricanteId: null }));
    await waitFor(() => expect(obterProdutoEstoque).toHaveBeenCalledTimes(2));
  });
  it("produto manual não mostra o bloco do catálogo", async () => {
    render(<ProdutoEstoqueDetalhe produtoId="p" />);
    await screen.findByText("Saldo consolidado");
    expect(screen.queryByRole("region", { name: "Cadastro do catálogo" })).toBeNull();
  });
  it("preserva nome após 403 e bloqueia renomeações concorrentes", async () => {
    let recusar!: (erro: Error) => void;
    vi.mocked(renomearLoteProduto).mockImplementationOnce(() => new Promise((_, reject) => { recusar = reject; }));
    render(<ProdutoEstoqueDetalhe produtoId="p" />);
    await screen.findByText("Saldo consolidado");
    fireEvent.click(screen.getByRole("tab", { name: "Lotes" }));
    await screen.findByRole("table", { name: "Lotes do produto" });
    fireEvent.pointerDown(screen.getAllByRole("button", { name: "Ações do lote Vence dezembro" })[0], { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Renomear lote" }));
    const nome = screen.getByLabelText("Novo nome");
    fireEvent.change(nome, { target: { value: "Lote revisado" } });
    const form = nome.closest("form")!;
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    expect(renomearLoteProduto).toHaveBeenCalledTimes(1);
    await act(async () => { recusar(new Error("Acesso negado (403)")); });
    expect(nome).toHaveProperty("value", "Lote revisado");
    expect(within(screen.getByRole("dialog")).getByRole("alert").textContent).toContain("403");
    fireEvent.submit(form);
    await waitFor(() => expect(renomearLoteProduto).toHaveBeenCalledTimes(2));
  });
  it("monta o resumo consolidado e troca o sítio sem criar estoque", async () => {
    render(<ProdutoEstoqueDetalhe produtoId="p" />);
    await screen.findByText("Saldo consolidado");
    expect(screen.getByText("25 kg")).toBeTruthy();
    expect(screen.queryByText(/Custo médio:/)).toBeNull();
    await alterarControle(screen.getByLabelText("Sítio da ficha"), { target: { value: "2" } });
    await waitFor(() => expect(obterProdutoEstoque).toHaveBeenLastCalledWith("p", 2));
    await screen.findByText("Saldo em Sítio Novo");
  });
  it("pagina lotes e abre origens filtradas por lote", async () => {
    render(<ProdutoEstoqueDetalhe produtoId="p" />); await screen.findByText("Saldo consolidado");
    fireEvent.click(screen.getByRole("tab", { name: "Lotes" }));
    await screen.findByRole("table", { name: "Lotes do produto" });
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await waitFor(() => expect(listarLotesProduto).toHaveBeenLastCalledWith("p", expect.objectContaining({ pagina: 2 })));
    fireEvent.pointerDown((await screen.findAllByRole("button", { name: "Ações do lote Vence dezembro" }))[0], { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Ver origens" }));
    await waitFor(() => expect(listarOrigensProduto).toHaveBeenLastCalledWith("p", expect.objectContaining({ partidaId: "l", pagina: 1 })));
    await screen.findByText("Nenhum recebimento neste escopo.");
  });
  it("renomeia por ação explícita auditada", async () => {
    render(<ProdutoEstoqueDetalhe produtoId="p" />); await screen.findByText("Saldo consolidado");
    fireEvent.click(screen.getByRole("tab", { name: "Lotes" })); await screen.findByRole("table", { name: "Lotes do produto" });
    fireEvent.pointerDown(screen.getAllByRole("button", { name: "Ações do lote Vence dezembro" })[0], { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Renomear lote" }));
    await alterarControle(screen.getByLabelText("Novo nome"), { target: { value: "Lote dezembro" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));
    await waitFor(() => expect(renomearLoteProduto).toHaveBeenCalledWith("l", "Lote dezembro"));
  });
  it("mostra o breadcrumb e preserva origem e estado dos movimentos na tabela", async () => {
    vi.mocked(listarMovimentosProduto).mockResolvedValue({ total: 1, itens: [{ id: "mov", seq: 1, produtoId: "p", produto: "Ração", materialGeneticoId: null, centrosCusto: [], tipo: "SAIDA", origem: "PERDA", status: "REVERTIDO", reversaoDeId: null, data: "2026-10-01", quantidade: 2, custoUnitario: null, valorTotal: null, fornecedor: null, observacao: null, operacaoId: null, operacaoNumero: null, vinculo: null }] });
    render(<ProdutoEstoqueDetalhe produtoId="p" />);
    await screen.findByText("Saldo consolidado");
    expect(within(screen.getByRole("navigation", { name: "Navegação estrutural" })).getByRole("link", { name: "Estoque" }).getAttribute("href")).toBe("/estoque");
    fireEvent.click(screen.getByRole("tab", { name: "Movimentos" }));
    const tabela = within(await screen.findByRole("table", { name: "Movimentos do produto" }));
    expect(tabela.getByText("Estornado")).toBeTruthy();
    expect(tabela.getByText("2 kg")).toBeTruthy();
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
    fireEvent.click(screen.getByRole("tab", { name: "Lotes" })); await screen.findByRole("table", { name: "Lotes do produto" });
    expect(screen.queryByRole("button", { name: "Renomear lote" })).toBeNull();
  });
  it("liga origens à compra e ao fornecedor quando o Financeiro está permitido", async () => {
    vi.mocked(listarOrigensProduto).mockResolvedValue({ total: 1, pagina: 1, porPagina: 15, itens: [{ id: "e", movimentoId: "e", seq: 1, data: "2026-10-02", propriedadeId: 1, origem: "COMPRA", status: "CONFIRMADO", quantidade: "25", custoUnitario: null, valorTotal: null, fornecedor: "Cooperativa", fornecedorId: "f", operacaoId: "op", operacaoNumero: 5, partidas: [] }] });
    render(<ProdutoEstoqueDetalhe produtoId="p" />); await screen.findByText("Saldo consolidado");
    fireEvent.click(screen.getByRole("tab", { name: "Origens das entradas" }));
    expect((await screen.findAllByRole("link", { name: "Compra OP-0005" }))[0].getAttribute("href")).toBe("/financeiro/operacoes/op");
    expect(screen.getAllByRole("link", { name: "Consultar fornecedor" })[0].getAttribute("href")).toBe("/financeiro/configuracoes?aba=parceiros&parceiroId=f");
  });
});

it("recebe lote do produto por link e consulta seus movimentos exatos", async () => {
  history.replaceState(null, "", "/estoque/produtos/p?partidaId=l");
  render(<ProdutoEstoqueDetalhe produtoId="p" />);
  await waitFor(() => expect(listarMovimentosProduto).toHaveBeenCalledWith("p", expect.objectContaining({ partidaId: "l" })));
  history.pushState(null, "", "/estoque/produtos/p?partidaId=outro"); fireEvent.popState(window);
  await waitFor(() => expect(listarMovimentosProduto).toHaveBeenLastCalledWith("p", expect.objectContaining({ partidaId: "outro" })));
});

it("consulta abre cadastro em somente leitura e conserva histórico e saldo", async () => {
  vi.mocked(getUsuario).mockReturnValue({ id: 1, nome: "Leitor", email: "leitor@fazenda.test", papel: "OPERADOR", abas: [], areas: ["pecuaria"], flags: [], status: "ATIVO", dono: false });
  render(<ProdutoEstoqueDetalhe produtoId="p" />);
  await screen.findByText("Saldo consolidado");
  expect(screen.queryByRole("button", { name: "Editar produto" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Consultar cadastro" }));
  expect(await screen.findByText("Cadastro somente leitura")).toBeTruthy();
  expect(screen.queryByText("Cadastro editável")).toBeNull();
  expect(screen.getByText("25 kg")).toBeTruthy();
});
