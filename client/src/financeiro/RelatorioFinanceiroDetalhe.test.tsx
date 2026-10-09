// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { RelatorioFinanceiroDetalhe } from "./RelatorioFinanceiroDetalhe";
import { obterRelatorioFinanceiro, salvarPdfRelatorioFinanceiro, type RelatorioFinanceiroDetalhe as Detalhe } from "./novo-api";
import { uid } from "../lib/uid.fixture";

vi.mock("./novo-api", () => ({ obterRelatorioFinanceiro: vi.fn(), salvarPdfRelatorioFinanceiro: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const configuracao = { nome: "Pecuária — agosto", dataInicio: "2026-08-01", dataFim: "2026-08-31", regime: "ambos" as const, tipos: [], status: ["CONFIRMADA"], centroCustoIds: [uid(1)], parceiroIds: [], categoriaIds: [uid(4)], classificacoes: [] };
const detalhe: Detalhe = {
  id: uid(12), nome: "Pecuária — agosto", status: "CONCLUIDO", parametros: configuracao, propriedadeId: 1, propriedade: "Fazenda Rio Novo",
  autor: "Rafael", geradoEm: "2026-09-14T12:00:00Z", concluidoEm: "2026-09-14T12:00:01Z", erro: null,
  snapshot: {
    versao: 1, nome: "Pecuária — agosto", geradoEm: "2026-09-14T12:00:00Z", autor: "Rafael", propriedade: { id: 1, nome: "Fazenda Rio Novo" }, configuracao,
    filtros: { tipos: [], status: ["Confirmada"], centrosCusto: ["Pecuária"], parceiros: [], categorias: ["Benfeitorias (nome da emissão)"], classificacoes: [] },
    gerencial: {
      meta: { geradoEm: "2026-09-14T12:00:00Z", propriedade: { id: 1, nome: "Fazenda Rio Novo" }, periodo: { inicio: "2026-08-01", fim: "2026-08-31" }, regime: "ambos", hoje: "2026-09-14" },
      resumo: { entradas: 0, saidas: 500, resultado: -500, saldoContasFinal: 1000, nLancamentos: 1, aPagar: 0, aReceber: 0 },
      saldoContas: null, entradasSaidas: null, resultado: null, compromissos: null, categorias: { itens: [{ categoria: "Benfeitorias", total: 500, pct: 100 }], centros: [{ centro: "Pecuária", total: 500, pct: 100 }] }, operacoes: [],
      rastreabilidade: { totalLancamentos: 1, estornados: 0, comDocumento: 0, semDocumento: 1, comNotaFiscal: 0, semNotaFiscal: 1, semCentroCusto: 0, mesesFechados: [], mesesAbertos: ["2026-08"] },
    },
    composicao: {
      linhas: [{ operacaoId: uid(7), operacaoNumero: null, data: "2026-08-03", tipo: "COMPRA_ESTOQUE", status: "CONFIRMADA", descricao: "Compra mista", item: "Mourões", quantidade: "50", unidade: "un", parceiro: "Agropecuária Boa Vista", categoriaId: uid(4), categoria: "Benfeitorias", centroCusto: "Pecuária", classificacao: "INVESTIMENTO", valor: "500.00" }],
      totalLinhas: 1, truncado: false,
      porTipo: [{ tipo: "COMPRA_ESTOQUE", rotulo: "Compra para estoque", operacoes: 1, total: "500.00" }],
      despesas: { total: "500.00", custeio: "0.00", investimento: "500.00", semClassificacao: "0.00", porCategoria: [{ nome: "Benfeitorias", total: "500.00", pct: 100, custeio: "0.00", investimento: "500.00", semClassificacao: "0.00" }], porCentro: [{ nome: "Pecuária", total: "500.00", pct: 100 }] },
    },
  },
};

describe("detalhe do relatório emitido", () => {
  it("mostra o recorte congelado e a composição por categoria, centro e item", async () => {
    vi.mocked(obterRelatorioFinanceiro).mockResolvedValue(detalhe);
    render(<RelatorioFinanceiroDetalhe id={uid(12)} podeExportar onVoltar={vi.fn()} />);
    expect(await screen.findByText("Benfeitorias (nome da emissão)")).toBeTruthy();
    expect(screen.getAllByRole("table", { name: "Compras e serviços por categoria" })[0].textContent).toContain("Benfeitorias");
    expect(screen.getAllByRole("table", { name: "Compras e serviços por centro de custo" })[0].textContent).toContain("Pecuária");
    const itens = screen.getAllByRole("table", { name: "Itens das operações" })[0].textContent;
    expect(itens).toContain("Mourões");
    expect(itens).toContain("Investimento");
    expect(screen.getByRole("region", { name: "Leitura de caixa e compromissos" }).textContent).toContain("o saldo das contas nunca é filtrado");
  });

  it("baixa o PDF do relatório concluído", async () => {
    vi.mocked(obterRelatorioFinanceiro).mockResolvedValue(detalhe);
    vi.mocked(salvarPdfRelatorioFinanceiro).mockResolvedValue(undefined);
    render(<RelatorioFinanceiroDetalhe id={uid(12)} podeExportar onVoltar={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /Baixar PDF/ }));
    await waitFor(() => expect(salvarPdfRelatorioFinanceiro).toHaveBeenCalledWith(detalhe));
  });

  it("relatório que falhou mostra o motivo e não oferece download", async () => {
    vi.mocked(obterRelatorioFinanceiro).mockResolvedValue({ ...detalhe, status: "FALHOU", snapshot: null, erro: "Não foi possível montar o relatório. Tente gerar novamente." });
    render(<RelatorioFinanceiroDetalhe id={uid(12)} podeExportar onVoltar={vi.fn()} />);
    expect((await screen.findByRole("alert")).textContent).toContain("Não foi possível montar");
    expect(screen.queryByRole("button", { name: /Baixar PDF/ })).toBeNull();
  });
});


it("pagina os itens salvos sem alterar os totais do snapshot", async () => {
  const snapshot = detalhe.snapshot!;
  const linhas = Array.from({ length: 31 }, (_, i) => ({ ...snapshot.composicao.linhas[0], item: `Item salvo ${i + 1}` }));
  vi.mocked(obterRelatorioFinanceiro).mockResolvedValue({ ...detalhe, snapshot: { ...snapshot, composicao: { ...snapshot.composicao, linhas, totalLinhas: 31 } } });
  render(<RelatorioFinanceiroDetalhe id={uid(12)} podeExportar onVoltar={vi.fn()} />);
  const tabela = within(await screen.findByRole("table", { name: "Itens das operações" }));
  expect(tabela.getAllByRole("row")).toHaveLength(16);
  expect(tabela.queryByText("Item salvo 16")).toBeNull();
  fireEvent.click(within(screen.getByRole("navigation", { name: "Paginação dos itens do relatório" })).getByRole("button", { name: "Próxima" }));
  expect(tabela.getByText("Item salvo 16")).toBeTruthy();
  expect(tabela.queryByText("Item salvo 1")).toBeNull();
  expect(screen.getByText("Compras e serviços").parentElement?.textContent).toContain("500,00");
});
